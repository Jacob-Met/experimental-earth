import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { makeExample, validateProject, compare } from '../core.js';
import { requireChromiumSandbox } from './support/chromium-sandbox.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.EARTH_WATER_CSV_BROWSER_OUTPUT;
assert.ok(out, 'Set a fresh EARTH_WATER_CSV_BROWSER_OUTPUT');
await mkdir(out, { recursive: false });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = { state: 'running', groups: [], errors: [], failedAssets: [], externalRequests: [], sourceBindings: {}, workerRequests: 0 };
const pendingBodies = [];
let server, browser, url, workerGate = null;

function parseCsv(csv) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; ++i) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { field += c; ++i; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') { assert.equal(field, ''); quoted = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r' && csv[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; ++i; }
    else field += c;
  }
  assert.equal(quoted, false); assert.deepEqual(row, []); assert.equal(field, ''); return rows;
}
function verifyCsv(bytes, projectBytes, project) {
  const csv = bytes.toString('utf8'), rows = parseCsv(csv), original = compare(project);
  assert.deepEqual(Buffer.from(csv), bytes, 'CSV is valid UTF8 without replacement');
  assert.deepEqual(rows[0], ['project_title_json', 'project_input_digest', 'model_minute', 'existing_stored_litres', 'proposed_stored_litres', 'proposed_minus_existing_litres']);
  assert.equal(rows.length, original.existing.snapshots.length + 1);
  for (let i = 0; i < original.existing.snapshots.length; ++i) {
    const a = original.existing.snapshots[i], b = original.proposal.snapshots[i], row = rows[i + 1];
    assert.equal(row.length, 6); assert.equal(JSON.parse(row[0]), project.title);
    assert.equal(row[0][0], '"', 'Untrusted title stays a literal string after CSV decoding');
    assert.equal(row[1], 'sha256:' + sha(projectBytes));
    for (const [column, value] of [a.minute, a.storedLiters, b.storedLiters, b.storedLiters - a.storedLiters].entries()) {
      assert.ok(Object.is(Number(row[column + 2]), value), 'Original scalar at row ' + i + ', column ' + column);
      assert.equal(row[column + 2], Object.is(value, -0) ? '-0' : String(value));
    }
  }
  return { rows: rows.length - 1, csvSha256: sha(bytes), inputSha256: sha(projectBytes), positiveChanges: rows.slice(1).filter(row => Number(row[5]) > 0).length, negativeChanges: rows.slice(1).filter(row => Number(row[5]) < 0).length };
}
async function serve() {
  const log = await open(join(out, 'server.log'), 'wx');
  try { server = spawn('python3', ['serve.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', log.fd], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }); }
  catch (error) { await log.close(); throw error; }
  const started = new Promise((resolve, reject) => {
    let value = ''; const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(Error('Server exited during startup: ' + code)); });
    server.stdout.on('data', chunk => { value += chunk; const match = value.match(/http:\/\/127\.0\.0\.1:\d+\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
  const [address] = await Promise.all([started, log.close()]); return address;
}
async function ready(page, project) {
  await page.waitForFunction(expected => {
    const canonical = x => x && typeof x === 'object' ? Array.isArray(x) ? x.map(canonical) : Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
    return document.querySelector('#rain-comparison-status')?.dataset.state === 'ready' &&
      !document.querySelector('#export-water-history-csv')?.disabled &&
      JSON.stringify(canonical(JSON.parse(localStorage.getItem('experimental-earth-site-v1')))) === JSON.stringify(canonical(expected));
  }, project, { timeout: 20000 });
}
async function boot(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__waterCsvClicks = 0;
    document.addEventListener('click', event => {
      if (event.target.closest?.('a[download="experimental-earth-water-history.csv"]')) ++window.__waterCsvClicks;
    }, true);
  });
  await context.route('**/*', route => {
    const address = route.request().url();
    if (address.startsWith(url) || address.startsWith('data:') || address.startsWith('blob:')) {
      if (new URL(address).pathname.endsWith('/rain-comparison-worker.js')) {
        ++receipt.workerRequests;
        if (workerGate) {
          const gate = workerGate; gate.started();
          const resumed = gate.held.then(() => route.continue()).catch(error => receipt.errors.push('Held original worker request: ' + error));
          gate.pending.push(resumed); return resumed;
        }
      }
      return route.continue();
    }
    receipt.externalRequests.push(address); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => receipt.errors.push(String(error)));
  page.on('response', response => {
    const address = new URL(response.url());
    if (response.status() >= 400 && !address.pathname.endsWith('favicon.ico')) receipt.failedAssets.push({ url: address.href, status: response.status() });
    if (response.ok() && /\.(?:m?js|css)$/.test(address.pathname)) pendingBodies.push(response.body().then(async bytes => {
      const path = decodeURIComponent(address.pathname).slice(1); assert.deepEqual(bytes, await readFile(join(root, path)), 'Served original ' + path); receipt.sourceBindings[path] = sha(bytes);
    }).catch(error => receipt.errors.push('Served source binding: ' + error)));
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(page, makeExample()); return page;
}
function fixture(kind) {
  const project = makeExample(); project.title = kind === 'ordinary' ? '=SUM(A1), "courtyard"\n雨 🌱' : 'Original CSV / ' + kind;
  if (kind === 'dry') project.weather.rainMmHr = 0;
  if (kind === 'large') {
    project.width = project.height = 24; project.selectedIndex = 0; project.observations = [];
    project.existing = Array.from({ length: 576 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'Authored maximum CSV control' }));
    project.proposal = project.existing.map(cell => ({ ...cell, surface: 'garden' }));
    Object.assign(project.weather, { rainMmHr: 250, stormMinutes: 720, durationMinutes: 720, stepMinutes: 1, cellSizeM: 100, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  }
  if (kind === 'fractional') Object.assign(project.weather, { durationMinutes: 5.5, stormMinutes: 2.5, stepMinutes: 2 });
  return validateProject(project);
}
async function importProject(page, project, name) {
  await page.locator('#import').setInputFiles({ name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await ready(page, project);
}
async function download(page, selector, name, keyboard = false) {
  const promise = page.waitForEvent('download'), button = page.locator(selector);
  if (keyboard) { await button.focus(); await button.press('Enter'); } else await button.click();
  const file = await promise, path = join(out, name); await file.saveAs(path);
  return { path, bytes: await readFile(path), suggestedFilename: file.suggestedFilename() };
}
const state = page => page.evaluate(() => ({
  original: localStorage.getItem('experimental-earth-site-v1'),
  generation: document.querySelector('#rain-comparison-status').dataset.generation,
  selected: document.querySelector('#water-history-snapshot').value,
  values: ['existing', 'proposed', 'change'].map(key => document.querySelector('#water-history-' + key).textContent),
  csvClicks: window.__waterCsvClicks,
}));
async function holdDigest(page) {
  await page.evaluate(() => {
    const original = crypto.subtle.digest;
    window.__waterDigestCalls = 0; window.__waterDigestStarted = false;
    window.__restoreWaterDigest = () => { crypto.subtle.digest = original; };
    crypto.subtle.digest = function (...args) {
      ++window.__waterDigestCalls; window.__waterDigestStarted = true;
      return new Promise((resolve, reject) => {
        window.__releaseWaterDigest = () => original.apply(this, args).then(resolve, reject);
      });
    };
  });
}
async function releaseDigest(page) {
  await page.evaluate(async () => {
    window.__restoreWaterDigest(); await window.__releaseWaterDigest();
    await Promise.resolve(); await Promise.resolve(); await new Promise(requestAnimationFrame);
  });
}
async function receive(page, project, name, keyboard = true) {
  const before = await state(page), workers = receipt.workerRequests;
  const input = await download(page, '#export', name + '-input.json');
  const csv = await download(page, '#export-water-history-csv', name + '.csv', keyboard);
  assert.equal(csv.suggestedFilename, 'experimental-earth-water-history.csv');
  assert.deepEqual(JSON.parse(input.bytes), project);
  const evidence = verifyCsv(csv.bytes, input.bytes, project), after = await state(page);
  for (const key of ['original', 'generation', 'selected', 'values']) assert.deepEqual(after[key], before[key]);
  assert.equal(receipt.workerRequests, workers, 'CSV export does not request another solve');
  return { input, csv, evidence };
}

try {
  url = await serve(); browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, chromiumSandbox: true, args: ['--allow-chrome-scheme-url'] });
  const sandboxPage = await browser.newPage(), cdp = await sandboxPage.context().newCDPSession(sandboxPage);
  receipt.sandbox = await requireChromiumSandbox({ send: (method, params) => cdp.send(method, params) }); await sandboxPage.close();
  const page = await boot(), tradeoffBytes = await readFile(join(root, 'tests/fixtures/water-history-tradeoff.json'));
  assert.equal(sha(tradeoffBytes), '55ad7f905ad1e81e4daec885effb7e297830f1d47db1835f7a251b5781e93bb8');
  const tradeoff = validateProject(JSON.parse(tradeoffBytes)); let tradeoffFiles;
  for (const [kind, width] of [['ordinary', 1440], ['dry', 390], ['large', 390], ['fractional', 1440], ['tradeoff', 390]]) {
    const project = kind === 'tradeoff' ? tradeoff : fixture(kind);
    await page.setViewportSize({ width, height: 1000 }); await importProject(page, project, kind);
    await page.locator('#water-history-snapshot').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    const received = await receive(page, project, kind);
    if (kind === 'tradeoff') {
      assert.ok(received.evidence.positiveChanges > 0 && received.evidence.negativeChanges > 0); tradeoffFiles = received;
    }
    const geometry = await page.locator('#water-history-export').evaluate(panel => {
      const box = panel.getBoundingClientRect(), failures = [];
      for (const el of panel.querySelectorAll('p,button')) {
        const r = el.getBoundingClientRect(); if (r.left < box.left - .1 || r.right > box.right + .1 || el.scrollWidth > el.clientWidth + 1) failures.push(el.id);
      }
      return { failures, width: box.width, viewport: document.documentElement.clientWidth, pageWidth: document.documentElement.scrollWidth };
    });
    assert.deepEqual(geometry.failures, []); assert.ok(geometry.pageWidth <= geometry.viewport + 1);
    if (kind === 'ordinary' || kind === 'tradeoff') await page.locator('#water-history-values').screenshot({ path: join(out, kind + '-' + width + '.png') });
    receipt.groups.push({ name: 'Original complete CSV / ' + kind, width, ...received.evidence, geometry, originalInputUnchanged: true, noNewSolver: true, nativeEnterDownload: true });
  }

  await holdDigest(page); const beforeDeferred = await state(page);
  await page.locator('#export-water-history-csv').click(); await page.waitForFunction(() => window.__waterDigestStarted);
  assert.equal(await page.locator('#export-water-history-csv').isDisabled(), true);
  await page.locator('#export-water-history-csv').evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(await page.evaluate(() => window.__waterDigestCalls), 1);
  const newer = fixture('fractional'); newer.title = 'New source after old digest began'; await importProject(page, newer, 'newer-than-digest');
  await releaseDigest(page); assert.equal((await state(page)).csvClicks, beforeDeferred.csvClicks);
  const receivedNewer = await receive(page, newer, 'newer-completed');
  receipt.groups.push({ name: 'Busy synthetic second click does not duplicate work; an old digest cannot download after a newer completed input', ...receivedNewer.evidence });

  const large = fixture('large'); await importProject(page, large, 'before-pending');
  let release, started; const held = new Promise(resolve => { release = resolve; }), requested = new Promise(resolve => { started = resolve; });
  const gate = { held, release, started, pending: [] }; workerGate = gate;
  const pending = structuredClone(large); pending.title = 'Pending changed input'; pending.weather.durationMinutes = pending.weather.stormMinutes = 719;
  const beforePending = await state(page);
  await page.locator('#import').setInputFiles({ name: 'pending.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pending)) });
  await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(Error('Worker request was not held')), 10000))]);
  await page.waitForFunction(() => document.querySelector('#rain-comparison-status').dataset.state === 'pending');
  assert.equal(await page.locator('#export-water-history-csv').isDisabled(), true);
  await page.locator('#export-water-history-csv').evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal((await state(page)).csvClicks, beforePending.csvClicks);
  workerGate = null; release(); await Promise.all(gate.pending); await ready(page, pending);
  const pendingFiles = await receive(page, pending, 'after-pending');
  receipt.groups.push({ name: 'Pending changed comparison refuses CSV and a completed replacement downloads only its own720 snapshots', ...pendingFiles.evidence });

  await page.evaluate(() => {
    const original = crypto.subtle.digest; window.__restoreWaterDigest = () => { crypto.subtle.digest = original; };
    crypto.subtle.digest = () => Promise.reject(new Error('Authored digest failure'));
  });
  const beforeFailure = await state(page); await page.locator('#export-water-history-csv').click();
  await page.waitForFunction(() => document.querySelector('#water-history-export-status').textContent.includes('Authored digest failure'));
  assert.equal(await page.locator('#export-water-history-csv').isDisabled(), false);
  assert.equal((await state(page)).csvClicks, beforeFailure.csvClicks);
  await page.evaluate(() => window.__restoreWaterDigest());
  const retry = await receive(page, pending, 'after-hash-failure'); assert.deepEqual(retry.csv.bytes, pendingFiles.csv.bytes);
  receipt.groups.push({ name: 'Actual digest rejection publishes no file and an explicit retry preserves original complete bytes', ...retry.evidence });

  await holdDigest(page); const beforeHide = await state(page);
  await page.locator('#export-water-history-csv').click(); await page.waitForFunction(() => window.__waterDigestStarted);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await releaseDigest(page); assert.equal((await state(page)).csvClicks, beforeHide.csvClicks);
  assert.equal(await page.locator('#export-water-history-csv').isDisabled(), false);
  const afterHide = await receive(page, pending, 'after-pagehide'); assert.deepEqual(afterHide.csv.bytes, pendingFiles.csv.bytes);
  receipt.groups.push({ name: 'Explicit persisted-pagehide event retires the held digest and leaves an explicit fresh download usable', qualification: 'PageTransitionEvent dispatch tests the lifetime boundary; this is not a real BFCache admission claim.' });

  const fresh = await boot(390); await fresh.locator('#import').setInputFiles(tradeoffFiles.input.path); await ready(fresh, tradeoff);
  const reopened = await receive(fresh, tradeoff, 'fresh-original-reopen');
  assert.deepEqual(reopened.input.bytes, tradeoffFiles.input.bytes); assert.deepEqual(reopened.csv.bytes, tradeoffFiles.csv.bytes);
  receipt.groups.push({ name: 'Actual original project download reopens in a fresh390px context with byte-identical complete CSV', ...reopened.evidence, fixtureOriginalSha256: sha(tradeoffBytes) });

  await Promise.all(pendingBodies); assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []); assert.deepEqual(receipt.externalRequests, []);
  for (const path of ['app.js', 'styles.css', 'water-history-values.js', 'water-history-csv.js']) assert.equal(receipt.sourceBindings[path], sha(await readFile(join(root, path))));
  receipt.state = 'passed';
} catch (error) { receipt.state = 'failed'; receipt.error = error.stack; throw error; }
finally {
  if (workerGate) { const gate = workerGate; workerGate = null; gate.release(); await Promise.all(gate.pending); }
  await Promise.all(pendingBodies); await writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser?.close();
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve)); server.kill('SIGTERM'); await exited;
  }
}
console.log(JSON.stringify({ state: receipt.state, groups: receipt.groups.length, servedFiles: Object.keys(receipt.sourceBindings).length }));

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
const out = process.env.EARTH_WATER_VALUES_BROWSER_OUTPUT;
assert.ok(out, 'Set a fresh EARTH_WATER_VALUES_BROWSER_OUTPUT');
await mkdir(out, { recursive: false });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = { state: 'running', groups: [], errors: [], failedAssets: [], externalRequests: [], sourceBindings: {}, workerRequests: 0, retiredGateErrors: [] };
const pendingBodies = [], contexts = [];
let server, browser, url, workerGate = null, failNextWorker = false;

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
      document.querySelector('#water-history-values')?.dataset.state === 'ready' &&
      JSON.stringify(canonical(JSON.parse(localStorage.getItem('experimental-earth-site-v1')))) === JSON.stringify(canonical(expected));
  }, project, { timeout: 20000 });
}

async function boot(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true }); contexts.push(context);
  await context.route('**/*', route => {
    const address = route.request().url();
    if (address.startsWith(url) || address.startsWith('data:') || address.startsWith('blob:')) {
      if (new URL(address).pathname.endsWith('/rain-comparison-worker.js')) {
        ++receipt.workerRequests;
        if (failNextWorker) { failNextWorker = false; return route.abort('failed'); }
        if (workerGate) {
          const gate = workerGate; gate.started();
          const resumed = gate.held.then(() => route.continue()).catch(error => {
            if (gate.retired) receipt.retiredGateErrors.push(String(error));
            else receipt.errors.push('Held worker request: ' + error);
          });
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
      const path = decodeURIComponent(address.pathname).slice(1), original = await readFile(join(root, path));
      assert.deepEqual(bytes, original, 'Served original ' + path);
      receipt.sourceBindings[path] = sha(bytes);
    }).catch(error => { receipt.errors.push('Served source binding: ' + error); }));
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await ready(page, makeExample()); return page;
}

function fixture(kind) {
  const project = makeExample(); project.title = 'Original water / ' + kind + ' <source> & comparison';
  if (kind === 'dry') project.weather.rainMmHr = 0;
  if (kind === 'positive') [project.existing, project.proposal] = [project.proposal, project.existing];
  if (kind === 'large') {
    project.width = project.height = 24; project.selectedIndex = 0; project.observations = [];
    project.existing = Array.from({ length: 576 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'Authored retained-water maximum control' }));
    project.proposal = project.existing.map(cell => ({ ...cell, surface: 'garden' }));
    Object.assign(project.weather, { rainMmHr: 250, stormMinutes: 720, durationMinutes: 720, stepMinutes: 1, cellSizeM: 100, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  }
  if (kind === 'fractional') Object.assign(project.weather, { durationMinutes: 5.5, stormMinutes: 2.5, stepMinutes: 2 });
  return validateProject(project);
}

// Independent consumer oracle: direct maintained comparison, no view helper import.
function expectedRows(project) {
  const original = compare(project);
  const text = value => value === 0 && 1 / value === -Infinity ? '-0' : String(value);
  return original.existing.snapshots.map((sample, i) => {
    const other = original.proposal.snapshots[i]; assert.equal(other.minute, sample.minute);
    const difference = other.storedLiters - sample.storedLiters;
    return { minute: text(sample.minute) + ' min', existing: text(sample.storedLiters), proposed: text(other.storedLiters), change: (difference > 0 ? '+' : '') + text(difference) };
  });
}
async function importProject(page, project, name) {
  await page.locator('#import').setInputFiles({ name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await ready(page, project);
}
const observe = page => page.evaluate(() => {
  const get = id => document.querySelector('#water-history-' + id);
  return {
    index: Number(get('snapshot').value), maximum: Number(get('snapshot').max), disabled: get('snapshot').disabled,
    minute: get('minute').textContent, existing: get('existing').textContent, proposed: get('proposed').textContent, change: get('change').textContent,
    source: get('source').textContent, caption: get('caption').textContent, valueText: get('snapshot').getAttribute('aria-valuetext'),
    state: get('values').dataset.state, position: get('position').textContent, status: get('status').textContent,
    previousDisabled: get('previous').disabled, nextDisabled: get('next').disabled,
    generation: document.querySelector('#rain-comparison-status').dataset.generation,
    original: localStorage.getItem('experimental-earth-site-v1'),
    paths: [...document.querySelectorAll('#chart path')].map(path => path.getAttribute('d')),
  };
});
async function assertSelection(page, project, index, expected = expectedRows(project)) {
  const observed = await observe(page), row = expected[index];
  for (const key of ['minute', 'existing', 'proposed', 'change']) assert.equal(observed[key], row[key], key + ' at original index ' + index);
  assert.equal(observed.index, index); assert.equal(observed.maximum, expected.length - 1);
  assert.equal(observed.source, 'Completed comparison: ' + project.title);
  assert.equal(observed.caption, 'Whole-site surface water at ' + row.minute);
  assert.equal(observed.valueText, row.minute + `; snapshot ${index + 1} of ${expected.length}`);
  return observed;
}
async function download(page, name) {
  const event = page.waitForEvent('download'); await page.locator('#export').click();
  const file = await event, path = join(out, name + '.json'); await file.saveAs(path);
  return { path, bytes: await readFile(path) };
}
function holdWorker() {
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  const gate = { held, release, started, requested, pending: [], retired: false }; workerGate = gate; return gate;
}
async function pendingImport(page, project, name, gate) {
  await page.locator('#import').setInputFiles({ name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await Promise.race([gate.requested, new Promise((_, reject) => setTimeout(() => reject(Error('Worker request was not held')), 10000))]);
  await page.waitForFunction(() => document.querySelector('#rain-comparison-status').dataset.state === 'pending');
}

try {
  url = await serve();
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, chromiumSandbox: true, args: ['--allow-chrome-scheme-url'] });
  const sandboxPage = await browser.newPage(), cdp = await sandboxPage.context().newCDPSession(sandboxPage);
  receipt.sandbox = await requireChromiumSandbox({ send: (method, params) => cdp.send(method, params) }); await sandboxPage.close();
  const page = await boot();
  for (const kind of ['dry', 'ordinary', 'positive', 'large', 'fractional']) {
    const project = fixture(kind), rows = expectedRows(project);
    await importProject(page, project, kind);
    const beforeDownload = kind === 'ordinary' ? await download(page, 'ordinary-before-selection') : null;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const before = await observe(page), workerCount = receipt.workerRequests;
      // Exercise every actual rendered sample choice, not a duplicate numeric helper.
      const traversal = await page.evaluate(expected => {
        const input = document.querySelector('#water-history-snapshot');
        for (let i = 0; i < expected.length; ++i) {
          input.value = String(i); input.dispatchEvent(new Event('input', { bubbles: true }));
          for (const key of ['minute', 'existing', 'proposed', 'change']) {
            const actual = document.querySelector('#water-history-' + key).textContent;
            if (actual !== expected[i][key]) throw Error(key + ' mismatch at ' + i + ': ' + actual);
          }
        }
        return { samples: expected.length, exact: true };
      }, rows);
      const slider = page.locator('#water-history-snapshot');
      await slider.focus(); await slider.press('Home'); await assertSelection(page, project, 0, rows);
      assert.equal(await page.locator('#water-history-previous').isDisabled(), true);
      await slider.press('ArrowRight'); await assertSelection(page, project, 1, rows);
      await slider.press('End'); await assertSelection(page, project, rows.length - 1, rows);
      assert.equal(await page.locator('#water-history-next').isDisabled(), true);
      await slider.press('ArrowLeft'); await assertSelection(page, project, rows.length - 2, rows);
      await slider.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'water-history-previous');
      await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'water-history-next');
      await page.keyboard.press('Enter'); const observed = await assertSelection(page, project, rows.length - 1, rows);
      assert.equal(observed.original, before.original); assert.equal(observed.generation, before.generation);
      assert.deepEqual(observed.paths, before.paths); assert.equal(receipt.workerRequests, workerCount);
      await page.locator('#water-history-values').scrollIntoViewIfNeeded();
      const geometry = await page.locator('#water-history-values').evaluate(section => {
        const box = section.getBoundingClientRect(), failures = [];
        for (const el of section.querySelectorAll('h3,p,label,output,input,button,span,caption,th,td')) {
          if (getComputedStyle(el).display === 'none') continue;
          const rect = el.getBoundingClientRect();
          if (rect.left < box.left - .1 || rect.right > box.right + .1 || el.scrollWidth > el.clientWidth + 1) failures.push(el.id || el.tagName);
        }
        for (const cell of section.querySelectorAll('td')) {
          const range = document.createRange(); range.selectNodeContents(cell);
          if (range.getClientRects().length !== 1) failures.push('wrapped numeric value: ' + cell.id);
        }
        return { width: box.width, failures, viewport: document.documentElement.clientWidth, pageWidth: document.documentElement.scrollWidth, tableFont: getComputedStyle(section.querySelector('td')).fontSize };
      });
      assert.deepEqual(geometry.failures, [], kind + '/' + width + ' has no clipped controls or values');
      assert.ok(geometry.pageWidth <= geometry.viewport + 1); assert.equal(geometry.tableFont, '13px');
      if (kind === 'large' || kind === 'ordinary') await page.locator('.chart-wrap').screenshot({ path: join(out, kind + '-' + width + '.png') });
      receipt.groups.push({ kind, width, traversal, nativeKeyboardEndpoints: true, sourceAndGenerationUnchanged: true, noNewWorker: true, geometry, final: rows.at(-1) });
    }
    if (beforeDownload) {
      const after = await download(page, 'ordinary-after-selection'); assert.deepEqual(after.bytes, beforeDownload.bytes);
      assert.deepEqual(JSON.parse(after.bytes), project);
      receipt.groups.push({ name: 'View-only selection preserves the actual original export bytes', sha256: sha(after.bytes) });
    }
  }
  const ordinary = fixture('ordinary'); await importProject(page, ordinary, 'minute-retention');
  await page.locator('#water-history-snapshot').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  const sameTimes = structuredClone(ordinary); sameTimes.title = 'Changed source with the same original retained time';
  await importProject(page, sameTimes, 'same-retained-minute'); await assertSelection(page, sameTimes, 1);
  const fractional = fixture('fractional'); await importProject(page, fractional, 'missing-original-minute'); await assertSelection(page, fractional, 3);
  receipt.groups.push({ name: 'Completed replacement retains the exact minute only if it exists, otherwise selects the final original sample' });

  const large = fixture('large'); await importProject(page, large, 'accepted-before-pending');
  await page.locator('#water-history-snapshot').evaluate(input => { input.value = '300'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const accepted = await assertSelection(page, large, 300);
  const next = structuredClone(large); next.title = 'New comparison still computing'; next.weather.durationMinutes = next.weather.stormMinutes = 719;
  const gate = holdWorker(); await pendingImport(page, next, 'pending-next', gate);
  const pending = await observe(page); assert.equal(pending.disabled, true); assert.equal(pending.state, 'unavailable');
  for (const key of ['minute', 'existing', 'proposed', 'change', 'source', 'index']) assert.equal(pending[key], accepted[key]);
  assert.match(pending.status, /last completed/);
  await page.locator('#water-history-snapshot').evaluate(input => { input.value = '0'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await assertSelection(page, large, 300);
  const pendingExport = await download(page, 'pending-new-input'); assert.deepEqual(JSON.parse(pendingExport.bytes), next);
  workerGate = null; gate.release(); await Promise.all(gate.pending); await ready(page, next); await assertSelection(page, next, 300);
  receipt.groups.push({ name: 'Pending comparison keeps the named accepted values, refuses selection and replaces both totals together after acceptance', pendingInputExportSha256: sha(pendingExport.bytes) });

  const superseded = structuredClone(large); superseded.title = 'Superseded pending source'; superseded.weather.rainMmHr = 249;
  const oldGate = holdWorker(); await pendingImport(page, superseded, 'older-pending', oldGate);
  workerGate = null;
  await importProject(page, fractional, 'newer-complete-source'); const newer = await assertSelection(page, fractional, 3);
  oldGate.retired = true; oldGate.release(); await Promise.all(oldGate.pending); await page.waitForLoadState('networkidle');
  const afterOld = await assertSelection(page, fractional, 3); assert.equal(afterOld.generation, newer.generation); assert.equal(afterOld.original, newer.original);
  receipt.groups.push({ name: 'An older held Worker request cannot replace the newer complete source and paired readout' });

  failNextWorker = true;
  await page.locator('#import').setInputFiles({ name: 'worker-failure.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(large)) });
  await page.waitForFunction(() => document.querySelector('#rain-comparison-status').dataset.state === 'failed');
  const failed = await assertSelection(page, fractional, 3); assert.equal(failed.disabled, true); assert.equal(failed.state, 'unavailable');
  await page.locator('#restore-rain-comparison').click(); await ready(page, fractional);
  const restored = await assertSelection(page, fractional, 3); assert.equal(restored.disabled, false);
  receipt.groups.push({ name: 'Actual Worker failure retains completed values and original-project restore re-enables selection' });

  const original = await download(page, 'reopen-original-project'); assert.deepEqual(JSON.parse(original.bytes), fractional);
  const fresh = await boot(390); await fresh.locator('#import').setInputFiles(original.path); await ready(fresh, fractional); await assertSelection(fresh, fractional, 3);
  const reopened = await download(fresh, 'reopened-original-project'); assert.deepEqual(reopened.bytes, original.bytes);
  receipt.groups.push({ name: 'Original input reopens in a fresh390px browser with exact paired values and unchanged export', originalSha256: sha(original.bytes) });
  await Promise.all(pendingBodies);
  assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []); assert.deepEqual(receipt.externalRequests, []);
  for (const path of ['app.js', 'styles.css', 'water-chart.js', 'water-history-values.js']) assert.equal(receipt.sourceBindings[path], sha(await readFile(join(root, path))));
  receipt.state = 'passed';
} catch (error) { receipt.state = 'failed'; receipt.error = error.stack; throw error; }
finally {
  if (workerGate) { const gate = workerGate; workerGate = null; gate.release(); await Promise.all(gate.pending); }
  await Promise.all(pendingBodies);
  await writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser?.close();
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve)); server.kill('SIGTERM'); await exited;
  }
}
console.log(JSON.stringify({ state: receipt.state, groups: receipt.groups.length, exactRenderedSelections: receipt.groups.reduce((n, group) => n + (group.traversal?.samples || 0), 0), servedFiles: Object.keys(receipt.sourceBindings).length }));

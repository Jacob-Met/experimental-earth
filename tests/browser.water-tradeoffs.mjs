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
const out = process.env.EARTH_WATER_TRADEOFF_BROWSER_OUTPUT;
assert.ok(out, 'Set a fresh EARTH_WATER_TRADEOFF_BROWSER_OUTPUT');
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
      document.querySelector('#water-tradeoffs')?.dataset.state === 'ready' &&
      JSON.stringify(canonical(JSON.parse(localStorage.getItem('experimental-earth-site-v1')))) === JSON.stringify(canonical(expected));
  }, project, { timeout: 20000 });
}
async function boot(width = 1440, contract = false) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__waterCsvClicks = 0;
    document.addEventListener('click', event => {
      if (event.target.closest?.('a[download="experimental-earth-water-history.csv"]')) ++window.__waterCsvClicks;
    }, true);
  });
  await context.route('**/*', route => {
    const address = route.request().url();
    if (address === url + '__water-tradeoff-contract') return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><main id="contract"></main>'});
    if (address.startsWith(url) || address.startsWith('data:') || address.startsWith('blob:')) {
      if (new URL(address).pathname.endsWith('/rain-comparison-worker.js')) {
        ++receipt.workerRequests;
        if (workerGate?.abort) return route.abort('failed');
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
  await page.goto(contract ? url + '__water-tradeoff-contract' : url, { waitUntil: 'domcontentloaded' }); if (!contract) await ready(page, makeExample()); return page;
}
function fixture(kind) {
  const project = makeExample(); project.title = kind === 'ordinary' ? '=SUM(A1), "courtyard"\n雨 🌱' : 'Original CSV / ' + kind;
  if (kind === 'dry') project.weather.rainMmHr = 0;
  if (kind === 'positive') [project.existing, project.proposal] = [project.proposal, project.existing];
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

const number = value => Object.is(value, -0) ? '-0' : String(value);
const signed = value => (value > 0 ? '+' : '') + number(value);
function oracle(project) {
  const comparison = compare(project);
  const rows = comparison.existing.snapshots.map((a, i) => {
    const b = comparison.proposal.snapshots[i];
    assert.equal(a.minute, b.minute);
    return { minute: a.minute, existing: a.storedLiters, proposed: b.storedLiters, change: b.storedLiters - a.storedLiters };
  });
  const values = rows.map(row => row.change), high = Math.max(...values), low = Math.min(...values);
  const kind = value => value > 0 ? 'more' : value < 0 ? 'less' : 'equal';
  const starts = [0, ...rows.flatMap((row, i) => i && kind(row.change) !== kind(rows[i - 1].change) ? [i] : [])];
  return {
    rows, more: values.filter(x => x > 0).length, less: values.filter(x => x < 0).length, equal: values.filter(x => x === 0).length,
    increase: high > 0 ? { value: high, indices: values.flatMap((x, i) => x === high ? [i] : []) } : null,
    decrease: low < 0 ? { value: low, indices: values.flatMap((x, i) => x === low ? [i] : []) } : null,
    groups: starts.map((start, i) => ({ sign: kind(values[start]), start, end: (starts[i + 1] ?? rows.length) - 1 })),
  };
}
async function selectedRow(page, row) {
  assert.equal(await page.locator('#water-history-minute').innerText(), number(row.minute) + ' min');
  assert.equal(await page.locator('#water-history-existing').innerText(), number(row.existing));
  assert.equal(await page.locator('#water-history-proposed').innerText(), number(row.proposed));
  assert.equal(await page.locator('#water-history-change').innerText(), signed(row.change));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'water-history-snapshot');
}
async function inspect(page, button, row) {
  await button.focus(); await button.press('Enter'); await selectedRow(page, row);
}
async function receiveTradeoffs(page, project) {
  const expected = oracle(project), before = await state(page), workers = receipt.workerRequests;
  assert.equal(await page.locator('#water-tradeoff-source').innerText(), 'Completed comparison: ' + project.title.replace(/\s+/g, ' '));
  assert.equal(await page.locator('#water-tradeoff-summary').innerText(), `Of ${expected.rows.length} original snapshots: ${expected.more} have more proposed surface water, ${expected.less} have less, and ${expected.equal} have the same amount.`);
  for (const key of ['increase', 'decrease']) {
    const value = expected[key], card = page.locator('[data-extreme="' + key + '"]');
    if (!value) { assert.equal(await card.locator('button, select').count(), 0); continue; }
    assert.equal(await card.locator('.water-tradeoff-value').innerText(), signed(value.value) + ' L');
    if (value.indices.length > 1) {
      assert.deepEqual(await card.locator('option').allTextContents(), value.indices.map(i => number(expected.rows[i].minute) + ' min'));
      for (const tie of [0, value.indices.length - 1]) {
        await card.locator('select').selectOption({ index: tie }); await inspect(page, card.locator('button'), expected.rows[value.indices[tie]]);
      }
    } else await inspect(page, card.locator('button'), expected.rows[value.indices[0]]);
  }
  const details = page.locator('#water-tradeoff-groups');
  if (!await details.evaluate(element => element.open)) await details.locator('summary').click();
  const items = details.locator('li'); assert.equal(await items.count(), expected.groups.length);
  for (const [index, group] of expected.groups.entries()) {
    const item = items.nth(index), first = expected.rows[group.start], last = expected.rows[group.end], count = group.end - group.start + 1;
    assert.equal(await item.getAttribute('data-sign'), group.sign);
    assert.equal(await item.locator('p').first().innerText(), count + (count === 1 ? ' original snapshot at ' : ' consecutive original snapshots, from ') + number(first.minute) + (count === 1 ? ' min.' : ' to ' + number(last.minute) + ' min.'));
    if (index) assert.equal(await item.locator('.mini-note').innerText(), 'Adjacent samples at this boundary: ' + number(expected.rows[group.start - 1].minute) + ' and ' + number(first.minute) + ' min.');
    assert.equal(await item.locator('button').count(), count === 1 ? 1 : 2);
    await inspect(page, item.locator('button').first(), first);
    if (count > 1) await inspect(page, item.locator('button').last(), last);
  }
  const after = await state(page);
  assert.equal(after.original, before.original); assert.equal(after.generation, before.generation); assert.equal(receipt.workerRequests, workers);
  const geometry = await page.locator('#water-tradeoffs').evaluate(section => {
    const failures = [], box = section.getBoundingClientRect();
    for (const element of section.querySelectorAll('button, select, .water-tradeoff-value')) {
      if (!element.getClientRects().length) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left < box.left - 1 || rect.right > box.right + 1 || element.scrollWidth > element.clientWidth + 1) failures.push(element.textContent);
      if (element.matches('.water-tradeoff-value')) { const range = document.createRange(); range.selectNodeContents(element); if (range.getClientRects().length !== 1) failures.push('Wrapped exact difference'); }
    }
    return { width: box.width, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, failures };
  });
  assert.deepEqual(geometry.failures, []); assert(geometry.pageWidth <= geometry.viewport + 1);
  return { rows: expected.rows.length, counts: { more: expected.more, less: expected.less, equal: expected.equal }, groups: expected.groups.length, nativeInspections: true, noSourceEditOrSolver: true, geometry };
}


async function captureUnobscured(page, selector, filename) {
  await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('show'));
  const target = page.locator(selector);
  await target.evaluate(element => element.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' }));
  const geometry = await target.evaluate(element => {
    const box = element.getBoundingClientRect(), failures = []; let controls = 0;
    if (box.top < -1 || box.bottom > innerHeight + 1) failures.push('Capture exceeds viewport');
    for (const control of element.querySelectorAll('button, select, summary')) {
      // Closed native details retain descendant boxes in Chromium; only their summary is visible.
      if (control.closest('details:not([open])') && !control.matches('summary')) continue;
      if (!control.getClientRects().length) continue;
      const rect = control.getBoundingClientRect(), x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
      ++controls;
      if (rect.top < 0 || rect.bottom > innerHeight || !control.contains(document.elementFromPoint(x, y))) failures.push(control.textContent);
    }
    return { top: box.top, bottom: box.bottom, height: box.height, viewportHeight: innerHeight, controls, failures };
  });
  assert.deepEqual(geometry.failures, [], 'Visible capture controls are unobscured by ordinary page overlays');
  await target.screenshot({ path: join(out, filename) });
  (receipt.visuals ??= []).push({ filename, ...geometry });
}

try {
  url = await serve(); browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, chromiumSandbox: true, args: ['--allow-chrome-scheme-url'] });
  const sandboxPage = await browser.newPage(), cdp = await sandboxPage.context().newCDPSession(sandboxPage);
  receipt.sandbox = await requireChromiumSandbox({ send: (method, params) => cdp.send(method, params) }); await sandboxPage.close();
  const page = await boot(), tradeoff = JSON.parse(await readFile(join(root, 'tests/fixtures/water-history-tradeoff.json'), 'utf8'));
  let originalTradeoff;
  for (const [kind, width] of [['ordinary', 1440], ['dry', 390], ['positive', 390], ['tradeoff', 1440], ['tradeoff', 390], ['large', 390], ['fractional', 1440]]) {
    await page.setViewportSize({ width, height: 1000 }); const project = kind === 'tradeoff' ? tradeoff : fixture(kind);
    await importProject(page, project, kind + '-' + width);
    const before = await receive(page, project, kind + '-' + width + '-before');
    const evidence = await receiveTradeoffs(page, project), after = await receive(page, project, kind + '-' + width + '-after');
    assert.deepEqual(after.input.bytes, before.input.bytes); assert.deepEqual(after.csv.bytes, before.csv.bytes);
    if (kind === 'tradeoff') { assert(evidence.counts.more > 0 && evidence.counts.less > 0); originalTradeoff = before; }
    if ((kind === 'ordinary' && width === 1440) || (kind === 'tradeoff' && width === 390)) {
      const groups = page.locator('#water-tradeoff-groups');
      if (await groups.evaluate(element => element.open)) await groups.locator('summary').click();
      await captureUnobscured(page, '#water-tradeoffs', kind + '-' + width + '.png');
      if (width === 390) {
        await groups.locator('summary').click();
        await captureUnobscured(page, '#water-tradeoff-groups', 'tradeoff-groups-390.png');
      }
    }
    receipt.groups.push({ name: 'Whole original course / ' + kind, width, ...evidence, originalInputSha256: before.evidence.inputSha256, csvSha256: before.evidence.csvSha256 });
  }

  await importProject(page, tradeoff, 'old-control-source');
  await page.evaluate(() => { window.retiredTradeoffButton = document.querySelector('#water-tradeoff-extremes button'); });
  const replacement = fixture('ordinary'); replacement.title = 'A newer completed comparison';
  await importProject(page, replacement, 'newer-source'); await page.locator('#water-history-snapshot').focus(); await page.locator('#water-history-snapshot').press('Home');
  const newerState = await state(page); await page.evaluate(() => window.retiredTradeoffButton.click()); assert.deepEqual(await state(page), newerState);
  receipt.groups.push({ name: 'A detached older button cannot select a coincident minute in a newer complete comparison' });

  const large = fixture('large'); large.title = 'Pending original tradeoff source'; large.weather.durationMinutes = large.weather.stormMinutes = 719;
  let released, started; const held = new Promise(resolve => { released = resolve; }), seen = new Promise(resolve => { started = resolve; });
  workerGate = { held, started, release: released, pending: [] };
  const previousState = await state(page), previousSummary = await page.locator('#water-tradeoff-summary').innerText();
  await page.locator('#import').setInputFiles({ name: 'pending.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(large)) }); await seen;
  await page.waitForFunction(() => document.querySelector('#rain-comparison-status').dataset.state === 'pending');
  assert.equal(await page.locator('#water-tradeoffs').getAttribute('data-state'), 'unavailable');
  assert.equal(await page.locator('#water-tradeoff-summary').innerText(), previousSummary);
  assert.equal(await page.locator('#water-tradeoff-source').innerText(), 'Completed comparison: ' + replacement.title);
  assert.equal(await page.locator('#water-tradeoffs button:enabled, #water-tradeoffs select:enabled').count(), 0);
  await page.evaluate(() => document.querySelector('#water-tradeoffs button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal((await state(page)).selected, previousState.selected);
  const gate = workerGate; workerGate = null; gate.release(); await Promise.all(gate.pending); await ready(page, large); await receiveTradeoffs(page, large);
  receipt.groups.push({ name: 'Pending comparison preserves named accepted summary, disables inspection and adopts only the complete replacement' });

  const acceptedState = await state(page), acceptedSummary = await page.locator('#water-tradeoff-summary').innerText();
  const failure = structuredClone(large); failure.title = 'Intentional Worker failure control'; failure.weather.rainMmHr = 249;
  workerGate = { abort: true };
  await page.locator('#import').setInputFiles({ name: 'worker-failure.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(failure)) });
  await page.waitForFunction(() => document.querySelector('#rain-comparison-status').dataset.state === 'failed');
  assert.equal(await page.locator('#water-tradeoffs').getAttribute('data-state'), 'unavailable');
  assert.equal(await page.locator('#water-tradeoff-summary').innerText(), acceptedSummary);
  await page.evaluate(() => document.querySelector('#water-tradeoffs button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal((await state(page)).selected, acceptedState.selected);
  workerGate = null; await importProject(page, large, 'restore-accepted-source'); await receiveTradeoffs(page, large);
  receipt.groups.push({ name: 'Actual Worker load failure keeps completed summary noninteractive; original-source import restores it' });

  const contract = await boot(390, true);
  await contract.evaluate(async () => {
    const { createWaterHistoryValues } = await import('/water-history-values.js'), { createWaterTradeoffs } = await import('/water-tradeoffs.js');
    const root = document.querySelector('#contract'), readout = createWaterHistoryValues(root), view = createWaterTradeoffs(root, minute => readout.selectMinute(minute));
    const times = [0, 1.25, 2.5, 3.75, 5.5];
    const comparison = { existing: { snapshots: times.map(minute => ({ minute, storedLiters: 10 })) }, proposal: { snapshots: times.map((minute, i) => ({ minute, storedLiters: [10, 12, 12, 8, 8][i] })) } };
    readout.update(comparison, 'Authored tied component contract'); view.update(comparison, 'Authored tied component contract'); readout.setAvailable(true); view.setAvailable(true);
    window.tiedWaterContract = { readout, view, comparison };
  });
  const increase = contract.locator('[data-extreme="increase"]'), decrease = contract.locator('[data-extreme="decrease"]');
  assert.deepEqual(await increase.locator('option').allTextContents(), ['1.25 min', '2.5 min']);
  assert.deepEqual(await decrease.locator('option').allTextContents(), ['3.75 min', '5.5 min']);
  await increase.locator('select').selectOption({ index: 1 }); await inspect(contract, increase.locator('button'), { minute: 2.5, existing: 10, proposed: 12, change: 2 });
  await decrease.locator('select').selectOption({ index: 1 }); await inspect(contract, decrease.locator('button'), { minute: 5.5, existing: 10, proposed: 8, change: -2 });
  assert.deepEqual(await contract.evaluate(() => {
    const { readout } = window.tiedWaterContract, before = document.querySelector('#water-history-snapshot').value;
    const answers = [readout.selectMinute(2), readout.selectMinute('2.5'), readout.selectMinute(Infinity)];
    if (document.querySelector('#water-history-snapshot').value !== before) throw Error('Non-original selection changed readout');
    readout.setAvailable(false); answers.push(readout.selectMinute(1.25)); return answers;
  }), [false, false, false, false]);
  receipt.groups.push({ name: 'Isolated authored component contract: all tied fractional times navigate exactly; absent/coerced/nonfinite/unavailable requests refuse', qualification: 'These constructed snapshots exercise the component contract, not an additional maintained-model physical claim.' });

  const fresh = await boot(390); await fresh.locator('#import').setInputFiles(originalTradeoff.input.path); await ready(fresh, tradeoff);
  const reopenedSummary = await receiveTradeoffs(fresh, tradeoff), reopened = await receive(fresh, tradeoff, 'fresh-original-reopen');
  assert.deepEqual(reopened.input.bytes, originalTradeoff.input.bytes); assert.deepEqual(reopened.csv.bytes, originalTradeoff.csv.bytes);
  receipt.groups.push({ name: 'Actual original-project download reopens with the same complete tradeoffs and byte-identical CSV', ...reopenedSummary });
  await Promise.all(pendingBodies); assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []); assert.deepEqual(receipt.externalRequests, []);
  for (const path of ['app.js', 'styles.css', 'water-history-values.js', 'water-tradeoffs.js', 'water-history-csv.js']) assert.equal(receipt.sourceBindings[path], sha(await readFile(join(root, path))));
  receipt.state = 'passed';
} catch (error) { receipt.state = 'failed'; receipt.error = error.stack; throw error; }
finally {
  if (workerGate) { const gate = workerGate; workerGate = null; gate.release?.(); await Promise.all(gate.pending ?? []); }
  await Promise.all(pendingBodies); await writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser?.close();
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve)); server.kill('SIGTERM'); await exited;
  }
}
console.log(JSON.stringify({ state: receipt.state, groups: receipt.groups.length, servedFiles: Object.keys(receipt.sourceBindings).length }));

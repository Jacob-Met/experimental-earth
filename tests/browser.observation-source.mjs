import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.CSV_SOURCE_QA_OUTPUT;
if (!out) throw new Error('Set a fresh CSV_SOURCE_QA_OUTPUT directory');
await mkdir(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = { state: 'running', qualification: 'Authored logger bytes and placement declarations; software receiving only', startedAt: new Date().toISOString(), groups: [], pageErrors: [], failedAssets: [], externalRequests: [] };
const sourcePaths = ['observation-source-file.js', 'observation-import-panel.js', 'tests/observation-source-file.test.mjs', 'tests/browser.observation-source.mjs', 'docs/ORIGINAL_OBSERVATION_SOURCE.md'];
const sourceBefore = await Promise.all(sourcePaths.map(async path => ({ path, sha256: sha(await readFile(join(root, path))) })));
const save = () => writeFile(join(out, 'browser.json'), JSON.stringify(receipt, null, 2) + '\n');
async function group(name, run) {
  const start = performance.now();
  let timer;
  try {
    const evidence = await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Group exceeded 25 seconds: ' + name)), 25000); })]);
    receipt.groups.push({ name, passed: true, seconds: (performance.now() - start) / 1000, ...evidence }); await save();
    console.log('PASS ' + name);
  } finally { clearTimeout(timer); }
}
const original = Buffer.from('\uFEFFstation,minute,depth,uncertainty,unit,source,scenario,use\r\n" east ",30,.3,.1,in,"gauge, α\r\nsecond line",existing,challenge\r\nwest,60,12,1,mm,"operator ""B""",existing,calibration\r\n');
const map = { source: 'Authored placement control', entries: [{ station: 'east', cell: 'B2' }, { station: 'west', cell: 'C3' }] };
const mapText = ' \n' + JSON.stringify(map) + '\n ';
const revisedText = ' \n' + JSON.stringify({ ...map, source: 'Revised explicit placement', entries: [{ station: 'east', cell: 'D2' }, { station: 'west', cell: 'C3' }] }) + '\n ';
let browser, server, base, context, page, fresh, packet, baselineProject;
async function downloaded(p, button, name) {
  const pending = p.waitForEvent('download', { timeout: 8000 });
  await p.locator(button).click();
  const download = await pending;
  const path = join(out, name); await download.saveAs(path);
  assert.equal(await download.failure(), null);
  return readFile(path);
}
function observe(ctx) {
  ctx.on('page', p => {
    p.setDefaultTimeout(8000);
    p.on('pageerror', error => receipt.pageErrors.push(String(error)));
    p.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) receipt.failedAssets.push({ url: response.url(), status: response.status() }); });
  });
}
async function localContext(viewport) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(base) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
    receipt.externalRequests.push(url); return route.abort();
  });
  observe(ctx); return ctx;
}
async function boot(ctx) {
  const p = await ctx.newPage();
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!document.querySelector('#investigation-navigation') && document.querySelector('#observation-table-status')?.textContent.includes('Choose'));
  await p.locator('#observation-station-map').evaluate(node => { node.closest('details').open = true; });
  return p;
}
const observations = p => p.evaluate(() => JSON.parse(localStorage.getItem('experimental-earth-site-v1')).observations);
const uploadSource = (p, buffer, name = 'saved-source.json') => p.locator('#observation-source-file').setInputFiles({ name, mimeType: 'application/json', buffer });
await save();
try {
  server = spawn('python3', ['serve.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  base = await new Promise((resolve, reject) => {
    let text = ''; const timer = setTimeout(() => reject(Error('Server startup timeout')), 10000);
    server.on('error', reject);
    server.stdout.on('data', data => { text += data; const found = text.match(/http:\/\/127\.0\.0\.1:\d+\//); if (found) { clearTimeout(timer); resolve(found[0]); } });
  });
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, executablePath: process.env.CHROME_BINARY || process.env.CHROME_BIN });
  receipt.browserVersion = browser.version();
  context = await localContext({ width: 1360, height: 1000 }); page = await boot(context);
  await group('ordinary CSV intake and actual raw/source downloads preserve every original byte and supplied map', async () => {
    baselineProject = await downloaded(page, '#export', 'baseline-project.json');
    await page.locator('#observation-station-map').fill(mapText);
    await page.locator('#observation-table-file').setInputFiles({ name: 'logger-α.csv', mimeType: 'text/csv', buffer: original });
    await page.waitForFunction(() => document.querySelectorAll('#observation-table-preview li').length === 2);
    assert.equal(await page.locator('input[data-observation-line]:checked').count(), 0);
    assert.equal(await page.locator('#append-observation-table').isDisabled(), true);
    assert.match(await page.locator('#observation-table-preview').innerText(), /Line 4/);
    assert.equal((await observations(page)).length, 0);
    const raw = await downloaded(page, '#download-observation-csv', 'original-before-append.csv');
    assert.deepEqual(raw, original);
    packet = await downloaded(page, '#save-observation-source', 'source-before-append.json');
    const parsed = JSON.parse(packet);
    assert.equal(parsed.table.sha256, sha(original));
    assert.deepEqual(Buffer.from(parsed.table.base64, 'base64'), original);
    assert.equal(parsed.stationMapText, mapText);
    return { originalBytes: original.length, originalSha256: sha(original), sourcePacketSha256: sha(packet), previewRows: 2 };
  });
  await group('corrected mapping requires repreview and keyboard append retains the exact map actually used', async () => {
    await page.locator('#observation-station-map').fill(revisedText);
    assert.equal(await page.locator('#append-observation-table').isDisabled(), true);
    await page.locator('#preview-observation-table').click();
    assert.match(await page.locator('#observation-table-preview').innerText(), /D2, 30 min/);
    assert.equal(await page.locator('input[data-observation-line]:checked').count(), 0);
    await page.locator('#select-all-observation-rows').click();
    await page.locator('#append-observation-table').focus(); await page.keyboard.press('Enter');
    const rows = await observations(page);
    assert.equal(rows.length, 2); assert.equal(rows[0].cellIndex, 11);
    assert.equal(rows[0].tableSource.stationValue, ' east ');
    assert.equal(rows[1].tableSource.line, 4);
    assert.equal(await page.locator('#preview-observation-table').isDisabled(), true);
    await page.locator('#observation-station-map').fill('{"unrelated":"unfinished later edit"}');
    const raw = await downloaded(page, '#download-observation-csv', 'original-after-append.csv');
    assert.deepEqual(raw, original);
    packet = await downloaded(page, '#save-observation-source', 'source-after-append.json');
    assert.equal(JSON.parse(packet).stationMapText, revisedText);
    return { keyboardAppend: true, rows: rows.length, originalRowLines: rows.map(row => row.tableSource.line), retainedPreviewMap: true };
  });
  await group('fresh narrow browser restores original source without adding readings and explicitly previews in the current site', async () => {
    fresh = await localContext({ width: 390, height: 1000 });
    const p = await boot(fresh); fresh.page = p;
    await uploadSource(p, packet);
    await p.waitForFunction(() => document.querySelector('#observation-table-status').textContent.startsWith('Original table and supplied map restored'));
    assert.equal(await p.locator('#observation-station-map').inputValue(), revisedText);
    assert.equal(await p.locator('#append-observation-table').isDisabled(), true);
    assert.equal(await p.locator('#observation-table-preview li').count(), 0);
    assert.equal((await observations(p)).length, 0);
    await p.locator('#preview-observation-table').click();
    assert.match(await p.locator('#observation-table-preview').innerText(), /D2, 30 min/);
    const raw = await downloaded(p, '#download-observation-csv', 'fresh-original.csv');
    assert.deepEqual(raw, original);
    await p.locator('[aria-labelledby=observation-import-title]').scrollIntoViewIfNeeded();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.locator('[aria-labelledby=observation-import-title]').screenshot({ path: join(out, 'source-390.png') });
    await page.locator('[aria-labelledby=observation-import-title]').screenshot({ path: join(out, 'source-desktop.png') });
    return { freshContext: true, explicitPreviewRequired: true, originalSha256: sha(raw), viewport: 390, noHorizontalOverflow: true };
  });
  await group('failed replacement identities, UTF-8 and byte limits preserve accepted original source and notebook', async () => {
    const p = fresh.page, before = await observations(p);
    const wrong = JSON.parse(packet); wrong.table.sha256 = '0'.repeat(64);
    const cases = [
      { saved: true, bytes: Buffer.from(JSON.stringify(wrong)), name: 'wrong.json' },
      { saved: true, bytes: Buffer.alloc(512001, 65), name: 'oversized.json' },
      { saved: false, bytes: Buffer.from([0xc3, 0x28]), name: 'bad-utf8.csv' },
      { saved: false, bytes: Buffer.alloc(128001, 65), name: 'oversized.csv' },
    ];
    for (const [index, item] of cases.entries()) {
      const input = item.saved ? '#observation-source-file' : '#observation-table-file';
      await p.locator(input).setInputFiles({ name: item.name, mimeType: item.saved ? 'application/json' : 'text/csv', buffer: item.bytes });
      await p.waitForFunction(() => document.querySelector('#observation-table-status').textContent.startsWith('Import refused'));
      assert.deepEqual(await observations(p), before);
      assert.equal(await p.locator('#observation-station-map').inputValue(), revisedText);
      assert.deepEqual(await downloaded(p, '#download-observation-csv', 'preserved-' + index + '.csv'), original);
      assert.equal(await p.locator('#append-observation-table').isDisabled(), true);
      assert.equal(await p.locator('#preview-observation-table').isDisabled(), true);
      assert.equal(await p.locator('#observation-table-selected').isHidden(), true);
      await p.evaluate(() => { document.querySelector('#preview-observation-table').click(); document.querySelector('#append-observation-table').click(); });
      assert.deepEqual(await observations(p), before);
    }
    return { refused: cases.length, priorOriginalPreserved: true, notebookUnchanged: true };
  });
  await group('a delayed saved source cannot overwrite a newer station-map edit', async () => {
    const p = fresh.page;
    await p.evaluate(body => {
      const file = new File([body], 'delayed-source.json', { type: 'application/json' });
      file.arrayBuffer = () => new Promise(resolve => { window.releaseSavedSource = () => resolve(new TextEncoder().encode(body).buffer); });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.querySelector('#observation-source-file'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    }, packet.toString());
    const newerMap = '{"source":"newer unsaved placement"}';
    await p.locator('#observation-station-map').fill(newerMap);
    await p.evaluate(() => window.releaseSavedSource());
    await p.waitForFunction(() => document.querySelector('#observation-table-status').textContent.includes('Station map changed while opening'));
    assert.equal(await p.locator('#observation-station-map').inputValue(), newerMap);
    assert.deepEqual(await downloaded(p, '#download-observation-csv', 'preserved-after-late-map.csv'), original);
    return { newerMapPreserved: true, oldOriginalPreserved: true, appendDisabled: await p.locator('#append-observation-table').isDisabled() };
  });
  await group('newest original-file intent wins and a replaced project retires actual late hashing', async () => {
    const p = fresh.page;
    const csv = 'cell,minute,depth,uncertainty,unit,source\nA1,20,2,.1,mm,authored ordering';
    await p.locator('#observation-station-map').fill('');
    await p.evaluate(body => {
      window.pendingOriginals = {};
      for (const name of ['older.csv', 'newest.csv']) {
        const file = new File([body], name, { type: 'text/csv' });
        file.arrayBuffer = () => new Promise(resolve => { window.pendingOriginals[name] = () => resolve(new TextEncoder().encode(body).buffer); });
        const dt = new DataTransfer(); dt.items.add(file);
        const input = document.querySelector('#observation-table-file'); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      window.pendingOriginals['newest.csv']();
    }, csv);
    await p.waitForFunction(() => document.querySelectorAll('#observation-table-preview li').length > 0);
    assert.equal(await p.locator('input[data-observation-line]:checked').count(), 0);
    assert.equal(await p.locator('#append-observation-table').isDisabled(), true);
    await p.locator('#select-all-observation-rows').click();
    await p.evaluate(() => window.pendingOriginals['older.csv']());
    await p.waitForTimeout(80);
    assert.match(await p.locator('#observation-table-selected').innerText(), /newest.csv/);
    await p.evaluate(() => {
      const subtle = crypto.subtle, native = subtle.digest.bind(subtle);
      window.restoreDigest = () => { subtle.digest = native; };
      subtle.digest = (...args) => native(...args).then(result => new Promise(resolve => { window.releaseNativeDigest = () => resolve(result); }));
    });
    await p.locator('#observation-table-file').setInputFiles({ name: 'late-hash.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await p.waitForFunction(() => typeof window.releaseNativeDigest === 'function');
    await p.locator('#import').setInputFiles({ name: 'baseline-project.json', mimeType: 'application/json', buffer: baselineProject });
    await p.waitForFunction(() => document.querySelector('#observation-table-status').textContent.includes('Choose'));
    await p.evaluate(() => { window.restoreDigest(); window.releaseNativeDigest(); delete window.releaseNativeDigest; });
    await p.waitForTimeout(80);
    assert.equal(await p.locator('#preview-observation-table').isDisabled(), true);
    assert.equal(await p.locator('#download-observation-csv').isDisabled(), true);
    assert.equal((await observations(p)).length, 0);
    return { latestFilename: 'newest.csv', actualLateHashRetired: true, originalProjectImportPreserved: true };
  });
  await group('a pending source save is retired by map changes and by actual project replacement', async () => {
    const p = fresh.page;
    await uploadSource(p, packet);
    await p.waitForFunction(() => document.querySelector('#observation-table-status').textContent.startsWith('Original table and supplied map restored'));
    let downloads = 0; p.on('download', () => downloads++);
    for (const action of ['map', 'project']) {
      await p.evaluate(() => {
        const subtle = crypto.subtle, native = subtle.digest.bind(subtle);
        window.restoreDigest = () => { subtle.digest = native; };
        subtle.digest = (...args) => native(...args).then(result => new Promise(resolve => { window.releaseSaveDigest = () => resolve(result); }));
      });
      await p.locator('#save-observation-source').click();
      await p.waitForFunction(() => typeof window.releaseSaveDigest === 'function');
      if (action === 'map') {
        await p.locator('#observation-station-map').fill(mapText);
        assert.equal(await p.locator('#observation-station-map').inputValue(), mapText);
      } else {
        // File input dispatch does not await the application's asynchronous import.
        // Observe a successful project replacement before releasing the stale save.
        assert.equal(await p.locator('#download-observation-csv').isDisabled(), false);
        await p.locator('#import').setInputFiles({ name: 'baseline-project.json', mimeType: 'application/json', buffer: baselineProject });
        await p.waitForFunction(() =>
          document.querySelector('#preview-observation-table').disabled &&
          document.querySelector('#download-observation-csv').disabled &&
          document.querySelector('#observation-table-status').textContent.includes('Choose'));
        assert.deepEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('experimental-earth-site-v1'))), JSON.parse(baselineProject.toString('utf8')));
      }
      console.log('Observed retirement before releasing pending save: ' + action);
      await p.evaluate(() => { window.restoreDigest(); window.releaseSaveDigest(); delete window.releaseSaveDigest; });
      await p.waitForTimeout(100);
      assert.equal(downloads, 0);
    }
    return { retiredSaves: 2, staleDownloads: downloads };
  });
  assert.deepEqual(receipt.pageErrors, []); assert.deepEqual(receipt.failedAssets, []); assert.deepEqual(receipt.externalRequests, []);
  const after = await Promise.all(sourcePaths.map(async path => ({ path, sha256: sha(await readFile(join(root, path))) })));
  assert.deepEqual(after, sourceBefore);
  Object.assign(receipt, { state: 'passed', finishedAt: new Date().toISOString(), source: sourceBefore, sourceChangedDuringRun: [] });
  await save();
} catch (error) {
  receipt.state = 'failed'; receipt.error = String(error.stack || error); await save(); throw error;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
}

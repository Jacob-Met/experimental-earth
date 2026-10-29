import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { makeExample, compare, validateProject } from '../core.js';
import { requireChromiumSandbox } from './support/chromium-sandbox.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const candidateRoot = fileURLToPath(new URL('../', import.meta.url));
const baselineRoot = process.env.EARTH_FORMAT_BASELINE_ROOT, out = process.env.EARTH_FORMAT_BROWSER_OUTPUT;
if (!baselineRoot || !out) throw Error('Set EARTH_FORMAT_BASELINE_ROOT and fresh EARTH_FORMAT_BROWSER_OUTPUT');
await mkdir(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = { state: 'running', startedAt: new Date().toISOString(), qualification: 'Current worker baseline and formatter candidate; exact requested source must be accepted before display parity. Dispatch and accepted-display timings are separate, neither proves paint completion or fleet performance', groups: [], timings: [], pageErrors: [], failedAssets: [], externalRequests: [] };
const sourceFiles = ['app.js', 'ponding-panel.js', 'number-format.js', 'core.js', 'rain-comparison-computation.js', 'rain-comparison-worker.js', 'serve.py', 'tests/support/chromium-sandbox.mjs', 'tests/browser.number-format.mjs'];
const sourceState = () => Promise.all(sourceFiles.map(async path => ({ path, sha256: sha(await readFile(join(candidateRoot, path))) })));
const sourceBefore = await sourceState();
const baselineApp = await readFile(join(baselineRoot, 'app.js'));
assert.equal(sha(baselineApp), '343a35f2fcec45672ce59576415eed1ef4d15c92fb546164e11380e9220667c3');
assert.equal(sha(await readFile(join(baselineRoot, 'ponding-panel.js'))), '65251070078628b10b95482d7f195ab1e0b3c6590eb8cf357a37827b59460a9f');
for (const path of ['core.js', 'rain-comparison-computation.js', 'rain-comparison-worker.js', 'serve.py', 'tests/support/chromium-sandbox.mjs']) {
  assert.deepEqual(await readFile(join(candidateRoot, path)), await readFile(join(baselineRoot, path)), 'Current worker/model/server must be identical: ' + path);
}
const save = () => writeFile(join(out, 'browser.json'), JSON.stringify(receipt, null, 2) + '\n');
let browser; const servers = [], pages = {}, urls = {}, contexts = {}, moduleBodies = [], modules = { baseline: {}, candidate: {} }, moduleMimes = { baseline: {}, candidate: {} };
async function serve(root, label) {
  // Every fresh worker loads model modules again. An unread stderr pipe can
  // fill with HTTP request logs and block the server before it sends headers.
  const log = await open(join(out, label + '-server-stderr.log'), 'wx');
  let child;
  try {
    child = spawn('python3', ['serve.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', log.fd], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  } catch (error) { await log.close(); throw error; }
  servers.push(child);
  const started = new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timer); reject(Error('Server exited during startup: ' + (signal || code))); });
    child.stdout.on('data', data => { output += data; const found = output.match(/http:\/\/127\.0\.0\.1:\d+\//); if (found) { clearTimeout(timer); resolve(found[0]); } });
  });
  // Own the child and its error listener before the first asynchronous close.
  const [url] = await Promise.all([started, log.close()]);
  return url;
}
function fixture(width, height, minutes, step, title) {
  const p = makeExample(); p.width = width; p.height = height; p.selectedIndex = 0; p.title = title;
  p.existing = Array.from({ length: width * height }, (_, i) => ({ elevationM: ((i * 37) % 101) / 1000, surface: i % 4 ? 'sealed' : 'garden', provenance: 'Authored browser responsiveness control' }));
  p.proposal = p.existing.map((cell, i) => ({ ...cell, surface: i % 3 ? cell.surface : 'turf' }));
  Object.assign(p.weather, { durationMinutes: minutes, stormMinutes: minutes / 2, stepMinutes: step });
  return validateProject(p);
}
async function boot(label) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 1100 }, acceptDownloads: true });
  contexts[label] = context;
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(urls[label]) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
    receipt.externalRequests.push(url); return route.abort();
  });
  const page = await context.newPage(); pages[label] = page; page.setDefaultTimeout(10000);
  page.on('pageerror', error => receipt.pageErrors.push({ label, error: String(error) }));
  page.on('response', response => {
    const url = response.url();
    if (response.status() >= 400 && !url.endsWith('/favicon.ico')) receipt.failedAssets.push({ label, url, status: response.status() });
    if (response.ok() && /\.m?js$/.test(new URL(url).pathname)) moduleBodies.push(response.body().then(body => {
      const path = new URL(url).pathname; const digest = sha(body);
      moduleMimes[label][path] = response.headers()['content-type'];
      if (modules[label][path]) assert.equal(modules[label][path], digest); else modules[label][path] = digest;
    }));
  });
  await page.goto(urls[label], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!document.querySelector('#investigation-navigation') && document.querySelectorAll('#existing-grid .cell').length === 48);
  await waitAccepted(page, makeExample());
  return page;
}
async function waitAccepted(page, expected, afterGeneration = -1) {
  await page.waitForFunction(({ expected, afterGeneration }) => {
    const canonical = value => value && typeof value === 'object'
      ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
      : value;
    const status = document.querySelector('#rain-comparison-status');
    const saved = JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
    return status?.dataset.state === 'ready' && Number(status.dataset.generation) > afterGeneration &&
      JSON.stringify(canonical(saved)) === JSON.stringify(canonical(expected));
  }, { expected, afterGeneration });
  assert.deepEqual(await stored(page), expected, 'entire accepted source equals requested input');
}
async function acceptedAction(page, expected, action) {
  const generation = await page.locator('#rain-comparison-status').getAttribute('data-generation');
  await action();
  await waitAccepted(page, expected, Number(generation));
}
async function importProject(page, project, name) {
  await acceptedAction(page, project, () => page.locator('#import').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) }));
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('experimental-earth-site-v1')));
const fingerprint = page => page.evaluate(() => ({
  existing: Array.from(document.querySelectorAll('#existing-grid .cell'), cell => ({ depth: cell.dataset.depthMm, alpha: cell.style.getPropertyValue('--water-alpha'), label: cell.getAttribute('aria-label') })),
  proposal: Array.from(document.querySelectorAll('#proposal-grid .cell'), cell => ({ depth: cell.dataset.depthMm, alpha: cell.style.getPropertyValue('--water-alpha'), label: cell.getAttribute('aria-label') })),
  metrics: document.querySelector('#metrics').textContent, chart: document.querySelector('#chart').innerHTML, balance: document.querySelector('#balance').textContent,
  originalRows: document.querySelector('#observation-list').textContent,
  selection: document.querySelector('#selection').textContent,
  replay: Array.from(document.querySelectorAll('#ponding-existing button, #ponding-proposal button'), cell => ({ text: cell.textContent, label: cell.getAttribute('aria-label'), pressed: cell.getAttribute('aria-pressed') })),
  replayMinute: document.querySelector('#ponding-minute-label').textContent,
  replayDetail: document.querySelector('#ponding-detail').textContent,
}));
async function sameRendered() {
  for (const page of [pages.baseline, pages.candidate]) assert.equal(await page.locator('#rain-comparison-status').getAttribute('data-state'), 'ready', 'never compare obsolete pending DOM');
  const a = await fingerprint(pages.baseline), b = await fingerprint(pages.candidate);
  assert.deepEqual(b, a); return sha(JSON.stringify(b));
}
async function timedChange(page, kind, value) {
  // Measure in the page: acceptedMs includes simulation/transfer/validation/DOM
  // work, but does not claim a paint or exclude shared-host scheduling.
  return page.evaluate(({ kind, value }) => new Promise((resolve, reject) => {
    const expected = JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
    const valid = kind === 'title' || value >= 0;
    if (valid) {
      if (kind === 'title') expected.title = value;
      else expected.weather.rainMmHr = value;
    }
    const canonical = value => value && typeof value === 'object'
      ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
      : value;
    const target = JSON.stringify(canonical(expected));
    const status = document.querySelector('#rain-comparison-status');
    const generation = Number(status.dataset.generation);
    const field = document.querySelector(kind === 'title' ? '#project-title' : '#rain');
    field.value = String(value);
    let dispatchMs, started;
    const finish = () => {
      if (dispatchMs === undefined) return;
      if (status.dataset.state !== 'ready' || (valid && Number(status.dataset.generation) <= generation)) return;
      const saved = JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
      if (JSON.stringify(canonical(saved)) !== target) return;
      observer.disconnect(); clearTimeout(timer);
      resolve({ dispatchMs, acceptedMs: performance.now() - started, expectedProject: expected });
    };
    const observer = new MutationObserver(finish);
    observer.observe(status, { attributes: true });
    const timer = setTimeout(() => {
      observer.disconnect();
      const saved = JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
      const differences = [];
      const walk = (wanted, actual, path = '$') => {
        if (differences.length >= 8 || JSON.stringify(wanted) === JSON.stringify(actual)) return;
        if (!wanted || !actual || typeof wanted !== 'object' || typeof actual !== 'object') {
          differences.push({ path, expected: wanted, saved: actual }); return;
        }
        for (const key of new Set([...Object.keys(wanted), ...Object.keys(actual)])) walk(wanted[key], actual[key], path + '.' + key);
      };
      walk(expected, saved);
      reject(Error('Requested source never reached accepted ready state: ' + JSON.stringify({
        kind, value, previousGeneration: generation, currentGeneration: status.dataset.generation,
        state: status.dataset.state, message: status.textContent,
        saveState: document.querySelector('#project-save-status')?.dataset.saveState,
        saveMessage: document.querySelector('#project-save-status')?.textContent, differences,
      })));
    }, 10000);
    try {
      started = performance.now();
      field.dispatchEvent(new Event('change', { bubbles: true }));
      dispatchMs = performance.now() - started;
      finish();
    } catch (error) { observer.disconnect(); clearTimeout(timer); reject(error); }
  }), { kind, value });
}
async function group(name, run) {
  const started = performance.now(); let timer;
  try {
    const detail = await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Group exceeded45s: ' + name)), 45000); })]);
    receipt.groups.push({ name, passed: true, seconds: (performance.now() - started) / 1000, ...detail });
    await save(); console.log('PASS ' + name);
  } finally { clearTimeout(timer); }
}
async function download(page, name) {
  const pending = page.waitForEvent('download'); await page.locator('#export').click();
  const file = await pending, path = join(out, name); await file.saveAs(path); assert.equal(await file.failure(), null); return readFile(path);
}
await save();
try {
  urls.baseline = await serve(baselineRoot, 'baseline'); urls.candidate = await serve(candidateRoot, 'candidate');
  browser = await chromium.launch({ headless: true, chromiumSandbox: true, args: ['--allow-chrome-scheme-url'], executablePath: process.env.CHROME_BINARY || process.env.CHROME_BIN });
  receipt.browserVersion = browser.version();
  // Match the maintained Chromium launcher: allow the internal status URL,
  // without disabling any sandbox protection. Inspect this same browser.
  let preflightContext;
  receipt.sandbox = { admitted: false, qualification: 'Isolated sandbox preflight has not completed' };
  try {
    preflightContext = await browser.newContext();
    const preflightPage = await preflightContext.newPage();
    const cdp = await preflightContext.newCDPSession(preflightPage);
    receipt.sandbox = await requireChromiumSandbox({ send: (method, params) => cdp.send(method, params) });
    assert.equal(receipt.sandbox.admitted, true);
    assert.equal(receipt.sandbox.moduleSha256, sourceBefore.find(file => file.path === 'tests/support/chromium-sandbox.mjs').sha256);
  } catch (error) {
    receipt.sandbox = error.receipt || { ...receipt.sandbox, admitted: false, failure: { message: String(error.message || error) } };
    throw error;
  } finally {
    try {
      await writeFile(join(out, 'sandbox.json'), JSON.stringify(receipt.sandbox, null, 2) + '\n');
      await save();
    } finally {
      if (preflightContext) await preflightContext.close();
    }
  }
  await boot('baseline'); await boot('candidate');
  const cases = [
    ['courtyard', { ...makeExample(), title: 'Authored courtyard original' }],
    ['medium', fixture(12, 12, 240, 3, 'Authored medium original')],
    ['maximum', fixture(24, 24, 720, 1, 'Authored maximum original')],
  ];
  for (const [name, project] of cases) {
    await group('actual same-input rendering and alternating ordinary edit timings: ' + name, async () => {
      receipt.activeCase = name; await save();
      await importProject(pages.baseline, project, name + '.json'); await importProject(pages.candidate, project, name + '.json');
      const initial = await sameRendered(), reference = compare(project);
      const actual = await pages.candidate.locator('#existing-grid .cell').evaluateAll(cells => cells.map(cell => Number(cell.dataset.depthMm)));
      assert.deepEqual(actual, reference.existing.peakDepthMm);
      for (const kind of ['title', 'rain']) {
        const samples = [];
        for (let i = 0; i < 7; i++) {
          const value = kind === 'title' ? 'Authored notebook edit ' + name + ' ' + i : 40 + i;
          const order = i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'], row = { order: order.join('-then-') };
          for (const label of order) {
            receipt.activeSample = { case: name, kind, iteration: i, label, value }; await save();
            const measured = await timedChange(pages[label], kind, value);
            row[label + 'DispatchMs'] = measured.dispatchMs;
            row[label + 'AcceptedMs'] = measured.acceptedMs;
            row[label + 'AcceptedProjectSha256'] = sha(JSON.stringify(measured.expectedProject));
          }
          const rendered = await sameRendered();
          if (kind === 'title') assert.equal(rendered, initial);
          samples.push({ ...row, renderedSha256: rendered });
        }
        const median = key => samples.map(row => row[key]).sort((a,b) => a-b)[3];
        receipt.timings.push({ case: name, action: kind === 'title' ? 'unchanged-physics-title-change' : 'changed-weather-recompute', baselineDispatchMedianMs: median('baselineDispatchMs'), candidateDispatchMedianMs: median('candidateDispatchMs'), baselineAcceptedMedianMs: median('baselineAcceptedMs'), candidateAcceptedMedianMs: median('candidateAcceptedMs'), samples });
      }
      assert.deepEqual(await stored(pages.candidate), await stored(pages.baseline));
      return { cells: project.width * project.height, snapshots: reference.existing.snapshots.length, completeRenderedParity: true };
    });
  }
  await group('keyboard cell inspection and actual notebook retention preserve current physical results', async () => {
    const before = await sameRendered();
    for (const label of ['baseline', 'candidate']) {
      const p = pages[label]; await p.locator('[data-brush="inspect"]').click();
      const selected = await stored(p); selected.selectedIndex = 17;
      await p.locator('#existing-grid .cell[data-cell-index="17"]').focus();
      await acceptedAction(p, selected, () => p.keyboard.press('Enter'));
      assert.equal((await stored(p)).selectedIndex, 17);
      assert.equal(await p.evaluate(() => document.activeElement?.dataset.cellIndex), '17');
      await p.locator('#obs-minute').fill('60'); await p.locator('#obs-depth').fill('7'); await p.locator('#obs-uncertainty').fill('2');
      await p.locator('#obs-source').fill('Authored formatting parity observation');
      await p.locator('#obs-scenario').selectOption('existing'); await p.locator('#obs-use').selectOption('challenge');
      const withReading = await stored(p);
      withReading.observations.push({ cellIndex: 17, minute: 60, depthMm: 7, uncertaintyMm: 2, source: 'Authored formatting parity observation', scenario: 'existing', use: 'challenge' });
      await acceptedAction(p, withReading, () => p.locator('#observe-form button[type=submit]').click());
      assert.equal((await stored(p)).observations.length, 1);
    }
    const after = await sameRendered(); assert.notEqual(after, before); // The explicit notebook row and selected cell are now visible.
    const a = await fingerprint(pages.baseline), b = await fingerprint(pages.candidate);
    assert.deepEqual(b.existing, a.existing); assert.deepEqual(b.proposal, a.proposal);
    return { keyboardSelection: 17, observations: 1, retainedSource: 'Authored formatting parity observation', renderedParity: true };
  });
  await group('real material and elevation brushes force fresh identical comparisons; invalid weather preserves accepted work', async () => {
    const before = await sameRendered();
    for (const label of ['baseline', 'candidate']) {
      const p = pages[label];
      const garden = await stored(p); garden.selectedIndex = 1;
      garden.proposal[1].surface = 'garden'; garden.proposal[1].provenance = 'manually edited hypothetical assumption';
      await p.locator('[data-brush="garden"]').click();
      await acceptedAction(p, garden, () => p.locator('#proposal-grid .cell[data-cell-index="1"]').click());
      const raised = await stored(p); raised.selectedIndex = 5;
      delete raised.proposal[5].terrainSource; delete raised.proposal[5].rasterSource;
      raised.proposal[5].elevationM = Number(Math.max(-10, Math.min(10, raised.proposal[5].elevationM + .025)).toFixed(3));
      raised.proposal[5].provenance = 'manually edited hypothetical assumption';
      await p.locator('[data-brush="raise"]').click();
      await acceptedAction(p, raised, () => p.locator('#proposal-grid .cell[data-cell-index="5"]').click());
    }
    const changed = await sameRendered(); assert.notEqual(changed, before);
    const accepted = await stored(pages.candidate);
    for (const label of ['baseline', 'candidate']) await timedChange(pages[label], 'rain', -1);
    assert.deepEqual(await stored(pages.candidate), accepted);
    assert.equal(await sameRendered(), changed);
    return { materialAndElevationAccepted: true, freshPhysicalResultsEqual: true, invalidWeatherRefused: true };
  });
  await group('actual ponding replay and threshold controls preserve every label and interval', async () => {
    for (const label of ['baseline', 'candidate']) {
      const p = pages[label];
      await p.locator('#ponding-minute').evaluate(el => { el.value = '61.234'; });
      await p.locator('#ponding-minute').dispatchEvent('input');
      await p.locator('#ponding-threshold').fill('2.675');
      await p.locator('#ponding-threshold').dispatchEvent('change');
      await p.locator('#ponding-existing button').nth(17).click();
    }
    const detailed = await sameRendered();
    for (const label of ['baseline', 'candidate']) {
      const p = pages[label];
      await p.locator('#ponding-threshold').fill('-1');
      await p.locator('#ponding-threshold').dispatchEvent('change');
    }
    assert.equal(await sameRendered(), detailed);
    for (const label of ['baseline', 'candidate']) {
      const p = pages[label];
      await p.locator('#ponding-minute').evaluate(el => { el.value = '0'; }); await p.locator('#ponding-minute').dispatchEvent('input');
      await p.locator('#ponding-threshold').fill('10'); await p.locator('#ponding-threshold').dispatchEvent('change');
      await p.locator('#ponding-existing button').first().click();
    }
    await sameRendered();
    return { originalThreshold: 2.675, originalMinute: 61.234, selectedReplayCell: 17, exactLabelsAndIntervals: true, invalidThresholdPreservesAccepted: true };
  });
  await group('real original export and a fresh narrow consumer reproduce the same project and visible numeric evidence', async () => {
    const original = await download(pages.baseline, 'baseline-export.json'), candidate = await download(pages.candidate, 'candidate-export.json');
    assert.deepEqual(candidate, original);
    const expected = await fingerprint(pages.candidate);
    const fresh = await browser.newContext({ viewport: { width: 390, height: 1000 }, acceptDownloads: true });
    await fresh.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(urls.candidate) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
      receipt.externalRequests.push(url); return route.abort();
    });
    const p = await fresh.newPage(); p.setDefaultTimeout(10000);
    p.on('pageerror', error => receipt.pageErrors.push({ label: 'fresh', error: String(error) }));
    p.on('response', response => {
      const url = response.url();
      if (response.status() >= 400 && !url.endsWith('/favicon.ico')) receipt.failedAssets.push({ label: 'fresh', url, status: response.status() });
    });
    await p.goto(urls.candidate, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => !!document.querySelector('#investigation-navigation'));
    const project = JSON.parse(candidate); await importProject(p, project, 'original-export.json');
    assert.deepEqual(await fingerprint(p), expected);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await p.locator('#chart').scrollIntoViewIfNeeded(); await p.screenshot({ path: join(out, 'fresh-390.png'), fullPage: false });
    await pages.candidate.locator('#chart').scrollIntoViewIfNeeded(); await pages.candidate.screenshot({ path: join(out, 'candidate-desktop.png'), fullPage: false });
    return { originalProjectSha256: sha(candidate), freshContext: true, noHorizontalOverflow: true, completeVisibleEvidenceEqual: true };
  });
  await Promise.all(moduleBodies);
  for (const [path, digest] of Object.entries(modules.baseline)) if (!['/app.js', '/ponding-panel.js'].includes(path)) assert.equal(modules.candidate[path], digest, 'Unrelated executed module differs: ' + path);
  for (const path of ['app.js', 'ponding-panel.js']) {
    assert.equal(modules.baseline['/' + path], sha(await readFile(join(baselineRoot, path))), 'served baseline bytes match the exact source: ' + path);
    assert.equal(modules.candidate['/' + path], sourceBefore.find(file => file.path === path).sha256, 'served candidate bytes match the exact source: ' + path);
  }
  assert.equal(modules.baseline['/number-format.js'], undefined);
  assert.equal(modules.candidate['/number-format.js'], sourceBefore.find(file => file.path === 'number-format.js').sha256, 'served formatter bytes match the candidate source');
  assert.match(moduleMimes.candidate['/number-format.js'] || '', /^(?:text|application)\/javascript(?:;|$)/i, 'formatter served with JavaScript MIME');
  assert.deepEqual(await sourceState(), sourceBefore);
  assert.deepEqual(receipt.pageErrors, []); assert.deepEqual(receipt.failedAssets, []); assert.deepEqual(receipt.externalRequests, []);
  delete receipt.activeCase; delete receipt.activeSample;
  Object.assign(receipt, { state: 'passed', finishedAt: new Date().toISOString(), source: sourceBefore, sourceChangedDuringRun: [], executedModules: modules, servedModuleMimeTypes: moduleMimes, baselineAppSha256: sha(baselineApp) });
  await save();
  console.log(JSON.stringify(receipt.timings.map(({ samples, ...row }) => row)));
} catch (error) {
  receipt.state = 'failed'; receipt.error = String(error.stack || error); await save(); throw error;
} finally {
  if (browser) await browser.close();
  for (const server of servers) if (server.pid && server.exitCode === null && server.signalCode === null) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM'); await exited;
  }
}

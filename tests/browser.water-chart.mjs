import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { makeExample, validateProject, compare } from '../core.js';
import { requireChromiumSandbox } from './support/chromium-sandbox.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const candidate = fileURLToPath(new URL('../', import.meta.url));
const baseline = process.env.EARTH_CHART_BASELINE_ROOT, out = process.env.EARTH_CHART_BROWSER_OUTPUT;
assert.ok(baseline && out, 'Set EARTH_CHART_BASELINE_ROOT and a fresh EARTH_CHART_BROWSER_OUTPUT');
await mkdir(out, { recursive: false });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = { state: 'running', groups: [], baselineDefects: [], errors: [], failedAssets: [], externalRequests: [], sourceBindings: {} };
const servers = [], contexts = [], pendingBodies = [], urls = {};
let browser, workerGate = null;
async function serve(root, label) {
  const log = await open(join(out, label + '-server.log'), 'wx');
  let child;
  try { child = spawn('python3', ['serve.py', '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', log.fd], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }); }
  catch (error) { await log.close(); throw error; }
  servers.push(child);
  const started = new Promise((resolve, reject) => {
    let value = ''; const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(Error('Server exited during startup: ' + code)); });
    child.stdout.on('data', chunk => { value += chunk; const match = value.match(/http:\/\/127\.0\.0\.1:\d+\//); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
  const [url] = await Promise.all([started, log.close()]); return url;
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('experimental-earth-site-v1')));
async function ready(page, project) {
  await page.waitForFunction(expected => {
    const canonical = x => x && typeof x === 'object' ? Array.isArray(x) ? x.map(canonical) : Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
    return document.querySelector('#rain-comparison-status')?.dataset.state === 'ready' && JSON.stringify(canonical(JSON.parse(localStorage.getItem('experimental-earth-site-v1')))) === JSON.stringify(canonical(expected));
  }, project, { timeout: 20000 });
  assert.deepEqual(await saved(page), project);
}
async function boot(label, width = 1440) {
  const root = label === 'baseline' ? baseline : candidate;
  const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true }); contexts.push(context);
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(urls[label]) || url.startsWith('data:') || url.startsWith('blob:')) {
      if (label === 'candidate' && workerGate && new URL(url).pathname.endsWith('/rain-comparison-worker.js')) {
        const gate = workerGate; gate.started();
        const resumed = gate.held.then(() => route.continue()).catch(error => { receipt.errors.push('Held worker request: ' + error); });
        gate.pending.push(resumed); return resumed;
      }
      return route.continue();
    }
    receipt.externalRequests.push(url); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => receipt.errors.push(String(error)));
  page.on('response', response => {
    const url = new URL(response.url());
    if (response.status() >= 400 && !url.pathname.endsWith('favicon.ico')) receipt.failedAssets.push({ label, url: url.href, status: response.status() });
    if (response.ok() && /\.(?:m?js|css)$/.test(url.pathname)) pendingBodies.push(response.body().then(async bytes => {
      const path = decodeURIComponent(url.pathname).slice(1), original = await readFile(join(root, path));
      assert.deepEqual(bytes, original, label + ' served original ' + path);
      receipt.sourceBindings[label + ':' + path] = sha(bytes);
    }).catch(error => { receipt.errors.push('Served source binding: ' + error); }));
  });
  await page.goto(urls[label], { waitUntil: 'domcontentloaded' }); await ready(page, makeExample()); return page;
}
async function importProject(page, project, name) {
  await page.locator('#import').setInputFiles({ name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await ready(page, project);
}
function fixture(kind) {
  const project = makeExample(); project.title = 'Authored chart legibility / ' + kind;
  if (kind === 'dry') project.weather.rainMmHr = 0;
  if (kind === 'large') {
    project.width = project.height = 24; project.selectedIndex = 0; project.observations = [];
    project.existing = Array.from({ length: 576 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'Authored maximum chart control' }));
    project.proposal = project.existing.map(cell => ({ ...cell, surface: 'garden' }));
    Object.assign(project.weather, { rainMmHr: 250, stormMinutes: 720, durationMinutes: 720, stepMinutes: 1, cellSizeM: 100, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  }
  if (kind === 'fractional') Object.assign(project.weather, { durationMinutes: 5.5, stormMinutes: 2.5, stepMinutes: 2 });
  return validateProject(project);
}
async function evidence(page) {
  return page.locator('#chart').evaluate(svg => {
    const box = svg.getBoundingClientRect(), view = svg.viewBox.baseVal;
    return {
      width: box.width, height: box.height, viewBox: [view.width, view.height],
      text: Array.from(svg.querySelectorAll('text'), el => { const r = el.getBoundingClientRect(), transform = el.getScreenCTM(); return { text: el.textContent, axis: el.dataset.axis ?? (el.textContent.endsWith(' min') ? 'time' : 'water'), x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height, fontPixels: Number.parseFloat(getComputedStyle(el).fontSize) * Math.hypot(transform.a, transform.b) }; }),
      paths: Array.from(svg.querySelectorAll('path'), el => el.getAttribute('d')),
      grid: Array.from(svg.querySelectorAll('line')).slice(0, 5).map(el => ['x1', 'x2', 'y1'].map(k => Number(el.getAttribute(k)))),
      pageWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
    };
  });
}
function verifySeries(observed, result, duration) {
  const series = [result.existing.snapshots, result.proposal.snapshots], maximum = Math.max(1, ...series.flatMap(samples => samples.map(s => s.storedLiters)));
  assert.equal(observed.paths.length, 2);
  const [left, right, bottom] = observed.grid[0], top = observed.grid[4][2];
  for (const [k, path] of observed.paths.entries()) {
    const points = [...path.matchAll(/[ML](-?[0-9.]+),(-?[0-9.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    assert.equal(points.length, series[k].length, 'Every retained model sample is drawn');
    for (let i = 0; i < points.length; ++i) {
      const targetX = left + (right - left) * series[k][i].minute / duration;
      const targetY = bottom - (bottom - top) * series[k][i].storedLiters / maximum;
      assert.ok(Math.abs(points[i][0] - targetX) <= .00501, 'Original sample minute');
      assert.ok(Math.abs(points[i][1] - targetY) <= .00501, 'Original sample water');
    }
  }
}
function defects(observed) {
  const failures = [];
  for (const text of observed.text) {
    if (text.x < -.1 || text.y < -.1 || text.x + text.width > observed.width + .1 || text.y + text.height > observed.height + .1) failures.push('clipped: ' + text.text);
    if (text.fontPixels < 11.95) failures.push('small: ' + text.text + ' / ' + text.fontPixels);
  }
  const ticks = observed.text.filter(x => x.axis === 'time').sort((a, b) => a.x - b.x);
  for (let i = 1; i < ticks.length; ++i) if (ticks[i].x - ticks[i - 1].x - ticks[i - 1].width < 11.8) failures.push('overlapping time labels');
  return failures;
}
try {
  urls.baseline = await serve(baseline, 'baseline'); urls.candidate = await serve(candidate, 'candidate');
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, chromiumSandbox: true, args: ['--allow-chrome-scheme-url'] });
  const sandboxPage = await browser.newPage(), cdp = await sandboxPage.context().newCDPSession(sandboxPage);
  receipt.sandbox = await requireChromiumSandbox({ send: (method, params) => cdp.send(method, params) }); await sandboxPage.close();
  const pages = { baseline: await boot('baseline'), candidate: await boot('candidate') };
  for (const kind of ['dry', 'ordinary', 'large', 'fractional']) {
    const project = fixture(kind), result = compare(project);
    for (const [label, page] of Object.entries(pages)) {
      await importProject(page, project, kind);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        if (label === 'candidate') await page.waitForFunction(() => { const svg = document.querySelector('#chart'); return Math.abs(svg.getBoundingClientRect().width - svg.viewBox.baseVal.width) < .1; });
        const observed = await evidence(page); verifySeries(observed, result, project.weather.durationMinutes); const issues = defects(observed);
        assert.deepEqual(await saved(page), project, 'A resize is a view change only');
        if (label === 'candidate') { assert.deepEqual(issues, [], kind + '/' + width); assert.ok(observed.scrollWidth <= observed.pageWidth + 1, 'No horizontal page overflow'); }
        else receipt.baselineDefects.push({ kind, width, issues });
        receipt.groups.push({ kind, label, width, sourceUnchanged: true, samplesPerSeries: result.existing.snapshots.length, observed });
        if (kind === 'large') await page.locator('.chart-wrap').screenshot({ path: join(out, `${label}-large-${width}.png`) });
      }
    }
  }
  assert.ok(receipt.baselineDefects.some(x => x.width === 390 && x.issues.some(s => s.startsWith('small:'))));
  assert.ok(receipt.baselineDefects.some(x => x.kind === 'large' && x.issues.some(s => s.startsWith('clipped:'))));
  const page = pages.candidate, project = fixture('large'); await importProject(page, project, 'accepted-before-pending');
  let release; const held = new Promise(resolve => { release = resolve; });
  let requested; const started = new Promise(resolve => { requested = resolve; });
  const gate = { held, release, started: requested, pending: [] }; workerGate = gate;
  const next = structuredClone(project); next.weather.durationMinutes = 719; next.weather.stormMinutes = 719;
  await page.locator('#import').setInputFiles({ name: 'new-pending.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next)) });
  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(Error('Worker request was not held')), 10000))]);
  await page.waitForFunction(() => document.querySelector('#rain-comparison-status').dataset.state === 'pending');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => { const svg = document.querySelector('#chart'); return Math.abs(svg.getBoundingClientRect().width - svg.viewBox.baseVal.width) < .1; });
  verifySeries(await evidence(page), compare(project), project.weather.durationMinutes);
  workerGate = null; release(); await Promise.all(gate.pending); await ready(page, next);
  verifySeries(await evidence(page), compare(next), next.weather.durationMinutes);
  receipt.groups.push({ name: 'Resize retains the accepted event while a different worker comparison is pending', passed: true });
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click(); const download = await downloadPromise;
  const path = join(out, 'original-project.json'); await download.saveAs(path); const bytes = await readFile(path);
  assert.deepEqual(JSON.parse(bytes), next);
  const fresh = await boot('candidate', 390); await fresh.locator('#import').setInputFiles(path); await ready(fresh, next);
  const reopened = await evidence(fresh); assert.deepEqual(defects(reopened), []); verifySeries(reopened, compare(next), next.weather.durationMinutes);
  assert.deepEqual(await saved(fresh), next);
  receipt.groups.push({ name: 'Original project download reopens in a fresh390px consumer', passed: true, originalProjectSha256: sha(bytes) });
  await Promise.all(pendingBodies); assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.failedAssets, []); assert.deepEqual(receipt.externalRequests, []);
  for (const path of ['app.js', 'styles.css', 'water-chart.js']) assert.equal(receipt.sourceBindings['candidate:' + path], sha(await readFile(join(candidate, path))));
  receipt.state = 'passed';
} catch (error) { receipt.state = 'failed'; receipt.error = error.stack; throw error; }
finally {
  if (workerGate) { const gate = workerGate; workerGate = null; gate.release(); await Promise.all(gate.pending); }
  await Promise.all(pendingBodies);
  await writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  await browser?.close();
  for (const child of servers) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited;
  }
}
console.log(JSON.stringify({ state: receipt.state, groups: receipt.groups.length, baselineDefects: receipt.baselineDefects, servedFiles: Object.keys(receipt.sourceBindings).length }));

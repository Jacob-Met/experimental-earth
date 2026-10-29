import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { makeWettingFrontEventsFixture } from './wetting-front-events-fixture.mjs';
import { serializeWettingFrontInvestigation } from '../wetting-front-study.js';
import { compareWettingFrontEvents } from '../wetting-front-events.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ??
  join(root, 'receiving-04e9-20261027', 'browser-' + randomUUID());
mkdirSync(dirname(runDirectory), { recursive: true });
const fixture = makeWettingFrontEventsFixture();
const originalFirst = serializeWettingFrontInvestigation(fixture.first, fixture.study);
const expected = compareWettingFrontEvents(fixture.first, fixture.second, fixture.study,
  fixture.references, fixture.initialConditions);
const sourceNames = ['index.html', 'app.js', 'core.js', 'infiltration-study.js',
  'wetting-front.js', 'wetting-front-contract.js', 'wetting-front-study.js',
  'wetting-front-panel.js', 'wetting-front-events.js', 'wetting-front-events-panel.js',
  'tests/wetting-front-events-fixture.mjs', 'tests/wetting-front-events.browser.mjs',
  'tests/support/browser-session.mjs', 'tests/support/chromium-session.mjs',
  'tests/support/chromium-sandbox.mjs'];
const sourceHashes = Object.fromEntries(sourceNames.map(name =>
  [name, createHash('sha256').update(readFileSync(join(root, name))).digest('hex')]));
const checks = [];
const received = await withBrowserSession({
  root, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', runDirectory,
}, async session => {
  const { send, evaluate, baseUrl, exceptions } = session;
  const browser = (fn, ...args) => evaluate('(' + fn.toString() + ')(' + args.map(value => JSON.stringify(value)).join(',') + ')');
  async function until(fn, ...args) {
    for (let i = 0; i < 200; i++) {
      try { if (await browser(fn, ...args)) return; } catch {}
      await delay(50);
    }
    const diagnostic = await browser(() => ({
      url: location.href, ready: document.readyState,
      status: document.querySelector('#wfe-status')?.textContent,
      replay: document.querySelector('#wfe-replay-status')?.textContent,
      first: document.querySelector('#wfe-first-source')?.textContent,
      body: document.body?.textContent.slice(0, 2000),
    }));
    throw new Error('Browser condition timed out: ' + fn.toString() + ' ' + JSON.stringify(diagnostic));
  }
  async function selectFile(selector, file) {
    const document = await send('DOM.getDocument', { depth: -1 });
    const found = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector });
    assert.ok(found.nodeId, 'Missing file input: ' + selector);
    await send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [file] });
  }
  async function revealSoil() {
    const route = await browser(() => {
      const search = document.querySelector('#investigation-search');
      if (search) {
        search.value = 'soil wets';
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const link = document.querySelector('#investigation-results a[data-investigation-id="wetting-front-study"]') ||
        document.querySelector('a[href="#wetting-front-study"]');
      if (link) link.click();
      const panel = document.querySelector('#wetting-front-study');
      for (let parent = panel?.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      return { hasSearch: Boolean(search), foundLink: Boolean(link) };
    });
    if (route.hasSearch) assert.equal(route.foundLink, true, 'Use the maintained soil investigation link');
    await until(() => document.querySelector('#wfe-run')?.getBoundingClientRect().height > 0);
    return route;
  }
  async function freshNavigation(url, reload = false) {
    const marker = randomUUID();
    await browser(value => { window.__eventDocumentMarker = value; }, marker);
    await send(reload ? 'Page.reload' : 'Page.navigate', reload ? { ignoreCache: true } : { url });
    await until(value => window.__eventDocumentMarker !== value &&
      document.readyState === 'complete' && Boolean(document.querySelector('#wfe-run')), marker);
  }
  async function submit() {
    await browser(() => document.querySelector('#wfe-run').focus());
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter',
      windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  }
  async function setText(selector, value) {
    await browser((selector, value) => {
      const input = document.querySelector(selector); input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, selector, value);
  }
  async function screenshot(name, selector) {
    const bounds = await browser(async selector => {
      const element = document.querySelector(selector);
      for (let attempt = 0; attempt < 6; attempt++) {
        window.scrollTo({top:window.scrollY + element.getBoundingClientRect().top - 16,behavior:'instant'});
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const rect = element.getBoundingClientRect();
        if (rect.top >= 8 && rect.top <= 24) return {top:rect.top,bottom:rect.bottom,attempt};
      }
      const rect = element.getBoundingClientRect();
      return {top:rect.top,bottom:rect.bottom,attempt:6};
    }, selector);
    assert.ok(bounds.top >= 0 && bounds.top < 64, JSON.stringify({selector,bounds}));
    const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(runDirectory, name + '.png'), Buffer.from(png.data, 'base64'));
  }
  try {
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await until(() => Boolean(document.querySelector('#wfe-run')));
    assert.equal(await browser(() => Boolean(document.querySelector('#pressure-head-run'))), true, 'The pressure-head investigation remains mounted alongside the recovered event workflow');
    const storageKey = 'experimental-earth-site-v1';
    await browser((key, value) => localStorage.setItem(key, value), storageKey, JSON.stringify(fixture.second));
    await freshNavigation(baseUrl, true);
    await until(() => document.querySelectorAll('#existing-grid .cell').length === 4);
    const navigation = await revealSoil();
    const originalWorking = await browser(key => localStorage.getItem(key), storageKey);
    const firstFile = join(runDirectory, 'first-event.json');
    writeFileSync(firstFile, originalFirst);
    await selectFile('#wfe-first-file', firstFile);
    await until(() => document.querySelectorAll('#wfe-initial-values [data-second-drive]').length === 2 &&
      document.querySelector('#wfe-first-source').textContent.includes('first-event.json'));
    assert.deepEqual(await browser(() => [...document.querySelectorAll('[data-second-drive]')].map(input => input.value)), ['', '']);
    await setText('#wfe-first-reference', fixture.references.calibration);
    await setText('#wfe-second-reference', fixture.references.challenge);
    await setText('#wfe-starting-basis', fixture.initialConditions.basis);
    await submit();
    await until(() => document.querySelector('#wfe-status').textContent.includes('Declare every second-event'));
    assert.equal(await browser(() => document.querySelector('#wfe-save').disabled), true);
    assert.equal(await browser(key => localStorage.getItem(key), storageKey), originalWorking);
    checks.push('real first-event file import leaves every second-event A blank and refuses an undeclared start without adopting a site');

    await browser(() => document.querySelector('#wfe-copy-starts').click());
    assert.deepEqual(await browser(() => [...document.querySelectorAll('[data-second-drive]')].map(input => Number(input.value))), [20, 0]);
    await submit();
    await until(() => document.querySelector('#wfe-live').dataset.status === 'one-survivor' &&
      !document.querySelector('#wfe-save').disabled);
    const rowIds = await browser(() => [...document.querySelectorAll('#wfe-live tbody tr')].map(row => Number(row.dataset.hypothesis)));
    assert.deepEqual(rowIds, expected.candidates.map(row => row.id));
    await browser(() => document.querySelectorAll('#wfe-live details').forEach(detail => { detail.open = true; }));
    await until(() => document.querySelector('#wfe-live').textContent.includes('Source: <img src=x'));
    assert.equal(await browser(() => document.querySelectorAll('#wetting-front-events img').length), 0);
    assert.equal(await browser(() => window.eventInjection ?? null), null);
    assert.equal(await browser(key => localStorage.getItem(key), storageKey), originalWorking);
    await screenshot('desktop', '#wfe-live');
    checks.push('keyboard comparison keeps original IDs/order, reaches the analytic one-survivor case, renders source text literally and preserves the working site');

    const downloadDirectory = join(runDirectory, 'downloads');
    mkdirSync(downloadDirectory);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDirectory, eventsEnabled: true });
    await browser(() => document.querySelector('#wfe-save').click());
    const downloadPath = join(downloadDirectory, 'experimental-earth-soil-events.json');
    for (let i = 0; i < 100 && !existsSync(downloadPath); i++) await delay(50);
    assert.ok(existsSync(downloadPath), 'The actual browser download must exist');
    const savedText = readFileSync(downloadPath, 'utf8'), saved = JSON.parse(savedText);
    assert.deepEqual(Object.keys(saved), ['schema', 'calibrationProject', 'challengeProject', 'study', 'references', 'initialConditions']);
    assert.deepEqual(saved.calibrationProject, fixture.first);
    assert.deepEqual(saved.study, fixture.study);
    assert.deepEqual(saved.references, fixture.references);
    assert.deepEqual(saved.initialConditions, fixture.initialConditions);
    assert.deepEqual(saved.challengeProject.observations, fixture.second.observations);
    checks.push('actual downloaded JSON contains complete original inputs and explicit starts, with no saved conclusions');

    await setText('#wfe-starting-basis', 'Changed explicit basis after comparison');
    assert.equal(await browser(() => document.querySelector('#wfe-save').disabled), true);
    assert.equal(await browser(() => document.querySelector('#wfe-live').textContent), '');
    await setText('#wfe-second-reference', fixture.references.calibration);
    await submit();
    await until(() => document.querySelector('#wfe-status').textContent.includes('distinct references'));
    assert.equal(await browser(() => document.querySelector('#wfe-save').disabled), true);
    await setText('#wfe-second-reference', fixture.references.challenge);
    checks.push('changed declarations retire live findings and export; duplicate event identities are refused');

    await browser(() => document.querySelector('#reset').click());
    const resetWorking = await browser(key => localStorage.getItem(key), storageKey);
    assert.notEqual(resetWorking, originalWorking);
    assert.equal(await browser(() => document.querySelector('#wfe-save').disabled), true);
    await revealSoil();
    await submit();
    await until(() => document.querySelector('#wfe-status').textContent.includes('site grid'));
    assert.equal(await browser(key => localStorage.getItem(key), storageKey), resetWorking);
    checks.push('a changed working site invalidates the comparison and incompatible event geometry is refused without adoption');

    await freshNavigation(baseUrl + '?two-event-replay=1');
    await revealSoil();
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await selectFile('#wfe-replay-file', downloadPath);
    await until(() => document.querySelector('#wfe-replay-result').dataset.status === 'one-survivor');
    assert.equal(await browser(key => localStorage.getItem(key), storageKey), resetWorking);
    const sourceContext = await browser(() => [...document.querySelectorAll('#wfe-replay-result .wfe-source-context')].map(node => node.textContent));
    assert.match(sourceContext[0], /First source: .*2 × 2 cells\. Rain 30 mm\/h · storm 60 min · run 60 min\./);
    assert.match(sourceContext[1], /Second source: .*2 × 2 cells\. Rain 60 mm\/h · storm 60 min · run 60 min\./);
    assert.equal(Number(await browser(() => document.querySelector('#rain').value)), JSON.parse(resetWorking).weather.rainMmHr);
    await browser(() => document.querySelectorAll('#wfe-replay-result details').forEach(detail => { detail.open = true; }));
    await until(() => document.querySelector('#wfe-replay-result').textContent.includes('Source: <img src=x'));
    const layout = await browser(() => {
      const panel = document.querySelector('#wetting-front-events');
      const wrap = document.querySelector('#wfe-replay-result .wfe-comparison');
      const label = wrap.querySelector('.wfe-compare-label');
      const range = document.createRange(); range.selectNodeContents(label);
      const labelLines = range.getClientRects().length;
      const scrollable = wrap.scrollWidth > wrap.clientWidth;
      const chartBounds = [...document.querySelectorAll('#wfe-replay-result svg')].map(svg => ({
        visible: svg.getBoundingClientRect().height > 0,
        minEffectiveFontPx: Math.min(...[...svg.querySelectorAll('text')].map(text =>
          parseFloat(getComputedStyle(text).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width)),
        textFits: [...svg.querySelectorAll('text')].every(text => {
          const box = text.getBBox(); return box.x >= -0.5 && box.x + box.width <= svg.viewBox.baseVal.width + 0.5;
        }),
      }));
      wrap.scrollLeft = wrap.scrollWidth;
      const last = wrap.querySelector('tbody tr td:last-child').getBoundingClientRect(), bounds = wrap.getBoundingClientRect();
      const lastColumnVisible = last.left >= bounds.left - 1 && last.right <= bounds.right + 1;
      wrap.scrollLeft = 0;
      return { viewport: innerWidth, page: document.documentElement.scrollWidth,
        panelWidth: panel.getBoundingClientRect().width, labelLines, scrollable, lastColumnVisible, chartBounds };
    });
    assert.ok(layout.page <= layout.viewport + 1, JSON.stringify(layout));
    assert.equal(layout.labelLines, 1); assert.equal(layout.scrollable, true);
    assert.equal(layout.lastColumnVisible, true);
    assert.ok(layout.chartBounds.length === 2 && layout.chartBounds.every(chart => chart.visible && chart.textFits), JSON.stringify(layout));
    assert.ok(layout.chartBounds.every(chart => chart.minEffectiveFontPx >= 10), JSON.stringify(layout));
    await screenshot('mobile', '#wfe-replay-result');
    await screenshot('mobile-curves', '#wfe-replay-result .wfe-detail');
    await browser(() => document.querySelectorAll('#wfe-replay-result .wfe-plots details')
      .forEach(details => { details.open = false; }));
    for (const [name, selector] of [
      ['mobile-first-curve', '#wfe-replay-result .wfe-model:first-child'],
      ['mobile-second-curve', '#wfe-replay-result .wfe-model:last-child'],
    ]) {
      await screenshot(name, selector);
      const rect = await browser(selector => {
        const r = document.querySelector(selector).querySelector('svg').getBoundingClientRect();
        return {top:r.top,bottom:r.bottom,height:innerHeight};
      }, selector);
      assert.ok(rect.top >= 0 && rect.bottom <= rect.height, JSON.stringify({selector,rect}));
    }
    checks.push('fresh-document file replay recomputes at390px without adoption; labels stay on one line, the last table column is reachable and every chart tick fits');

    const forged = join(runDirectory, 'forged-results.json');
    writeFileSync(forged, JSON.stringify({ ...saved, results: { survivors: [2] } }));
    await selectFile('#wfe-replay-file', forged);
    await until(() => document.querySelector('#wfe-replay-status').textContent.includes('Saved comparison refused'));
    assert.equal(await browser(() => document.querySelector('#wfe-replay-result').textContent), '');
    assert.equal(await browser(key => localStorage.getItem(key), storageKey), resetWorking);
    checks.push('forged saved findings are refused and retire the previous replay while preserving the working project');

    await selectFile('#wfe-first-file', firstFile);
    await until(() => document.querySelector('#wfe-first-source').textContent.includes('first-event.json'));
    await setText('#wfe-second-drive-1', '7');
    await setText('#wfe-second-drive-2', '8');
    await setText('#wfe-starting-basis', 'Keep these explicit declarations when a replacement fails');
    const beforeBad = await browser(() => ({
      source: document.querySelector('#wfe-first-source').textContent,
      drives: [...document.querySelectorAll('[data-second-drive]')].map(input => input.value),
      basis: document.querySelector('#wfe-starting-basis').value,
    }));
    const badFirst = join(runDirectory, 'bad-first.json');
    writeFileSync(badFirst, '{}');
    await selectFile('#wfe-first-file', badFirst);
    await until(() => document.querySelector('#wfe-status').textContent.includes('First event refused'));
    assert.deepEqual(await browser(() => ({
      source: document.querySelector('#wfe-first-source').textContent,
      drives: [...document.querySelectorAll('[data-second-drive]')].map(input => input.value),
      basis: document.querySelector('#wfe-starting-basis').value,
    })), beforeBad);
    checks.push('a malformed first-event replacement preserves the accepted source and explicit starting declarations');

    const delayed = join(runDirectory, 'delayed-bad.json'), newer = join(runDirectory, 'new-first.json');
    writeFileSync(delayed, '{}'); writeFileSync(newer, originalFirst);
    await browser(() => {
      const original = File.prototype.text;
      File.prototype.text = function() {
        if (this.name === 'delayed-bad.json') return new Promise((resolve, reject) => {
          window.__lateFirstReject = () => reject(new Error('late authored read failure'));
        });
        return original.call(this);
      };
      window.__restoreFileText = () => { File.prototype.text = original; };
    });
    try {
      await selectFile('#wfe-first-file', delayed);
      await until(() => typeof window.__lateFirstReject === 'function');
      await selectFile('#wfe-first-file', newer);
      await until(() => document.querySelector('#wfe-first-source').textContent.includes('new-first.json'));
      await setText('#wfe-second-drive-1', '33');
      await browser(async () => { window.__lateFirstReject(); await new Promise(resolve => setTimeout(resolve, 80)); });
      assert.match(await browser(() => document.querySelector('#wfe-first-source').textContent), /new-first\.json/);
      assert.equal(await browser(() => document.querySelector('#wfe-second-drive-1').value), '33');
      assert.doesNotMatch(await browser(() => document.querySelector('#wfe-status').textContent), /late authored/);
      assert.equal(await browser(key => localStorage.getItem(key), storageKey), resetWorking);
    } finally { await browser(() => window.__restoreFileText?.()); }
    checks.push('a delayed older file failure cannot overwrite a newer accepted source, its controls or its status');

    assert.deepEqual(exceptions, []);
    assert.equal(session.sandbox.admitted, true);
    const receipt = { passed: true, checks, sourceHashes, navigation, layout, exceptions,
      browser: session.sandbox.browser.product, sandboxAdmitted: session.sandbox.admitted,
      declaredBase: process.env.EARTH_RECEIVING_BASE ?? 'development snapshot; upstream composition unverified',
      inputKind: 'Authored mathematical controls, not field observations',
      actualDownload: { path: downloadPath, sha256: createHash('sha256').update(savedText).digest('hex') },
      runDirectory };
    writeFileSync(join(runDirectory, 'browser-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
    return receipt;
  } catch (error) {
    try {
      const png = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(runDirectory, 'failed-viewport.png'), Buffer.from(png.data, 'base64'));
      writeFileSync(join(runDirectory, 'course-failure.json'), JSON.stringify({
        error: String(error.stack ?? error), checks, sourceHashes, exceptions,
        status: await browser(() => ({ live: document.querySelector('#wfe-status')?.textContent,
          replay: document.querySelector('#wfe-replay-status')?.textContent, url: location.href })),
      }, null, 2) + '\n');
    } catch {}
    throw error;
  }
});
assert.equal(received.value.passed, true);
console.log(JSON.stringify({ passed: true, checks: checks.length, browser: received.value.browser, runDirectory }));

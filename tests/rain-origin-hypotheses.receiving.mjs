import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';

export async function receiveRainOriginHypotheses({ evaluate, send, delay, report, artifactDirectory }) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const get = (id, field = 'textContent') => evaluate('document.getElementById(' + JSON.stringify(id) + ').' + field);
  const click = id => get(id, 'click()');
  const set = (id, value) => evaluate('(()=>{const e=document.getElementById(' + JSON.stringify(id) + ');e.value=' + JSON.stringify(String(value)) + ';e.dispatchEvent(new Event("change"));})()');
  const state = () => get('origin-status', 'dataset.state');
  const load = async p => {
    await evaluate("localStorage.setItem('experimental-earth-site-v1'," + JSON.stringify(JSON.stringify(p)) + ')');
    await send('Page.reload', { ignoreCache: true });await delay(350);
    await evaluate("document.getElementById('rain-origin').open=true;document.getElementById('origin-hypotheses-controls').open=true");
  };
  const p = makeExample();p.rainOriginStudy = { targetCells: [29], fate: 'stored', minute: 60, hypothesisSubset: 'calibration' };
  p.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [3, 9, 22] };
  p.observations = [{ cellIndex: 29, minute: 60, depthMm: 42, uncertaintyMm: 3,
    source: 'authored ambiguity control; not a field observation', scenario: 'existing', use: 'calibration' }];
  try {
    await load(p);await click('origin-hypotheses-run');assert.equal(await state(), 'compared');
    assert.equal(await get('origin-model', 'value'), '3');
    assert.equal(await evaluate("document.querySelectorAll('#origin-hypothesis-table tbody tr').length"), 3);
    assert.match(await get('origin-summary'), /178.6 L supplied by rainfall/);
    assert.match(await get('origin-hypothesis-summary'), /161.6 to 178.6/);
    assert.match(await get('origin-hypothesis-summary'), /1 calibration and 0 held-aside/);
    await evaluate("document.querySelector('#origin-existing-map [data-cell-index=\"30\"]').click()");
    assert.match(await get('origin-hypothesis-source'), /21.96 to 33.91/);
    assert.match(await get('origin-hypothesis-source'), /-1.709 to -0.9607/);
    assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")), p);
    report.push('actual admitted rainfall-origin hypotheses retain three distinct maps and paired reduction ranges without adopting a rate');

    const scale = await get('origin-scale');await get('origin-model', 'focus()');
    for (let i = 0; i < 2; i++) for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    }
    await delay(80);assert.equal(await get('origin-model', 'value'), '22');
    assert.match(await get('origin-source'), /21.96 L/);assert.match(await get('origin-assumption'), /22 mm\/h/);
    assert.equal(await get('origin-scale'), scale);
    assert.equal(await evaluate("document.querySelector('#origin-existing-map [data-cell-index=\"30\"]').getAttribute('aria-pressed')"), 'true');
    report.push('real keyboard hypothesis switching preserves origin inspection and a common scale across all hypotheses');

    for (const width of [1360, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      if (artifactDirectory) {
        const clip = await evaluate("(()=>{const r=document.getElementById('rain-origin').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
        writeFileSync(artifactDirectory + '/rain-origin-hypotheses-' + width + '.png', Buffer.from(shot.data, 'base64'));
      }
    }
    report.push('paired origin hypotheses fit desktop and390px layouts without page overflow');
    await get('origin-time', 'focus()');
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await delay(80);assert.equal(await get('origin-minute'), '65 of 240 minutes');
    assert.equal(await get('origin-model', 'value'), '22');assert.equal(await state(), 'compared');
    assert.equal(await evaluate("document.querySelector('#origin-existing-map [data-cell-index=\"30\"]').getAttribute('aria-pressed')"), 'true');
    await click('origin-final');assert.equal(await get('origin-minute'), '240 of 240 minutes');assert.equal(await get('origin-model', 'value'), '22');
    await set('origin-fate', 'absorbed');assert.equal(await get('origin-results', 'hidden'), true);
    await click('origin-hypotheses-run');assert.equal(await state(), 'compared');await set('origin-time', 0);
    assert.match(await get('origin-total'), /through 0 minutes/);assert.match(await get('origin-hypothesis-summary'), /existing 0 L; proposal 0 L; paired change 0 L/);
    assert.doesNotMatch(await get('origin-results'), /NaN|Infinity/);
    report.push('time and modeled-end changes retain the chosen rate; fate recomputation and minute-zero ranges remain explicit');

    await load(p);await click('origin-hypotheses-run');
    await send('Page.reload', { ignoreCache: true });await delay(350);
    assert.equal(await state(), 'not-explained');assert.equal(await get('origin-hypotheses-subset', 'value'), 'calibration');
    await evaluate("document.getElementById('rain-origin').open=true;document.getElementById('origin-hypotheses-controls').open=true");
    await click('origin-hypotheses-run');assert.equal(await get('origin-model', 'options.length'), 3);
    const retained = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
    assert.deepEqual(retained, p);assert.equal('candidates' in retained.rainOriginStudy, false);
    await evaluate("document.getElementById('study-rates').value='9, 22';document.getElementById('study-rates').dispatchEvent(new Event('input'));document.getElementById('compare-infiltration').click()");
    assert.equal(await get('origin-results', 'hidden'), true);assert.equal(await state(), 'not-explained');
    await click('origin-hypotheses-run');assert.equal(await get('origin-model', 'options.length'), 2);
    assert.equal(await get('origin-model', 'value'), '9');
    await click('origin-run');assert.equal(await state(), 'explained');assert.equal(await get('origin-hypothesis-results', 'hidden'), true);
    assert.match(await get('origin-assumption'), /default infiltration/);assert.match(await get('origin-summary'), /173.4 L supplied by rainfall/);
    report.push('saved inputs reopen by recomputation, changed rate evidence invalidates the comparison, and default origins remain available');

    const missing = structuredClone(p);missing.observations = [];await load(missing);await click('origin-hypotheses-run');
    assert.equal(await state(), 'error');assert.equal(await get('origin-results', 'hidden'), true);assert.match(await get('origin-status'), /calibration readings/);
    await set('origin-hypotheses-subset', 'all');await click('origin-hypotheses-run');assert.equal(await state(), 'compared');
    assert.match(await get('origin-hypothesis-summary'), /No evidence filter/);
    const challenged = structuredClone(p);challenged.rainOriginStudy.hypothesisSubset = 'surviving';await load(challenged);await click('origin-hypotheses-run');
    assert.equal(await state(), 'error');assert.match(await get('origin-status'), /Held-aside readings/);
    challenged.observations.push({ cellIndex: 29, minute: 120, depthMm: 40.87091295285532, uncertaintyMm: 0.01,
      source: 'authored held-aside control', scenario: 'existing', use: 'challenge' });
    await load(challenged);await click('origin-hypotheses-run');assert.equal(await state(), 'compared');
    assert.equal(await get('origin-model', 'options.length'), 1);assert.equal(await get('origin-model', 'value'), '9');
    report.push('missing calibration/challenge refuses; all-rate exploration is labeled; a held-aside band retains only its compatible hypothesis');

    const large = structuredClone(p);large.width = large.height = 24;
    large.existing = Array.from({ length: 576 }, () => ({ surface: 'turf', elevationM: 0, provenance: 'authored work-limit control' }));
    large.proposal = structuredClone(large.existing);large.infiltrationStudy.ratesMmHr = [1,2,3,4,5,6,7,8,9];
    Object.assign(large.weather, { durationMinutes: 400, stepMinutes: 1 });large.rainOriginStudy.minute = 0;
    await load(large);await click('origin-hypotheses-run');assert.equal(await state(), 'error');
    assert.match(await get('origin-status'), /calculation budget/);assert.equal(await get('origin-results', 'hidden'), true);
    report.push('the actual browser refuses oversized cohort work even at minute zero without displaying a partial range');
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await evaluate(original === null ? "localStorage.removeItem('experimental-earth-site-v1')" : "localStorage.setItem('experimental-earth-site-v1'," + JSON.stringify(original) + ')');
    await send('Page.reload', { ignoreCache: true });await delay(350);
  }
}

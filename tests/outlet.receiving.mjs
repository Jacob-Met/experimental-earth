import assert from 'node:assert/strict';
import { makeExample } from '../core.js';

export async function receiveOutlet({evaluate, send, delay, report}) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.ok(await evaluate("!!document.querySelector('#outlet-panel')"));
  await evaluate("document.querySelector('#outlet-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'compared');
  assert.equal(await evaluate("document.querySelectorAll('#outlet-results article').length"), 3);
  const outcome = await evaluate("document.querySelector('#outlet-results').textContent");
  assert.ok(outcome.includes('Peak standing water'), outcome);
  assert.ok(outcome.includes('Edge outflow'), outcome);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  report.push('actual browser compares three paired edge conditions without modifying saved project');

  const p = makeExample();
  p.width = p.height = 2; p.selectedIndex = 0;
  const mk = (elevationM, surface) => ({elevationM, surface, provenance:'authored reversal browser control'});
  p.existing = [mk(-0.03,'turf'),mk(-0.03,'turf'),mk(-0.03,'sealed'),mk(0.08,'garden')];
  p.proposal = [mk(0,'turf'),mk(-0.03,'turf'),mk(0,'garden'),mk(0.08,'garden')];
  Object.assign(p.weather,{rainMmHr:48,stormMinutes:60,durationMinutes:120,
    stepMinutes:5,cellSizeM:1,mobilityPerHour:3});
  await evaluate("localStorage.setItem('experimental-earth-site-v1'," +
    JSON.stringify(JSON.stringify(p)) + ")");
  await send('Page.reload', {ignoreCache:true}); await delay(350);
  await evaluate("document.querySelector('#outlet-rates').value='0,0.6,5';document.querySelector('#outlet-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'compared');
  const reversal = await evaluate("document.querySelector('#outlet-results').textContent");
  assert.ok(reversal.includes('Peak standing water:'), reversal);
  assert.ok(reversal.includes('reverses.'), reversal);
  assert.ok(reversal.includes('cells have higher modeled peak depth'), reversal);
  report.push('authored grade/garden case reverses site-peak conclusion across edge hypotheses in actual browser');


  await evaluate("document.querySelector('#outlet-rates').value='0, 0';document.querySelector('#outlet-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'error');
  assert.equal(await evaluate("document.querySelectorAll('#outlet-results article').length"), 0);
  report.push('duplicate outlet assumptions rejected and old results cleared');

  await evaluate("document.querySelector('#outlet-rates').value='0, 0.38, 2';document.querySelector('#outlet-form').requestSubmit()");
  await evaluate("document.querySelector('#copy-existing').click()");
  assert.equal(await evaluate("document.querySelector('#outlet-status').dataset.state"), 'not-compared');
  await evaluate("document.querySelector('#outlet-form').requestSubmit()");
  const same = await evaluate("Array.from(document.querySelectorAll('#outlet-results article')).every(e=>e.textContent.includes('change 0.'))");
  assert.equal(same, true);
  report.push('layout changes invalidate prior comparison; identical sites give zero effects for every candidate');

  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(150);
  const geometry = await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");
  assert.ok(geometry.scroll <= geometry.inner + 1, JSON.stringify(geometry));
  await send('Emulation.clearDeviceMetricsOverride');
  report.push('edge-condition study fits a 390px browser viewport');

  if (original === null) await evaluate("localStorage.removeItem('experimental-earth-site-v1')");
  else await evaluate('localStorage.setItem("experimental-earth-site-v1",' + JSON.stringify(original) + ')');
  await send('Page.reload', {ignoreCache:true}); await delay(350);
}

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';

export async function receiveLocalWaterBudget({ evaluate, send, delay, report, artifactDirectory }) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'authored browser control' }));
  p.proposal = p.existing.map(c => ({ ...c, surface: 'garden' }));
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
  await send('Page.reload', { ignoreCache: true }); await delay(350);
  await evaluate("document.querySelector('#trace-local-budget').click()");
  assert.equal(await evaluate("document.querySelector('#local-budget-status').dataset.state"), 'computed');
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#local-budget-results [data-component=storedLiters] td')).map(x=>x.textContent)"), ['21', '6', '-15']);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#local-budget-results [data-component=absorbedLiters] td')).map(x=>x.textContent)"), ['9', '24', '+15']);
  report.push('local accounting consumer reproduces analytic 15-liter storage reduction per cell');

  // Neighbor navigation must switch out of a painting mode and preserve geometry.
  await evaluate("document.querySelector('[data-brush=raise]').click();document.querySelector('#local-budget-results [data-neighbor=\"1\"] button').click()");
  assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellIndex"), '1');
  assert.equal(await evaluate("document.querySelector('[data-brush=inspect]').getAttribute('aria-pressed')"), 'true');
  const selected = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.deepEqual(selected.existing, p.existing); assert.deepEqual(selected.proposal, p.proposal);
  await evaluate("document.querySelector('#existing-grid [data-cell-index=\"3\"]').click()");
  assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellIndex"), '3');
  assert.equal(await evaluate("document.querySelector('#local-budget-status').dataset.state"), 'computed');
  report.push('neighbor/map navigation preserves computed trace and cannot paint the site');

  // Ordinary JSON reopening recomputes the budget, with no stale derived result.
  await evaluate(`(async()=>{const file=new File([${JSON.stringify(JSON.stringify(p))}],'local-budget-site.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,160));})()`);
  await send('Page.reload', { ignoreCache: true }); await delay(350);
  assert.equal(await evaluate("document.querySelector('#local-budget-status').dataset.state"), 'not-computed');
  await evaluate("document.querySelector('#trace-local-budget').click()");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#local-budget-results [data-component=storedLiters] td')).map(x=>x.textContent)"), ['21', '6', '-15']);
  await evaluate("document.querySelector('#rain').value='35';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#local-budget-status').dataset.state"), 'stale');
  assert.equal(await evaluate("document.querySelector('#local-budget-results').textContent"), '');
  await evaluate("document.querySelector('#trace-local-budget').click()");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#local-budget-results [data-component=storedLiters] td')).map(x=>x.textContent)"), ['26', '11', '-15']);
  report.push('ordinary project reopen and changed rainfall produce fresh accounting without reusing stale results');

  await evaluate("document.querySelector('#reset').click();document.querySelector('#trace-local-budget').click()");
  const incoming = await evaluate("Number(document.querySelector('#local-budget-results [data-component=incomingLiters] td').textContent.replaceAll(',',''))");
  const neighborText = await evaluate("document.querySelector('.local-budget-neighbors').textContent");
  assert.ok(incoming > 0, 'coupled courtyard must expose actual incoming water');
  assert.ok(neighborText.includes('C4 → D4') && neighborText.includes('D4 → C4'), neighborText);
  assert.equal(await evaluate("document.querySelectorAll('.local-budget-neighbor').length"), 4);
  report.push('coupled courtyard consumer retains incoming water and both directions for four actual neighbors');

  await evaluate("(()=>{const s=document.querySelector('#local-budget-scope');s.value='edited';s.dispatchEvent(new Event('change'));})()");
  assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellCount"), '6');
  const footprintText = await evaluate("document.querySelector('#local-budget-results').textContent");
  assert.ok(footprintText.includes('D3, E3, D4, E4, D5, E5'), footprintText);
  assert.ok(footprintText.includes('internal crossings cancel'), footprintText);
  await evaluate("(()=>{const s=document.querySelector('#local-budget-scope');s.value='site';s.dispatchEvent(new Event('change'));})()");
  assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellCount"), '48');
  for (const key of ['incomingLiters', 'outgoingLiters']) assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#local-budget-results [data-component=${key}] td')).map(x=>x.textContent)`), ['0', '0', '0']);
  assert.equal(await evaluate("document.querySelectorAll('.local-budget-neighbor').length"), 0);
  report.push('edited-area membership is explicit and whole-site crossings cancel while global water losses remain');
  await evaluate("(()=>{const s=document.querySelector('#local-budget-scope');s.value='edited';s.dispatchEvent(new Event('change'));})()");
  const neighbor = await evaluate("document.querySelector('.local-budget-neighbor').dataset.neighbor");
  await evaluate("document.querySelector('.local-budget-neighbor button').click()");
  assert.equal(await evaluate("document.querySelector('#local-budget-scope').value"), 'cell');
  assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellIndex"), neighbor);
  await evaluate("(()=>{const s=document.querySelector('#local-budget-scope');s.value='edited';s.dispatchEvent(new Event('change'));document.querySelector('#copy-existing').click();})()");
  assert.equal(await evaluate("document.querySelector('#local-budget-status').dataset.state"), 'no-edits');
  assert.equal(await evaluate("document.querySelector('#trace-local-budget').disabled"), true);
  assert.equal(await evaluate("document.querySelectorAll('#local-budget-results table').length"), 0);
  await evaluate("document.querySelector('#reset').click();document.querySelector('#trace-local-budget').click()");
  assert.equal(await evaluate("document.querySelector('#local-budget-scope').value"), 'cell');
  assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellCount"), '1');
  report.push('regional neighbor navigation returns to a cell; identical plans explicitly have no edited footprint');

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('#local-budget-panel').scrollIntoView({block:'start',behavior:'instant'})");
  await delay(200);
  if (artifactDirectory) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${artifactDirectory}/local-budget-desktop.png`, Buffer.from(shot.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('#local-budget-panel').scrollIntoView({block:'start',behavior:'instant'})");
  await delay(200);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  assert.ok(await evaluate("Array.from(document.querySelectorAll('.local-budget-neighbor button')).every(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})"));
  if (artifactDirectory) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${artifactDirectory}/local-budget-mobile.png`, Buffer.from(shot.data, 'base64'));
  }
  report.push('computed local-balance table and neighbor controls fit desktop and 390px layouts');
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(original)})`);
  await send('Page.reload', { ignoreCache: true }); await delay(350);
}

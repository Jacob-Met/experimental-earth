import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';

export async function receiveRainTrace({ evaluate, send, delay, report, artifactDirectory }) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const load = async project => {
    await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(project))})`);
    await send('Page.reload', { ignoreCache: true }); await delay(350);
  };
  const state = () => evaluate("document.querySelector('#trace-status').dataset.state");
  await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
  await load(makeExample());
  assert.equal(await evaluate("document.querySelector('#trace-run').disabled"), true);
  const before = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  await evaluate("document.querySelector('#trace-use-selected').click();document.querySelector('#trace-run').click()");
  assert.equal(await state(), 'traced');
  assert.equal(await evaluate("document.querySelectorAll('#trace-existing-map button').length"), 48);
  const saved = JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.deepEqual(saved.rainTraceStudy, { sourceCells: [27] });
  delete saved.rainTraceStudy; assert.deepEqual(saved, before);
  report.push('rain attribution uses the existing source cell, renders both destination grids and preserves model/evidence inputs');
  assert.equal(await evaluate("document.querySelector('#trace-time').hidden"), false);
  assert.equal(await evaluate("document.querySelector('#trace-step').value"), '48');
  await evaluate("document.querySelector('#trace-step').value='12';document.querySelector('#trace-step').dispatchEvent(new Event('input'))");
  assert.ok((await evaluate("document.querySelector('#trace-time-label').textContent")).includes('60 / 240 min'));
  assert.ok((await evaluate("document.querySelector('.trace-total-card:last-child').textContent")).includes('proposal 59.26 L'));
  await evaluate("document.querySelector('#trace-step').value='0';document.querySelector('#trace-step').dispatchEvent(new Event('input'))");
  assert.ok((await evaluate("document.querySelector('#trace-summary').textContent")).includes('0 L of rain'));
  assert.equal(await evaluate("[...document.querySelectorAll('.trace-total-card small')].every(e=>e.textContent==='Change 0 L')"), true);
  await evaluate("document.querySelector('#trace-step').value='48';document.querySelector('#trace-step').dispatchEvent(new Event('input'))");
  assert.ok((await evaluate("document.querySelector('.trace-total-card:last-child').textContent")).includes('proposal 0 L'));
  report.push('retained source timeline reveals the independently established temporary 59.2624 L contribution, initial zero and final zero at matched scenario times');

  await evaluate("document.querySelector('#existing-grid [data-cell-index=\"0\"]').click()");
  assert.equal(await state(), 'traced');
  await evaluate("document.querySelector('#trace-add-selected').click()");
  assert.equal(await state(), 'not-traced');
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).rainTraceStudy, { sourceCells: [0, 27] });
  await evaluate("document.querySelector('#trace-run').click()");
  assert.equal(await state(), 'traced');
  await send('Page.reload', { ignoreCache: true }); await delay(350);
  assert.equal(await state(), 'not-traced');
  assert.equal(await evaluate("document.querySelectorAll('#trace-sources button').length"), 2);
  await evaluate("document.querySelector('#trace-run').click()");
  report.push('multi-cell source selection persists; ordinary inspection preserves results and changed source inputs require recomputation');

  await evaluate("document.querySelector('#trace-step').value='12';document.querySelector('#trace-step').dispatchEvent(new Event('input'))");
  if (artifactDirectory) {
    const clip = await evaluate("(()=>{const r=document.querySelector('#rain-trace').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    writeFileSync(artifactDirectory + '/rain-trace-desktop.png', Buffer.from(shot.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  if (artifactDirectory) {
    const clip = await evaluate("(()=>{const r=document.querySelector('#rain-trace').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    writeFileSync(artifactDirectory + '/rain-trace-mobile.png', Buffer.from(shot.data, 'base64'));
  }
  report.push('rain attribution fits the actual 390px viewport; paired heatmaps and source controls remain visible');

  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'sealed', provenance: 'authored analytic browser control' }));
  p.proposal = structuredClone(p.existing); p.proposal[0].elevationM = 1;
  Object.assign(p.weather, { rainMmHr: 60, stormMinutes: 5, durationMinutes: 5, stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 1, boundaryExitPerHour: 0 });
  p.rainTraceStudy = { sourceCells: [0] };
  await load(p);
  await evaluate("document.querySelector('#trace-run').click();const s=document.querySelector('#trace-fate');s.value='stored';s.dispatchEvent(new Event('change'))");
  assert.ok((await evaluate("document.querySelector('#trace-summary').textContent")).includes('5 L of rain'));
  assert.ok((await evaluate("document.querySelector('#trace-destination').textContent")).includes('existing 4.917 L; proposal 0 L'));
  await evaluate("document.querySelector('#trace-proposal-map [data-cell-index=\"1\"]').click()");
  assert.ok((await evaluate("document.querySelector('#trace-destination').textContent")).includes('existing 0 L; proposal 2.458 L'));
  assert.equal(await evaluate("document.querySelectorAll('#trace-table tbody tr').length"), 4);
  report.push('independent one-step analytic fixture renders conserved splitting and the actual changed destination quantities');

  await evaluate("document.querySelector('#rain').value='0';document.querySelector('#rain').dispatchEvent(new Event('change'))");
  assert.equal(await state(), 'not-traced');
  assert.equal(await evaluate("document.querySelector('#trace-results').hidden"), true);
  await evaluate("document.querySelector('#trace-run').click()");
  assert.ok((await evaluate("document.querySelector('#trace-summary').textContent")).includes('0 L of rain'));
  assert.ok(!(await evaluate("document.querySelector('#trace-results').textContent")).match(/NaN|Infinity/));
  await evaluate("document.querySelector('#rain').value='60';document.querySelector('#rain').dispatchEvent(new Event('change'));document.querySelector('#copy-existing').click();document.querySelector('#trace-run').click()");
  assert.equal(await evaluate("[...document.querySelectorAll('.trace-total-card small')].every(e=>e.textContent==='Change 0 L')"), true);
  report.push('weather/terrain edits invalidate attribution; dry and identical-scenario controls have zero contribution or change');

  await evaluate("window.__traceBlob=null;window.__traceOriginalURL=URL.createObjectURL;URL.createObjectURL=b=>{window.__traceBlob=b;return window.__traceOriginalURL(b)};document.querySelector('#export').click()");
  const exported = JSON.parse(await evaluate('window.__traceBlob.text()'));
  assert.deepEqual(exported.rainTraceStudy, { sourceCells: [0] });
  await evaluate("document.querySelector('#trace-clear').click()");
  assert.equal(await evaluate("document.querySelector('#trace-run').disabled"), true);
  await evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(exported))}],'traced-site.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
  assert.equal(await evaluate("document.querySelectorAll('#trace-sources button').length"), 1);
  assert.equal(await state(), 'not-traced');
  const accepted = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  exported.rainTraceStudy = { sourceCells: [0, 0] };
  await evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(exported))}],'bad-trace.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), accepted);
  assert.ok((await evaluate("document.querySelector('#toast').textContent")).includes('Import refused'));
  report.push('actual project export/import reopens the source selection; invalid duplicate-cell import preserves the accepted workspace');
  const large=makeExample();large.width=large.height=24;large.selectedIndex=0;
  large.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'authored timeline budget control'}));
  large.proposal=structuredClone(large.existing);large.rainTraceStudy={sourceCells:[0]};
  Object.assign(large.weather,{durationMinutes:720,stepMinutes:1,mobilityPerHour:0,boundaryExitPerHour:0});
  await load(large);await evaluate("document.querySelector('#trace-run').click()");
  assert.equal(await state(),'traced');
  assert.equal(await evaluate("document.querySelector('#trace-time').hidden"),true);
  assert.ok((await evaluate("document.querySelector('#trace-status').textContent")).includes('too detailed'));
  assert.equal(await evaluate("document.querySelector('#trace-results').hidden"),false);
  report.push('oversized retained timeline is explicitly unavailable while actual final attribution remains usable');
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(original)})`);
  await send('Page.reload', { ignoreCache: true }); await delay(350);
}

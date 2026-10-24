import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';

export async function receiveRainOrigins({ evaluate, send, delay, report, artifactDirectory }) {
  const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const load=async p=>{
    await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
    await send('Page.reload',{ignoreCache:true});await delay(350);
    await evaluate("document.querySelector('#rain-origin').open=true");
  };
  const state=()=>evaluate("document.querySelector('#origin-status').dataset.state");
  const p=makeExample();p.width=p.height=2;p.selectedIndex=1;
  p.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'authored receiving control'}));
  p.proposal=structuredClone(p.existing);p.proposal[0].elevationM=1;
  Object.assign(p.weather,{rainMmHr:60,stormMinutes:5,durationMinutes:5,stepMinutes:5,cellSizeM:1,mobilityPerHour:1,boundaryExitPerHour:0});
  await send('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false});
  await load(p);
  assert.equal(await evaluate("document.querySelector('#origin-run').disabled"),true);
  await evaluate("document.querySelector('#origin-fate').value='stored';document.querySelector('#origin-fate').dispatchEvent(new Event('change'));document.querySelector('#origin-use-selected').click();document.querySelector('#origin-run').click()");
  assert.equal(await state(),'explained');
  assert.equal(await evaluate("document.querySelectorAll('#origin-existing-map button').length"),4);
  assert.equal(await evaluate("document.querySelectorAll('#origin-table tbody tr').length"),4);
  const totals=await evaluate("document.querySelector('#origin-summary').textContent");
  assert.ok(totals.includes('4.917 L supplied by rainfall'));assert.ok(totals.includes('7.375 L supplied by rainfall'));
  await evaluate("document.querySelector('#origin-proposal-map [data-cell-index=\"0\"]').click()");
  assert.ok((await evaluate("document.querySelector('#origin-source').textContent")).includes('existing 0 L; proposal 2.458 L'));
  const saved=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.deepEqual(saved.rainOriginStudy,{targetCells:[1],fate:'stored'});
  delete saved.rainOriginStudy;assert.deepEqual(saved,p);
  report.push('reverse rainfall origins render the independent 4.9167/7.375 L destination control and 2.4583 L remote-origin contribution');

  if(artifactDirectory){
    const clip=await evaluate("(()=>{const r=document.querySelector('#rain-origin').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    writeFileSync(artifactDirectory+'/rain-origin-desktop.png',Buffer.from(shot.data,'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  if(artifactDirectory){
    const clip=await evaluate("(()=>{const r=document.querySelector('#rain-origin').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    writeFileSync(artifactDirectory+'/rain-origin-mobile.png',Buffer.from(shot.data,'base64'));
  }
  report.push('paired rainfall-origin maps, destination selection and complete table fit the actual 390px viewport');

  await evaluate("document.querySelector('#origin-fate').value='absorbed';document.querySelector('#origin-fate').dispatchEvent(new Event('change'))");
  assert.equal(await state(),'not-explained');assert.equal(await evaluate("document.querySelector('#origin-results').hidden"),true);
  await evaluate("document.querySelector('#origin-run').click()");
  assert.ok((await evaluate("document.querySelector('#origin-summary').textContent")).includes('0.08333 L supplied by rainfall'));
  await evaluate("document.querySelector('#origin-fate').value='exit';document.querySelector('#origin-fate').dispatchEvent(new Event('change'));document.querySelector('#origin-run').click()");
  assert.ok((await evaluate("document.querySelector('#origin-status').textContent")).includes('No rainfall reaches'));
  await evaluate("document.querySelector('#existing-grid [data-cell-index=\"0\"]').click()");
  assert.equal(await state(),'explained');
  await evaluate("document.querySelector('#origin-add-selected').click()");
  assert.equal(await state(),'not-explained');
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).rainOriginStudy,{targetCells:[0,1],fate:'exit'});
  report.push('fate and destination edits invalidate derived origins; ordinary inspection preserves results and zero-outflow remains explicit');

  await evaluate("window.__originBlob=null;window.__originURL=URL.createObjectURL;URL.createObjectURL=b=>{window.__originBlob=b;return window.__originURL(b)};document.querySelector('#export').click()");
  const exported=JSON.parse(await evaluate('window.__originBlob.text()'));
  assert.deepEqual(exported.rainOriginStudy,{targetCells:[0,1],fate:'exit'});
  assert.equal(exported.rainOrigins,undefined);
  await send('Page.reload',{ignoreCache:true});await delay(350);
  assert.equal(await evaluate("document.querySelectorAll('#origin-targets button').length"),2);
  assert.equal(await state(),'not-explained');
  await evaluate("document.querySelector('#origin-clear').click()");
  assert.equal(await evaluate("document.querySelector('#origin-run').disabled"),true);
  const importProject=async project=>evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(project))}],'origin-site.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
  await importProject(exported);
  assert.equal(await evaluate("document.querySelectorAll('#origin-targets button').length"),2);
  const accepted=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  exported.rainOriginStudy.targetCells=[1,1];await importProject(exported);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),accepted);
  assert.ok((await evaluate("document.querySelector('#toast').textContent")).includes('Import refused'));
  report.push('actual export, reload and import preserve origin inputs without derived arrays; rejected destination metadata leaves accepted state unchanged');

  await evaluate("document.querySelector('#origin-fate').value='stored';document.querySelector('#origin-fate').dispatchEvent(new Event('change'));document.querySelector('#origin-run').click();document.querySelector('#rain').value='0';document.querySelector('#rain').dispatchEvent(new Event('change'))");
  assert.equal(await state(),'not-explained');
  await evaluate("document.querySelector('#origin-run').click()");
  assert.ok((await evaluate("document.querySelector('#origin-status').textContent")).includes('No rainfall reaches'));
  assert.ok(!(await evaluate("document.querySelector('#origin-results').textContent")).match(/NaN|Infinity/));
  const large=makeExample();large.width=large.height=24;large.selectedIndex=0;
  large.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'authored origin budget control'}));
  large.proposal=structuredClone(large.existing);large.rainOriginStudy={targetCells:[0],fate:'stored'};
  Object.assign(large.weather,{durationMinutes:720,stepMinutes:1,mobilityPerHour:0,boundaryExitPerHour:0});
  await load(large);await evaluate("document.querySelector('#origin-run').click()");
  assert.equal(await state(),'error');
  assert.ok((await evaluate("document.querySelector('#origin-status').textContent")).includes('cell-step budget'));
  assert.equal(await evaluate("document.querySelector('#origin-results').hidden"),true);
  report.push('weather changes retire origin results; dry behavior is finite and oversized reverse analysis is explicitly refused before retained allocation');
  await send('Emulation.clearDeviceMetricsOverride');
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(original)})`);
  await send('Page.reload',{ignoreCache:true});await delay(350);
}

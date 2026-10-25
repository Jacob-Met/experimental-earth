import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
export async function receiveObservedStorage({evaluate,send,delay,report}) {
  const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'sealed',provenance:'authored browser control'}));p.proposal=structuredClone(p.existing);p.weather={...p.weather,rainMmHr:61,stormMinutes:10,durationMinutes:10,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:2};
  const row={cellIndex:0,minute:2.5,depthMm:2.5,uncertaintyMm:.5,scenario:'existing',use:'challenge',source:'Authored <not field data>'};p.observations=[row];
  const importProject=async data=>evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(data))}],'storage-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
  const text=()=>evaluate("document.querySelector('#storage-result').textContent");
  const state=()=>evaluate("document.querySelector('#storage-result').dataset.state");
  const run=()=>evaluate("document.querySelector('#storage-run').click()");
  const declare=()=>evaluate("{const b=document.querySelector('#storage-basis');b.value='Authored uniform cell depths';b.dispatchEvent(new Event('input'));}");
  await importProject(p);await run();assert.equal(await state(),'error');assert.match(await text(),/Declare why/);
  await declare();await run();assert.equal(await state(),'bounded');assert.match(await text(),/8–12 L/);assert.match(await text(),/no finite upper bound/);assert.match(await text(),/footprint: 10 L/);assert.match(await text(),/whole modeled site: 40 L/);assert.match(await text(),/<not field data>/);
  report.push('explicit spatial declaration required; actual maintained model and sparse original inventory agree with analytic litres; missing cells remain unbounded');
  await evaluate("{const rain=document.querySelector('#rain');rain.value='1';rain.dispatchEvent(new Event('change'));}");assert.equal(await state(),'not-compared');await run();assert.match(await text(),/footprint: 0 L \(below/);
  await importProject({...p,observations:[row,{...row,depthMm:4,uncertaintyMm:0}]});await run();assert.equal(await state(),'contradictory');assert.doesNotMatch(await text(),/Authored model on/);
  report.push('changed forcing retires old comparison; conflicting original bands refuse aggregate and model agreement');
  const complete={...p,observations:[0,1,2,3].map(cellIndex=>({...row,cellIndex}))};await importProject(complete);await run();assert.match(await text(),/32–48 L/);assert.match(await text(),/at most 48 L/);
  const exported=await evaluate(`(async()=>{let blob;const original=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{blob=b;return original.call(URL,b)};HTMLAnchorElement.prototype.click=function(){};try{document.querySelector('#export').click();return await blob.text();}finally{URL.createObjectURL=original;HTMLAnchorElement.prototype.click=click;}})()`);
  assert.deepEqual(JSON.parse(exported).observations,complete.observations);
  await importProject(p);await importProject(JSON.parse(exported));await run();assert.match(await text(),/32–48 L/);
  await send('Page.reload',{ignoreCache:true});await delay(300);assert.equal(await state(),'not-compared');await declare();await run();assert.match(await text(),/32–48 L/);
  report.push('complete coverage bounds whole site; ordinary export, source-only reopen and reload preserve original evidence and recomputation');
  await evaluate("{const r=document.querySelector('#evidence-map-role');r.value='calibration';r.dispatchEvent(new Event('change'));}");await run();assert.equal(await state(),'error');assert.match(await text(),/No readings match/);
  await evaluate("{const r=document.querySelector('#evidence-map-role');r.value='challenge';r.dispatchEvent(new Event('change'));}");await run();assert.equal(await state(),'bounded');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  await evaluate("document.querySelector('#storage-run').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});assert.equal(await state(),'bounded');
  report.push('role exclusion cannot invent evidence; 390px layout contained and keyboard recomputation works');
}

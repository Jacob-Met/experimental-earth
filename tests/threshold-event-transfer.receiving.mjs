import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareThresholdEvidence} from '../threshold-evidence.js';
export async function receiveThresholdTransfer({evaluate,send,delay,report}){
 const a=makeExample();a.width=a.height=2;a.selectedIndex=0;a.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored transfer receiver'}));a.proposal=a.existing.map(c=>({...c,surface:'garden'}));
 Object.assign(a.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});a.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,24,28]};
 const row={cellIndex:0,minute:60,relation:'at-least',thresholdMm:1,uncertaintyMm:0,source:'Authored bounds, not field acquisition',use:'calibration'};
 a.thresholdEvidence=prepareThresholdEvidence(a,'existing','authored-first-storm',[row]);
 const b=structuredClone(a);b.weather.rainMmHr=12;b.thresholdEvidence=prepareThresholdEvidence(b,'existing','authored-second-storm',[{...row,use:'challenge'}]);
 const load=async(selector,value)=>evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)}),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'original-storm.json',{type:'application/json'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
 const state=()=>evaluate("document.querySelector('#threshold-event-status').dataset.state");
 const text=()=>evaluate("document.querySelector('#threshold-event-results').textContent");
 const run=()=>evaluate("document.querySelector('#threshold-event-run').click()");
 await load('#import',a);await load('#threshold-event-file',b);
 await evaluate("(()=>{const e=document.querySelector('#threshold-event-basis');e.value='Explicitly separate authored forcing; no physical independence established.';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await run();assert.equal(await state(),'one-survivor');assert.ok((await text()).includes('Rates still supported: 10 mm/h'));assert.ok((await text()).includes('-56.000'));
 assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")),a);
 report.push('actual two-project file intake challenges unchanged first rates under different forcing and resolves a reversing first-event consequence');
 b.thresholdEvidence.readings[0].relation='at-most';b.thresholdEvidence.readings[0].thresholdMm=0;await load('#threshold-event-file',b);assert.equal(await state(),'not-compared');await run();
 assert.equal(await state(),'ambiguous');assert.ok((await text()).includes('Rates still supported: 24, 28 mm/h'));assert.ok((await text()).includes('higher-or-equal'));
 const delayedWet=structuredClone(b);delayedWet.thresholdEvidence.readings[0].relation='at-least';delayedWet.thresholdEvidence.readings[0].thresholdMm=1;
 await evaluate(`(()=>{window.__transferOriginalText=File.prototype.text;File.prototype.text=function(){if(this.name==='delayed-wet.json')return new Promise(resolve=>{window.__resolveTransferRead=()=>resolve(${JSON.stringify(JSON.stringify(delayedWet))});});return window.__transferOriginalText.call(this);};const e=document.querySelector('#threshold-event-file'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(delayedWet))}],'delayed-wet.json',{type:'application/json'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 try{
  assert.equal(await evaluate("typeof window.__resolveTransferRead==='function'"),true);
  await evaluate("(()=>{const e=document.querySelector('#threshold-event-basis');e.value+=' Reaffirmed during delayed-read control.';e.dispatchEvent(new Event('input',{bubbles:true}));window.__resolveTransferRead();})()");
  await delay(100);
  assert.equal(await evaluate("document.querySelector('#threshold-event-file').value"),'');
  assert.equal(await evaluate("document.querySelector('#threshold-event-source').textContent.includes('delayed-wet.json')"),false);
  assert.equal(await state(),'not-compared');await run();assert.equal(await state(),'ambiguous');
  assert.ok((await text()).includes('Rates still supported: 24, 28 mm/h'));
  report.push('a declaration change retires a delayed wet-source read; accepted dry source survives and the same file can be reselected');
 }finally{await evaluate("(()=>{if(window.__transferOriginalText)File.prototype.text=window.__transferOriginalText;delete window.__transferOriginalText;delete window.__resolveTransferRead;})()");}
 await evaluate("(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.__transferDownload=blob;return original.call(this,blob)};document.querySelector('#threshold-event-export').click();})()");
 const saved=JSON.parse(await evaluate("window.__transferDownload.text()"));assert.equal(saved.metrics,undefined);assert.deepEqual(saved.calibrationProject,a);assert.deepEqual(saved.challengeProject,b);
 await send('Page.reload',{ignoreCache:true});await delay(350);await load('#threshold-event-reopen',saved);assert.equal(await state(),'ambiguous');assert.ok((await text()).includes('Rates still supported: 24, 28 mm/h'));
 report.push('alternate second observation changes consequences without refitting first source; actual source-only export and fresh reopen recompute');
 await evaluate("(()=>{const e=document.querySelector('#threshold-event-basis');e.value='Separate authored forcing, declared again for the active source.';e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 const bad=structuredClone(b);bad.thresholdEvidence.readings[0].relation='at-least';bad.thresholdEvidence.readings[0].thresholdMm=30;await load('#threshold-event-file',bad);await run();assert.equal(await state(),'challenged');assert.ok((await text()).includes('No transferred consequence'));assert.ok((await text()).includes('contradicted'));
 const stale=structuredClone(b);stale.weather.rainMmHr=13;await load('#threshold-event-file',stale);await run();assert.equal(await state(),'second-context-changed');
 report.push('rejected or stale second source cannot substitute a transferred consequence and contradictory modeled readings remain inspectable');
 await load('#threshold-event-file',b);await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.bringToFront');
 assert.equal(await evaluate("(()=>{const b=document.querySelector('#threshold-event-run');b.scrollIntoView({block:'center',behavior:'instant'});b.focus({preventScroll:true});return document.activeElement===b})()"),true);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await delay(50);
 assert.equal(await state(),'ambiguous');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 report.push('narrow visible keyboard activation recomputes the original-source transfer');
}

import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
export async function receiveThresholdEvidence({evaluate,send,delay,report}){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored endpoint software control'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:240,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};
 p.observations=[{cellIndex:0,minute:120,depthMm:12,uncertaintyMm:0,source:'Unchanged numeric-depth control',scenario:'existing',use:'calibration'}];
 const load=async value=>evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'threshold-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
 const stored=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
 const text=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
 const compare=()=>evaluate("document.querySelector('#threshold-compare').click()");
 const add=async({minute,relation,use='calibration',threshold=5,uncertainty='0'})=>evaluate(`(()=>{const fields=${JSON.stringify({'threshold-event':'authored endpoint event','threshold-cell':'0','threshold-minute':String(minute),'threshold-relation':relation,'threshold-depth':String(threshold),'threshold-uncertainty':uncertainty,'threshold-source':'Authored bound software control, not field evidence','threshold-role':use})};for(const [id,value] of Object.entries(fields))document.getElementById(id).value=value;document.querySelector('#threshold-add').click();})()`);
 await load(p);await add({minute:120,relation:'at-least',uncertainty:''});assert.equal((await stored()).thresholdEvidence,undefined);assert.ok((await text('#threshold-status')).includes('numeric fields'));
 await add({minute:120,relation:'at-least'});await add({minute:180,relation:'at-most',use:'challenge'});await compare();
 assert.ok((await text('#threshold-results')).includes('Calibration-compatible rates: 3, 9 mm/h. Remaining after held-aside checks: 9 mm/h'));
 assert.deepEqual((await stored()).observations,p.observations);assert.equal((await stored()).thresholdEvidence.readings.length,2);
 report.push('actual source-bound lower/upper entry requires explicit uncertainty, retains two roles, and separates calibration3/9 from surviving9 without altering numeric notebook');
 const saved=await stored();await send('Page.reload',{ignoreCache:true});await delay(350);await compare();assert.deepEqual((await stored()).thresholdEvidence,saved.thresholdEvidence);assert.ok((await text('#threshold-results')).includes('Remaining after held-aside checks: 9'));
 const impossible=structuredClone(saved);impossible.thresholdEvidence.readings[1].thresholdMm=0;await load(impossible);assert.equal(await evaluate("document.querySelector('#threshold-status').dataset.state"),'not-compared');await compare();assert.equal(await text('#threshold-status'),'challenged');assert.ok((await text('#threshold-results')).includes('Calibration-compatible rates: 3, 9'));
 report.push('reload recomputes retained raw bounds; changed held-aside threshold rejects survivors without tuning calibration');
 const changed=structuredClone(saved);changed.weather.rainMmHr=31;await load(changed);await compare();assert.equal(await text('#threshold-status'),'context-changed');assert.equal(await text('#threshold-results'),'');await add({minute:200,relation:'at-most'});assert.equal((await stored()).thresholdEvidence.readings.length,2);assert.ok((await text('#threshold-status')).includes('no automatic reassociation'));
 report.push('changed forcing refuses original-event evidence and prevents appending under a silently rebound context');
 await load(saved);await compare();await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
 report.push('source-bound bounds and per-rate explanations remain available in narrow layout');
}

import assert from 'node:assert/strict';
import {receiveThresholdEvidence} from './threshold.receiving.mjs';
export async function receiveThresholdIntervention(session){
 const {evaluate,send,delay,report}=session;
 await receiveThresholdEvidence(session);
 const stored=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
 const load=async value=>evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'threshold-effects.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
 const run=()=>evaluate("document.querySelector('#threshold-effect-run').click()");
 const status=()=>evaluate("document.querySelector('#threshold-effect-status').dataset.state");
 const text=()=>evaluate("document.querySelector('#threshold-effect-results').textContent");
 const subset=async value=>evaluate(`(()=>{const e=document.querySelector('#threshold-effect-subset');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const source=await stored();source.proposal[0].surface='sealed';await load(source);await run();
 assert.equal(await status(),'compared');assert.ok((await text()).includes('Retained rates: 3, 9 mm/h'));assert.ok((await text()).includes('Final stored water'));assert.ok((await text()).includes('Water-account residuals'));
 const saved=await stored();assert.deepEqual(saved,source);
 await subset('surviving');assert.equal(await status(),'not-compared');assert.equal(await text(),'');await run();assert.ok((await text()).includes('Retained rates: 9 mm/h'));
 report.push('original entered bounds drive paired consequences for all calibration rates or the one held-aside survivor; selecting subset retires stale results without source mutation');
 await send('Page.reload',{ignoreCache:true});await delay(350);assert.equal(await status(),'not-compared');await run();assert.ok((await text()).includes('Retained rates: 3, 9 mm/h'));assert.deepEqual(await stored(),saved);
 const bad=structuredClone(saved);bad.thresholdEvidence.readings[1].thresholdMm=0;await load(bad);await subset('surviving');await run();assert.equal(await status(),'no-compatible-rates');assert.equal(await text(),'');await subset('calibration');await run();assert.ok((await text()).includes('Retained rates: 3, 9 mm/h'));
 const stale=structuredClone(saved);stale.weather.rainMmHr=31;await load(stale);await run();assert.equal(await status(),'context-changed');assert.equal(await text(),'');
 report.push('raw-project reopen recomputes; rejected held-aside support and changed observed forcing cannot show substitute consequences');
 await load(saved);await subset('calibration');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.bringToFront');
 const focus=await evaluate("(()=>{const b=document.querySelector('#threshold-effect-run');b.scrollIntoView({block:'center',behavior:'instant'});b.focus({preventScroll:true});const r=b.getBoundingClientRect();return {active:document.activeElement?.id,focused:document.hasFocus(),disabled:b.disabled,width:r.width,height:r.height};})()");
 assert.equal(focus.active,'threshold-effect-run');assert.ok(focus.width>0&&focus.height>0);assert.equal(focus.disabled,false);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await delay(50);
 assert.equal(await status(),'compared');assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
 report.push('390px keyboard activation produces retained consequence ranges and every cell without horizontal overflow');
}

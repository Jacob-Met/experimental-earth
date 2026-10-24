import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
export async function receivePlacementDuration({evaluate,send,delay,report}) {
 const p=makeExample();p.proposal=structuredClone(p.existing);p.infiltrationStudy={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
 await evaluate(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(p))}],'duration-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);
 const set=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 async function run(id){await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);for(let i=0;i<100;i++){await delay(30);if(await evaluate(`!document.getElementById(${JSON.stringify(id)}).disabled`))break;}}
 await evaluate("document.querySelector('#placement-clear').click();for(const i of [18,19,27,36])document.querySelector('#placement-grid [data-cell-index=\"'+i+'\"]').click()");
 await set('placement-duration-cells','C2');await set('placement-duration-threshold','5');await set('placement-duration-limit','-50');await set('placement-duration-basis','Authored software wet-window control, not safety guidance');
 const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");await run('placement-run');
 assert.ok(await evaluate("document.querySelector('#placement-results').textContent.includes('C3 + D4 · best for this objective')"));
 await evaluate("document.querySelector('#placement-results tr[data-cells=\"27,36\"] button').click()");
 assert.equal(await evaluate("document.querySelector('#placement-adopt').disabled"),true);
 assert.ok(await evaluate("document.querySelector('.placement-duration-witnesses').textContent.includes('at modeled end: yes')"));
 assert.ok(await evaluate("document.querySelector('.placement-duration-witnesses').textContent.includes('0.2 mm/h')"));
 report.push('site winner fails full-family duration goal; all original-rate intervals and wet modeled-end flags retained, adoption disabled');
 await run('placement-resolution-run');assert.equal(await evaluate("document.querySelector('#placement-resolution-results').dataset.state"),'compared');
 assert.ok(await evaluate("document.querySelector('#placement-resolution-results').textContent.includes('Local-target qualifications are unchanged')"));
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),saved);
 await set('placement-duration-limit','-50.75');assert.equal(await evaluate("!!document.querySelector('#placement-resolution-results')"),false);await run('placement-run');await run('placement-resolution-run');
 assert.ok(await evaluate("document.querySelector('#placement-resolution-results').textContent.includes('Some local-target qualifications change')"));
 report.push('unchanged source and fixed original support: -50min stable, -50.75min qualification changes at finer intervals; editing removes stale result');
 await set('placement-duration-limit','-240');await run('placement-run');assert.ok(await evaluate("document.querySelector('#placement-status').dataset.state==='no-qualifying-placement'"));
 await set('placement-duration-limit','-50');await run('placement-run');await evaluate("document.querySelector('#placement-results tr[data-cells=\"27,36\"] button').click()");
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await evaluate("document.querySelector('#placement-duration-threshold').focus();document.querySelector('.placement-duration-witnesses details').open=true");assert.equal(await evaluate('document.activeElement.id'),'placement-duration-threshold');
 report.push('impossible duration goal has no fallback winner; narrow screen exposes inspectable censored intervals and focusable threshold input');
}

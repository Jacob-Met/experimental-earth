import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
export async function receivePlacementConstraints({evaluate,send,delay,report}) {
 const p=makeExample();p.proposal=structuredClone(p.existing);p.infiltrationStudy={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
 await evaluate(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(p))}],'local-target-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);
 const set=async(id,value)=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 async function run(){await evaluate("document.querySelector('#placement-run').click()");for(let i=0;i<100;i++){await delay(30);if(await evaluate("!document.querySelector('#placement-run').disabled"))break;}}
 await evaluate("document.querySelector('#placement-sealed').click()");await set('placement-target-cells','C2');await set('placement-target-limit','-1');await set('placement-target-basis','Authored target, not a field observation');await run();
 assert.equal(await evaluate("document.querySelector('#placement-status').dataset.state"),'compared');
 assert.ok(await evaluate("document.querySelector('#placement-detail').textContent.includes('Meets every local target')"));
 assert.equal(await evaluate("document.querySelectorAll('.placement-target-witnesses p').length"),4);
 assert.equal(await evaluate("document.querySelectorAll('.placement-table tbody tr').length"),79);
 assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).proposal,p.proposal);
 await evaluate("document.querySelector('.placement-table tr[data-cells=\"27,36\"] button').click()");
 assert.equal(await evaluate("document.querySelector('#placement-adopt').disabled"),true);
 assert.ok(await evaluate("document.querySelector('#placement-detail').textContent.includes('exceeds target')"));
 report.push('C2 target changes qualifying selection; all79 alternatives and three original rate witnesses remain visible; violating site winner cannot be applied');
 await set('placement-target-limit','-1000');assert.equal(await evaluate("document.querySelector('#placement-results').children.length"),0);await run();
 assert.equal(await evaluate("document.querySelector('#placement-status').dataset.state"),'no-qualifying-placement');assert.equal(await evaluate("document.querySelector('#placement-adopt').disabled"),true);
 report.push('changed limit retires old results; impossible reduction shows no qualifying placement and no adoption fallback');
 await set('placement-target-cells','Y99');await run();assert.ok(await evaluate("document.querySelector('#placement-status').textContent.includes('cell')"));
 await set('placement-target-cells','C2');await set('placement-target-limit','-1');await run();
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await evaluate("document.querySelector('#placement-target-basis').focus()");assert.equal(await evaluate("document.activeElement.id"),'placement-target-basis');
 await evaluate("document.querySelector('#placement-adopt').click()");
 const adopted=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.notDeepEqual(adopted.proposal,p.proposal);assert.deepEqual(adopted.existing,p.existing);assert.deepEqual(adopted.observations,p.observations);
 report.push('narrow target inputs stay contained and focusable; explicit qualifying adoption preserves original geometry and observations');
 // Restore the original imported control and its witnesses for visual receiving.
 await evaluate(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(p))}],'local-target-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);
 await evaluate("document.querySelector('#placement-sealed').click()");await run();
 assert.ok(await evaluate("document.querySelector('.placement-target-witnesses').textContent.includes('Meets every local target')"));
}

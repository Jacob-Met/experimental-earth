import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {interpolateDepth} from '../infiltration-study.js';
export async function receivePlacementResolution({evaluate,send,delay,report}) {
 const p=makeExample();p.proposal=structuredClone(p.existing);p.infiltrationStudy={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
 const load=async project=>{await evaluate(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(project))}],'resolution-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(200);};
 const set=async(id,value,event='input')=>evaluate(`(()=>{const el=document.getElementById(${JSON.stringify(id)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`);
 async function clickRun(id){await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);for(let i=0;i<100;i++){await delay(30);if(await evaluate(`!document.getElementById(${JSON.stringify(id)}).disabled`))break;}}
 const state=()=>evaluate("document.getElementById('placement-resolution-results').dataset.state");
 const chooseFour=()=>evaluate("document.querySelector('#placement-clear').click();for(const i of [18,19,27,36])document.querySelector('#placement-grid [data-cell-index=\"'+i+'\"]').click()");
 await load(p);await evaluate("document.querySelector('#placement-sealed').click()");await clickRun('placement-run');await clickRun('placement-resolution-run');assert.equal(await state(),'work-limit');
 assert.ok(await evaluate("document.querySelector('#placement-resolution-results').textContent.includes('no layouts were silently removed')"));
 report.push('full79-layout combined workload refuses explicitly without silently reducing eligibility');
 await chooseFour();await set('placement-target-cells','C2');await set('placement-target-limit','-1.8');await set('placement-target-basis','Authored interval-sensitivity target');
 await clickRun('placement-run');const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");await clickRun('placement-resolution-run');assert.equal(await state(),'compared');
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#placement-resolution-results table tr')).slice(1).map(r=>Array.from(r.children).map(c=>c.textContent))"),[['5','4','C3 + E5'],['2.5','2','C3 + D4'],['1.25','2','C3 + D4']]);
 assert.ok(await evaluate("document.querySelector('#placement-resolution-results').textContent.includes('Some local-target qualifications change')"));
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),saved);
 report.push('same11 layouts and three fixed rates expose C2 qualification reversal and changed best set without adopting any source or calculation edit');
 await set('placement-target-limit','-1');assert.equal(await evaluate("!!document.querySelector('#placement-resolution-results')"),false);await clickRun('placement-run');await clickRun('placement-resolution-run');assert.ok(await evaluate("document.querySelector('#placement-resolution-results').textContent.includes('Local-target qualifications are unchanged')"));
 report.push('target edits remove the old finer-step result; stable -1mm control is recomputed');
 const one=structuredClone(p),model=runRain(p.existing,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}});
 one.observations=[{cellIndex:27,minute:60,depthMm:interpolateDepth(model,27,60).depthMm,uncertaintyMm:0,source:'Synthetic single-support control, not field evidence',scenario:'existing',use:'calibration'}];
 await load(one);await chooseFour();await set('placement-subset','calibration','change');await clickRun('placement-run');await clickRun('placement-resolution-run');assert.equal(await state(),'compared');assert.ok(await evaluate("document.querySelector('#placement-resolution-results').textContent.includes('Fixed original support: 1 mm/h')"));
 report.push('one original calibration-supported rate survives as a fixed sensitivity hypothesis instead of being reconditioned at finer intervals');
 const minimum=structuredClone(p);minimum.weather.stepMinutes=1;await load(minimum);await set('placement-subset','all','change');await chooseFour();await clickRun('placement-run');await clickRun('placement-resolution-run');assert.equal(await state(),'minimum-step');
 await load(p);await chooseFour();await set('placement-target-limit','-1.8');await clickRun('placement-run');await clickRun('placement-resolution-run');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await evaluate("document.querySelector('#placement-resolution-run').focus()");assert.equal(await evaluate('document.activeElement.id'),'placement-resolution-run');
 await evaluate("const all=document.querySelector('#placement-resolution-results > details');all.open=true;Array.from(all.querySelectorAll(':scope > details')).find(d=>d.querySelector('summary').textContent.startsWith('C3 + E5')).open=true");
 report.push('supported minimum refuses; narrow controls and complete selected-layout witnesses remain focusable and inspectable');
}

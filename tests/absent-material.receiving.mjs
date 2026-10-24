import assert from 'node:assert/strict';
import {makeExample} from '../core.js';

export async function receiveAbsentMaterial({evaluate,delay,report}) {
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'Authored analytic control, not field evidence'}));p.proposal=structuredClone(p.existing);
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});
 p.infiltrationStudy={target:'existing',surface:'garden',ratesMmHr:[0,12,24]};
 const load=async value=>evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'absent-material-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
 const state=()=>evaluate("document.querySelector('#placement-status').dataset.state");
 async function run(){await evaluate("document.querySelector('#placement-run').click()");for(let i=0;i<100;i++){if(await evaluate("!document.querySelector('#placement-run').disabled"))break;await delay(30);}}
 const select=async()=>evaluate("(()=>{document.querySelector('#placement-clear').click();document.querySelector('#placement-grid [data-cell-index=\"0\"]').click();const s=document.querySelector('#placement-subset');s.value='all';s.dispatchEvent(new Event('change'));})()");
 const best=()=>evaluate("document.querySelector('.placement-table tbody tr').dataset.cells");
 await load(p);await select();await run();assert.equal(await state(),'compared');assert.equal(await best(),'');
 assert.ok((await evaluate("document.querySelector('.placement-absent-note').textContent")).includes('source observations have not constrained them'));
 await evaluate("document.querySelector('.placement-table [data-cells=\"0\"] button').click()");
 assert.ok((await evaluate("document.querySelector('#placement-detail').textContent")).includes('Water not absorbed: -23 to 1 L; reverses'));
 const stored=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.deepEqual(stored.proposal,p.proposal);
 report.push('absent source material evaluates identical baseline under three declared rates; introduction reverses -23 to +1L and no change wins without editing source');
 const positive=structuredClone(p);positive.infiltrationStudy.ratesMmHr=[12,24];await load(positive);assert.equal(await state(),'not-compared');await run();assert.equal(await best(),'0');
 report.push('removing explicitly declared zero-capacity hypothesis changes best to introduced material and invalidates prior comparison');
 const observed=structuredClone(p);observed.observations=[{cellIndex:0,minute:60,depthMm:29,uncertaintyMm:100,source:'Authored broad band, not field evidence',scenario:'existing',use:'calibration'}];
 await load(observed);await evaluate("(()=>{const s=document.querySelector('#placement-subset');s.value='calibration';s.dispatchEvent(new Event('change'));})()");await run();assert.equal(await state(),'no-compatible-rates');
 assert.equal(await evaluate("document.querySelectorAll('.placement-table').length"),0);
 assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).observations,observed.observations);
 report.push('even broad source depth bands cannot calibrate a material absent from observed geometry; no hypothetical evidence refit or partial results');
 await load(p);await select();await run();
 await evaluate("(()=>{document.querySelector('#placement-results > details').open=true;document.querySelector('.placement-table [data-cells=\"0\"] button').click();})()");
}

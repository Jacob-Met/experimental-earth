import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { interpolateDepth } from '../infiltration-study.js';

export async function receivePlacements({evaluate,send,delay,report}) {
  const p=makeExample();p.proposal=structuredClone(p.existing);
  p.infiltrationStudy={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
  const load=async value=>evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'placement-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
  const text=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
  async function run(){await evaluate("document.querySelector('#placement-run').click()");for(let i=0;i<100;i++){if(await evaluate("!document.querySelector('#placement-run').disabled"))break;await delay(30);}assert.equal(await evaluate("document.querySelector('#placement-status').dataset.state"),'compared');}
  const best=()=>evaluate("document.querySelector('.placement-table tbody tr').dataset.cells");
  await load(p);
  await evaluate("document.querySelector('#placement-sealed').click()");
  assert.ok((await text('#placement-selection')).includes('12/12'));
  await run();assert.equal(await best(),'27,36');
  assert.equal(await evaluate("document.querySelectorAll('.placement-table tbody tr').length"),79);
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).proposal,p.proposal);
  assert.ok((await text('#placement-detail')).includes('additional changes from the current proposal'));
  report.push('explicit12-cell eligibility enumerates79 variants through real model, chooses non-greedy pair and leaves active proposal unchanged');
  await evaluate("(()=>{const o=document.querySelector('#placement-objective');o.value='exitLiters';o.dispatchEvent(new Event('change'));})()");
  assert.equal(await evaluate("document.querySelector('#placement-status').dataset.state"),'not-compared');
  await run();assert.equal(await best(),'34,35');
  await evaluate("(()=>{const o=document.querySelector('#placement-objective');o.value='unabsorbedLiters';o.dispatchEvent(new Event('change'));document.querySelector('#placement-grid [data-cell-index=\"36\"]').click();})()");
  await run();assert.equal(await best(),'28,35');
  report.push('changed objective selects different tradeoff; excluding one eligible location changes best pair and clears prior result');

  const observed=structuredClone(p);observed.infiltrationStudy.target='proposal';
  const model=runRain(observed.proposal,observed.width,observed.height,observed.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}});
  observed.observations=[{cellIndex:27,minute:60,depthMm:interpolateDepth(model,27,60).depthMm,uncertaintyMm:0,source:'Authored source-geometry control; not field evidence',scenario:'proposal',use:'calibration'}];
  await load(observed);
  await evaluate("(()=>{document.querySelector('#placement-clear').click();document.querySelector('#placement-grid [data-cell-index=\"27\"]').click();const s=document.querySelector('#placement-subset');s.value='calibration';s.dispatchEvent(new Event('change'));})()");
  await run();assert.equal(await best(),'27');
  assert.ok((await text('#placement-status')).includes('2 variants × 1 fixed hypotheses'));
  assert.equal(await evaluate("document.querySelector('#placement-adopt').disabled"),true);
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).observations,observed.observations);
  report.push('proposal-target calibration stays conditioned on original geometry; hypothetical comparison retains rate1 and prevents reassociation of observed proposal');

  const adoptable=structuredClone(p);adoptable.observations=[{...observed.observations[0],scenario:'existing'}];
  await load(adoptable);await evaluate("document.querySelector('#placement-sealed').click()");await run();
  assert.equal(await best(),'27,36');assert.equal(await evaluate("document.querySelector('#placement-adopt').disabled"),false);
  await evaluate("document.querySelector('#placement-adopt').click()");
  const accepted=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.deepEqual(accepted.existing,adoptable.existing);assert.deepEqual(accepted.observations,adoptable.observations);
  assert.deepEqual(accepted.proposal.flatMap((c,i)=>c.surface!==adoptable.proposal[i].surface?[i]:[]),[27,36]);
  assert.equal(await evaluate("document.querySelector('#placement-status').dataset.state"),'not-compared');
  await send('Page.reload',{ignoreCache:true});await delay(350);
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).proposal,accepted.proposal);
  report.push('explicit adoption changes only chosen hypothetical proposal surfaces; original site/readings preserved, old comparison retired and reload durable');

  // Leave a useful comparative state for desktop and narrow pixel review.
  await load(p);await evaluate("document.querySelector('#placement-sealed').click()");await run();
  await evaluate("document.querySelector('#placement-results > details').open=true");
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
}

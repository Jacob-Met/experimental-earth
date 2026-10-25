import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {receivingFixture} from './fixtures/placement-receiving-source.mjs';
import {comparePlacements} from '../placement-search.js';
import {serializeDrainingEvidence} from '../draining-layer-evidence.js';
import {parsePlacementInvestigation,serializePlacementInvestigation} from '../placement-investigation.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.PLACEMENT_RECEIVING_RECEIPT_DIR?resolve(process.env.PLACEMENT_RECEIVING_RECEIPT_DIR):await mkdtemp(join(tmpdir(),'earth-receiving-placements-'));
await mkdir(output,{recursive:true});const downloads=join(output,'downloads');await mkdir(downloads,{recursive:true});
const {project,query}=receivingFixture(),originalPath=join(output,'original-receiving-evidence.json');
await writeFile(originalPath,serializeDrainingEvidence(project,query.receivingStudy));
const expected=comparePlacements(project,query),survivor=comparePlacements(project,{...query,subset:'surviving'});
const sourceHashes={};for(const path of [...(await readdir(root)).filter(p=>/\.(js|css|html)$/.test(p)),'tests/placement-receiving.browser.mjs','tests/fixtures/placement-receiving-source.mjs'])sourceHashes[path]=createHash('sha256').update(await readFile(join(root,path))).digest('hex');
const report=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory:join(output,'browser-session')},async session=>{
 const {evaluate,send,exceptions}=session;
 const text=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
 const state=()=>evaluate("document.querySelector('#placement-status').dataset.state");
 const savedProject=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
 const set=async values=>evaluate(`(()=>{for(const [id,value]of Object.entries(${JSON.stringify(values)})){const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`);
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 const upload=async(id,value,name='authored-input.json')=>evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(id)}),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const wait=async(predicate,label)=>{for(let i=0;i<150;i++){if(await predicate())return;await delay(30);}throw Error('Timed out: '+label);};
 async function run(expectedState='compared'){await click('placement-run');await wait(()=>evaluate("!document.querySelector('#placement-run').disabled"),'placement computation');assert.equal(await state(),expectedState,await text('#placement-status'));}
 const rows=()=>evaluate("[...document.querySelectorAll('#placement-results > details .placement-table tbody tr')].map(r=>({cells:r.dataset.cells,text:r.textContent}))");
 const best=async()=>(await rows()).filter(r=>r.text.includes('best for this objective')).map(r=>r.cells);
 async function openFile(id,path){const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#'+id});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await wait(async()=>/Original placement inputs opened/.test(await text('#placement-status')),'actual original file opening');}
 let failure=null;
 try {
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await wait(()=>evaluate("!!document.querySelector('#placement-receiving-open')"),'placement receiving controls');
  await openFile('placement-receiving-open',originalPath);
  assert.deepEqual(await savedProject(),project);assert.match(await text('#placement-selection'),/^0\/12/);
  assert.equal(await evaluate("document.querySelector('#placement-single-layer').hidden"),true);
  assert.match(await text('#placement-study'),/sealed 1 mm\/h, turf 9 mm\/h, garden 24 mm\/h/);
  await evaluate("document.querySelector('#placement-sealed').focus()");
  assert.equal(await evaluate('document.activeElement.id'),'placement-sealed');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  assert.match(await text('#placement-selection'),/^11\/12/);
  await run();assert.match(await text('#placement-status'),/67 variants × 4 fixed hypotheses/);assert.deepEqual(await best(),['35,36']);
  assert.equal((await rows()).length,67);assert.equal(await evaluate("document.querySelectorAll('#placement-receiving-evidence [data-hypothesis-id]').length"),4);
  report.push('Actual native receiving-evidence file opens original source, fixed model defaults and all four explanations; keyboard selects all 11 eligible cells and all 67 layouts run');

  await set({'placement-subset':'calibration'});await run();assert.match(await text('#placement-status'),/67 variants × 2 fixed hypotheses/);
  assert.match(await text('#placement-detail'),/Authored receiver 0/);assert.match(await text('#placement-detail'),/Authored receiver 1/);
  const calibrationRows=await rows();assert.deepEqual(await savedProject(),project);
  await set({'placement-subset':'surviving'});await run();assert.match(await text('#placement-status'),/67 variants × 1 fixed hypotheses/);
  assert.ok(expected.plans[0].score>survivor.plans[0].score+100);assert.notDeepEqual(await rows(),calibrationRows);
  assert.match(await text('#placement-receiving-evidence'),/outside at least one band/);
  report.push('Original calibration retains two explanations and held-aside input retains one; changed consequence range is visible while all offered/rejected explanations and original readings remain inspectable');

  await click('placement-save');let downloaded;
  await wait(async()=>{downloaded=(await readdir(downloads)).find(n=>n.endsWith('.json'));return Boolean(downloaded);},'actual original-input download');
  const downloadPath=join(downloads,downloaded),downloadText=await readFile(downloadPath,'utf8'),input=parsePlacementInvestigation(downloadText);
  assert.equal(JSON.parse(downloadText).schema,'experimental-earth-placement-investigation/2');assert.deepEqual(input.project,project);assert.deepEqual(input.query.receivingStudy,query.receivingStudy);
  assert.ok(!downloadText.includes('survivingIds'));assert.ok(!downloadText.includes('plans'));
  const beforeRows=await rows();await send('Page.reload',{ignoreCache:true});await wait(()=>evaluate("!!document.querySelector('#placement-open')"),'reloaded consumer');
  await openFile('placement-open',downloadPath);await run();assert.deepEqual(await rows(),beforeRows);assert.deepEqual(await savedProject(),project);
  report.push('Actual strict-v2 source-only download survives reload and native file chooser; every layout and source-supported hypothesis recomputes identically');

  const forged=JSON.parse(downloadText);forged.schema='experimental-earth-placement-investigation/1';
  await upload('placement-open',forged);await delay(80);assert.equal(await state(),'not-compared');assert.match(await text('#placement-status'),/version 2/);assert.deepEqual(await savedProject(),project);
  forged.schema='experimental-earth-placement-investigation/2';forged.best=[[35,36]];await upload('placement-open',forged);await delay(80);assert.match(await text('#placement-status'),/conclusions/);
  delete forged.best;forged.project.observations[1].depthMm=999;await upload('placement-open',forged);await wait(async()=>/Original placement inputs opened/.test(await text('#placement-status')),'contradictory original challenge opening');
  await run('no-compatible-receivers');assert.equal((await rows()).length,0);assert.equal(await evaluate("document.querySelector('#placement-save')===null"),true);
  assert.equal(await evaluate("document.querySelectorAll('#placement-receiving-evidence [data-hypothesis-id]').length"),4);
  report.push('Downgraded schema and forged winner refuse; a changed original held-aside reading rejects every receiver with no computed winner, save button or hidden fallback');

  const smallQuery={...input.query,eligibleCells:[35,36],targets:[{cellIndex:10,maxPeakChangeMm:0,basis:'Authored local target'}],durationGoal:{cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:0,basis:'Authored finite duration target'}};
  const tradeoffs={metrics:['unabsorbedLiters','maxDepthMm'],costUnit:'authored work units',budget:2,cellCosts:smallQuery.eligibleCells.map(cellIndex=>({cellIndex,cost:1,source:'Authored common cost'}))};
  const smallPath=join(output,'receiver-duration-cost-inputs.json');await writeFile(smallPath,serializePlacementInvestigation(project,smallQuery,tradeoffs));
  await openFile('placement-open',smallPath);await run();assert.match(await text('#placement-status'),/4 variants × 1 fixed hypotheses/);
  assert.match(await text('#placement-detail'),/Authored receiver 1 \(h1\).*wet min/s);assert.ok(!/undefined/.test(await text('#placement-results')));
  await click('placement-resolution-run');await wait(()=>evaluate("!document.querySelector('#placement-resolution-run').disabled"),'finer calculations');
  assert.equal(await evaluate("document.querySelector('#placement-resolution-results').dataset.state"),'compared');assert.match(await text('#placement-resolution-results'),/Fixed original support: h1/);
  assert.ok(await evaluate("Number(document.querySelector('#placement-tradeoff-results').dataset.frontierCount)>0"));assert.deepEqual(await savedProject(),project);
  report.push('Named receiver witnesses reach peak targets, duration, cost and all finer-interval layouts with original h1 support fixed');

  await openFile('placement-open',downloadPath);await run();await click('placement-adopt');
  const adopted=await savedProject();assert.deepEqual(adopted.existing,project.existing);assert.deepEqual(adopted.observations,project.observations);
  assert.deepEqual(adopted.proposal.flatMap((c,i)=>c.surface!==project.proposal[i].surface?[i]:[]),[35,36]);assert.equal(adopted.receivingStudy,undefined);assert.equal(await state(),'not-compared');
  report.push('Explicit adoption changes only the chosen hypothetical surfaces; original readings remain attached and receiving assumptions are not silently installed as site properties');

  await openFile('placement-open',downloadPath);
  await evaluate("(()=>{const original=File.prototype.text;window.__receivingRace={restore:()=>{File.prototype.text=original;}};File.prototype.text=function(){if(this.name!=='delayed-receiver.json')return original.call(this);return new Promise((yes,no)=>{window.__receivingRace.release=()=>original.call(this).then(yes,no);});};})()");
  const delayed=JSON.parse(await readFile(originalPath,'utf8'));delayed.project.weather.rainMmHr=41;
  await upload('placement-receiving-open',delayed,'delayed-receiver.json');await openFile('placement-open',smallPath);
  await evaluate('window.__receivingRace.release()');await delay(60);assert.deepEqual(await savedProject(),project);assert.match(await text('#placement-selection'),/^2\/12/);
  await run();assert.match(await text('#placement-status'),/4 variants × 1 fixed hypotheses/);
  await upload('placement-receiving-open',delayed,'delayed-receiver.json');await click('placement-receiving-clear');
  await evaluate('window.__receivingRace.release()');await delay(60);assert.equal(await evaluate("document.querySelector('#placement-single-layer').hidden"),false);assert.deepEqual(await savedProject(),project);
  await evaluate('window.__receivingRace.restore();delete window.__receivingRace');await run();assert.ok(!/receiving explanations/.test(await text('#placement-study')));
  report.push('Delayed native receiving intake cannot replace a newer placement file or undo an explicit return to infiltration hypotheses');

  await openFile('placement-open',smallPath);await run();await evaluate("document.querySelector('#placement-receiving-evidence').open=true");
  for(const [name,width,height]of [['desktop',1440,1000],['narrow',390,844]]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await delay(50);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   const clip=await evaluate("(()=>{const r=document.querySelector('#placement-search').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
   const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));
  }
  report.push('Actual desktop and 390 px consumer remains contained with original explanations and current comparison inspectable');
 } catch(error){failure=error;}
 const receipt={passed:!failure&&!exceptions.length,report,exceptions,sandbox:session.sandbox,sourceHashes,
  sourceSha256:createHash('sha256').update(await readFile(originalPath)).digest('hex'),
  authored:{calibrationBest:expected.best,calibrationWorstLiters:expected.plans[0].score,survivingBest:survivor.best,survivingWorstLiters:survivor.plans[0].score},failure:failure?String(failure.stack):null};
 await writeFile(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,checks:report.length,output,failure:receipt.failure}));
 if(failure)throw failure;if(exceptions.length)throw Error('Browser exceptions');
});

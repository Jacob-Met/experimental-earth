import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeExample} from '../core.js';
import {comparePlacements} from '../placement-search.js';
import {parsePlacementInvestigation,serializePlacementInvestigation} from '../placement-investigation.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.PLACEMENT_DRAINING_RECEIPT_DIR?resolve(process.env.PLACEMENT_DRAINING_RECEIPT_DIR):await mkdtemp(join(tmpdir(),'earth-draining-placement-'));
await mkdir(output,{recursive:true});const downloads=join(output,'downloads');await mkdir(downloads,{recursive:true});
const project=makeExample();project.proposal=structuredClone(project.existing);
project.infiltrationStudy={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
project.observations=[{cellIndex:27,minute:60,depthMm:0,uncertaintyMm:1,source:'Authored custody control, not a field observation',scenario:'existing',use:'calibration'}];
const layer={schema:'experimental-earth-draining-layer/1',surface:'garden',capacityMm:5,initialStoredMm:0,drainagePerHour:1,source:'Authored finite receiver, not measured soil'};
const query={eligibleCells:project.proposal.flatMap((c,i)=>c.surface==='sealed'?[i]:[]),maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study:project.infiltrationStudy,drainingLayer:layer};
const expected=comparePlacements(project,query);assert.deepEqual(expected.best,[[35,36]]);
const sourceHashes={};for(const path of [...(await readdir(root)).filter(p=>/\.(js|css|html)$/.test(p)),'tests/placement-draining.browser.mjs'])sourceHashes[path]=createHash('sha256').update(await readFile(join(root,path))).digest('hex');
const report=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory:join(output,'browser-session')},async session=>{
 const {evaluate,send,exceptions}=session;
 const text=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
 const state=()=>evaluate("document.querySelector('#placement-status').dataset.state");
 const savedProject=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
 const set=async values=>evaluate(`(()=>{for(const [id,value]of Object.entries(${JSON.stringify(values)})){const e=document.getElementById(id);e.value=String(value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`);
 const click=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
 const upload=async(id,value,name='authored-input.json')=>evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(id)}),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 const wait=async(predicate,label)=>{for(let i=0;i<120;i++){if(await predicate())return;await delay(30);}throw Error('Timed out: '+label);};
 async function run(expectedState='compared'){await click('placement-run');await wait(()=>evaluate("!document.querySelector('#placement-run').disabled"),'placement computation');assert.equal(await state(),expectedState,await text('#placement-status'));}
 const best=()=>evaluate("[...document.querySelectorAll('#placement-results > details .placement-table tbody tr')].filter(r=>r.textContent.includes('best for this objective')).map(r=>r.dataset.cells)");
 async function openFile(path){const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#placement-open'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await wait(async()=>/Original placement inputs opened/.test(await text('#placement-status')),'actual saved file reopening');}
 let failure=null;
 try{
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await wait(()=>evaluate("!!document.querySelector('#placement-run')"),'placement panel');
  await upload('import',project);await delay(180);await click('placement-sealed');
  assert.equal(await evaluate("document.querySelector('#placement-layer-enabled').checked"),false);
  await run();assert.deepEqual(await best(),['27,36']);
  assert.equal(await evaluate("document.querySelectorAll('#placement-results > details .placement-table tbody tr').length"),79);
  const original=await savedProject();assert.deepEqual(original.proposal,project.proposal);assert.deepEqual(original.observations,project.observations);
  report.push('Unchanged default enumerates79 layouts and retains unlimited-model best27,36; no source mutation');

  await evaluate("document.querySelector('#placement-layer-enabled').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  assert.equal(await evaluate("document.querySelector('#placement-layer-enabled').checked"),true);
  assert.equal(await state(),'not-compared');
  await set({'placement-layer-source':layer.source});await run();assert.deepEqual(await best(),['35,36']);
  assert.match(await text('#placement-detail'),/retained .*drained .*accepted /);
  assert.match(await text('#placement-study'),/have not calibrated/);
  assert.equal(await evaluate("document.querySelectorAll('#placement-results > details .placement-table tbody tr').length"),79);
  assert.deepEqual(await savedProject(),original);
  report.push('Keyboard-enabled5mm receiver at1/hour changes best to35,36 through all79 layouts; receiving totals and uncalibrated basis visible');

  await set({'placement-layer-drainage':0});assert.equal(await state(),'not-compared');await run();assert.deepEqual(await best(),['']);
  assert.equal(await evaluate("document.querySelector('#placement-adopt')===null"),true);
  report.push('Closed5mm layer selects unchanged proposal; old unlimited winner is not substituted');
  await set({'placement-subset':'calibration'});await run('error');assert.match(await text('#placement-status'),/unlimited-receiver evidence/);
  assert.equal(await evaluate("document.querySelector('#placement-save')===null"),true);
  await set({'placement-subset':'all','placement-layer-initial':6});await run('error');
  await set({'placement-layer-initial':0,'placement-layer-drainage':1});await run();
  report.push('Unlimited-model evidence and overfilled layer refuse without a successful result or downloadable fallback');

  await click('placement-save');let downloaded;
  await wait(async()=>{downloaded=(await readdir(downloads)).find(n=>n.endsWith('.json'));return Boolean(downloaded);},'actual download');
  const downloadPath=join(downloads,downloaded),downloadText=await readFile(downloadPath,'utf8'),input=parsePlacementInvestigation(downloadText);
  assert.deepEqual(input.project,original);assert.deepEqual(input.query.drainingLayer,layer);
  assert.equal(Object.hasOwn(JSON.parse(downloadText),'plans'),false);assert.equal(downloadText.includes('drainedLiters'),false);
  const beforeRows=await evaluate("[...document.querySelectorAll('#placement-results > details .placement-table tbody tr')].map(r=>r.textContent)");
  await send('Page.reload',{ignoreCache:true});await wait(()=>evaluate("!!document.querySelector('#placement-open')"),'reloaded panel');
  await openFile(downloadPath);assert.equal(await state(),'not-compared');await run();
  assert.deepEqual(await best(),['35,36']);assert.deepEqual(await evaluate("[...document.querySelectorAll('#placement-results > details .placement-table tbody tr')].map(r=>r.textContent)"),beforeRows);
  assert.deepEqual(await savedProject(),original);
  report.push('Actual input-only download survives page reload and native file upload; full79-layout result recomputes identically');

  // Delay one real File.text promise so user-visible intake races are tested.
  await evaluate("(()=>{const original=File.prototype.text;window.__placementIntakeFixture={restore:()=>{File.prototype.text=original;}};File.prototype.text=function(){if(this.name!=='delayed-A.json')return original.call(this);return new Promise((yes,no)=>{window.__placementIntakeFixture.release=()=>original.call(this).then(yes,no);});};})()");
  const oldInput=JSON.parse(downloadText);oldInput.query.drainingLayer.drainagePerHour=0;oldInput.project.observations[0].source='Older intake must not replace the current source';
  await upload('placement-open',oldInput,'delayed-A.json');await openFile(downloadPath);
  await evaluate("window.__placementIntakeFixture.release()");await delay(60);
  assert.deepEqual(await savedProject(),original);assert.equal(await evaluate("document.querySelector('#placement-layer-drainage').value"),'1');
  await run();assert.deepEqual(await best(),['35,36']);
  report.push('Delayed older intake cannot overwrite a newer successfully opened file or its receiving declaration');
  await upload('placement-open',oldInput,'delayed-A.json');const newerSource=structuredClone(original);newerSource.weather.rainMmHr+=1;
  await upload('import',newerSource);await delay(180);const expectedNewerSource=await savedProject();
  await evaluate("window.__placementIntakeFixture.release()");await delay(60);
  assert.deepEqual(await savedProject(),expectedNewerSource);assert.equal((await savedProject()).weather.rainMmHr,newerSource.weather.rainMmHr);
  assert.equal(await state(),'not-compared');
  await evaluate("window.__placementIntakeFixture.restore();delete window.__placementIntakeFixture");
  await openFile(downloadPath);await run();
  report.push('Delayed intake cannot undo a newer source import; only the current source can be recomputed');

  const forged=JSON.parse(downloadText);forged.best=[[27,36]];await upload('placement-open',forged);await delay(100);
  assert.equal(await state(),'not-compared');assert.match(await text('#placement-status'),/conclusions/);assert.deepEqual(await savedProject(),original);
  await openFile(downloadPath);await set({'placement-layer-drainage':0});await run();assert.deepEqual(await best(),['']);
  report.push('Forged cached winner refuses; changed reopened drainage recomputes a different result');

  const smallQuery={...input.query,eligibleCells:[18,19,27,36],targets:[{cellIndex:10,maxPeakChangeMm:0,basis:'Authored local target'}],durationGoal:{cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:0,basis:'Authored duration target'}};
  const tradeoffs={metrics:['unabsorbedLiters','maxDepthMm'],costUnit:'authored work units',budget:2,cellCosts:smallQuery.eligibleCells.map(cellIndex=>({cellIndex,cost:1,source:'Authored common cost'}))};
  const smallPath=join(output,'duration-cost-source.json');await writeFile(smallPath,serializePlacementInvestigation(input.project,smallQuery,tradeoffs));
  await openFile(smallPath);await run();assert.match(await text('#placement-status'),/11 variants/);assert.match(await text('#placement-detail'),/wet min/);
  assert.ok(await evaluate("Number(document.querySelector('#placement-tradeoff-results').dataset.frontierCount)>0"));
  await click('placement-resolution-run');await wait(()=>evaluate("!document.querySelector('#placement-resolution-run').disabled"),'calculation interval comparison');
  assert.equal(await evaluate("document.querySelector('#placement-resolution-results').dataset.state"),'compared');
  assert.match(await text('#placement-resolution-results'),/all 11 layouts/);assert.deepEqual(await savedProject(),original);
  report.push('Same layer composes with duration, peak targets, declared cost and finer intervals over all11 chosen layouts');

  await openFile(downloadPath);await run();await click('placement-adopt');
  const adopted=await savedProject();assert.deepEqual(adopted.existing,original.existing);assert.deepEqual(adopted.observations,original.observations);
  assert.deepEqual(adopted.proposal.flatMap((c,i)=>c.surface!==original.proposal[i].surface?[i]:[]),[35,36]);
  assert.equal(await state(),'not-compared');
  report.push('Explicit adoption changes only the chosen hypothetical surfaces and preserves original readings');

  await openFile(downloadPath);await run();
  await evaluate("document.querySelector('#placement-results > details').open=true");
  for(const [name,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await delay(50);
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   const clip=await evaluate("(()=>{const r=document.querySelector('#placement-search').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
   const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));
  }
  report.push('Desktop and390px actual panel remains contained with all layouts inspectable');
 }catch(error){failure=error;}
 const receipt={passed:!failure&&!exceptions.length,report,exceptions,sandbox:session.sandbox,sourceHashes,failure:failure?String(failure.stack):null};
 await writeFile(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,checks:report.length,output,failure:receipt.failure}));
 if(failure)throw failure;if(exceptions.length)throw Error('Browser exceptions');
});

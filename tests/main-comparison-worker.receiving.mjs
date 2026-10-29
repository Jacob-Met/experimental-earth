import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {withBrowserSession} from './support/browser-session.mjs';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.env.APP_ROOT&&!path.isAbsolute(process.env.APP_ROOT))throw new Error('APP_ROOT must be an absolute path');
const root=process.env.APP_ROOT||defaultRoot;
const runDirectory=process.env.RUN_DIRECTORY||path.join(root,'test-results','main-comparison-worker');
await mkdir(path.dirname(runDirectory),{recursive:true});
const fixtureScript=`const {makeExample}=await import('/core.js');const p=makeExample();p.title='Authored worker responsiveness';p.width=24;p.height=24;p.selectedIndex=0;p.existing=Array.from({length:576},(_,i)=>({surface:i%3===0?'garden':i%3===1?'turf':'sealed',elevationM:((i%24)+(Math.floor(i/24)%4))/100,provenance:'Authored responsiveness control'}));p.proposal=structuredClone(p.existing);p.proposal[0].surface='sealed';p.weather.durationMinutes=720;p.weather.stepMinutes=1;return p;`;
const bootstrap=`(()=>{
 const NativeWorker=window.Worker;
 window.__rainProbe={hold:false,fault:false,constructorFault:false,posted:0,finished:0,beats:0,beatsAtPost:0,beatsAtFinish:0,postTime:0,nativeReceiveTime:0,queued:[],urls:[],exports:[],downloads:[]};
 const h=window.__rainProbe;
 const beat=()=>{h.beats++;requestAnimationFrame(beat)};requestAnimationFrame(beat);
 class ObservedWorker extends EventTarget {
  constructor(url,options){super();h.urls.push(String(url));if(h.constructorFault)throw new Error('Injected receiving-test worker constructor failure');this.native=new NativeWorker(url,options);this.onmessage=null;this.onerror=null;this.onmessageerror=null;
   this.native.addEventListener('message',e=>{h.nativeReceiveTime=performance.now();const forward=()=>{h.finished++;h.beatsAtFinish=h.beats;const event=new MessageEvent('message',{data:e.data});this.dispatchEvent(event);this.onmessage?.(event)};if(h.hold)h.queued.push(forward);else forward()});
   for(const type of ['error','messageerror'])this.native.addEventListener(type,e=>{const event=type==='error'?new ErrorEvent(type,{message:e.message||'Worker failure'}):new MessageEvent(type,{data:e.data});this.dispatchEvent(event);this['on'+type]?.(event)});
  }
  postMessage(...args){h.posted++;h.beatsAtPost=h.beats;h.postTime=performance.now();if(h.fault){queueMicrotask(()=>{const e=new ErrorEvent('error',{message:'Injected receiving-test worker failure'});this.dispatchEvent(e);this.onerror?.(e)});return}return this.native.postMessage(...args)}
  terminate(){this.native.terminate()}
 }
 window.Worker=ObservedWorker;
 const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{if(blob instanceof Blob)Promise.all([blob.text(),blob.arrayBuffer()]).then(([text,buffer])=>{h.exports.push(text);h.downloads.push({text,bytes:Array.from(new Uint8Array(buffer)),type:blob.type})});return create(blob)};
 const originalText=File.prototype.text;h.readGate=null;h.releaseRead=null;
 File.prototype.text=function(){if(this.name==='delayed-old.json')return new Promise(resolve=>{h.releaseRead=()=>originalText.call(this).then(resolve)});return originalText.call(this)};
})();`;

const evidence={checks:[],limitations:['Instrumentation preserves native worker computation; controlled reply/failure tests are distinct from the native responsiveness check.','Native heartbeat interval spans postMessage to result delivery, including worker startup, scheduling and serialization; it is not compute-only time.']};
let server;
try {
 server=spawn('python3',['-u','serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const origin=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Maintained server did not announce an origin')),15000);server.on('error',reject);server.on('exit',code=>reject(new Error('Maintained server exited '+code)));server.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0])}});server.stderr.on('data',chunk=>{output+=chunk})});
 await withBrowserSession({root,chromeBin:process.env.CHROME_BIN||'/usr/bin/chromium',runDirectory,commandMs:120000},async({send,evaluate,exceptions})=>{
  // Subscribe before the maintained application navigation: evaluate alone does
  // not enable Runtime.exceptionThrown events collected by the session helper.
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:bootstrap});
  const wait=async(expression,label)=>{for(let i=0;i<240;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Timed out: '+label)};
  const state=s=>`document.querySelector('#rain-comparison-status')?.dataset.state===${JSON.stringify(s)}`;
  const go=async()=>{await send('Page.navigate',{url:origin});await wait(`document.querySelector('#import')&&window.__rainProbe`,'application loaded')};
  const upload=async(project,name='project.json')=>{await evaluate(`(()=>{const f=new File([${JSON.stringify(JSON.stringify(project))}],${JSON.stringify(name)},{type:'application/json'});const d=new DataTransfer();d.items.add(f);const el=document.querySelector('#import');el.files=d.files;el.dispatchEvent(new Event('change',{bubbles:true}))})()`);if(name!=='delayed-old.json')await wait(`document.querySelector('#project-title').value===${JSON.stringify(project.title)}`,'selected file loaded')};
  const saved=()=>evaluate(`localStorage.getItem('experimental-earth-site-v1')`);
  const exportProject=async()=>{const n=await evaluate('window.__rainProbe.exports.length');await evaluate(`document.querySelector('#export').click()`);await wait(`window.__rainProbe.exports.length>${n}`,'export blob');return JSON.parse(await evaluate('window.__rainProbe.exports.at(-1)'))};
  await go();await wait(state('ready'),'initial small project');
  const large=await evaluate(`(async()=>{${fixtureScript}})()`);
  const small=await evaluate(`(async()=>{const {makeExample}=await import('/core.js');const p=makeExample();p.title='Newest small source';return p})()`);
  const workerAsset=await evaluate(`(async()=>{const r=await fetch('/rain-comparison-worker.js');return {ok:r.ok,status:r.status,contentType:r.headers.get('content-type')||'',nonempty:(await r.text()).length>0}})()`);
  assert.equal(workerAsset.ok,true);assert.equal(workerAsset.nonempty,true);
  assert.match(workerAsset.contentType,/^(?:application|text)\/javascript(?:\s*;|\s*$)/i,'worker asset must be served with JavaScript MIME');
  evidence.workerAsset=workerAsset;
  evidence.checks.push('Maintained serve.py serves the nonempty worker asset with JavaScript MIME');

  // Native compute: count animation frames strictly between posting and receiving.
  await upload(large,'authored-original-large.json');await wait(state('ready'),'native large comparison');
  const responsive=await evaluate(`({posted:__rainProbe.posted,postToReceiveFrames:__rainProbe.beatsAtFinish-__rainProbe.beatsAtPost,postToNativeReceiveMs:__rainProbe.nativeReceiveTime-__rainProbe.postTime,urls:__rainProbe.urls})`);
  assert.ok(responsive.posted>0,'large source uses a real worker');assert.ok(responsive.postToReceiveFrames>0,'animation frames progress between native worker post and result delivery');
  assert.ok(responsive.urls.some(url=>url.includes('rain-comparison-worker.js')));
  const control=await evaluate(`(async()=>{const {compare}=await import('/core.js');const project=${JSON.stringify(large)};const before=__rainProbe.beats;const canonical=compare(project);return {frames:__rainProbe.beats-before,existing:Array.from(canonical.existing.peakDepthMm),proposal:Array.from(canonical.proposal.peakDepthMm)}})()`);
  assert.equal(control.frames,0,'incumbent synchronous comparison blocks the animation heartbeat');
  evidence.responsiveness={...responsive,synchronousFrames:control.frames};
  const displayed=await evaluate(`(()=>{const read=id=>{const grid=document.querySelector(id);return {view:grid.dataset.view,cells:Array.from(grid.querySelectorAll('.cell'),cell=>({index:Number(cell.dataset.cellIndex),depthMm:Number(cell.dataset.depthMm)}))}};return {view:document.querySelector('#map-view').value,existing:read('#existing-grid'),proposal:read('#proposal-grid')}})()`);
  assert.equal(displayed.view,'peak','parity evidence uses the actual peak-depth view');
  for(const side of ['existing','proposal']){
   assert.equal(displayed[side].view,'peak');assert.equal(displayed[side].cells.length,576,side+' renders every original cell');assert.equal(control[side].length,576);
   assert.deepEqual(displayed[side].cells.map(cell=>cell.index),Array.from({length:576},(_,i)=>i),side+' cell indexes remain complete and ordered');
   assert.deepEqual(displayed[side].cells.map(cell=>cell.depthMm),control[side],side+' rendered depth vector exactly matches canonical main-thread compare');
  }
  assert.deepEqual(await exportProject(),large,'accepted export preserves the complete original authored large project');
  evidence.checks.push('All 1152 rendered peak-depth cell values exactly match canonical compare(original large project), with complete ordered cell indexes and full original-project export parity');
  evidence.largeProjectParity={existingCells:576,proposalCells:576,comparison:'Exact numeric deep equality; no tolerance or sampling',view:'peak',originalProjectExport:'Exact complete-object deep equality'};

  // A held old native response must not displace a later small source.
  await evaluate('__rainProbe.hold=true');const old={...large,title:'Older large source'};await upload(old);await wait(state('pending'),'held old source');
  await wait('__rainProbe.queued.length>0','old native result captured');
  await upload(small);await wait(state('ready'),'small successor accepted');
  const smallSaved=await saved();await evaluate('__rainProbe.hold=false;__rainProbe.queued.splice(0).forEach(f=>f())');
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert.equal(await saved(),smallSaved);assert.equal((await exportProject()).title,small.title);
  evidence.checks.push('Late old native result cannot replace a newer small source');

  // Failures retain the accepted save and expose attempted source for export.
  await evaluate('__rainProbe.fault=true');await upload({...large,title:'Failed input remains exportable'});await wait(state('failed'),'worker failure surfaced');
  assert.equal(await saved(),smallSaved);assert.equal((await exportProject()).title,'Failed input remains exportable');
  assert.ok(await evaluate(`document.querySelector('#restore-rain-comparison')&&!document.querySelector('#restore-rain-comparison').disabled`));
  await evaluate(`document.querySelector('#restore-rain-comparison').click()`);await wait(state('ready'),'restore accepted source');
  assert.equal((await exportProject()).title,small.title);
  await evaluate('__rainProbe.fault=false');
  evidence.checks.push('Worker failure preserves accepted save; export retains failed source; explicit restore recovers');

  // Retry must use the worker, then persist the attempted source only on success.
  await evaluate('__rainProbe.fault=true');const retrySource={...large,title:'Recovered through explicit retry'};await upload(retrySource);await wait(state('failed'),'retry fixture failed');
  assert.equal(await saved(),smallSaved);const postsBeforeRetry=await evaluate('__rainProbe.posted');
  await evaluate(`__rainProbe.fault=false;document.querySelector('#retry-rain-comparison').click()`);await wait(state('ready'),'retry succeeds');
  assert.ok(await evaluate(`__rainProbe.posted>${postsBeforeRetry}`));assert.equal((await exportProject()).title,retrySource.title);assert.notEqual(await saved(),smallSaved);
  evidence.checks.push('Explicit retry dispatches a fresh worker request and saves only after success');

  // Constructor failure cannot silently fall back to the blocking main-thread path.
  const retrySaved=await saved();const postsBeforeConstructor=await evaluate('__rainProbe.posted');
  await evaluate('__rainProbe.constructorFault=true');await upload({...large,title:'Constructor failure source'});await wait(state('failed'),'constructor failure surfaced');
  assert.equal(await evaluate('__rainProbe.posted'),postsBeforeConstructor);assert.equal(await saved(),retrySaved);
  assert.equal((await exportProject()).title,'Constructor failure source');
  await evaluate(`__rainProbe.constructorFault=false;document.querySelector('#restore-rain-comparison').click()`);await wait(state('ready'),'restore after constructor failure');
  evidence.checks.push('Constructor failure stays failed with accepted save intact and no synchronous success fallback');

  // Restore invalidates pending file reads as well as pending solver messages.
  const focusedResult=await evaluate(`(()=>{const el=document.querySelector('#proposal-grid .cell');if(!el)return false;el.focus();return document.activeElement===el})()`);
  assert.equal(focusedResult,true,'the actual ready proposal grid cell receives keyboard focus before pending');
  await evaluate('__rainProbe.hold=true');await upload({...large,title:'Pending source before restore'});await wait(state('pending'),'restore race pending');
  const pendingInteraction=await evaluate(`(()=>{const active=document.activeElement;const ids=['rain','storm','duration','cell-size','project-title','import','export'];return {activeId:active?.id,focusInStatus:document.querySelector('#rain-comparison-status').contains(active),focusInInert:!!active?.closest('[inert]'),mapViewDisabled:document.querySelector('#map-view').disabled,resultGridInert:!!document.querySelector('#proposal-grid .cell')?.closest('[inert]'),controls:ids.map(id=>{const el=document.getElementById(id);return {id,present:!!el,disabled:el?.disabled,inert:!!el?.closest('[inert]')}})}})()`);
  assert.equal(pendingInteraction.focusInStatus,true,'pending status receives focus from the ready result cell');assert.equal(pendingInteraction.focusInInert,false);
  assert.equal(pendingInteraction.mapViewDisabled,true,'overlay selector is disabled while its comparison is obsolete');assert.equal(pendingInteraction.resultGridInert,true,'result grid is inert while pending');
  for(const control of pendingInteraction.controls){assert.equal(control.present,true,control.id+' exists');assert.equal(control.disabled,false,control.id+' remains enabled');assert.equal(control.inert,false,control.id+' remains outside inert result panels')}
  evidence.pendingInteraction=pendingInteraction;
  evidence.checks.push('Actual proposal-cell focus moves to pending status; obsolete results and overlay selector are disabled while all seven source/export controls remain enabled');
  await evaluate(`document.querySelector('#rain-comparison-status').scrollIntoView({block:'start',behavior:'instant'})`);
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await writeFile(path.join(runDirectory,'pending.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await upload({...large,title:'Late file after explicit restore'},'delayed-old.json');await wait(`typeof __rainProbe.releaseRead==='function'`,'restore race file gated');
  assert.equal(await evaluate(`document.querySelector('#rain-comparison-status').textContent.includes('undefined')`),false,'loading must not announce an undefined comparison failure');
  await evaluate(`document.querySelector('#restore-rain-comparison').click()`);await wait(state('ready'),'restore invalidates file intent');
  await evaluate('__rainProbe.releaseRead()');await evaluate('new Promise(r=>setTimeout(r,100))');
  assert.equal((await exportProject()).title,retrySource.title);assert.equal(await saved(),retrySaved);
  await evaluate('__rainProbe.hold=false;__rainProbe.queued.splice(0).forEach(f=>f());__rainProbe.releaseRead=null');
  evidence.checks.push('Restore invalidates a delayed file read and retains the accepted source');

  // Earlier slow file read must not override a newer file selection.
  await upload({...large,title:'Slow obsolete file'},'delayed-old.json');await wait('typeof __rainProbe.releaseRead===\'function\'','old file read gated');
  const newerFile={...small,title:'Newer file wins read race'};await upload(newerFile,'newer-file.json');await wait(state('ready'),'newer file accepted');
  await evaluate('__rainProbe.releaseRead()');await evaluate('new Promise(r=>setTimeout(r,100))');
  assert.equal((await exportProject()).title,newerFile.title);
  evidence.checks.push('Delayed earlier file read cannot overwrite a newer imported source');

  // The same persisted large project must use the worker on a fresh page load.
  await upload(large);await wait(state('ready'),'large source persisted');await go();await wait(state('ready'),'saved large source reloaded');
  assert.ok(await evaluate('__rainProbe.posted>0'));assert.equal((await exportProject()).title,large.title);
  evidence.checks.push('Initial persisted large source uses worker and reaches ready after reload');

  // Actual observation intake must retain its original after asynchronous
  // comparison acceptance, and after an identical-source worker retry.
  const originalCsv='\uFEFFstation,minute,depth,uncertainty,unit,source,scenario,use\r\n" east ",30,.3,.1,in,"gauge, α\r\nsecond line",existing,challenge\r\nwest,60,12,1,mm,"operator ""B""",existing,calibration\r\n';
  const stationMapText=' \n'+JSON.stringify({source:'Authored placement control',entries:[{station:'east',cell:'B2'},{station:'west',cell:'C3'}]})+'\n ';
  const originalBytes=Array.from(Buffer.from(originalCsv,'utf8'));
  const uploadObservation=async(selector,text,name,type)=>evaluate(`(()=>{const file=new File([${JSON.stringify(text)}],${JSON.stringify(name)},{type:${JSON.stringify(type)}});const data=new DataTransfer();data.items.add(file);const input=document.querySelector(${JSON.stringify(selector)});input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const downloadObservation=async(selector)=>{const before=await evaluate('__rainProbe.downloads.length');assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).disabled`),false,selector+' available after comparison');await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(`__rainProbe.downloads.length>${before}`,'observation source download');return evaluate('__rainProbe.downloads.at(-1)')};
  const assertOriginal=async()=>{const raw=await downloadObservation('#download-observation-csv');assert.deepEqual(raw.bytes,originalBytes,'complete original CSV bytes, including BOM, CRLF, Unicode, quoted multiline field and unselected row, survive worker acceptance');const packet=await downloadObservation('#save-observation-source');const parsed=JSON.parse(packet.text);assert.equal(parsed.stationMapText,stationMapText,'exact preview station-map text is retained');assert.deepEqual(Array.from(Buffer.from(parsed.table.base64,'base64')),originalBytes,'saved packet retains exact original CSV bytes');return packet};
  await evaluate(`(()=>{const map=document.querySelector('#observation-station-map');let ancestor=map.parentElement;while(ancestor){if(ancestor.tagName==='DETAILS')ancestor.open=true;ancestor=ancestor.parentElement}map.value=${JSON.stringify(stationMapText)};map.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  const notebookBefore=(await exportProject()).observations.length;
  await uploadObservation('#observation-table-file',originalCsv,'worker-logger-α.csv','text/csv');
  await wait(`document.querySelectorAll('#observation-table-preview li').length===2`,'two authored CSV rows previewed');
  assert.equal(await evaluate(`document.querySelectorAll('input[data-observation-line]:checked').length`),0);
  await evaluate(`(()=>{const checkbox=document.querySelector('input[data-observation-line="2"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));__rainProbe.hold=true;document.querySelector('#append-observation-table').click()})()`);
  await wait(state('pending'),'large CSV append triggers worker');await wait('__rainProbe.queued.length>0','CSV append native result captured');
  await evaluate('__rainProbe.hold=false;__rainProbe.queued.splice(0).forEach(f=>f())');await wait(state('ready'),'CSV append worker accepted');
  const afterAppend=await exportProject();assert.equal(afterAppend.observations.length,notebookBefore+1);assert.equal(afterAppend.observations.at(-1).tableSource.line,2);
  // A later unfinished map edit must not change the map accepted with the row.
  await evaluate(`(()=>{const map=document.querySelector('#observation-station-map');map.value='{"unrelated":"unfinished later edit"}';map.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  const sourcePacket=await assertOriginal();
  await uploadObservation('#observation-source-file',sourcePacket.text,'retained-worker-source.json','application/json');
  await wait(`document.querySelector('#observation-table-status').textContent.startsWith('Original table and supplied map restored')`,'saved source reopened');
  assert.equal(await evaluate(`document.querySelector('#observation-station-map').value`),stationMapText);
  assert.equal(await evaluate(`document.querySelectorAll('#observation-table-preview li').length`),0,'reopen does not implicitly preview');
  assert.equal((await exportProject()).observations.length,notebookBefore+1,'reopen does not implicitly append');
  const reopenedPacket=await assertOriginal();assert.deepEqual(JSON.parse(reopenedPacket.text),JSON.parse(sourcePacket.text),'saved original table and map roundtrip exactly');
  await evaluate(`document.querySelector('#preview-observation-table').click()`);await wait(`document.querySelectorAll('#observation-table-preview li').length===2`,'explicit reopened preview');
  const acceptedBeforeFault=await saved();
  await evaluate(`(()=>{const checkbox=document.querySelector('input[data-observation-line="4"]');checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));__rainProbe.fault=true;document.querySelector('#append-observation-table').click()})()`);
  await wait(state('failed'),'appended source worker fault');assert.equal(await saved(),acceptedBeforeFault,'failed append comparison does not replace accepted save');
  await evaluate(`__rainProbe.fault=false;document.querySelector('#retry-rain-comparison').click()`);await wait(state('ready'),'appended source retry accepted');
  assert.equal((await exportProject()).observations.length,notebookBefore+2);await assertOriginal();
  evidence.checks.push('Large observation append retains exact original CSV bytes and preview station map after worker completion, save/open/save roundtrip, and worker failure followed by retry');
  evidence.observationSourceCustody={originalBytes:originalBytes.length,previewRows:2,firstAppendRows:1,rowsAfterRetry:2,exactOriginalBytes:true,exactPreviewMapText:true,roundtrip:true};
  assert.equal(exceptions.length,0,'no uncaught browser exceptions');
  await evaluate(`(()=>{const maps=document.querySelector('#maps')||document.querySelector('#existing-grid');if(!maps)throw new Error('Ready comparison maps missing');maps.scrollIntoView({block:'start',behavior:'instant'})})()`);
  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  await writeFile(path.join(runDirectory,'ready.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  evidence.screenshots={viewport:{width:1280,height:900,deviceScaleFactor:1,mobile:false},pending:'pending.png',ready:'ready.png'};
 });
 await writeFile(path.join(runDirectory,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence,null,2));
} finally {if(server&&server.exitCode===null){server.kill('SIGTERM');await Promise.race([once(server,'exit'),new Promise(resolve=>setTimeout(resolve,3000))])}}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeSkyJointExample} from '../shade-heat-sky-joint-example.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {prepareSkyJointSource,parseSkyJointSource} from '../shade-heat-sky-joint-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {profileFraction} from '../shade-heat-profile-band.js';
import {rational as q,sub} from '../vendor/chronos/exact-halfplanes.mjs';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-sky-joint-'+randomUUID(),checks=[];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)],example=makeSkyJointExample();let launcher=null;
try{
 launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Joint launcher readiness: '+errors)),10000);
  launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
  launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',e=>{clearTimeout(timer);reject(e);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:120000},async session=>{
  const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
  await send('DOM.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  async function until(expression){for(let i=0;i<1800;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Joint wait: '+expression+'; '+await value("document.getElementById('joint-status')?.textContent"));}
  const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
  async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
  async function files(id,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#'+id});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
  async function state(kind){const expression="document.getElementById('joint-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(kind==='compared'?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('joint-status').textContent"));}
  const observe=()=>value("window.jointPosts=0;window.originalJointPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.jointPosts++;const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedJointResult=structuredClone(e.data.result);handler(e)};return window.originalJointPost.call(this,m,...args)}");
  const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
  async function matches(output){
   const r=output.report,d=await value("({...document.getElementById('joint-results').dataset})");
   assert.equal(d.status,r.compatibility);assert.equal(d.joint,r.jointStatus);assert.equal(d.minimum,r.minimumChanges===null?'none':String(r.minimumChanges));
   assert.equal(Number(d.patterns),r.patterns.length);assert.equal(Number(d.alternatives),r.alternatives.length);assert.equal(Number(d.records),output.investigation.readings.length);
   assert.equal(Number(d.originalTimes),r.originalTimes.length);assert.equal(Number(d.sources),r.work.uniqueSources);
   const query=await value("['a','b'].map(id=>({receiverReadingIndex:Number(document.getElementById('joint-'+id+'-receiver').value),utc:document.getElementById('joint-'+id+'-time').value,store:document.getElementById('joint-'+id+'-store').value,relation:document.getElementById('joint-'+id+'-relation').value,differenceC:Number(document.getElementById('joint-'+id+'-limit').value),source:document.getElementById('joint-'+id+'-source').value}))");
   assert.deepEqual(query,output.investigation.query.requirements);
   const verdict=await value("({...document.getElementById('joint-verdict').dataset})");assert.equal(verdict.joint,r.jointStatus);
   for(const [index,key]of ['a','b'].entries()){assert.equal(verdict[key],r.individual?.[index].status??'unevaluated');assert.deepEqual(JSON.parse(verdict[key+'Patterns']),r.individual?.[index].patternIndices??null);}
   assert.deepEqual(JSON.parse(verdict.jointPatterns),r.jointPatternIndices);
   const classes=await value("Array.from(document.querySelectorAll('.joint-class')).map(e=>({...e.dataset}))");
   for(const row of classes){const changes=Number(row.changes),patterns=r.patterns.filter(p=>p.changes===changes),compatible=patterns.filter(p=>p.compatibility==='compatible');
    assert.equal(Number(row.examined),patterns.length);assert.equal(Number(row.compatible),compatible.length);
    assert.equal(row.status,changes>r.query.maximumChanges?'outside-declaration':!patterns.length?'not-examined':compatible.length?'compatible':'incompatible');}
   assert.equal(await value("document.querySelectorAll('#joint-all-patterns tbody tr').length"),r.patterns.length);
   if(!r.alternatives.length){assert.equal(await value("Boolean(document.getElementById('joint-pattern-select')||document.getElementById('joint-witness'))"),false);return;}
   const rows=await value("Array.from(document.querySelectorAll('#joint-pattern-results tbody tr')).map(e=>({...e.dataset}))");
   assert.deepEqual(rows,r.alternatives.map(a=>({pattern:String(a.patternIndex),a:a.individual[0].compatibility,b:a.individual[1].compatibility,joint:a.joint.compatibility,orderA:String(a.maximumLowerMinusUpperC[0].upper),orderB:String(a.maximumLowerMinusUpperC[1].upper)})));
   assert.deepEqual(await value("Array.from(document.getElementById('joint-pattern-select').options).map(o=>Number(o.value))"),r.alternatives.map(a=>a.patternIndex));
   const selected=Number(await value("document.getElementById('joint-pattern-select').value")),kind=await value("document.getElementById('joint-result-select').value"),pattern=r.alternatives.find(a=>a.patternIndex===selected);
   const entry=kind==='joint'?pattern.joint:pattern.individual[kind==='a'?0:1],w=entry.witness,data=await value("({...document.getElementById('joint-witness').dataset})");
   assert.equal(data.pattern,String(selected));assert.equal(data.kind,kind);assert.equal(data.compatibility,entry.compatibility);assert.equal(Number(data.phases),w?.phaseProfiles.length??0);
   if(!w){assert.equal(await value("Boolean(document.getElementById('joint-time-select')||document.getElementById('joint-receiver-select'))"),false);return;}
   assert.deepEqual(await value("Array.from(document.querySelectorAll('#joint-witness .phase-profile')).map(e=>JSON.parse(e.dataset.weights))"),w.phaseProfiles.map(p=>p.map(v=>v.lower)));
   assert.equal(await value("document.querySelectorAll('#joint-observations tbody tr').length"),output.investigation.readings.length);
   const shown=await value("Array.from(document.querySelectorAll('#joint-witness-requirements tbody tr')).map(e=>({...e.dataset}))");
   assert.deepEqual(shown,w.requirements.map(item=>({requirement:String(item.requirementIndex),represented:item.representedStatus,numerical:item.originalNumericalStatus,
    representedLower:String(item.representedPairC.lower.lower),representedUpper:String(item.representedPairC.upper.upper),numericalLower:String(item.originalNumericalPairC.lower.lower),numericalUpper:String(item.originalNumericalPairC.upper.upper)})));
  }
  async function allViews(output){
   const before=await value('window.jointPosts');let total=0;
   for(const pattern of output.report.alternatives)for(const kind of ['joint','a','b']){
    await field('joint-pattern-select',pattern.patternIndex);await field('joint-result-select',kind);await matches(output);
    const a=(kind==='joint'?pattern.joint:pattern.individual[kind==='a'?0:1]).witness;if(!a)continue;
    const rows=await value("(()=>{const receiver=document.getElementById('joint-receiver-select'),time=document.getElementById('joint-time-select'),rows=[];for(const s of receiver.options){receiver.value=s.value;receiver.dispatchEvent(new Event('input'));for(const t of time.options){time.value=t.value;time.dispatchEvent(new Event('input'));const context={...document.getElementById('joint-time-detail').dataset};rows.push(...Array.from(document.querySelectorAll('.joint-value')).map(e=>({...context,...e.dataset})));}}return rows})()");
    assert.equal(rows.length,a.originalReplays.length*output.report.originalTimes.length*2);total+=rows.length;
    for(const row of rows){assert.equal(Number(row.pattern),pattern.patternIndex);assert.equal(row.kind,kind);
     const replay=a.originalReplays.find(p=>p.sourceIndex===Number(row.source)),at=replay.originalCourse[Number(row.time)],store=row.store;
     assert.equal(row.utc,at.utc);assert.equal(Number(row.additiveLower),profileFraction(sub(exact(at.additiveC.proposal.lower[store]),exact(at.additiveC.existing.upper[store]))).lower);
     assert.equal(Number(row.additiveUpper),profileFraction(sub(exact(at.additiveC.proposal.upper[store]),exact(at.additiveC.existing.lower[store]))).upper);
     assert.equal(Number(row.originalLower),profileFraction(sub(q(at.originalC.proposal.lower[store]),q(at.originalC.existing.upper[store]))).lower);
     assert.equal(Number(row.originalUpper),profileFraction(sub(q(at.originalC.proposal.upper[store]),q(at.originalC.existing.lower[store]))).upper);
    }
   }assert.equal(await value('window.jointPosts'),before);return total;
  }
  async function download(name){
   const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('joint-export');
   const path=directory+'/original-clock-sky-joint-inputs.json';let found=false;for(let i=0;i<300;i++){try{await access(path);found=true;break;}catch{await delay(30);}}assert(found);
   const text=await readFile(path,'utf8'),source=parseSkyJointSource(text);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);return {path,text,source};
  }

  await send('Page.navigate',{url:launcherUrl+'sky-consequences.html'});await until("Boolean(document.querySelector('a[href=\"sky-joint-requirements.html\"]'))");
  assert.equal(await value("document.querySelector('a[href=\"sky-joint-requirements.html\"]').target"),'_blank');const originalStorage=await stored();
  await send('Page.navigate',{url:launcherUrl+'sky-joint-requirements.html'});await until("document.getElementById('joint-example')?.disabled===false");await observe();await click('joint-example');await state('compared');
  const actual=await value('window.observedJointResult');await matches(actual);assert.deepEqual(actual.investigation.readings,example.readings);
  assert.equal(actual.report.minimumChanges,2);assert.equal(actual.report.patterns.length,121);assert.deepEqual(actual.report.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
  assert.equal(actual.report.jointStatus,'joint-incompatible');assert.deepEqual(actual.report.individual.map(item=>item.status),['compatible','compatible']);
  assert.equal(actual.report.work.actualWitnessProfiles,2);assert.equal(actual.report.work.executedThermalCourses,47592);
  await writeFile(runDirectory+'/runtime-joint-original.json',JSON.stringify(actual,null,2));
  await value("document.getElementById('joint-selected-certificate').open=true");await until("document.querySelector('#joint-selected-certificate pre').textContent.length>0");
  const jointProof=await value("JSON.parse(document.querySelector('#joint-selected-certificate pre').textContent)");assert.deepEqual(jointProof.requirementResult,actual.report.exactEvidence.result.cases[0].joint);
  assert.equal(await value("Boolean(document.getElementById('joint-time-select'))"),false);
  checks.push('Actual new entry and worker retain24original records/3receivers/17times, complete121pattern search, sole minimum2-change pattern[6,10], both individual witnesses and exact joint contradiction with no invented joint course');
  assert.equal(await allViews(actual),204);await field('joint-result-select','a');await field('joint-time-select',3);await value("document.getElementById('joint-time-select').focus()");
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await until("document.getElementById('joint-time-detail').dataset.time==='4'");
  await value("document.getElementById('joint-requirement-proof').open=true");await until("document.querySelector('#joint-requirement-proof pre').textContent.length>0");
  const disclosed=await value("JSON.parse(document.querySelector('#joint-requirement-proof pre').textContent)");assert.deepEqual(disclosed.cases,actual.report.exactEvidence.result.cases);assert.deepEqual(disclosed.requirements,actual.report.requirements);
  await value("document.getElementById('joint-requirement-proof').open=false;document.getElementById('joint-all-patterns').open=true;document.querySelector('#joint-all-patterns .joint-proof').open=true");
  await until("document.querySelector('#joint-all-patterns pre').textContent.length>0");await field('joint-proof-select',0);
  const originalProof=await value("JSON.parse(document.querySelector('#joint-all-patterns pre').textContent)");assert.deepEqual(originalProof.proof,actual.report.exactEvidence.result.analysis.cases[0]);await value("document.getElementById('joint-all-patterns').open=false");
  assert.equal(await value("(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);return new Set(ids).size===ids.length})()"),true);
  checks.push('Every204 individual-witness receiver/time/component view and both requirement statuses match actual exact/numerical output; keyboard selection, original and augmented proof disclosure use no new worker and IDs remain unique');
  const saved=await download('original');assert.deepEqual(saved.source,actual.investigation);
  for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
   for(const [selector,label]of [['.joint-requirement','requirements'],['#joint-verdict','joint-verdict'],['#joint-witness','common-profile'],['#joint-time-detail','original-time']]){
    await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/joint-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
   }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  const three=makeThreeEpochSkyExample(),priorPath=runDirectory+'/prior-three-inputs.json';await writeFile(priorPath,JSON.stringify(prepareThreeEpochSkySource(three.readings,three.query)));
  await files('joint-originals',[priorPath]);await state('not-compared');assert.equal(await value("document.querySelectorAll('#joint-sources tbody tr').length"),24);assert.equal(await value("document.getElementById('joint-results').hidden"),true);
  assert.equal(await value("document.getElementById('joint-maximum').value"),'2');
  await send('Page.reload',{ignoreCache:true});await until("document.getElementById('joint-example')?.disabled===false");await observe();await files('joint-reopen',[saved.path]);await state('compared');
  assert.deepEqual(await value('window.observedJointResult'),actual);await matches(actual);
  checks.push('Source-only download and fresh document/worker reproduce the exact report; a prior fixed-profile inquiry preserves all observations without passing its known cuts;1440/390layouts retain viewport bounds');
  const tiedReadings=structuredClone(example.readings);for(const input of tiedReadings)input.query.reading.halfWidthC=1;
  const tiedQuery=structuredClone(example.query);tiedQuery.searchSource='Authored wider original bands with two broad whole-interval requirements';
  Object.assign(tiedQuery.requirements[0],{relation:'at-most',differenceC:100});Object.assign(tiedQuery.requirements[1],{relation:'at-least',differenceC:-100});
  const tiedSource=prepareSkyJointSource(tiedReadings,tiedQuery),tiedPath=runDirectory+'/tied-inputs.json';await writeFile(tiedPath,JSON.stringify(tiedSource));
  await files('joint-reopen',[tiedPath]);await state('compared');const tied=await value('window.observedJointResult');await matches(tied);
  assert.equal(tied.report.minimumChanges,1);assert.equal(tied.report.patterns.length,16);assert.deepEqual(tied.report.alternatives.map(a=>a.splitAfterIntervals),Array.from({length:9},(_,i)=>[i+3]));
  assert.equal(tied.report.unexaminedHigherChangePatterns,105);assert.deepEqual(tied.report.jointPatternIndices,tied.report.alternatives.map(a=>a.patternIndex));assert.equal(tied.report.work.actualWitnessProfiles,27);
  assert.equal(await allViews(tied),2754);await field('joint-pattern-select',tied.report.alternatives[0].patternIndex);await field('joint-result-select','joint');
  await value("window.retiredJointTime=document.getElementById('joint-time-select');window.retiredJointReceiver=document.getElementById('joint-receiver-select')");
  await field('joint-pattern-select',tied.report.alternatives[1].patternIndex);const currentView=await value("({...document.getElementById('joint-time-detail').dataset})");
  await value("window.retiredJointTime.value='0';window.retiredJointTime.dispatchEvent(new Event('input'));window.retiredJointReceiver.value='0';window.retiredJointReceiver.dispatchEvent(new Event('input'))");
  assert.deepEqual(await value("({...document.getElementById('joint-time-detail').dataset})"),currentView);
  await writeFile(runDirectory+'/runtime-joint-ties.json',JSON.stringify(tied,null,2));
  checks.push('All9 tied minimum one-change patterns remain individually and jointly compatible under broad upper/lower requirements;27 result-bound common witnesses supply2754 views;105higher patterns stay unexamined and detached controls retire');
  const representative=[example.readings[0],example.readings[3],example.readings[5]].map(input=>{const source=structuredClone(input.source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});return {...input,source};});
  const choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
  const partialReadings=choices.map(([source,index,store])=>{const input=representative[source];return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,reading:{...input.query.reading,utc:originalSkyReadingTimes(input.source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar partial original clock'}});});
  const partialTimes=originalSkyReadingTimes(partialReadings[0].source),partialQuery={...tiedQuery,searchSource:'All original internal boundaries on this independently declared partial clock',
   requirements:[{...tiedQuery.requirements[0],receiverReadingIndex:0,utc:partialTimes.at(-1).utc,store:'surfaceC'},{...tiedQuery.requirements[1],receiverReadingIndex:2,utc:partialTimes[3].utc,store:'subsurfaceC'}]};
  const partialSource=prepareSkyJointSource(partialReadings,partialQuery),partialPath=runDirectory+'/partial-inputs.json';await writeFile(partialPath,JSON.stringify(partialSource));
  await value("window.retiredJointChoice=document.getElementById('joint-pattern-select')");await files('joint-reopen',[partialPath]);await state('compared');const partial=await value('window.observedJointResult');await matches(partial);
  assert.equal(partial.report.minimumChanges,0);assert.equal(partial.report.patterns.length,1);assert.equal(partial.report.jointStatus,'joint-compatible');
  assert.equal(partial.report.unexaminedHigherChangePatterns,45);assert.equal(partial.report.originalTimes.at(-1).minute,127.4);assert.equal(partial.report.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');assert.equal(await allViews(partial),198);
  const beforeOld=await value("({...document.getElementById('joint-time-detail').dataset})");await value("window.retiredJointChoice.value='3';window.retiredJointChoice.dispatchEvent(new Event('input'))");assert.deepEqual(await value("({...document.getElementById('joint-time-detail').dataset})"),beforeOld);
  await writeFile(runDirectory+'/runtime-joint-partial.json',JSON.stringify(partial,null,2));
  checks.push('Unfamiliar11-time127.4minute clock and5mixed records preserve all original identities; all3 static common witnesses supply198 views and45higher patterns stay unexamined');
  const targetPosts=await value('window.jointPosts');
  const edits=[['a-receiver',1],['a-time',partial.report.originalTimes[2].utc],['a-store','subsurfaceC'],['a-relation','at-least'],['a-limit',-100],['a-source','A freshly declared lower requirement'],
   ['b-receiver',0],['b-time',partial.report.originalTimes[0].utc],['b-store','surfaceC'],['b-relation','at-most'],['b-limit',0],['b-source','An exact initial-state upper requirement']];
  for(const [id,content]of edits){await field('joint-'+id,content);assert.equal(await value("document.getElementById('joint-results').hidden&&document.getElementById('joint-export').disabled"),true);}
  assert.equal(await value('window.jointPosts'),targetPosts);await click('joint-run');await state('compared');const retargeted=await value('window.observedJointResult');await matches(retargeted);
  assert.deepEqual(retargeted.investigation.readings,partial.investigation.readings);assert.equal(await value('window.jointPosts'),targetPosts+1);assert.equal(retargeted.report.jointStatus,'joint-compatible');assert.equal(await allViews(retargeted),198);
  await writeFile(runDirectory+'/runtime-joint-retargeted.json',JSON.stringify(retargeted,null,2));
  await field('joint-b-limit',-1);await click('joint-run');await state('compared');const one=await value('window.observedJointResult');await matches(one);
  assert.equal(one.report.jointStatus,'joint-incompatible');assert.deepEqual(one.report.individual.map(item=>item.status),['compatible','incompatible']);assert.equal(one.report.work.actualWitnessProfiles,1);assert.equal(await allViews(one),66);
  await writeFile(runDirectory+'/runtime-joint-one-impossible.json',JSON.stringify(one,null,2));
  await files('joint-reopen',[partialPath]);await state('compared');await matches(partial);
  checks.push('All12 target identity/relation/threshold/source edits retire the previous proof before one fresh worker; exact initial equality passes and an impossible individual remains distinct from empty original evidence, across264additional views');

  for(const [name,content]of [
   ['derived',JSON.stringify({...partial.investigation,report:partial.report})],
   ['cuts',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,splitAfterIntervals:[1,2]}})],
   ['requirement-clock',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,requirements:partial.investigation.query.requirements.map((target,index)=>index?target:{...target,utc:'2026-06-21T06:07:37.001Z'})}})],
   ['requirement-count',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,requirements:[partial.investigation.query.requirements[0]]}})],
   ['utf8',Buffer.from([0xff,0xfe])],['oversize',' '.repeat(5*1024*1024+1)]]){
   const path=runDirectory+'/bad-'+name+'.json';await writeFile(path,content);const before=await value('window.jointPosts');await files('joint-reopen',[path]);await state('file-refused');
   assert.equal(await value('window.jointPosts'),before);await matches(partial);assert.equal(await value("document.getElementById('joint-export').disabled"),false);
  }
  const shortSource=structuredClone(example.readings[0].source);Object.assign(shortSource.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
  const shortTimes=originalSkyReadingTimes(shortSource),impossibleReadings=[[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(shortSource.project,shortSource.declaration,{bins:4,reading:{...example.readings[0].query.reading,utc:shortTimes[index].utc,store,temperatureC:index===2?400:25,halfWidthC:index===2?0:100,source:'Authored impossible final original observation'}}));
  const impossibleSource=prepareSkyJointSource(impossibleReadings,{...partialQuery,requirements:partialQuery.requirements.map((target,index)=>({...target,receiverReadingIndex:index,utc:shortTimes[index+1].utc}))}),impossiblePath=runDirectory+'/impossible-inputs.json';
  await writeFile(impossiblePath,JSON.stringify(impossibleSource));await files('joint-reopen',[impossiblePath]);await state('compared');const impossible=await value('window.observedJointResult');await matches(impossible);
  assert.equal(impossible.report.compatibility,'incompatible');assert.equal(impossible.report.minimumChanges,null);assert.equal(impossible.report.jointStatus,'original-incompatible');
  assert.equal(impossible.report.individual,null);assert.equal(impossible.report.patterns.length,2);assert.equal(impossible.report.alternatives.length,0);assert.equal(impossible.report.work.executedWitnessCourses,0);
  await writeFile(runDirectory+'/runtime-joint-original-empty.json',JSON.stringify(impossible,null,2));const impossibleSaved=await download('incompatible');assert.deepEqual(impossibleSaved.source,impossible.investigation);
  checks.push('Malformed UTF-8, excess bytes, injected output/cuts and altered target count/clock are refused before a worker without replacing the accepted inquiry; impossible original evidence leaves both requirements unevaluated and has no witness');
  await files('joint-reopen',[partialPath]);await state('compared');
  const slow=runDirectory+'/slow-joint-inputs.json';await writeFile(slow,saved.text);
  await value("window.jointArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-joint-inputs.json')return new Promise(resolve=>{window.releaseJointFile=()=>window.jointArrayBuffer.call(this).then(resolve)});return window.jointArrayBuffer.call(this)}");
  await files('joint-reopen',[slow]);await until("typeof window.releaseJointFile==='function'");assert.equal(await value("document.getElementById('joint-export').disabled&&document.getElementById('joint-time-select').disabled"),true);
  await field('joint-a-source','Newer requirement while an older file is pending');assert.equal(await value("document.getElementById('joint-results').hidden"),true);
  await files('joint-reopen',[impossiblePath]);await state('compared');await matches(impossible);await value('window.releaseJointFile()');await delay(80);await matches(impossible);await value('File.prototype.arrayBuffer=window.jointArrayBuffer');
  await value("window.heldJointPost=Worker.prototype.postMessage;window.holdJoint=true;Worker.prototype.postMessage=function(m,...args){if(window.holdJoint&&m.operation==='prepare'){window.holdJoint=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseJointWorker=()=>handler(e)}}return window.heldJointPost.call(this,m,...args)}");
  await files('joint-reopen',[partialPath]);await until("typeof window.releaseJointWorker==='function'");await files('joint-reopen',[impossiblePath]);await state('compared');await matches(impossible);
  await value('window.releaseJointWorker()');await delay(80);await matches(impossible);await value('Worker.prototype.postMessage=window.heldJointPost');
  checks.push('Pending file/result controls are held; requirement edits retire old evidence; held file bytes and an older completed worker cannot replace a newer complete inquiry');
  await files('joint-originals',[partialPath]);await state('not-compared');const postBefore=await value('window.jointPosts');await field('joint-maximum',0);await click('joint-run');await state('compared');
  const fixed=await value('window.observedJointResult');assert.equal(await value('window.jointPosts'),postBefore+1);assert.equal(fixed.report.totalDeclaredPatterns,1);assert.equal(fixed.report.unexaminedHigherChangePatterns,0);await matches(fixed);
  await writeFile(runDirectory+'/runtime-joint-declared-static.json',JSON.stringify(fixed,null,2));
  await value("document.getElementById('joint-source-details').open=true;document.querySelector('#joint-sources .table-wrap').focus()");
  assert.equal(await value("document.activeElement===document.querySelector('#joint-sources .table-wrap')"),true);assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
  checks.push('Explicit maximum0 recomputes only the declared static class; original evidence tables remain focusable; saved site state and page exception count remain unchanged');
  return {checks,sandbox:session.sandbox,exceptions,launcher:{command:'python3 serve.py --port 0',url:launcherUrl},
   qualification:'Actual fresh worker output is the UI oracle. The original minimum class is fixed before the two whole-interval requirements. Every pattern retains both individual and joint results and every feasible result-bound witness is inspected; numerical and exact statuses remain separate.'};
 });
 const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

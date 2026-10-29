import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeSkyRelaxationExample} from '../shade-heat-sky-relaxation-example.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {prepareSkyRelaxationSource,parseSkyRelaxationSource} from '../shade-heat-sky-relaxation-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {profileFraction} from '../shade-heat-profile-band.js';
import {rational as q,sub} from '../vendor/chronos/exact-halfplanes.mjs';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-sky-relaxation-'+randomUUID(),checks=[];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)],example=makeSkyRelaxationExample();let launcher=null;
try{
 launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Relaxation launcher readiness: '+errors)),10000);
  launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
  launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',e=>{clearTimeout(timer);reject(e);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:120000},async session=>{
  const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
  await send('DOM.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  async function until(expression){for(let i=0;i<1800;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Relaxation wait: '+expression+'; '+await value("document.getElementById('relaxation-status')?.textContent"));}
  const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
  async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
  async function files(id,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#'+id});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
  async function state(kind){const expression="document.getElementById('relaxation-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(kind==='compared'?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('relaxation-status').textContent"));}
  const observe=()=>value("window.relaxationPosts=0;window.originalRelaxationPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.relaxationPosts++;const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedRelaxationResult=structuredClone(e.data.result);handler(e)};return window.originalRelaxationPost.call(this,m,...args)}");
  const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
  const exactText=v=>v.exact.numerator+' / '+v.exact.denominator;
  async function matches(output){
   const r=output.report,d=await value("({...document.getElementById('relaxation-results').dataset})");
   assert.equal(d.status,r.compatibility);assert.equal(d.relaxation,r.relaxationStatus);assert.equal(d.minimum,r.minimumChanges===null?'none':String(r.minimumChanges));
   for(const [key,want]of [['patterns',r.patterns.length],['alternatives',r.alternatives.length],['records',output.investigation.readings.length],['originalTimes',r.originalTimes.length],['sources',r.work.uniqueSources]])assert.equal(Number(d[key]),want);
   const query=await value("['a','b'].map(id=>({receiverReadingIndex:Number(document.getElementById('relaxation-'+id+'-receiver').value),utc:document.getElementById('relaxation-'+id+'-time').value,store:document.getElementById('relaxation-'+id+'-store').value,relation:document.getElementById('relaxation-'+id+'-relation').value,differenceC:Number(document.getElementById('relaxation-'+id+'-limit').value),source:document.getElementById('relaxation-'+id+'-source').value}))");
   assert.deepEqual(query,output.investigation.query.requirements);
   const verdict=await value("({...document.getElementById('relaxation-verdict').dataset})");
   assert.equal(verdict.relaxation,r.relaxationStatus);assert.equal(verdict.originalCompatible,r.originalRequirementsCompatible===null?'unevaluated':String(r.originalRequirementsCompatible));
   assert.equal(verdict.delta,r.minimumRelaxationC?exactText(r.minimumRelaxationC):'unevaluated');
   assert.deepEqual(JSON.parse(verdict.attainingPatterns),r.attainingPatternIndices);assert.deepEqual(JSON.parse(verdict.zeroPatterns),r.zeroCompatiblePatternIndices);
   const classes=await value("Array.from(document.querySelectorAll('.relaxation-class')).map(e=>({...e.dataset}))");
   for(const row of classes){const changes=Number(row.changes),patterns=r.patterns.filter(p=>p.changes===changes),compatible=patterns.filter(p=>p.compatibility==='compatible');
    assert.equal(Number(row.examined),patterns.length);assert.equal(Number(row.compatible),compatible.length);
    assert.equal(row.status,changes>r.query.maximumChanges?'outside-declaration':!patterns.length?'not-examined':compatible.length?'compatible':'incompatible');}
   assert.equal(await value("document.querySelectorAll('#relaxation-all-patterns tbody tr').length"),r.patterns.length);
   if(!r.alternatives.length){assert.equal(await value("Boolean(document.getElementById('relaxation-pattern-select')||document.getElementById('relaxation-witness'))"),false);return;}
   const rows=await value("Array.from(document.querySelectorAll('#relaxation-pattern-results tbody tr')).map(e=>({...e.dataset}))");
   assert.deepEqual(rows,r.alternatives.map(a=>({pattern:String(a.patternIndex),delta:exactText(a.minimumRelaxationC),attains:String(a.attainsGlobalMinimum),orderA:String(a.maximumLowerMinusUpperC[0].upper),orderB:String(a.maximumLowerMinusUpperC[1].upper)})));
   assert.deepEqual(await value("Array.from(document.getElementById('relaxation-pattern-select').options).map(o=>Number(o.value))"),r.alternatives.map(a=>a.patternIndex));
   const selected=Number(await value("document.getElementById('relaxation-pattern-select').value")),pattern=r.alternatives.find(a=>a.patternIndex===selected),w=pattern.witness,data=await value("({...document.getElementById('relaxation-witness').dataset})");
   assert.equal(data.pattern,String(selected));assert.equal(data.kind,'optimal');assert.equal(data.delta,exactText(pattern.minimumRelaxationC));assert.equal(data.attains,String(pattern.attainsGlobalMinimum));assert.equal(Number(data.phases),w.phaseProfiles.length);
   assert.deepEqual(await value("Array.from(document.querySelectorAll('#relaxation-witness .phase-profile')).map(e=>JSON.parse(e.dataset.weights))"),w.phaseProfiles.map(p=>p.map(v=>v.lower)));
   assert.equal(await value("document.querySelectorAll('#relaxation-observations tbody tr').length"),output.investigation.readings.length);
   const shown=await value("Array.from(document.querySelectorAll('#relaxation-witness-requirements tbody tr')).map(e=>({...e.dataset}))");
   assert.deepEqual(shown,w.requirements.map(item=>({requirement:String(item.requirementIndex),represented:item.representedStatus,relaxedRepresented:item.relaxedRepresentedStatus,numerical:item.originalNumericalStatus,relaxedNumerical:item.relaxedOriginalNumericalStatus,originalLimit:exactText(item.originalLimitC),relaxedLimit:exactText(item.relaxedLimitC),
    representedLower:String(item.representedPairC.lower.lower),representedUpper:String(item.representedPairC.upper.upper),numericalLower:String(item.originalNumericalPairC.lower.lower),numericalUpper:String(item.originalNumericalPairC.upper.upper)})));
  }
  async function allViews(output){
   const before=await value('window.relaxationPosts');let total=0;
   for(const pattern of output.report.alternatives){
    await field('relaxation-pattern-select',pattern.patternIndex);await matches(output);const a=pattern.witness;
    const rows=await value("(()=>{const receiver=document.getElementById('relaxation-receiver-select'),time=document.getElementById('relaxation-time-select'),rows=[];for(const s of receiver.options){receiver.value=s.value;receiver.dispatchEvent(new Event('input'));for(const t of time.options){time.value=t.value;time.dispatchEvent(new Event('input'));const context={...document.getElementById('relaxation-time-detail').dataset};rows.push(...Array.from(document.querySelectorAll('.relaxation-value')).map(e=>({...context,...e.dataset})));}}return rows})()");
    assert.equal(rows.length,a.originalReplays.length*output.report.originalTimes.length*2);total+=rows.length;
    for(const row of rows){assert.equal(Number(row.pattern),pattern.patternIndex);assert.equal(row.kind,'optimal');
     const replay=a.originalReplays.find(p=>p.sourceIndex===Number(row.source)),at=replay.originalCourse[Number(row.time)],store=row.store;
     assert.equal(row.utc,at.utc);assert.equal(Number(row.additiveLower),profileFraction(sub(exact(at.additiveC.proposal.lower[store]),exact(at.additiveC.existing.upper[store]))).lower);
     assert.equal(Number(row.additiveUpper),profileFraction(sub(exact(at.additiveC.proposal.upper[store]),exact(at.additiveC.existing.lower[store]))).upper);
     assert.equal(Number(row.originalLower),profileFraction(sub(q(at.originalC.proposal.lower[store]),q(at.originalC.existing.upper[store]))).lower);
     assert.equal(Number(row.originalUpper),profileFraction(sub(q(at.originalC.proposal.upper[store]),q(at.originalC.existing.lower[store]))).upper);
    }
   }assert.equal(await value('window.relaxationPosts'),before);return total;
  }
  async function download(name){
   const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('relaxation-export');
   const path=directory+'/original-clock-sky-relaxation-inputs.json';let found=false;for(let i=0;i<300;i++){try{await access(path);found=true;break;}catch{await delay(30);}}assert(found);
   const text=await readFile(path,'utf8'),source=parseSkyRelaxationSource(text);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);return {path,text,source};
  }

  await send('Page.navigate',{url:launcherUrl+'sky-joint-requirements.html'});await until("Boolean(document.querySelector('a[href=\"sky-relaxation.html\"]'))");
  assert.equal(await value("document.querySelector('a[href=\"sky-relaxation.html\"]').target"),'_blank');const originalStorage=await stored();
  await send('Page.navigate',{url:launcherUrl+'sky-relaxation.html'});await until("document.getElementById('relaxation-example')?.disabled===false");await observe();await click('relaxation-example');await state('compared');
  const actual=await value('window.observedRelaxationResult');await matches(actual);assert.deepEqual(actual.investigation.readings,example.readings);
  assert.equal(actual.report.minimumChanges,2);assert.equal(actual.report.patterns.length,121);assert.deepEqual(actual.report.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
  assert.equal(actual.report.relaxationStatus,'minimum-common-relaxation');assert.equal(actual.report.originalRequirementsCompatible,false);assert(actual.report.minimumRelaxationC.lower>0);assert.deepEqual(actual.report.attainingPatternIndices,[79]);
  assert.equal(actual.report.work.actualWitnessProfiles,1);assert.equal(actual.report.work.executedThermalCourses,47580);
  await writeFile(runDirectory+'/runtime-relaxation-original.json',JSON.stringify(actual,null,2));
  await value("document.getElementById('relaxation-selected-certificate').open=true");await until("document.querySelector('#relaxation-selected-certificate pre').textContent.length>0");
  const relaxationProof=await value("JSON.parse(document.querySelector('#relaxation-selected-certificate pre').textContent)");assert.deepEqual(relaxationProof.relaxation,actual.report.exactEvidence.result.cases[0].relaxation);
  assert.equal(await value("Boolean(document.getElementById('relaxation-time-select'))"),true);
  checks.push('Actual new entry and worker retain24original records/3receivers/17times, complete121pattern search, sole minimum2-change pattern[6,10], one certified positive common relaxation and its one complete optimal common profile');
  assert.equal(await allViews(actual),102);await field('relaxation-time-select',3);await value("document.getElementById('relaxation-time-select').focus()");
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await until("document.getElementById('relaxation-time-detail').dataset.time==='4'");
  await value("document.getElementById('relaxation-requirement-proof').open=true");await until("document.querySelector('#relaxation-requirement-proof pre').textContent.length>0");
  const disclosed=await value("JSON.parse(document.querySelector('#relaxation-requirement-proof pre').textContent)");assert.deepEqual(disclosed.cases,actual.report.exactEvidence.result.cases);assert.deepEqual(disclosed.requirements,actual.report.requirements);
  await value("document.getElementById('relaxation-requirement-proof').open=false;document.getElementById('relaxation-all-patterns').open=true;document.querySelector('#relaxation-all-patterns .relaxation-proof').open=true");
  await until("document.querySelector('#relaxation-all-patterns pre').textContent.length>0");await field('relaxation-proof-select',0);
  const originalProof=await value("JSON.parse(document.querySelector('#relaxation-all-patterns pre').textContent)");assert.deepEqual(originalProof.proof,actual.report.exactEvidence.result.analysis.cases[0]);await value("document.getElementById('relaxation-all-patterns').open=false");
  assert.equal(await value("(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);return new Set(ids).size===ids.length})()"),true);
  checks.push('Every102 optimal-profile receiver/time/component view and both requirement statuses match actual exact/numerical output; keyboard selection, original and augmented proof disclosure use no new worker and IDs remain unique');
  assert.match(await value("document.querySelector('#relaxation-verdict h3').textContent"),/4\.2935\d+e-5/);
  const saved=await download('original');assert.deepEqual(saved.source,actual.investigation);
  for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
   for(const [selector,label]of [['.relaxation-requirement','requirements'],['#relaxation-verdict','relaxation-verdict'],['#relaxation-witness','common-profile'],['#relaxation-time-detail','original-time']]){
    await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/relaxation-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
   }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  const three=makeThreeEpochSkyExample(),priorPath=runDirectory+'/prior-three-inputs.json';await writeFile(priorPath,JSON.stringify(prepareThreeEpochSkySource(three.readings,three.query)));
  await files('relaxation-originals',[priorPath]);await state('not-compared');assert.equal(await value("document.querySelectorAll('#relaxation-sources tbody tr').length"),24);assert.equal(await value("document.getElementById('relaxation-results').hidden"),true);
  assert.equal(await value("document.getElementById('relaxation-maximum').value"),'2');
  await send('Page.reload',{ignoreCache:true});await until("document.getElementById('relaxation-example')?.disabled===false");await observe();await files('relaxation-reopen',[saved.path]);await state('compared');
  assert.deepEqual(await value('window.observedRelaxationResult'),actual);await matches(actual);
  checks.push('Source-only download and fresh document/worker reproduce the exact report; a prior fixed-profile inquiry preserves all observations without passing its known cuts;1440/390layouts retain viewport bounds');
  const tiedReadings=structuredClone(example.readings);for(const input of tiedReadings)input.query.reading.halfWidthC=1;
  const tiedQuery=structuredClone(example.query);tiedQuery.searchSource='Authored wider original bands with two broad whole-interval requirements';
  Object.assign(tiedQuery.requirements[0],{relation:'at-most',differenceC:100});Object.assign(tiedQuery.requirements[1],{relation:'at-least',differenceC:-100});
  const tiedSource=prepareSkyRelaxationSource(tiedReadings,tiedQuery),tiedPath=runDirectory+'/tied-inputs.json';await writeFile(tiedPath,JSON.stringify(tiedSource));
  await files('relaxation-reopen',[tiedPath]);await state('compared');const tied=await value('window.observedRelaxationResult');await matches(tied);
  assert.equal(tied.report.minimumChanges,1);assert.equal(tied.report.patterns.length,16);assert.deepEqual(tied.report.alternatives.map(a=>a.splitAfterIntervals),Array.from({length:9},(_,i)=>[i+3]));
  assert.equal(tied.report.unexaminedHigherChangePatterns,105);assert.deepEqual(tied.report.attainingPatternIndices,tied.report.alternatives.map(a=>a.patternIndex));assert.deepEqual(tied.report.zeroCompatiblePatternIndices,tied.report.attainingPatternIndices);assert.equal(tied.report.work.actualWitnessProfiles,9);
  assert.equal(await allViews(tied),918);await field('relaxation-pattern-select',tied.report.alternatives[0].patternIndex);
  await value("window.retiredRelaxationTime=document.getElementById('relaxation-time-select');window.retiredRelaxationReceiver=document.getElementById('relaxation-receiver-select')");
  await field('relaxation-pattern-select',tied.report.alternatives[1].patternIndex);const currentView=await value("({...document.getElementById('relaxation-time-detail').dataset})");
  await value("window.retiredRelaxationTime.value='0';window.retiredRelaxationTime.dispatchEvent(new Event('input'));window.retiredRelaxationReceiver.value='0';window.retiredRelaxationReceiver.dispatchEvent(new Event('input'))");
  assert.deepEqual(await value("({...document.getElementById('relaxation-time-detail').dataset})"),currentView);
  await writeFile(runDirectory+'/runtime-relaxation-ties.json',JSON.stringify(tied,null,2));
  checks.push('All9 tied minimum one-change patterns attain exact zero under broad upper/lower requirements;9 optimal common witnesses supply918 views;105higher patterns stay unexamined and detached controls retire');
  const mixedQuery={...tiedQuery,requirements:structuredClone(example.query.requirements),searchSource:'Retain the independently declared wider original bands while restoring both authored original thresholds'};
  const mixedSource=prepareSkyRelaxationSource(tiedReadings,mixedQuery),mixedPath=runDirectory+'/nonattainer-inputs.json';await writeFile(mixedPath,JSON.stringify(mixedSource));
  await files('relaxation-reopen',[mixedPath]);await state('compared');const mixed=await value('window.observedRelaxationResult');await matches(mixed);
  assert.equal(mixed.report.minimumChanges,1);assert.equal(mixed.report.minimumRelaxationC.exact.numerator,'0');assert.deepEqual(mixed.report.attainingPatternIndices,[8,9,10,11]);
  assert.equal(mixed.report.alternatives.length,9);assert.equal(mixed.report.alternatives.filter(a=>!a.attainsGlobalMinimum).length,5);assert.equal(await allViews(mixed),918);
  const nonwinner=mixed.report.alternatives.find(a=>!a.attainsGlobalMinimum);await field('relaxation-pattern-select',nonwinner.patternIndex);await matches(mixed);
  assert.notEqual(nonwinner.minimumRelaxationC.exact.numerator,'0');assert.match(await value("document.getElementById('relaxation-witness').textContent"),/above the global minimum/);
  await value("document.getElementById('relaxation-selected-certificate').open=true");await until("document.querySelector('#relaxation-selected-certificate pre').textContent.length>0");
  assert.deepEqual(await value("JSON.parse(document.querySelector('#relaxation-selected-certificate pre').textContent).relaxation"),mixed.report.exactEvidence.result.cases.find(c=>c.patternIndex===nonwinner.patternIndex).relaxation);
  await value("document.getElementById('relaxation-selected-certificate').open=false");
  for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await value("document.getElementById('relaxation-witness').scrollIntoView({block:'start',behavior:'instant'})");await delay(40);
   assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/relaxation-nonattainer-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  await writeFile(runDirectory+'/runtime-relaxation-nonattainers.json',JSON.stringify(mixed,null,2));
  checks.push('A global zero retains four exact tied winners and five positive nonattaining pattern optima;918 additional views, selected nonwinner limits and its own proof stay distinct from the global headline');
  const representative=[example.readings[0],example.readings[3],example.readings[5]].map(input=>{const source=structuredClone(input.source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});return {...input,source};});
  const choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
  const partialReadings=choices.map(([source,index,store])=>{const input=representative[source];return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,reading:{...input.query.reading,utc:originalSkyReadingTimes(input.source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar partial original clock'}});});
  const partialTimes=originalSkyReadingTimes(partialReadings[0].source),partialQuery={...tiedQuery,searchSource:'All original internal boundaries on this independently declared partial clock',
   requirements:[{...tiedQuery.requirements[0],receiverReadingIndex:0,utc:partialTimes.at(-1).utc,store:'surfaceC'},{...tiedQuery.requirements[1],receiverReadingIndex:2,utc:partialTimes[3].utc,store:'subsurfaceC'}]};
  const partialSource=prepareSkyRelaxationSource(partialReadings,partialQuery),partialPath=runDirectory+'/partial-inputs.json';await writeFile(partialPath,JSON.stringify(partialSource));
  await value("window.retiredRelaxationChoice=document.getElementById('relaxation-pattern-select')");await files('relaxation-reopen',[partialPath]);await state('compared');const partial=await value('window.observedRelaxationResult');await matches(partial);
  assert.equal(partial.report.minimumChanges,0);assert.equal(partial.report.patterns.length,1);assert.equal(partial.report.originalRequirementsCompatible,true);
  assert.equal(partial.report.unexaminedHigherChangePatterns,45);assert.equal(partial.report.originalTimes.at(-1).minute,127.4);assert.equal(partial.report.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');assert.equal(await allViews(partial),66);
  const beforeOld=await value("({...document.getElementById('relaxation-time-detail').dataset})");await value("window.retiredRelaxationChoice.value='3';window.retiredRelaxationChoice.dispatchEvent(new Event('input'))");assert.deepEqual(await value("({...document.getElementById('relaxation-time-detail').dataset})"),beforeOld);
  await writeFile(runDirectory+'/runtime-relaxation-partial.json',JSON.stringify(partial,null,2));
  checks.push('Unfamiliar11-time127.4minute clock and5mixed records preserve all original identities; one static optimum witness supplies66 views and45higher patterns stay unexamined');
  const targetPosts=await value('window.relaxationPosts');
  const edits=[['a-receiver',1],['a-time',partial.report.originalTimes[2].utc],['a-store','subsurfaceC'],['a-relation','at-least'],['a-limit',-100],['a-source','A freshly declared lower requirement'],
   ['b-receiver',0],['b-time',partial.report.originalTimes[0].utc],['b-store','surfaceC'],['b-relation','at-most'],['b-limit',0],['b-source','An exact initial-state upper requirement']];
  for(const [id,content]of edits){await field('relaxation-'+id,content);assert.equal(await value("document.getElementById('relaxation-results').hidden&&document.getElementById('relaxation-export').disabled"),true);}
  assert.equal(await value('window.relaxationPosts'),targetPosts);await click('relaxation-run');await state('compared');const retargeted=await value('window.observedRelaxationResult');await matches(retargeted);
  assert.deepEqual(retargeted.investigation.readings,partial.investigation.readings);assert.equal(await value('window.relaxationPosts'),targetPosts+1);assert.equal(retargeted.report.originalRequirementsCompatible,true);assert.equal(await allViews(retargeted),66);
  await writeFile(runDirectory+'/runtime-relaxation-retargeted.json',JSON.stringify(retargeted,null,2));
  await field('relaxation-b-limit',-1);await click('relaxation-run');await state('compared');const one=await value('window.observedRelaxationResult');await matches(one);
  assert.equal(one.report.originalRequirementsCompatible,false);assert.equal(one.report.minimumRelaxationC.lower,1);assert.deepEqual(one.report.alternatives[0].witness.requirements.map(item=>item.representedStatus),['met','not-met']);assert.equal(one.report.work.actualWitnessProfiles,1);assert.equal(await allViews(one),66);
  await writeFile(runDirectory+'/runtime-relaxation-constant-positive.json',JSON.stringify(one,null,2));
  const tinyQuery=structuredClone(partialQuery);
  for(const [i,target]of tinyQuery.requirements.entries())Object.assign(target,{receiverReadingIndex:0,utc:partialTimes[0].utc,store:'surfaceC',relation:i?'at-least':'at-most',differenceC:i?Number.MIN_VALUE:-Number.MIN_VALUE});
  const tinySource=prepareSkyRelaxationSource(partialReadings,tinyQuery),tinyPath=runDirectory+'/tiny-positive-inputs.json';await writeFile(tinyPath,JSON.stringify(tinySource));
  await files('relaxation-reopen',[tinyPath]);await state('compared');const tiny=await value('window.observedRelaxationResult');await matches(tiny);
  assert.equal(tiny.report.originalRequirementsCompatible,false);assert(tiny.report.minimumRelaxationC.exact.numerator!=='0');
  assert.match(await value("document.querySelector('#relaxation-verdict h3').textContent"),/4\.940656e-324/);
  const belowDisplay=await value("(async()=>{const m=await import('./shade-heat-sky-relaxation-view.js');return m.skyRelaxationAmountText({exact:{numerator:'1',denominator:(2n**1075n).toString()}})})()");
  assert.equal(belowDisplay,'2.470328e-324');assert.equal(await allViews(tiny),66);
  await writeFile(runDirectory+'/runtime-relaxation-tiny-positive.json',JSON.stringify(tiny,null,2));
  checks.push('Actual source thresholds at the smallest positive binary64 amount retain a positive optimum, original failures and scientific display; exact2^-1075 formatting also remains positive');
  await files('relaxation-reopen',[partialPath]);await state('compared');await matches(partial);
  checks.push('All12 target identity/relation/threshold/source edits retire the previous proof before one fresh worker; exact initial equality has zero relaxation and a constant positive optimum retains one original failure, across132additional views');

  for(const [name,content]of [
   ['derived',JSON.stringify({...partial.investigation,report:partial.report})],
   ['cuts',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,splitAfterIntervals:[1,2]}})],
   ['requirement-clock',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,requirements:partial.investigation.query.requirements.map((target,index)=>index?target:{...target,utc:'2026-06-21T06:07:37.001Z'})}})],
   ['requirement-count',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,requirements:[partial.investigation.query.requirements[0]]}})],
   ['utf8',Buffer.from([0xff,0xfe])],['oversize',' '.repeat(5*1024*1024+1)]]){
   const path=runDirectory+'/bad-'+name+'.json';await writeFile(path,content);const before=await value('window.relaxationPosts');await files('relaxation-reopen',[path]);await state('file-refused');
   assert.equal(await value('window.relaxationPosts'),before);await matches(partial);assert.equal(await value("document.getElementById('relaxation-export').disabled"),false);
  }
  const shortSource=structuredClone(example.readings[0].source);Object.assign(shortSource.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
  const shortTimes=originalSkyReadingTimes(shortSource),impossibleReadings=[[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(shortSource.project,shortSource.declaration,{bins:4,reading:{...example.readings[0].query.reading,utc:shortTimes[index].utc,store,temperatureC:index===2?400:25,halfWidthC:index===2?0:100,source:'Authored impossible final original observation'}}));
  const impossibleSource=prepareSkyRelaxationSource(impossibleReadings,{...partialQuery,requirements:partialQuery.requirements.map((target,index)=>({...target,receiverReadingIndex:index,utc:shortTimes[index+1].utc}))}),impossiblePath=runDirectory+'/impossible-inputs.json';
  await writeFile(impossiblePath,JSON.stringify(impossibleSource));await files('relaxation-reopen',[impossiblePath]);await state('compared');const impossible=await value('window.observedRelaxationResult');await matches(impossible);
  assert.equal(impossible.report.compatibility,'incompatible');assert.equal(impossible.report.minimumChanges,null);assert.equal(impossible.report.relaxationStatus,'original-incompatible');
  assert.equal(impossible.report.minimumRelaxationC,null);assert.equal(impossible.report.originalRequirementsCompatible,null);assert.equal(impossible.report.patterns.length,2);assert.equal(impossible.report.alternatives.length,0);assert.equal(impossible.report.work.executedWitnessCourses,0);
  await writeFile(runDirectory+'/runtime-relaxation-original-empty.json',JSON.stringify(impossible,null,2));const impossibleSaved=await download('incompatible');assert.deepEqual(impossibleSaved.source,impossible.investigation);
  checks.push('Malformed UTF-8, excess bytes, injected output/cuts and altered target count/clock are refused before a worker without replacing the accepted inquiry; impossible original evidence leaves both requirements unevaluated and has no witness');
  await files('relaxation-reopen',[partialPath]);await state('compared');
  const slow=runDirectory+'/slow-relaxation-inputs.json';await writeFile(slow,saved.text);
  await value("window.relaxationArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-relaxation-inputs.json')return new Promise(resolve=>{window.releaseRelaxationFile=()=>window.relaxationArrayBuffer.call(this).then(resolve)});return window.relaxationArrayBuffer.call(this)}");
  await files('relaxation-reopen',[slow]);await until("typeof window.releaseRelaxationFile==='function'");assert.equal(await value("document.getElementById('relaxation-export').disabled&&document.getElementById('relaxation-time-select').disabled"),true);
  await field('relaxation-a-source','Newer requirement while an older file is pending');assert.equal(await value("document.getElementById('relaxation-results').hidden"),true);
  await files('relaxation-reopen',[impossiblePath]);await state('compared');await matches(impossible);await value('window.releaseRelaxationFile()');await delay(80);await matches(impossible);await value('File.prototype.arrayBuffer=window.relaxationArrayBuffer');
  await value("window.heldRelaxationPost=Worker.prototype.postMessage;window.holdRelaxation=true;Worker.prototype.postMessage=function(m,...args){if(window.holdRelaxation&&m.operation==='prepare'){window.holdRelaxation=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseRelaxationWorker=()=>handler(e)}}return window.heldRelaxationPost.call(this,m,...args)}");
  await files('relaxation-reopen',[partialPath]);await until("typeof window.releaseRelaxationWorker==='function'");await files('relaxation-reopen',[impossiblePath]);await state('compared');await matches(impossible);
  await value('window.releaseRelaxationWorker()');await delay(80);await matches(impossible);await value('Worker.prototype.postMessage=window.heldRelaxationPost');
  checks.push('Pending file/result controls are held; requirement edits retire old evidence; held file bytes and an older completed worker cannot replace a newer complete inquiry');
  await files('relaxation-originals',[partialPath]);await state('not-compared');const postBefore=await value('window.relaxationPosts');await field('relaxation-maximum',0);await click('relaxation-run');await state('compared');
  const fixed=await value('window.observedRelaxationResult');assert.equal(await value('window.relaxationPosts'),postBefore+1);assert.equal(fixed.report.totalDeclaredPatterns,1);assert.equal(fixed.report.unexaminedHigherChangePatterns,0);await matches(fixed);
  await writeFile(runDirectory+'/runtime-relaxation-declared-static.json',JSON.stringify(fixed,null,2));
  await value("document.getElementById('relaxation-source-details').open=true;document.querySelector('#relaxation-sources .table-wrap').focus()");
  assert.equal(await value("document.activeElement===document.querySelector('#relaxation-sources .table-wrap')"),true);assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
  checks.push('Explicit maximum0 recomputes only the declared static class; original evidence tables remain focusable; saved site state and page exception count remain unchanged');
  return {checks,sandbox:session.sandbox,exceptions,launcher:{command:'python3 serve.py --port 0',url:launcherUrl},
   qualification:'Actual fresh worker output is the UI oracle. The original minimum class is fixed before the two whole-interval requirements. Every pattern retains its own certified relaxation optimum and one optimal common witness; all global ties and original/relaxed exact/numerical statuses remain separate.'};
 });
 const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeSkyConditionalExample} from '../shade-heat-sky-conditional-example.js';
import {prepareSkyConditionalSource,parseSkyConditionalSource} from '../shade-heat-sky-conditional-course.js';
import {prepareSkyCoverageSource} from '../shade-heat-sky-coverage-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {parseSkyAllowanceText,skyAllowanceFractionText} from '../shade-heat-sky-allowance.js';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-sky-conditional-'+randomUUID(),checks=[],example=makeSkyConditionalExample();let launcher=null;
try{
 launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Conditional launcher readiness: '+errors)),10000);
  launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
  launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',e=>{clearTimeout(timer);reject(e);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:120000},async session=>{
  const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
  await send('DOM.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  async function until(expression){for(let i=0;i<1800;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Conditional wait: '+expression+'; '+await value("document.getElementById('conditional-status')?.textContent"));}
  const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
  async function field(id,content,event='input'){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event('+JSON.stringify(event)+',{bubbles:true}));})()');}
  async function files(id,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#'+id});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
  async function state(kind){const expression="document.getElementById('conditional-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(kind==='conditioned'?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('conditional-status').textContent"));}
  const observe=()=>value("window.conditionalPosts=0;window.originalConditionalPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.conditionalPosts++;const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedConditionalResult=structuredClone(e.data.result);handler(e)};return window.originalConditionalPost.call(this,m,...args)}");
  const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
  async function matches(output){
   const r=output.report,d=await value("({...document.getElementById('conditional-results').dataset})");assert.equal(d.status,r.conditionalStatus);assert.equal(d.original,r.compatibility);assert.equal(d.minimum,r.minimumChanges===null?'none':String(r.minimumChanges));
   for(const [key,want]of [['patterns',r.patterns.length],['alternatives',r.alternatives.length],['survivors',r.conditionalPatternIndices.length],['excluded',r.conditionalExcludedPatternIndices.length],['components',r.components.length],['gaps',r.gaps.length],['records',r.readings.length],['originalTimes',r.originalTimes.length],['sources',r.work.uniqueSources]])assert.equal(Number(d[key]),want,key);
   const query=await value("({allowanceC:document.getElementById('conditional-allowance').value,consequence:{receiverReadingIndex:Number(document.getElementById('conditional-c-receiver').value),utc:document.getElementById('conditional-c-time').value,store:document.getElementById('conditional-c-store').value,source:document.getElementById('conditional-c-source').value}})");
   assert.equal(skyAllowanceFractionText(parseSkyAllowanceText(query.allowanceC)),output.investigation.query.allowanceC);assert.deepEqual(query.consequence,output.investigation.query.consequence);
   assert.equal(await value("document.getElementById('conditional-export').disabled"),false);
   assert.equal(await value("document.querySelectorAll('#conditional-pattern-table tbody tr').length"),r.alternatives.length);
   assert.equal(await value("Boolean(document.getElementById('conditional-hull'))"),r.hullC!==null);
   assert.equal(await value("Boolean(document.getElementById('conditional-gaps'))"),r.gaps.length>0);
  }
  let totalViews=0,totalRoleChecks=0,totalReports=0;
  async function keep(name){
   const output=await value('window.observedConditionalResult');await matches(output);
   await writeFile(runDirectory+'/runtime-conditional-'+name+'.json',JSON.stringify(output,null,2)+'\n');
   await writeFile(runDirectory+'/'+name+'-inputs.json',JSON.stringify(output.investigation,null,2)+'\n');totalReports++;return output;
  }
  async function allViews(){
   const summary=await value(`(()=>{
    const r=window.observedConditionalResult.report,issues=[];let views=0,roles=0;
    const set=(id,v)=>{const el=document.getElementById(id);el.value=String(v);el.dispatchEvent(new Event('change',{bubbles:true}));};
    const exact=v=>v.exact.numerator+' / '+v.exact.denominator;
    const cells=selector=>Array.from(document.querySelectorAll(selector+' tbody tr'),tr=>Array.from(tr.querySelectorAll('td'),td=>td.textContent));
    for(const p of r.alternatives){
     set('conditional-pattern',p.patternIndex);
     if(!p.extremes){if(document.getElementById('conditional-role'))issues.push('excluded role');continue;}
     for(const role of ['lower','upper']){
      set('conditional-role',role);const w=p.extremes[role];roles++;
      const pair=cells('#conditional-role-pair'),wantPair=[['Exact represented pair',exact(w.consequenceRepresentedPairC.lower),exact(w.consequenceRepresentedPairC.upper)],['Original numerical pair',exact(w.consequenceOriginalNumericalPairC.lower),exact(w.consequenceOriginalNumericalPairC.upper)]];
      if(JSON.stringify(pair)!==JSON.stringify(wantPair))issues.push('third pair '+p.patternIndex+'/'+role);
      const requirementTable=Array.from(document.querySelectorAll('#conditional-role-detail table')).find(t=>t.caption?.textContent==='Both requirements on this same profile');
      const statuses=Array.from(requirementTable.tBodies[0].rows,tr=>Array.from(tr.cells,td=>td.textContent));
      for(let i=0;i<2;i++){const v=w.requirements[i];if(statuses[i][2]!==v.representedStatus||statuses[i][3]!==v.selectedRepresentedStatus||statuses[i][5]!==v.originalNumericalStatus||statuses[i][6]!==v.selectedOriginalNumericalStatus)issues.push('statuses');}
      for(const replay of w.originalReplays)for(let index=0;index<r.originalTimes.length;index++){
       set('conditional-receiver',replay.sourceIndex);set('conditional-time',index);const row=replay.originalCourse[index],want=[];
       for(const design of ['existing','proposal'])for(const endpoint of ['lower','upper'])for(const store of ['surfaceC','subsurfaceC'])want.push([design,endpoint,store==='surfaceC'?'Ground surface':'Lower heat store',exact(row.additiveC[design][endpoint][store]),String(row.originalC[design][endpoint][store])]);
       if(JSON.stringify(cells('#conditional-time-detail'))!==JSON.stringify(want))issues.push('course '+p.patternIndex+'/'+role+'/'+replay.sourceIndex+'/'+index);
       const d=document.getElementById('conditional-results').dataset;if(d.pattern!==String(p.patternIndex)||d.role!==role||d.receiver!==String(replay.sourceIndex)||d.time!==String(index))issues.push('context');
       views++;
      }
     }
    }return {issues,views,roles};
   })()`);
   assert.deepEqual(summary.issues,[]);totalViews+=summary.views;totalRoleChecks+=summary.roles;return summary;
  }
  async function download(name){
   const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('conditional-export');
   const path=directory+'/conditional-sky-consequence-inputs.json';let found=false;for(let i=0;i<300;i++){try{await access(path);found=true;break;}catch{await delay(30);}}assert(found);
   const text=await readFile(path,'utf8'),source=parseSkyConditionalSource(text);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);return {path,text,source};
  }
  async function openSource(name,readings,query){
   const source=prepareSkyConditionalSource(readings,query),path=runDirectory+'/'+name+'-open-inputs.json';await writeFile(path,JSON.stringify(source));
   await files('conditional-reopen',[path]);await state('conditioned');return {output:await keep(name),path,source};
  }
  async function screenshot(name,anchor){
   for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});
    await value('document.getElementById('+JSON.stringify(anchor)+').scrollIntoView({block:"start",behavior:"instant"})');
    await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/conditional-'+name+'-'+width+'.png',Buffer.from(shot.data,'base64'));
   }
   await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  }
  await send('Page.navigate',{url:launcherUrl+'sky-coverage.html'});await until("Boolean(document.querySelector('a[href=\"sky-conditional.html\"]'))");
  assert.equal(await value("document.querySelector('a[href=\"sky-conditional.html\"]').target"),'_blank');const originalStorage=await stored();
  await send('Page.navigate',{url:launcherUrl+'sky-conditional.html'});await until("document.getElementById('conditional-example')?.disabled===false");await observe();await click('conditional-example');await state('conditioned');
  const actual=await keep('original');assert.equal(actual.report.status,'compared');assert.deepEqual(actual.investigation.readings,example.readings);
  assert.equal(actual.report.minimumChanges,2);assert.equal(actual.report.patterns.length,121);assert.deepEqual(actual.report.conditionalPatternIndices,[79]);assert.deepEqual(actual.report.alternatives[0].splitAfterIntervals,[6,10]);
  assert.deepEqual([actual.report.consequence.sourceIndex,actual.report.consequence.originalIndex,actual.report.consequence.store],[1,12,'subsurfaceC']);
  assert.equal((await allViews()).views,102);
  await field('conditional-time',3,'change');await value("document.getElementById('conditional-time').focus()");
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
  await until("document.getElementById('conditional-results').dataset.time==='4'");
  await value("document.querySelector('.conditional-proof').open=true");await until("document.querySelector('.conditional-proof pre').textContent.length>0");
  assert.deepEqual(await value("JSON.parse(document.querySelector('.conditional-proof pre').textContent)"),actual.report);await value("document.querySelector('.conditional-proof').open=false");
  const displayedEndpoints=await value("Array.from(document.querySelectorAll('#conditional-hull .conditional-value>strong'),e=>e.textContent)");
  assert.deepEqual(displayedEndpoints,['1.095866 °C','1.097684 °C']);
  await screenshot('original','conditional-results');await screenshot('roles','conditional-role-detail');
  checks.push('Actual sandboxed worker retains24records/3receivers/17times/121patterns and originalmin2; both endpoint profiles bind the third receiver and both conditions across102course views and all statuses');
  const saved=await download('original');assert.deepEqual(saved.source,actual.investigation);
  await send('Page.reload',{ignoreCache:true});await until("document.getElementById('conditional-example')?.disabled===false");await observe();await files('conditional-reopen',[saved.path]);await state('conditioned');
  assert.deepEqual(await value('window.observedConditionalResult'),actual);await matches(actual);
  checks.push('Source-only download retains exact allowance and third declaration; a new document and worker reproduce the complete result without saved calculations');
  const tiedReadings=structuredClone(example.readings);for(const input of tiedReadings)input.query.reading.halfWidthC=1;
  const tiedQuery=structuredClone(example.query);tiedQuery.allowanceC='0';tiedQuery.searchSource='Authored wider original bands with two broad requirements';
  Object.assign(tiedQuery.requirements[0],{relation:'at-most',differenceC:100});Object.assign(tiedQuery.requirements[1],{relation:'at-least',differenceC:-100});
  const tiedRun=await openSource('nine-patterns',tiedReadings,tiedQuery),tied=tiedRun.output;
  assert.equal(tied.report.minimumChanges,1);assert.equal(tied.report.patterns.length,16);assert.equal(tied.report.alternatives.length,9);assert.equal(tied.report.conditionalPatternIndices.length,9);assert.equal(tied.report.unexaminedHigherChangePatterns,105);
  assert.equal((await allViews()).views,918);
  await field('conditional-pattern',tied.report.alternatives[0].patternIndex,'change');
  await value("window.oldTime=document.getElementById('conditional-time');window.oldReceiver=document.getElementById('conditional-receiver');window.oldRole=document.getElementById('conditional-role')");
  await field('conditional-pattern',tied.report.alternatives[1].patternIndex,'change');const afterPattern=await value("({...document.getElementById('conditional-results').dataset})");
  await value("window.oldTime.value='2';window.oldTime.dispatchEvent(new Event('change'));window.oldReceiver.value='2';window.oldReceiver.dispatchEvent(new Event('change'));window.oldRole.value='upper';window.oldRole.dispatchEvent(new Event('change'))");
  assert.deepEqual(await value("({...document.getElementById('conditional-results').dataset})"),afterPattern);
  checks.push('All9 minimum one-change patterns survive broad conditions;918 original course views bind18roles and detached controls cannot alter a new pattern');
  const mixedQuery={...tiedQuery,requirements:structuredClone(example.query.requirements),searchSource:'Retain all nine original minimum patterns while conditioning on the original two requirements'};
  const mixedRun=await openSource('partial-exclusions',tiedReadings,mixedQuery),mixed=mixedRun.output;
  assert.equal(mixed.report.minimumChanges,1);assert.equal(mixed.report.alternatives.length,9);assert.deepEqual(mixed.report.conditionalPatternIndices,[8,9,10,11]);assert.equal(mixed.report.conditionalExcludedPatternIndices.length,5);
  assert.equal((await allViews()).views,408);
  await field('conditional-pattern',mixed.report.conditionalExcludedPatternIndices[0],'change');
  assert.equal(await value("Boolean(document.getElementById('conditional-role'))"),false);assert.match(await value("document.getElementById('conditional-pattern-detail').textContent"),/excluded/);
  await field('conditional-pattern',mixed.report.conditionalPatternIndices[0],'change');await screenshot('partial-exclusions','conditional-results');await screenshot('partial-role','conditional-role-detail');
  checks.push('Both conditions retain4survivors and5Farkas-excluded original patterns with no higher-class fallback; excluded patterns expose no role;408 additional views retain distinct lower and upper profiles');
  const source=structuredClone(example.readings[0].source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
  const times=originalSkyReadingTimes(source),shortReadings=[[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(source.project,source.declaration,{bins:4,reading:{...example.readings[0].query.reading,utc:times[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad original short-clock observation'}}));
  const shortQuery={bins:4,maximumChanges:2,sharingSource:'Authored unchanged receiver conditions',searchSource:'Original minimum before applying both conditions',
   requirements:[{receiverReadingIndex:0,utc:times.at(-1).utc,store:'surfaceC',relation:'at-most',differenceC:100,source:'Authored broad upper requirement'},{receiverReadingIndex:1,utc:times[1].utc,store:'subsurfaceC',relation:'at-least',differenceC:-100,source:'Authored broad lower requirement'}],
   allowanceC:'0',consequence:{receiverReadingIndex:2,utc:times.at(-1).utc,store:'subsurfaceC',source:'Authored third original lower-store consequence'}};
  const shortRun=await openSource('short',shortReadings,shortQuery),short=shortRun.output;assert.equal(short.report.minimumChanges,0);assert.equal(short.report.unexaminedHigherChangePatterns,1);assert.equal(short.report.originalTimes.at(-1).minute,19.4);assert.equal((await allViews()).views,6);
  const emptyQuery=structuredClone(shortQuery);for(const t of emptyQuery.requirements)Object.assign(t,{receiverReadingIndex:0,utc:times[0].utc,store:'surfaceC'});emptyQuery.requirements[0].differenceC=0;emptyQuery.requirements[1].differenceC=1;
  const emptyRun=await openSource('conditional-empty',shortReadings,emptyQuery);assert.equal(emptyRun.output.report.conditionalStatus,'conditional-empty');assert.equal(emptyRun.output.report.minimumChanges,0);assert.equal(emptyRun.output.report.hullC,null);assert.equal(emptyRun.output.report.alternatives.length,1);assert.equal((await allViews()).views,0);
  const contactRun=await openSource('contact',shortReadings,{...emptyQuery,allowanceC:'1'});assert.equal(contactRun.output.report.conditionalStatus,'conditional-range');assert.equal((await allViews()).views,6);
  const initialRun=await openSource('initial',shortReadings,{...shortQuery,consequence:{...shortQuery.consequence,utc:times[0].utc}});assert.equal(initialRun.output.report.hullC.lower.exact.numerator,'0');assert.equal(initialRun.output.report.hullC.upper.exact.numerator,'0');assert.equal((await allViews()).views,6);
  const tinyQuery={...shortQuery,allowanceC:'1 / '+String(2n**1075n)},tinyRun=await openSource('tiny',shortReadings,tinyQuery);assert.equal(tinyRun.output.report.allowanceC.exact.numerator,'1');assert.match(await value("document.getElementById('conditional-selected-allowance').textContent"),/2\.470328e-324/);assert.equal((await allViews()).views,6);
  await screenshot('tiny','conditional-selected-allowance');const tinySaved=await download('tiny');assert.equal(tinySaved.source.query.allowanceC,tinyQuery.allowanceC);
  const impossible=structuredClone(shortReadings);impossible[2].query.reading.temperatureC=400;impossible[2].query.reading.halfWidthC=0;
  const originalEmpty=await openSource('original-empty',impossible,shortQuery);assert.equal(originalEmpty.output.report.conditionalStatus,'original-incompatible');assert.equal(originalEmpty.output.report.minimumChanges,null);assert.equal(originalEmpty.output.report.hullC,null);assert.equal(originalEmpty.output.report.alternatives.length,0);assert.equal((await allViews()).views,0);
  checks.push('Unfamiliar partial original clock distinguishes conditional-empty from original-empty, exact initial zero, positive2^-1075allowance and contact at1; tiny exact allowance survives display and source download');
  const {allowanceC,consequence,...coverageQuery}=shortQuery,prior=prepareSkyCoverageSource(shortReadings,coverageQuery),priorPath=runDirectory+'/prior-coverage-inputs.json';await writeFile(priorPath,JSON.stringify(prior));
  await files('conditional-originals',[priorPath]);await state('not-conditioned');assert.equal(await value("document.getElementById('conditional-results').hidden"),true);
  const beforeRetarget=await value('window.conditionalPosts');
  for(const [key,v]of [['a-relation','at-least'],['a-limit',-100],['b-relation','at-most'],['b-limit',100],['c-receiver',0],['c-time',times[1].utc],['c-store','surfaceC'],['c-source','Freshly declared third surface consequence'],['allowance','1e-3']]){
   await field('conditional-'+key,v);assert.equal(await value("document.getElementById('conditional-results').hidden&&document.getElementById('conditional-export').disabled"),true);
  }
  assert.equal(await value('window.conditionalPosts'),beforeRetarget);await click('conditional-run');await state('conditioned');const retargeted=await keep('retargeted');
  assert.deepEqual(retargeted.investigation.readings,shortReadings);assert.equal(retargeted.investigation.query.allowanceC,'1 / 1000');assert.equal(retargeted.report.consequence.store,'surfaceC');assert.equal(await value('window.conditionalPosts'),beforeRetarget+1);assert.equal((await allViews()).views,6);
  checks.push('Prior coverage input retains both original requirements and all observations; explicit third-target/relation/allowance edits retire old evidence before one fresh worker and canonical source persistence');
  let invalidInputs=0;
  for(const [name,content]of [
   ['derived',JSON.stringify({...retargeted.investigation,report:retargeted.report})],
   ['allowance',JSON.stringify({...retargeted.investigation,query:{...retargeted.investigation.query,allowanceC:'-1'}})],
   ['third-clock',JSON.stringify({...retargeted.investigation,query:{...retargeted.investigation.query,consequence:{...retargeted.investigation.query.consequence,utc:'2026-06-21T04:13:13.001Z'}}})],
   ['count',JSON.stringify({...retargeted.investigation,query:{...retargeted.investigation.query,requirements:[retargeted.investigation.query.requirements[0]]}})],
   ['utf8',Buffer.from([0xff,0xfe])],['oversize',' '.repeat(5*1024*1024+1)]]){
   const path=runDirectory+'/bad-'+name+'.json';await writeFile(path,content);const posts=await value('window.conditionalPosts');await files('conditional-reopen',[path]);await state('file-refused');
   assert.equal(await value('window.conditionalPosts'),posts);await matches(retargeted);invalidInputs++;
  }
  const restorePath=runDirectory+'/retargeted-restore-inputs.json';await writeFile(restorePath,JSON.stringify(retargeted.investigation));
  for(const invalid of ['','-1','NaN','Infinity','1/0','1e1234','1/'+String(2n**4096n)]){
   const posts=await value('window.conditionalPosts');await field('conditional-allowance',invalid);await click('conditional-run');await state('refused');
   assert.equal(await value('window.conditionalPosts'),posts);assert.equal(await value("document.getElementById('conditional-results').hidden"),true);invalidInputs++;
  }
  await files('conditional-reopen',[restorePath]);await state('conditioned');await matches(retargeted);
  checks.push('Six malformed files preserve the accepted inquiry without dispatch; seven invalid exact allowances retire the old result and refuse before a worker');
  const savedContext=await value("({...document.getElementById('conditional-results').dataset})");
  await value("window.retiredPattern=document.getElementById('conditional-pattern');window.rawConditionalFile=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const file=this;return new Promise((resolve,reject)=>{window.releaseConditionalFile=()=>window.rawConditionalFile.call(file).then(resolve,reject)})}");
  await files('conditional-reopen',[originalEmpty.path]);await state('file-pending');
  assert.equal(await value("document.getElementById('conditional-export').disabled&&Array.from(document.querySelectorAll('#conditional-results select')).every(e=>e.disabled)"),true);
  await value("window.retiredPattern.dispatchEvent(new Event('change'))");assert.deepEqual(await value("({...document.getElementById('conditional-results').dataset})"),savedContext);
  await field('conditional-allowance','0');await state('not-conditioned');await value('File.prototype.arrayBuffer=window.rawConditionalFile;window.releaseConditionalFile()');await delay(100);
  assert.equal(await value("document.getElementById('conditional-results').hidden"),true);
  await value("window.heldConditionalPost=Worker.prototype.postMessage;window.holdNextConditional=true;Worker.prototype.postMessage=function(m,...args){const handler=this.onmessage;if(window.holdNextConditional){window.holdNextConditional=false;this.onmessage=e=>{window.releaseConditionalWorker=()=>handler(e)}}return window.heldConditionalPost.call(this,m,...args)}");
  await files('conditional-reopen',[shortRun.path]);await until("typeof window.releaseConditionalWorker==='function'");
  await files('conditional-reopen',[originalEmpty.path]);await state('conditioned');await matches(originalEmpty.output);
  await value('window.releaseConditionalWorker()');await delay(80);await matches(originalEmpty.output);await value('Worker.prototype.postMessage=window.heldConditionalPost');
  checks.push('Pending reads disable and current-guard prior controls; query edits retire held bytes; an older completed worker cannot replace a newer complete inquiry');
  await files('conditional-reopen',[shortRun.path]);await state('conditioned');await matches(short);
  await value("window.retiredRoleTime=document.getElementById('conditional-time')");await field('conditional-role','upper','change');const roleContext=await value("({...document.getElementById('conditional-results').dataset})");
  await value("window.retiredRoleTime.value='1';window.retiredRoleTime.dispatchEvent(new Event('change'))");assert.deepEqual(await value("({...document.getElementById('conditional-results').dataset})"),roleContext);
  const displayControl=await value(`(async()=>{
   const core=await import('./shade-heat-sky-conditional.js'),v=await import('./shade-heat-sky-conditional-view.js'),pf=await import('./shade-heat-profile-band.js');
   const Q=n=>[BigInt(n),1n],z=()=>Q(0),row=a=>({constant:z(),coefficients:a.map(x=>[Q(x),z(),z()])});
   const g=[1n,2n**1075n],original=[row([1,0,0]),row([0,0,1])],bands=[{lower:z(),upper:z()},{lower:Q(1),upper:Q(1)}],zero=row([0,0,0]);
   const req=[0,1].map(()=>({relation:'at-most',limit:z(),lower:zero,upper:zero})),target={constant:z(),coefficients:[[z(),z(),z()],[g,z(),z()],[z(),z(),z()]]};
   const result=core.conditionMinimumSkyConsequence(original,bands,req,z(),{lower:target,upper:target});
   const {report,investigation}=window.observedConditionalResult,r=structuredClone(report);r.conditionalStatus=result.status;r.minimumChanges=result.analysis.minimumChanges;
   r.alternatives=[];r.patterns=result.analysis.cases.map((c,i)=>({patternIndex:i,changes:c.splits.length,splitUtcs:[],compatibility:c.status}));r.conditionalPatternIndices=result.conditionalPatternIndices;r.conditionalExcludedPatternIndices=result.conditionalExcludedPatternIndices;
   r.lowerAttainingPatternIndices=result.lowerAttainingPatternIndices;r.upperAttainingPatternIndices=result.upperAttainingPatternIndices;r.hullC={lower:pf.profileFraction(result.hull.lower),upper:pf.profileFraction(result.hull.upper)};
   r.components=result.components.map(c=>({...c,lower:pf.profileFraction(c.lower),upper:pf.profileFraction(c.upper)}));r.gaps=result.gaps.map(c=>({...c,lower:pf.profileFraction(c.lower),upper:pf.profileFraction(c.upper)}));
   const box=document.createElement('section');box.id='conditional-synthetic-display';box.className='card';document.querySelector('main').append(box);v.drawSkyConditionalReport(box,{report:r,investigation},()=>true);
   const text=box.textContent,exactGap=box.querySelector('#conditional-gaps')?.textContent;
   const check={scope:'Synthetic core-to-view formatting control only; no thermal or source report qualification',positiveTinyEndpoint:text.includes('2.470328e-324'),exactGapDenominator:exactGap.includes(String(g[1])),components:r.components.length,gaps:r.gaps.length};
   box.remove();return check;
  })()`);
  assert.equal(displayControl.positiveTinyEndpoint,true);assert.equal(displayControl.exactGapDenominator,true);assert.equal(displayControl.components,2);assert.equal(displayControl.gaps,1);
  await writeFile(runDirectory+'/display-only-exact-gap.json',JSON.stringify(displayControl,null,2)+'\n');
  checks.push('Detached role-time controls retire; a separately labeled synthetic core-to-view control preserves a positive2^-1075gap and two closed components without floating-point collapse');
  await field('conditional-maximum',0);const finalPosts=await value('window.conditionalPosts');await click('conditional-run');await state('conditioned');const declared=await keep('declared-static');
  assert.equal(declared.report.totalDeclaredPatterns,1);assert.equal(declared.report.unexaminedHigherChangePatterns,0);assert.equal(await value('window.conditionalPosts'),finalPosts+1);assert.equal((await allViews()).views,6);
  await value("document.getElementById('conditional-source-details').open=true;document.querySelector('#conditional-sources .table-wrap').focus()");
  assert.equal(await value("document.activeElement===document.querySelector('#conditional-sources .table-wrap')"),true);assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
  checks.push('Explicit maximum0 recomputes only the declared class; original source tables remain keyboard focusable, local saved site state is unchanged, and page exceptions remain zero');
  return {checks,totalReports,totalViews,totalRoleChecks,invalidInputs,displayControl,sandbox:session.sandbox,exceptions,launcher:{command:'python3 serve.py --port 0',url:launcherUrl},
   qualification:'Actual fresh worker output is the UI oracle. Original minimum class is fixed; both conditions apply to the same profile; excluded patterns retain no fabricated range; each lower and upper role retains its own requirement, third-consequence and original-course values. Exact represented and numerical statuses remain separate.'};
 });
 const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

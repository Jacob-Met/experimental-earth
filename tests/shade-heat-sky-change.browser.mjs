import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {prepareSkyChangeSource,parseSkyChangeSource} from '../shade-heat-sky-change-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {profileFraction} from '../shade-heat-profile-band.js';
import {rational as q,sub} from '../vendor/chronos/exact-halfplanes.mjs';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-sky-change-'+randomUUID(),checks=[];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)],example=makeThreeEpochSkyExample();let launcher=null;
try{
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Pattern launcher readiness: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',e=>{clearTimeout(timer);reject(e);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
    async function until(expression){for(let i=0;i<1800;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Sky-pattern wait: '+expression+'; '+await value("document.getElementById('change-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    async function files(id,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#'+id});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
    async function state(kind){const expression="document.getElementById('change-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(kind==='compared'?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('change-status').textContent"));}
    const observe=()=>value("window.patternPosts=0;window.originalPatternPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.patternPosts++;const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedPatternResult=structuredClone(e.data.result);handler(e)};return window.originalPatternPost.call(this,m,...args)}");
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    async function matches(result){
      const r=result.report,d=await value("({...document.getElementById('change-results').dataset})");
      assert.equal(d.status,r.compatibility);assert.equal(d.minimum,r.minimumChanges===null?'none':String(r.minimumChanges));assert.equal(Number(d.patterns),r.patterns.length);
      assert.equal(Number(d.alternatives),r.alternatives.length);assert.equal(Number(d.records),result.investigation.readings.length);assert.equal(Number(d.originalTimes),r.originalTimes.length);assert.equal(Number(d.sources),r.work.uniqueSources);
      const classes=await value("Array.from(document.querySelectorAll('.change-class')).map(e=>({...e.dataset}))");
      for(const row of classes){const changes=Number(row.changes),patterns=r.patterns.filter(p=>p.changes===changes),compatible=patterns.filter(p=>p.compatibility==='compatible');assert.equal(Number(row.examined),patterns.length);assert.equal(Number(row.compatible),compatible.length);
        assert.equal(row.status,changes>r.query.maximumChanges?'outside-declaration':!patterns.length?'not-examined':compatible.length?'compatible':'incompatible');}
      assert.equal(await value("document.querySelectorAll('#change-all-patterns tbody tr').length"),r.patterns.length);
      if(!r.alternatives.length){assert.equal(await value("Boolean(document.getElementById('change-pattern-select'))"),false);return;}
      assert.deepEqual(await value("Array.from(document.getElementById('change-pattern-select').options).map(o=>Number(o.value))"),r.alternatives.map(a=>a.patternIndex));
      const selected=Number(await value("document.getElementById('change-pattern-select').value")),a=r.alternatives.find(a=>a.patternIndex===selected);
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#change-witness .phase-profile')).map(e=>JSON.parse(e.dataset.weights))"),a.phaseProfiles.map(p=>p.map(v=>v.lower)));
      assert.equal(await value("document.querySelectorAll('#change-observations tbody tr').length"),result.investigation.readings.length);
    }
    async function allViews(result){
      const before=await value('window.patternPosts');let total=0;
      for(const a of result.report.alternatives){
        await field('change-pattern-select',a.patternIndex);await matches(result);
        const rows=await value("(()=>{const receiver=document.getElementById('change-receiver-select'),time=document.getElementById('change-time-select'),rows=[];for(const s of receiver.options){receiver.value=s.value;receiver.dispatchEvent(new Event('input'));for(const t of time.options){time.value=t.value;time.dispatchEvent(new Event('input'));const context={...document.getElementById('change-time-detail').dataset};rows.push(...Array.from(document.querySelectorAll('.change-value')).map(e=>({...context,...e.dataset})));}}return rows})()");
        assert.equal(rows.length,a.originalReplays.length*result.report.originalTimes.length*2);total+=rows.length;
        for(const row of rows){assert.equal(Number(row.pattern),a.patternIndex);const replay=a.originalReplays.find(p=>p.sourceIndex===Number(row.source)),at=replay.originalCourse[Number(row.time)],store=row.store;
          assert.equal(row.utc,at.utc);assert.equal(Number(row.additiveLower),profileFraction(sub(exact(at.additiveC.proposal.lower[store]),exact(at.additiveC.existing.upper[store]))).lower);
          assert.equal(Number(row.additiveUpper),profileFraction(sub(exact(at.additiveC.proposal.upper[store]),exact(at.additiveC.existing.lower[store]))).upper);
          assert.equal(Number(row.originalLower),profileFraction(sub(q(at.originalC.proposal.lower[store]),q(at.originalC.existing.upper[store]))).lower);
          assert.equal(Number(row.originalUpper),profileFraction(sub(q(at.originalC.proposal.upper[store]),q(at.originalC.existing.lower[store]))).upper);
        }
      }assert.equal(await value('window.patternPosts'),before);return total;
    }
    async function download(name){const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('change-export');const path=directory+'/original-clock-sky-change-inputs.json';let found=false;
      for(let i=0;i<300;i++){try{await access(path);found=true;break;}catch{await delay(30);}}assert(found);const text=await readFile(path,'utf8'),source=parseSkyChangeSource(text);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);return {path,text,source};}
    await send('Page.navigate',{url:launcherUrl+'sky-three-epochs.html'});await until("Boolean(document.querySelector('a[href=\"sky-change-patterns.html\"]'))");assert.equal(await value("document.querySelector('a[href=\"sky-change-patterns.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-change-patterns.html'});await until("document.getElementById('change-example')?.disabled===false");await observe();await click('change-example');await state('compared');const actual=await value('window.observedPatternResult');await matches(actual);
    assert.equal(actual.report.minimumChanges,2);assert.deepEqual(actual.report.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);assert.equal(actual.report.patterns.length,121);assert.equal(actual.report.work.executedThermalCourses,47580);assert.equal(actual.investigation.readings.length,24);
    await writeFile(runDirectory+'/runtime-pattern-course.json',JSON.stringify(actual,null,2));checks.push('Actual new entry and worker search121 complete original-clock patterns without authored cuts, retain24records/3receivers/17times, and identify the unique minimum2-change pattern[6,10]');
    assert.equal(await allViews(actual),102);await field('change-time-select',3);await value("document.getElementById('change-time-select').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await until("document.getElementById('change-time-detail').dataset.time==='4'");
    await value("document.getElementById('change-all-patterns').open=true;document.querySelector('#change-all-patterns .change-proof').open=true");await until("document.querySelector('#change-all-patterns pre').textContent.length>0");
    await field('change-proof-select',0);const proof=await value("JSON.parse(document.querySelector('#change-all-patterns pre').textContent)");assert.deepEqual(proof.proof,actual.report.exactEvidence.analysis.cases[0]);await value("document.getElementById('change-all-patterns').open=false");
    assert.equal(await value("(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);return new Set(ids).size===ids.length})()"),true);
    checks.push('All102 original receiver/time/component views match actual represented and numerical endpoints; keyboard time selection and exact incompatible-pattern disclosure use no new worker and IDs remain unique');
    const saved=await download('two-change');assert.deepEqual(saved.source,actual.investigation);
    for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      for(const [selector,label]of [['#change-form','declaration'],['#change-results','minimum'],['#change-witness','profiles'],['#change-time-detail','original-time']]){
        await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/pattern-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
    const priorPath=runDirectory+'/prior-three-inputs.json';await writeFile(priorPath,JSON.stringify(prepareThreeEpochSkySource(example.readings,example.query)));await files('change-originals',[priorPath]);await state('not-compared');assert.equal(await value("document.querySelectorAll('#change-sources tbody tr').length"),24);assert.equal(await value("document.getElementById('change-results').hidden"),true);
    assert.equal(await value("document.getElementById('change-maximum').value"),'2');assert.equal(await value("document.getElementById('change-run').disabled"),false);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('change-example')?.disabled===false");await observe();await files('change-reopen',[saved.path]);await state('compared');assert.deepEqual(await value('window.observedPatternResult'),actual);await matches(actual);
    checks.push('Source-only download and a fresh document/worker reproduce the exact full report; a prior fixed-three-profile inquiry supplies every original record while its known cuts remain outside the new search query;1440/390 views stay within the viewport');
    const tiedReadings=structuredClone(example.readings);for(const input of tiedReadings)input.query.reading.halfWidthC=1;
    const tiedSource=prepareSkyChangeSource(tiedReadings,{...actual.investigation.query,searchSource:'Authored wider original uncertainty bands to inspect every compatible minimum-class pattern'}),tiedPath=runDirectory+'/tied-inputs.json';await writeFile(tiedPath,JSON.stringify(tiedSource));await files('change-reopen',[tiedPath]);await state('compared');const tied=await value('window.observedPatternResult');await matches(tied);
    assert.equal(tied.report.minimumChanges,1);assert.equal(tied.report.patterns.length,16);assert.deepEqual(tied.report.alternatives.map(a=>a.splitAfterIntervals),Array.from({length:9},(_,i)=>[i+3]));assert.equal(tied.report.unexaminedHigherChangePatterns,105);
    assert.equal(await allViews(tied),918);await field('change-pattern-select',tied.report.alternatives[0].patternIndex);await value("window.retiredPatternTime=document.getElementById('change-time-select');window.retiredPatternReceiver=document.getElementById('change-receiver-select')");await field('change-pattern-select',tied.report.alternatives[1].patternIndex);
    const currentView=await value("({...document.getElementById('change-time-detail').dataset})");await value("window.retiredPatternTime.value='0';window.retiredPatternTime.dispatchEvent(new Event('input'));window.retiredPatternReceiver.value='0';window.retiredPatternReceiver.dispatchEvent(new Event('input'))");assert.deepEqual(await value("({...document.getElementById('change-time-detail').dataset})"),currentView);
    await writeFile(runDirectory+'/runtime-pattern-ties.json',JSON.stringify(tied,null,2));checks.push('Widening only the24original bands to1°C retains all9 compatible one-change patterns, leaves105higher patterns explicitly unexamined, binds all918 receiver/time/component views, and retires detached prior profile controls');
    const representative=[example.readings[0],example.readings[3],example.readings[5]].map(input=>{const source=structuredClone(input.source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});return {...input,source};});
    const choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
    const partialReadings=choices.map(([source,index,store])=>{const input=representative[source];return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,reading:{...input.query.reading,utc:originalSkyReadingTimes(input.source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar partial original clock'}});});
    const partialSource=prepareSkyChangeSource(partialReadings,{...actual.investigation.query,searchSource:'All original internal boundaries on this independently declared partial clock'}),partialPath=runDirectory+'/partial-inputs.json';await writeFile(partialPath,JSON.stringify(partialSource));
    await value("window.retiredPatternChoice=document.getElementById('change-pattern-select')");await files('change-reopen',[partialPath]);await state('compared');const partial=await value('window.observedPatternResult');await matches(partial);
    assert.equal(partial.report.minimumChanges,0);assert.equal(partial.report.patterns.length,1);assert.equal(partial.report.unexaminedHigherChangePatterns,45);assert.equal(partial.report.originalTimes.at(-1).minute,127.4);assert.equal(partial.report.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');assert.equal(await allViews(partial),66);
    const beforeOld=await value("({...document.getElementById('change-time-detail').dataset})");await value("window.retiredPatternChoice.value='3';window.retiredPatternChoice.dispatchEvent(new Event('input'))");assert.deepEqual(await value("({...document.getElementById('change-time-detail').dataset})"),beforeOld);
    await writeFile(runDirectory+'/runtime-pattern-partial-static.json',JSON.stringify(partial,null,2));checks.push('Unfamiliar11-time127.4minute original clock and5mixed observations retain all identities; the complete static class succeeds, all45higher patterns stay unexamined, and all66 receiver/time/component views remain available');
    for(const [name,content]of [['derived',JSON.stringify({...partial.investigation,report:partial.report})],['cuts',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,splitAfterIntervals:[1,2]}})],['utf8',Buffer.from([0xff,0xfe])],['oversize',' '.repeat(5*1024*1024+1)]]){
      const path=runDirectory+'/bad-'+name+'.json';await writeFile(path,content);const before=await value('window.patternPosts');await files('change-reopen',[path]);await state('file-refused');assert.equal(await value('window.patternPosts'),before);await matches(partial);assert.equal(await value("document.getElementById('change-export').disabled"),false);
    }
    const shortSource=structuredClone(example.readings[0].source);Object.assign(shortSource.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
    const impossibleReadings=[[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(shortSource.project,shortSource.declaration,{bins:4,reading:{...example.readings[0].query.reading,utc:originalSkyReadingTimes(shortSource)[index].utc,store,temperatureC:index===2?400:25,halfWidthC:index===2?0:100,source:'Authored impossible final original observation'}}));
    const impossibleSource=prepareSkyChangeSource(impossibleReadings,actual.investigation.query),impossiblePath=runDirectory+'/impossible-inputs.json';await writeFile(impossiblePath,JSON.stringify(impossibleSource));await files('change-reopen',[impossiblePath]);await state('compared');const impossible=await value('window.observedPatternResult');await matches(impossible);
    assert.equal(impossible.report.compatibility,'incompatible');assert.equal(impossible.report.minimumChanges,null);assert.equal(impossible.report.patterns.length,2);assert.equal(impossible.report.alternatives.length,0);assert.equal(impossible.report.work.executedWitnessCourses,0);
    await writeFile(runDirectory+'/runtime-pattern-incompatible.json',JSON.stringify(impossible,null,2));const impossibleSaved=await download('incompatible');assert.deepEqual(impossibleSaved.source,impossible.investigation);
    checks.push('Malformed UTF-8, excess bytes, injected output and prior cuts are refused before a worker without replacing the accepted inquiry; an impossible original band produces complete incompatibility with no fixed-profile claims and remains source-only downloadable');
    await files('change-reopen',[partialPath]);await state('compared');
    const slow=runDirectory+'/slow-pattern-inputs.json';await writeFile(slow,saved.text);await value("window.patternArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-pattern-inputs.json')return new Promise(resolve=>{window.releasePatternFile=()=>window.patternArrayBuffer.call(this).then(resolve)});return window.patternArrayBuffer.call(this)}");
    await files('change-reopen',[slow]);await until("typeof window.releasePatternFile==='function'");assert.equal(await value("document.getElementById('change-export').disabled&&document.getElementById('change-time-select').disabled"),true);
    await field('change-search-source','Newer model declaration while an older file is pending');assert.equal(await value("document.getElementById('change-results').hidden"),true);await files('change-reopen',[impossiblePath]);await state('compared');await matches(impossible);await value('window.releasePatternFile()');await delay(80);await matches(impossible);await value('File.prototype.arrayBuffer=window.patternArrayBuffer');
    await value("window.heldPatternPost=Worker.prototype.postMessage;window.holdPattern=true;Worker.prototype.postMessage=function(m,...args){if(window.holdPattern&&m.operation==='prepare'){window.holdPattern=false;const handler=this.onmessage;this.onmessage=e=>{window.releasePatternWorker=()=>handler(e)}}return window.heldPatternPost.call(this,m,...args)}");
    await files('change-reopen',[partialPath]);await until("typeof window.releasePatternWorker==='function'");await files('change-reopen',[impossiblePath]);await state('compared');await matches(impossible);await value('window.releasePatternWorker()');await delay(80);await matches(impossible);await value('Worker.prototype.postMessage=window.heldPatternPost');
    checks.push('Pending file and result controls are held; a query edit retires the old proof; held file bytes and held old worker completion cannot replace a newer complete inquiry');
    await files('change-originals',[partialPath]);await state('not-compared');const postBefore=await value('window.patternPosts');await field('change-maximum',0);await click('change-run');await state('compared');const fixed=await value('window.observedPatternResult');assert.equal(await value('window.patternPosts'),postBefore+1);assert.equal(fixed.report.totalDeclaredPatterns,1);assert.equal(fixed.report.unexaminedHigherChangePatterns,0);await matches(fixed);
    await writeFile(runDirectory+'/runtime-pattern-declared-static.json',JSON.stringify(fixed,null,2));
    await value("document.getElementById('change-source-details').open=true;document.querySelector('#change-sources .table-wrap').focus()");assert.equal(await value("document.activeElement===document.querySelector('#change-sources .table-wrap')"),true);
    assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    checks.push('Changing the declared maximum to0 starts one fresh complete worker, reports only the single declared class, retains focusable original tables, and changes neither saved site state nor page exception count');
    return {checks,sandbox:session.sandbox,exceptions,launcher:{command:'python3 serve.py --port 0',url:launcherUrl},qualification:'Actual worker output is the UI oracle. Every original pattern through the minimum class is retained; one profile per compatible pattern is inspected. No physical or every-profile consequence claim.'};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

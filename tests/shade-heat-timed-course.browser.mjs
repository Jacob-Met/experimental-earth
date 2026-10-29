import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeTimedSkyExample} from '../shade-heat-timed-example.js';
import {prepareTimedSkyCourseEvidence,prepareTimedSkyCourseSource} from '../shade-heat-timed-course.js';
import {makeJointCourseExample} from '../shade-heat-joint-example.js';
import {prepareSkyCourseSource} from '../shade-heat-course-evidence.js';
import {courseWitnessDifferences} from '../shade-heat-course-inputs.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-run-timed-course-'+randomUUID(),checks=[];
const raw=makeTimedSkyExample(),reference=prepareTimedSkyCourseEvidence(raw.readings,raw.query);
let launcher=null,launcherUrl=null;
try{
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Launcher readiness timed out: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',error=>{clearTimeout(timer);reject(error);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');
    async function until(expression){for(let i=0;i<1500;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Timed out: '+expression+'; '+await value("document.getElementById('timed-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    async function editField(index,name,content){await value('(()=>{const d=document.querySelector(\'.source-edit[data-reading="'+index+'"]\');d.open=true;const e=d.querySelector(\'[data-field="'+name+'"]\');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    const editAction=(index,action)=>value('document.querySelector(\'.source-edit[data-reading="'+index+'"] [data-action="'+action+'-reading"]\').click()');
    async function files(selector,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
    async function state(kind){const expression="document.getElementById('timed-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(['compatible','incompatible','inputs-ready'].includes(kind)?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('timed-status').textContent"));}
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    const observe=()=>value("window.originalTimedPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.observedTimedRequest=structuredClone(m);const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedTimedResult=structuredClone(e.data.result);handler(e)};return window.originalTimedPost.call(this,m,...args)}");
    async function matches(r){
      const actual=await value("({...document.getElementById('timed-results').dataset})");
      assert.equal(actual.status,r.compatibility);assert.equal(Number(actual.cell),r.cellIndex);assert.equal(Number(actual.split),r.query.splitAfterInterval);
      assert.equal(Number(actual.points),r.pointwiseCourse.length);assert.equal(Number(actual.basis),192);assert.equal(Number(actual.courses),r.work.executedThermalCourses);
      const cards=await value("Array.from(document.querySelectorAll('#timed-sources .source-card')).map(e=>({...e.dataset}))");assert.equal(cards.length,3);
      for(let i=0;i<3;i++){assert.equal(cards[i].utc,r.readings[i].utc);assert.equal(cards[i].store,r.readings[i].store);assert.equal(Number(cards[i].cell),r.readings[i].cellIndex);}
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#timed-time-select option')).map(o=>Number(o.value))"),r.pointwiseCourse.map(x=>x.index));
      assert.equal(await value("Boolean(document.getElementById('timed-witness'))"),r.compatibility==='compatible');
      if(r.compatibility==='compatible'){
        const witnessId=Number(await value("document.getElementById('timed-witness').dataset.witness")),w=r.witnesses.find(w=>w.id===witnessId);assert(w);
        assert.equal(await value("document.getElementById('timed-replay-note').dataset.replay"),w.originalReplays.some(p=>Object.values(p.originalObservationEndpointStatus).includes('outside-original-band'))?'outside-original-band':'within-original-band');
        const rows=await value("Array.from(document.querySelectorAll('#timed-observation-replay tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(e=>e.textContent))");
        for(let i=0;i<3;i++){const replay=w.originalReplays[i];assert.equal(rows[i][1],r.readings[i].utc);assert.equal(rows[i][2],r.readings[i].store==='surfaceC'?'ground surface':'lower heat store');assert.equal(rows[i][3],replay.originalObservation.originalC.lower+' / '+replay.originalObservation.originalC.upper);}
        const models=await value("Array.from(document.querySelectorAll('#timed-observation-model tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(e=>e.textContent))");
        for(let i=0;i<3;i++){assert.equal(models[i][1],r.readings[i].utc);assert.equal(models[i][2],rows[i][2]);assert.equal(models[i][4],r.readings[i].temperatureC+' ± '+r.readings[i].halfWidthC);}
      }
    }
    async function download(name){const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('timed-export');
      const path=directory+'/experimental-earth-original-time-reading-inputs.json';let found=false;for(let i=0;i<500;i++){try{await access(path);found=true;break;}catch{await delay(40);}}assert(found);
      const text=await readFile(path,'utf8'),source=JSON.parse(text);assert.deepEqual(Object.keys(source),['kind','model','readings','query']);assert.deepEqual(prepareTimedSkyCourseSource(source.readings,source.query),source);return {path,text,source};}
    await send('Page.navigate',{url:launcherUrl+'sky-course-evidence.html'});await until("Boolean(document.querySelector('a[href=\"sky-timed-readings.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-timed-readings.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-timed-readings.html'});await until("document.getElementById('timed-example')?.disabled===false");await observe();
    await click('timed-example');await state('compatible');const actual=await value('window.observedTimedResult');await matches(actual.report);
    assert.deepEqual(actual.investigation,reference.investigation);assert.deepEqual(actual.report.readings.map(r=>r.originalIndex),[12,16,4]);
    assert(actual.report.readings.every(r=>r.cellIndex===7));assert.equal(actual.report.pointwiseCourse.length,17);
    const comparison=await value("({...document.getElementById('timed-evidence-comparison').dataset})");assert(Number(comparison.surfaceCBefore)>2.58);assert(Number(comparison.surfaceCAfter)<.0124);
    assert.equal(await value("document.getElementById('timed-time-detail').dataset.index"),'4');
    checks.push('Actual parent entry and worker preserve three same-receiver observations at 10:00,12:00,06:00 UTC; the third unchanged band narrows the modeled 06:00 surface-difference width from over2.58C to under0.0124C');

    await value('window.timedRawSource='+JSON.stringify(actual.investigation));
    const pairs=await value("(async()=>{const {buildOriginalBoundaryBasis}=await import('./shade-heat-epoch-kernel.js');const source=window.timedRawSource,split=source.query.splitAfterInterval,bases=source.readings.map(input=>buildOriginalBoundaryBasis(input,split));return {split,readings:source.readings.map(input=>input.query.reading),points:bases.map(b=>({cellIndex:b.input.query.reading.cellIndex,pairs:b.pairs.map(p=>({early:p.early,late:p.late,final:p.trace.final,originalBoundaries:p.trace.originalBoundaries,states:p.trace.states}))}))}})()");
    await writeFile(runDirectory+'/runtime-original-pair-values.json',JSON.stringify(pairs,null,2));
    await writeFile(runDirectory+'/runtime-timed-course.json',JSON.stringify(actual,null,2));
    const truth=pairs.points[0].pairs.find(p=>p.early===1&&p.late===2);assert(truth);
    await value("window.countedTimedPost=Worker.prototype.postMessage;window.timedPosts=0;Worker.prototype.postMessage=function(...args){window.timedPosts++;return window.countedTimedPost.apply(this,args)}");
    for(const row of actual.report.pointwiseCourse){await field('timed-time-select',row.index);const detail=await value("({...document.getElementById('timed-time-detail').dataset})");assert.equal(Number(detail.index),row.index);assert.equal(detail.utc,row.utc);
      for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper'])assert.equal(Number(detail[store+(side==='lower'?'Lower':'Upper')]),row.ranges[store][side].differenceC[side]);}
    const selected=Number(await value("document.getElementById('timed-witness').dataset.witness")),trace=courseWitnessDifferences(actual.report.witnesses.find(w=>w.id===selected));
    for(const store of ['surfaceC','subsurfaceC']){
      const plot=await value('(()=>{const p=document.querySelector(\'.timed-plot[data-store="'+store+'"]\');return {ranges:Array.from(p.querySelectorAll("g[data-index]")).map(e=>({...e.dataset})),prior:Array.from(p.querySelectorAll("g[data-prior-index]")).map(e=>({...e.dataset})),markers:Array.from(p.querySelectorAll("circle[data-profile]")).map(e=>({...e.dataset}))}})()');
      assert.equal(plot.ranges.length,17);assert.equal(plot.prior.length,17);assert.equal(plot.markers.length,34);
      for(const row of plot.ranges){const range=actual.report.pointwiseCourse[Number(row.index)].ranges[store];assert.equal(Number(row.lower),range.lower.differenceC.lower);assert.equal(Number(row.upper),range.upper.differenceC.upper);}
      for(const row of plot.prior){const range=actual.report.firstTwo.pointwiseCourse[Number(row.priorIndex)].ranges[store];assert.equal(Number(row.priorLower),range.lower.differenceC.lower);assert.equal(Number(row.priorUpper),range.upper.differenceC.upper);}
      for(const marker of plot.markers){assert.equal(Number(marker.profile),selected);assert.equal(Number(marker.value),trace[Number(marker.index)].differenceC[store][marker.bound][marker.bound]);}
    }
    await field('timed-time-slider',4);await value("document.getElementById('timed-time-slider').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await value("document.getElementById('timed-time-detail').dataset.index"),'5');assert.equal(await value('window.timedPosts'),0);await value('Worker.prototype.postMessage=window.countedTimedPost');
    checks.push('All17 original times, both first-two/all-three plots and one fixed-profile trace bind exactly to the actual worker; original UTC/component replay tables and keyboard inspection remain distinct and require no recomputation');

    const saved=await download('initial');assert.deepEqual(saved.source,actual.investigation);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('timed-example')?.disabled===false");await observe();await files('#timed-reopen',[saved.path]);await state('compatible');
    assert.deepEqual(await value('window.observedTimedResult'),actual);await matches(actual.report);assert.equal(await stored(),originalStorage);
    checks.push('Actual source-only download and fresh reopen preserve all reading/source identities and recompute the complete same-runtime report without writing the current site');

    await editField(2,'temperatureC',400);assert.equal(await value("document.getElementById('timed-run').disabled"),true);assert.equal(await value("document.getElementById('timed-export').disabled"),true);
    assert.match(await value("document.querySelector('.source-card[data-reading=\"2\"] strong').textContent"),/26\.168026334165262/);assert.equal(await value("document.getElementById('timed-results').hidden"),true);
    await editAction(2,'apply');await click('timed-run');await state('incompatible');const empty=await value('window.observedTimedResult');await matches(empty.report);
    assert.deepEqual(empty.report.firstTwo,actual.report.firstTwo);assert.equal(empty.report.witnesses.length,0);assert.equal(empty.report.work.executedBasisCourses,192);assert.equal(empty.report.pointwiseCourse.length,17);
    assert.equal(await value("document.querySelectorAll('.timed-plot').length"),0);assert(Number(await value("document.getElementById('timed-evidence-comparison').dataset.surfaceCBefore"))>2.58);
    assert.deepEqual((await download('contradictory')).source,empty.investigation);
    await writeFile(runDirectory+'/runtime-contradictory-course.json',JSON.stringify(empty,null,2));
    checks.push('An unapplied reading edit clears old results and blocks run/export; explicit400C admission yields an empty three-band family while retaining the unchanged first-two family, all192 basis courses and all17 times');

    await files('#timed-reopen',[saved.path]);await state('compatible');await editField(2,'utc',truth.originalBoundaries[8].utc);await editField(2,'temperatureC',truth.states.existing.lower[8].surfaceC);
    await editField(2,'source','Authored original08:00 surface value from the same complete numerical control; explicit observation revision.');await editAction(2,'apply');await click('timed-run');await state('compatible');
    const moved=await value('window.observedTimedResult');await matches(moved.report);assert.equal(moved.report.readings[2].originalIndex,8);assert.deepEqual(moved.investigation.readings.map(r=>r.source),actual.investigation.readings.map(r=>r.source));
    await editField(2,'store','subsurfaceC');await editField(2,'temperatureC',truth.states.existing.lower[8].subsurfaceC);await editField(2,'source','Authored original08:00 lower-store value from the same complete numerical control; explicit component revision.');
    await editAction(2,'apply');await click('timed-run');await state('compatible');const lower=await value('window.observedTimedResult');await matches(lower.report);assert.equal(lower.report.readings[2].store,'subsurfaceC');
    assert.deepEqual(lower.investigation.readings.map(r=>r.source),actual.investigation.readings.map(r=>r.source));
    await writeFile(runDirectory+'/runtime-revised-observations.json',JSON.stringify({originalEightSurface:moved,originalEightLower:lower},null,2));
    await editField(2,'utc',actual.report.readings[0].utc);await editField(2,'store','surfaceC');await editAction(2,'apply');await state('reading-refused');
    assert.equal(await value("document.getElementById('timed-run').disabled"),true);assert.equal(await value("document.querySelector('.source-card[data-reading=\"2\"]').dataset.utc"),lower.report.readings[2].utc);
    assert.equal(await value("document.querySelector('.source-card[data-reading=\"2\"]').dataset.store"),'subsurfaceC');await editAction(2,'cancel');assert.equal(await value("document.getElementById('timed-run').disabled"),false);
    await click('timed-run');await state('compatible');assert.deepEqual(await value('window.observedTimedResult'),lower);
    checks.push('Explicit UTC and component revisions use original08:00 surface/lower values while retaining every source byte; duplicate identity is refused transactionally and Cancel restores the admitted original lower-store inquiry');

    await files('#timed-reopen',[saved.path]);await state('compatible');
    for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      await value("document.querySelector('.source-edit[data-reading=\"2\"]').open=true");
      for(const [selector,label]of [['.source-edit[data-reading="2"]','reading-edit'],['#timed-form','conditions'],['#timed-results','comparison'],['#timed-time-detail','original-time'],['#timed-witness','profile']]){
        await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/timed-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    await value("document.querySelector('#timed-observation-replay').focus()");assert.equal(await value("document.activeElement.id"),'timed-observation-replay');
    assert.match(await value("document.querySelector('.source-edit[data-reading=\"2\"] .source-time-hint').textContent"),/2026-06-21T06:00:00\.000Z/);
    checks.push('Actual1440px/390px source editor, complete UTC hint, conditions, two-family comparison, original-time detail and fixed-profile views fit the viewport; wide exact tables remain keyboard-focusable');

    await value("window.retiredTimedTime=document.getElementById('timed-time-select');window.retiredTimedPoint=document.querySelector('#timed-sources input[value=\"1\"]');window.retiredTimedForm=document.querySelector('.source-edit[data-reading=\"2\"] form')");
    const originals=structuredClone(raw.readings);originals.forEach((r,i)=>{r.query.bins=[4,16,8][i];});const paths=originals.map((_,i)=>runDirectory+'/original-'+i+'.json');await Promise.all(paths.map((path,i)=>writeFile(path,JSON.stringify(originals[i]))));
    await files('#timed-originals',paths);await state('inputs-ready');await value("(()=>{const e=document.querySelector('#timed-sources input[value=\"2\"]');e.checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));})()");await click('timed-run');await state('compatible');const reordered=await value('window.observedTimedResult');await matches(reordered.report);
    assert.deepEqual(reordered.investigation.readings.map(r=>r.query.bins),[8,4,16]);assert.deepEqual(reordered.report.readings.map(r=>r.originalIndex),[4,12,16]);
    await value("window.retiredTimedTime.value='0';window.retiredTimedTime.dispatchEvent(new Event('input'));window.retiredTimedPoint.checked=true;window.retiredTimedPoint.dispatchEvent(new Event('input'));window.retiredTimedForm.querySelector('[data-field=temperatureC]').value='400';window.retiredTimedForm.dispatchEvent(new Event('input',{bubbles:true}));window.retiredTimedForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");await matches(reordered.report);
    const old=makeJointCourseExample(),prior=prepareSkyCourseSource(old.readings,{bins:4,splitAfterInterval:8,sharingSource:old.query.sharingSource}),priorPath=runDirectory+'/prior-course.json';await writeFile(priorPath,JSON.stringify(prior));
    await field('timed-split',7);await files('#timed-originals',[saved.path]);await state('inputs-ready');assert.equal(await value("document.getElementById('timed-split').value"),'7');
    await files('#timed-originals',[priorPath]);await state('inputs-ready');assert.equal(await value("document.getElementById('timed-split').value"),'7');
    await files('#timed-reopen',[saved.path]);await state('compatible');await matches(actual.report);
    checks.push('Three files preserve4/16/8 histories and explicit first-reading order; new and legacy inquiry intake does not adopt its boundary; detached time,comparison and reading-edit controls cannot revive retired context');

    const forged=runDirectory+'/forged.json',badUtf=runDirectory+'/bad-utf8.json',mismatch=runDirectory+'/mismatch.json',unresolved=runDirectory+'/unresolved.json',malformed=runDirectory+'/malformed.json';
    await writeFile(forged,JSON.stringify({...actual.investigation,report:{}}));await writeFile(badUtf,Buffer.from([0xc3,0x28]));await writeFile(malformed,'{');
    const wrong=structuredClone(actual.investigation);wrong.readings[2].source.declaration.reservoirC+=1;await writeFile(mismatch,JSON.stringify(wrong));
    const uncertain=structuredClone(actual.investigation);uncertain.readings.forEach(r=>{r.source.project.solarStudy.existing[0].heightMaxM=4;});await writeFile(unresolved,JSON.stringify(uncertain));
    for(const group of [[forged],paths.slice(0,2)]){await files('#timed-originals',group);await state('file-refused');await matches(actual.report);}
    for(const path of [badUtf,malformed,mismatch,unresolved]){await files('#timed-reopen',[path]);await state('file-refused');await matches(actual.report);}
    await field('timed-split',0);await click('timed-run');await state('refused');assert.equal(await value("document.getElementById('timed-results').hidden"),true);assert.equal(await value("document.getElementById('timed-export').disabled"),true);
    await files('#timed-reopen',[saved.path]);await state('compatible');await matches(actual.report);
    checks.push('Forged calculated fields,incomplete originals,malformed JSON/UTF8,conflicting repeated-source declarations and unresolved observation geometry refuse without replacing accepted evidence; an invalid new boundary clears the attempted result');

    const slow=runDirectory+'/slow-original.json';await writeFile(slow,JSON.stringify(originals[2]));
    await value("window.timedArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-original.json')return new Promise(resolve=>{window.releaseTimedFile=()=>window.timedArrayBuffer.call(this).then(resolve)});return window.timedArrayBuffer.call(this)}");
    await files('#timed-originals',[paths[0],paths[1],slow]);await until("typeof window.releaseTimedFile==='function'");await editField(2,'temperatureC',400);await editAction(2,'apply');await click('timed-run');await state('incompatible');const newer=await value('window.observedTimedResult');
    await value('window.releaseTimedFile()');await delay(100);await matches(newer.report);assert.equal(await value("document.querySelector('.source-card[data-reading=\"2\"] strong').textContent"),'400 ± 0.001 °C');await value('File.prototype.arrayBuffer=window.timedArrayBuffer');
    await files('#timed-reopen',[saved.path]);await state('compatible');
    await value("window.heldTimedPost=Worker.prototype.postMessage;window.holdTimed=true;Worker.prototype.postMessage=function(m,...a){if(window.holdTimed&&m.operation==='prepare'){window.holdTimed=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseTimedWorker=()=>handler(e)}}return window.heldTimedPost.call(this,m,...a)}");
    await click('timed-run');await until("typeof window.releaseTimedWorker==='function'");const impossiblePath=runDirectory+'/impossible.json';await writeFile(impossiblePath,JSON.stringify(empty.investigation));await files('#timed-reopen',[impossiblePath]);await state('incompatible');await matches(empty.report);
    await value('window.releaseTimedWorker()');await delay(100);await matches(empty.report);await value('Worker.prototype.postMessage=window.heldTimedPost');
    checks.push('A held actual file read cannot overwrite an explicitly revised observation; a held older compatible worker cannot overwrite the newer contradictory original-time family');

    let maximumRuntimeRangeDifferenceC=0;
    for(const family of ['all','firstTwo'])for(let i=0;i<17;i++)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper']){
      const a=(family==='all'?actual.report:actual.report.firstTwo).pointwiseCourse[i].ranges[store][side].differenceC[side];
      const b=(family==='all'?reference.report:reference.report.firstTwo).pointwiseCourse[i].ranges[store][side].differenceC[side];
      const difference=Math.abs(a-b);assert(difference<=1e-9);maximumRuntimeRangeDifferenceC=Math.max(maximumRuntimeRangeDifferenceC,difference);
    }
    assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    return {checks,sandbox:session.sandbox,exceptions,maximumRuntimeRangeDifferenceC,runtimeComparisonScope:'Actual worker report is the exact DOM oracle; separate Node comparison covers both families at every retained time with a numerical1e-9C threshold, not a physical error bound.',launcher:{command:'python3 serve.py --port 0',url:launcherUrl}};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

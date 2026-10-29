import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareThreeEpochSkyEvidence,prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {makeJointCourseExample} from '../shade-heat-joint-example.js';
import {prepareSkyCourseSource} from '../shade-heat-course-evidence.js';
import {courseWitnessDifferences} from '../shade-heat-course-inputs.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-run-three-course-'+randomUUID(),checks=[];
const raw=makeThreeEpochSkyExample(),reference=prepareThreeEpochSkyEvidence(raw.readings,raw.query);
let launcher=null,launcherUrl=null;
try{
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Launcher readiness many out: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',error=>{clearTimeout(timer);reject(error);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');
    async function until(expression){for(let i=0;i<1500;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Three out: '+expression+'; '+await value("document.getElementById('three-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    async function editField(index,name,content){await value('(()=>{document.getElementById("three-source-details").open=true;const d=document.querySelector(\'.source-edit[data-reading="'+index+'"]\');d.open=true;const e=d.querySelector(\'[data-field="'+name+'"]\');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    const editAction=(index,action)=>value('document.querySelector(\'.source-edit[data-reading="'+index+'"] [data-action="'+action+'-reading"]\').click()');
    async function files(selector,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
    async function state(kind){const expression="document.getElementById('three-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(['compatible','incompatible','inputs-ready'].includes(kind)?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('three-status').textContent"));}
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    const observe=()=>value("window.originalThreePost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.observedThreeRequest=structuredClone(m);const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedThreeResult=structuredClone(e.data.result);handler(e)};return window.originalThreePost.call(this,m,...args)}");
    async function matches(r){
      const actual=await value("({...document.getElementById('three-results').dataset})");
      assert.equal(actual.status,r.compatibility);assert.equal(Number(actual.cell),r.cellIndex);assert.equal(actual.splits,r.query.splitAfterIntervals.join(','));
      assert.equal(Number(actual.points),r.pointwiseCourse.length);assert.equal(Number(actual.basis),r.work.executedBasisCourses);assert.equal(Number(actual.courses),r.work.executedThermalCourses);
      const cards=await value("Array.from(document.querySelectorAll('#three-sources .source-card')).map(e=>({...e.dataset}))");assert.equal(cards.length,r.readings.length);
      for(let i=0;i<r.readings.length;i++){assert.equal(cards[i].utc,r.readings[i].utc);assert.equal(cards[i].store,r.readings[i].store);assert.equal(Number(cards[i].cell),r.readings[i].cellIndex);}
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#three-time-select option')).map(o=>Number(o.value))"),r.pointwiseCourse.map(x=>x.index));
      assert.equal(await value("Boolean(document.getElementById('three-witness'))"),r.compatibility==='compatible');
      const references=await value("Array.from(document.querySelectorAll('#three-embedded-references .three-reference-card')).map(e=>({...e.dataset}))");
      assert.equal(references.length,2);references.forEach((x,i)=>{assert.equal(Number(x.referenceIndex),i);assert.equal(x.status,r.embeddedOneChange[i].compatibility);assert.equal(Number(x.split),r.query.splitAfterIntervals[i]);});

      if(r.compatibility==='compatible'){
        const witnessId=Number(await value("document.getElementById('three-witness').dataset.witness")),w=r.witnesses.find(w=>w.id===witnessId);assert(w);
        const phases=await value("Array.from(document.querySelectorAll('#three-witness .phase-profile')).map(e=>({phase:Number(e.dataset.phase),weights:JSON.parse(e.dataset.weights),label:e.querySelector('figcaption').textContent}))");
        assert.equal(phases.length,3);phases.forEach((p,i)=>{assert.equal(p.phase,i);assert.deepEqual(p.weights,w.phaseProfiles[i].map(x=>x.lower));assert.match(p.label,new RegExp('Epoch'+(i+1)));});

        assert.equal(await value("document.getElementById('three-replay-note').dataset.replay"),w.originalObservations.some(p=>Object.values(p.endpointStatus).includes('outside-original-band'))?'outside-original-band':'within-original-band');
        const rows=await value("Array.from(document.querySelectorAll('#three-observation-replay tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(e=>e.textContent))");
        for(let i=0;i<r.readings.length;i++){const replay=w.originalObservations[i];assert.equal(rows[i][1],r.readings[i].utc);assert.equal(rows[i][2],r.readings[i].store==='surfaceC'?'ground surface':'lower heat store');assert.equal(rows[i][3],replay.originalC.lower+' / '+replay.originalC.upper);}
        const models=await value("Array.from(document.querySelectorAll('#three-observation-model tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(e=>e.textContent))");
        for(let i=0;i<r.readings.length;i++){assert.equal(models[i][1],r.readings[i].utc);assert.equal(models[i][2],rows[i][2]);assert.equal(models[i][4],r.readings[i].temperatureC+' ± '+r.readings[i].halfWidthC);}
      }
    }
    async function download(name){const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('three-export');
      const path=directory+'/experimental-earth-three-epoch-inputs.json';let found=false;for(let i=0;i<500;i++){try{await access(path);found=true;break;}catch{await delay(40);}}assert(found);
      const text=await readFile(path,'utf8'),source=JSON.parse(text);assert.deepEqual(Object.keys(source),['kind','model','readings','query']);assert.equal(source.kind,'experimental-earth/three-declared-sky-epoch-inputs/1');assert.deepEqual(prepareThreeEpochSkySource(source.readings,source.query),source);return {path,text,source};}
    await send('Page.navigate',{url:launcherUrl+'sky-record-boundaries.html'});await until("Boolean(document.querySelector('a[href=\"sky-three-epochs.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-three-epochs.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-three-epochs.html'});await until("document.getElementById('three-example')?.disabled===false");await observe();
    await click('three-example');await state('compatible');const actual=await value('window.observedThreeResult');await matches(actual.report);
    assert.deepEqual(actual.investigation,reference.investigation);assert.deepEqual(actual.report.readings.slice(0,3).map(r=>r.originalIndex),[12,16,4]);assert.equal(actual.report.readings.length,24);
    assert.deepEqual([...new Set(actual.report.readings.map(r=>r.cellIndex))],[7,5,1]);assert.equal(actual.report.pointwiseCourse.length,17);
    const comparison=await value("({...document.getElementById('three-evidence-comparison').dataset})");assert(Number(comparison.surfaceCBefore)>Number(comparison.surfaceCAfter));assert.deepEqual(actual.report.embeddedOneChange.map(r=>r.compatibility),['incompatible','incompatible']);
    assert.equal(await value("document.getElementById('three-time-detail').dataset.index"),'4');
    checks.push('Actual parent entry and three-profile worker retain all24 original bands and768 complete basis courses; both embedded one-change references are incompatible and the complete record narrows the first-three range');

    await writeFile(runDirectory+'/runtime-three-course.json',JSON.stringify(actual,null,2));
    const truth=actual.report.witnesses[0].originalReplays[0];assert(truth);
    await value("window.countedThreePost=Worker.prototype.postMessage;window.threePosts=0;Worker.prototype.postMessage=function(...args){window.threePosts++;return window.countedThreePost.apply(this,args)}");
    for(const row of actual.report.pointwiseCourse){await field('three-time-select',row.index);const detail=await value("({...document.getElementById('three-time-detail').dataset})");assert.equal(Number(detail.index),row.index);assert.equal(detail.utc,row.utc);
      for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper'])assert.equal(Number(detail[store+(side==='lower'?'Lower':'Upper')]),row.ranges[store][side].differenceC[side]);}
    const selected=Number(await value("document.getElementById('three-witness').dataset.witness")),trace=courseWitnessDifferences(actual.report.witnesses.find(w=>w.id===selected));
    for(const store of ['surfaceC','subsurfaceC']){
      const plot=await value('(()=>{const p=document.querySelector(\'.three-plot[data-store="'+store+'"]\');return {ranges:Array.from(p.querySelectorAll("g[data-index]")).map(e=>({...e.dataset})),prior:Array.from(p.querySelectorAll("g[data-prior-index]")).map(e=>({...e.dataset})),markers:Array.from(p.querySelectorAll("circle[data-profile]")).map(e=>({...e.dataset}))}})()');
      assert.equal(plot.ranges.length,17);assert.equal(plot.prior.length,17);assert.equal(plot.markers.length,34);
      assert.deepEqual(await value('Array.from(document.querySelectorAll('+JSON.stringify('.three-plot[data-store="'+store+'"] [data-change-index]')+')).map(e=>Number(e.dataset.changeIndex))'),actual.report.query.splitAfterIntervals);
      for(const row of plot.ranges){const range=actual.report.pointwiseCourse[Number(row.index)].ranges[store];assert.equal(Number(row.lower),range.lower.differenceC.lower);assert.equal(Number(row.upper),range.upper.differenceC.upper);}
      for(const row of plot.prior){const range=actual.report.firstThree.pointwiseCourse[Number(row.priorIndex)].ranges[store];assert.equal(Number(row.priorLower),range.lower.differenceC.lower);assert.equal(Number(row.priorUpper),range.upper.differenceC.upper);}
      for(const marker of plot.markers){assert.equal(Number(marker.profile),selected);assert.equal(Number(marker.value),trace[Number(marker.index)].differenceC[store][marker.bound][marker.bound]);}
    }
    await value("window.detachedThreeButton=document.querySelector('#three-time-detail button[data-bound]')");
    await field('three-time-select',7);const keptWitness=await value("document.getElementById('three-witness').dataset.witness");
    await value('window.detachedThreeButton.click()');assert.equal(await value("document.getElementById('three-time-detail').dataset.index"),'7');assert.equal(await value("document.getElementById('three-witness').dataset.witness"),keptWitness);
    await field('three-time-slider',4);await value("document.getElementById('three-time-slider').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await value("document.getElementById('three-time-detail').dataset.index"),'5');assert.equal(await value('window.threePosts'),0);await value('Worker.prototype.postMessage=window.countedThreePost');
    checks.push('All17 original times, both first-three/all-record plots and one fixed-profile trace bind exactly to the actual worker;24 UTC/component/model/replay rows remain distinct and keyboard inspection makes no worker request');

    const saved=await download('initial');assert.deepEqual(saved.source,actual.investigation);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('three-example')?.disabled===false");await observe();await files('#three-reopen',[saved.path]);await state('compatible');
    assert.deepEqual(await value('window.observedThreeResult'),actual);await matches(actual.report);assert.equal(await stored(),originalStorage);
    checks.push('Actual source-only download and fresh reopen retain all24 original identities and recompute the same-runtime report without altering the current site');

    const broad=structuredClone(actual.investigation);broad.readings=broad.readings.slice(0,3);for(const r of broad.readings){r.query.reading.temperatureC=20;r.query.reading.halfWidthC=100;}
    const broadPath=runDirectory+'/broad.json';await writeFile(broadPath,JSON.stringify(broad));await files('#three-reopen',[broadPath]);await state('compatible');const noGain=await value('window.observedThreeResult');await matches(noGain.report);
    assert.equal(noGain.report.rangeChanges.narrowed,0);assert.deepEqual(noGain.report.embeddedOneChange.map(r=>r.compatibility),['compatible','compatible']);
    for(const time of noGain.report.originalTimes){await field('three-time-select',time.index);const shown=await value("Array.from(document.querySelectorAll('#three-embedded-time p[data-reference-index]')).map(e=>({...e.dataset}))");assert.equal(shown.length,4);for(const row of shown){const range=noGain.report.embeddedOneChange[Number(row.referenceIndex)].pointwiseCourse[time.index].ranges[row.store];assert.equal(Number(row.lower),range.lower.differenceC.lower);assert.equal(Number(row.upper),range.upper.differenceC.upper);}}
    await writeFile(runDirectory+'/runtime-three-no-gain.json',JSON.stringify(noGain,null,2));
    checks.push('Actual three-record broad-band control preserves no-gain equality and both compatible embedded references; every reference endpoint at17 original times binds exactly to its retained worker family');
    await files('#three-reopen',[saved.path]);await state('compatible');await matches(actual.report);
    await editField(23,'temperatureC',400);assert.equal(await value("document.getElementById('three-run').disabled"),true);assert.equal(await value("document.getElementById('three-export').disabled"),true);
    assert((await value("document.querySelector('.source-card[data-reading=\"23\"] strong').textContent")).includes(String(actual.report.readings[23].temperatureC)));assert.equal(await value("document.getElementById('three-results').hidden"),true);
    await editAction(23,'apply');await click('three-run');await state('incompatible');const empty=await value('window.observedThreeResult');await matches(empty.report);
    assert.deepEqual(empty.report.firstThree,actual.report.firstThree);assert.equal(empty.report.witnesses.length,0);assert.equal(empty.report.work.executedBasisCourses,768);assert.equal(empty.report.pointwiseCourse.length,17);
    assert.equal(await value("document.querySelectorAll('.three-plot').length"),0);assert(Number(await value("document.getElementById('three-evidence-comparison').dataset.surfaceCBefore"))>0);
    assert.deepEqual((await download('contradictory')).source,empty.investigation);
    await writeFile(runDirectory+'/runtime-contradictory-course.json',JSON.stringify(empty,null,2));
    checks.push('An unapplied final-record edit clears old results and blocks run/export; explicit400C admission rejects all24 bands while preserving the compatible first-three reference,768 complete basis courses and17 times');

    await files('#three-reopen',[saved.path]);await state('compatible');await editField(23,'utc',truth.originalCourse[11].utc);await editField(23,'store','surfaceC');await editField(23,'temperatureC',truth.originalCourse[11].originalC.existing.lower.surfaceC);
    await editField(23,'source','Authored original09:30 surface value from the same fixed-profile original numerical replay; explicit observation revision.');await editAction(23,'apply');await click('three-run');await state('compatible');
    const moved=await value('window.observedThreeResult');await matches(moved.report);assert.equal(moved.report.readings[23].originalIndex,11);assert.deepEqual(moved.investigation.readings.map(r=>r.source),actual.investigation.readings.map(r=>r.source));
    await editField(23,'store','subsurfaceC');await editField(23,'temperatureC',truth.originalCourse[11].originalC.existing.lower.subsurfaceC);await editField(23,'source','Authored original09:30 lower-store value from the same fixed-profile original numerical replay; explicit component revision.');
    await editAction(23,'apply');await click('three-run');await state('compatible');const lower=await value('window.observedThreeResult');await matches(lower.report);assert.equal(lower.report.readings[23].store,'subsurfaceC');
    assert.deepEqual(lower.investigation.readings.map(r=>r.source),actual.investigation.readings.map(r=>r.source));
    await writeFile(runDirectory+'/runtime-revised-observations.json',JSON.stringify({originalEightSurface:moved,originalEightLower:lower},null,2));
    await editField(23,'utc',actual.report.readings[0].utc);await editField(23,'store','surfaceC');await editAction(23,'apply');await state('reading-refused');
    assert.equal(await value("document.getElementById('three-run').disabled"),true);assert.equal(await value("document.querySelector('.source-card[data-reading=\"23\"]').dataset.utc"),lower.report.readings[23].utc);
    assert.equal(await value("document.querySelector('.source-card[data-reading=\"23\"]').dataset.store"),'subsurfaceC');await editAction(23,'cancel');assert.equal(await value("document.getElementById('three-run').disabled"),false);
    await click('three-run');await state('compatible');assert.deepEqual(await value('window.observedThreeResult'),lower);
    checks.push('Explicit final-record UTC/store revisions use original09:30 surface/lower values from the unchanged complete source; duplicate identity refuses transactionally and Cancel restores the admitted record');

    await files('#three-reopen',[saved.path]);await state('compatible');
    for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      await value("document.getElementById('three-source-details').open=true;document.querySelector('.source-edit[data-reading=\"23\"]').open=true");
      for(const [selector,label]of [['.source-edit[data-reading="23"]','reading-edit'],['#three-form','conditions'],['#three-results','comparison'],['#three-time-detail','original-time'],['#three-witness','profile']]){
        if(label!=='reading-edit')await value("document.getElementById('three-source-details').open=false");
        await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/three-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    await value("document.querySelector('#three-observation-replay').focus()");assert.equal(await value("document.activeElement.id"),'three-observation-replay');
    assert.match(await value("document.querySelector('.source-edit[data-reading=\"23\"] .source-time-hint').textContent"),/2026-06-21T12:00:00\.000Z/);
    checks.push('Actual1440px/390px24-record editor, complete UTC hint, conditions, comparison and fixed-profile views fit the viewport; wide observation tables remain keyboard-focusable');

    await value("window.retiredThreeTime=document.getElementById('three-time-select');window.retiredThreePoint=document.querySelector('#three-sources input[value=\"1\"]');window.retiredThreeForm=document.querySelector('.source-edit[data-reading=\"23\"] form')");
    const originals=structuredClone(raw.readings);originals.forEach((r,i)=>{r.query.bins=[4,16,8][i%3];});const paths=originals.map((_,i)=>runDirectory+'/original-'+i+'.json');await Promise.all(paths.map((path,i)=>writeFile(path,JSON.stringify(originals[i]))));
    await files('#three-originals',paths);await state('inputs-ready');await value("(()=>{const e=document.querySelector('#three-sources input[value=\"5\"]');e.checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));})()");await click('three-run');await state('compatible');const reordered=await value('window.observedThreeResult');await matches(reordered.report);
    assert.deepEqual(reordered.investigation.readings,[originals[5],...originals.filter((_,i)=>i!==5)]);assert.equal(reordered.report.cellIndex,1);
    await value("window.retiredThreeTime.value='0';window.retiredThreeTime.dispatchEvent(new Event('input'));window.retiredThreePoint.checked=true;window.retiredThreePoint.dispatchEvent(new Event('input'));window.retiredThreeForm.querySelector('[data-field=temperatureC]').value='400';window.retiredThreeForm.dispatchEvent(new Event('input',{bubbles:true}));window.retiredThreeForm.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");await matches(reordered.report);
    const old=makeJointCourseExample(),prior=prepareSkyCourseSource(old.readings,{bins:4,splitAfterInterval:8,sharingSource:old.query.sharingSource}),priorPath=runDirectory+'/prior-course.json';await writeFile(priorPath,JSON.stringify(prior));
    await field('three-split-first',7);await files('#three-originals',[saved.path]);await state('inputs-ready');assert.equal(await value("document.getElementById('three-split-first').value"),'7');assert.equal(await value("document.getElementById('three-split-second').value"),'10');
    await files('#three-originals',[priorPath]);await state('inputs-ready');assert.equal(await value("document.getElementById('three-split-first').value"),'7');assert.equal(await value("document.getElementById('three-split-second').value"),'10');
    await files('#three-reopen',[saved.path]);await state('compatible');await matches(actual.report);
    checks.push('All24 original files preserve4/16/8 bin histories and explicit first-reading order; saved-new and legacy-three inquiry intake retain both selected boundaries; detached controls cannot revive retired context');

    const forged=runDirectory+'/forged.json',badUtf=runDirectory+'/bad-utf8.json',mismatch=runDirectory+'/mismatch.json',unresolved=runDirectory+'/unresolved.json',malformed=runDirectory+'/malformed.json';
    await writeFile(forged,JSON.stringify({...actual.investigation,report:{}}));await writeFile(badUtf,Buffer.from([0xc3,0x28]));await writeFile(malformed,'{');
    const wrong=structuredClone(actual.investigation);wrong.readings[23].source.declaration.reservoirC+=1;await writeFile(mismatch,JSON.stringify(wrong));
    const uncertain=structuredClone(actual.investigation);uncertain.readings.forEach(r=>{r.source.project.solarStudy.existing[0].heightMaxM=4;});await writeFile(unresolved,JSON.stringify(uncertain));
    for(const group of [[forged],paths.slice(0,2)]){await files('#three-originals',group);await state('file-refused');await matches(actual.report);}
    for(const path of [badUtf,malformed,mismatch,unresolved]){await files('#three-reopen',[path]);await state('file-refused');await matches(actual.report);}
    await field('three-split-first',0);await click('three-run');await state('refused');assert.equal(await value("document.getElementById('three-results').hidden"),true);assert.equal(await value("document.getElementById('three-export').disabled"),true);
    await files('#three-reopen',[saved.path]);await state('compatible');await matches(actual.report);
    checks.push('Forged calculated fields,incomplete records,malformed JSON/UTF8,conflicting repeated-source declarations and unresolved original endpoints refuse without replacing accepted evidence; invalid original boundary clears the attempted result');

    const slow=runDirectory+'/slow-original.json';await writeFile(slow,JSON.stringify(originals[23]));
    await value("window.manyArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-original.json')return new Promise(resolve=>{window.releaseThreeFile=()=>window.manyArrayBuffer.call(this).then(resolve)});return window.manyArrayBuffer.call(this)}");
    await files('#three-originals',[...paths.slice(0,23),slow]);await until("typeof window.releaseThreeFile==='function'");await editField(23,'temperatureC',400);await editAction(23,'apply');await click('three-run');await state('incompatible');const newer=await value('window.observedThreeResult');
    await value('window.releaseThreeFile()');await delay(100);await matches(newer.report);assert.equal(await value("document.querySelector('.source-card[data-reading=\"23\"] strong').textContent"),'400 ± 0.001 °C');await value('File.prototype.arrayBuffer=window.manyArrayBuffer');
    await files('#three-reopen',[saved.path]);await state('compatible');
    await value("window.heldThreePost=Worker.prototype.postMessage;window.holdThree=true;Worker.prototype.postMessage=function(m,...a){if(window.holdThree&&m.operation==='prepare'){window.holdThree=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseThreeWorker=()=>handler(e)}}return window.heldThreePost.call(this,m,...a)}");
    await click('three-run');await until("typeof window.releaseThreeWorker==='function'");const impossiblePath=runDirectory+'/impossible.json';await writeFile(impossiblePath,JSON.stringify(empty.investigation));await files('#three-reopen',[impossiblePath]);await state('incompatible');await matches(empty.report);
    await value('window.releaseThreeWorker()');await delay(100);await matches(empty.report);await value('Worker.prototype.postMessage=window.heldThreePost');
    checks.push('A held24-file load cannot overwrite an explicitly revised observation; a held compatible worker cannot overwrite a newer contradictory complete record');

    let maximumRuntimeRangeDifferenceC=0;
    for(const family of ['all','firstThree'])for(let i=0;i<17;i++)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper']){
      const a=(family==='all'?actual.report:actual.report.firstThree).pointwiseCourse[i].ranges[store][side].differenceC[side];
      const b=(family==='all'?reference.report:reference.report.firstThree).pointwiseCourse[i].ranges[store][side].differenceC[side];
      const difference=Math.abs(a-b);assert(difference<=1e-9);maximumRuntimeRangeDifferenceC=Math.max(maximumRuntimeRangeDifferenceC,difference);
    }
    assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    return {checks,sandbox:session.sandbox,exceptions,maximumRuntimeRangeDifferenceC,runtimeComparisonScope:'Actual worker report is the exact DOM oracle; separate Node comparison covers both families at every retained time with a numerical1e-9C threshold, not a physical error bound.',launcher:{command:'python3 serve.py --port 0',url:launcherUrl}};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

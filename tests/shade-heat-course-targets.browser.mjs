import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeSkyCourseTargetExample} from '../shade-heat-course-target-example.js';
import {prepareSkyCourseTargetSource,prepareSkyCourseTargetEvidence} from '../shade-heat-course-targets.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {profileFraction} from '../shade-heat-profile-band.js';
import {rational as q,sub} from '../vendor/chronos/exact-halfplanes.mjs';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-course-targets-'+randomUUID(),checks=[];
const raw=makeSkyCourseTargetExample(),reference=prepareSkyCourseTargetEvidence(raw.readings,raw.query);
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
let launcher=null;
try{
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Target launcher readiness: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',error=>{clearTimeout(timer);reject(error);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
    async function until(expression){for(let i=0;i<1500;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Target wait: '+expression+'; '+await value("document.getElementById('target-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content,event='input'){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event('+JSON.stringify(event)+',{bubbles:true}));})()');}
    async function files(path){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#target-open'});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});}
    async function state(kind){const expression="document.getElementById('target-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(['compatible','incompatible','not-evaluated-original-incompatible','inputs-ready','draft'].includes(kind)?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('target-status').textContent"));}
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    const observe=()=>value("window.targetPosts=0;window.originalTargetPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.targetPosts++;window.observedTargetRequest=structuredClone(m);const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedTargetResult=structuredClone(e.data.result);handler(e)};return window.originalTargetPost.call(this,m,...args)}");
    async function matches(result){
      const r=result.report,data=await value("({...document.getElementById('target-results').dataset})");
      assert.equal(data.observation,r.observationCompatibility);assert.equal(data.targets,r.targetCompatibility);assert.equal(Number(data.records),r.original.readings.length);
      assert.equal(Number(data.times),r.originalTimes.length);assert.equal(Number(data.targetCount),r.targets.length);assert.equal(Number(data.courses),r.work.executedThermalCourses);
      const original=await value("Array.from(document.querySelectorAll('#target-original-records tbody tr')).map(e=>({...e.dataset}))");assert.equal(original.length,r.original.readings.length);
      original.forEach((row,i)=>{const reading=r.original.readings[i];assert.equal(row.utc,reading.utc);assert.equal(row.store,reading.store);assert.equal(Number(row.cell),reading.cellIndex);assert.equal(Number(row.temperature),reading.temperatureC);assert.equal(Number(row.halfWidth),reading.halfWidthC);});
      const targetRows=await value("Array.from(document.querySelectorAll('#target-values tbody tr')).map(e=>({...e.dataset}))");
      if(r.observationCompatibility==='incompatible'){
        assert.equal(targetRows.length,0);assert.equal(data.minimumWorstExcess,undefined);assert.equal(data.maximumCommonMargin,undefined);assert.equal(await value("Boolean(document.getElementById('target-profile'))"),false);assert.equal(await value("Boolean(document.getElementById('target-time'))"),false);return;
      }
      assert.equal(Number(data.minimumWorstExcess),r.margin.minimumWorstExcessC.lower);assert.equal(Number(data.maximumCommonMargin),r.margin.maximumCommonMarginC.lower);
      assert.equal(targetRows.length,r.targets.length);targetRows.forEach((row,i)=>{const target=r.targets[i];assert.equal(Number(row.targetIndex),i);assert.equal(Number(row.originalIndex),target.originalIndex);assert.equal(row.utc,target.utc);assert.equal(row.store,target.store);assert.equal(Number(row.ceiling),target.maximumDifferenceC);assert.equal(Number(row.difference),target.differenceC.lower);assert.equal(Number(row.excess),target.excessC.lower);assert.equal(row.limiting,String(target.attainsWorstExcess));});
      const markers=await value("Array.from(document.querySelectorAll('.target-figure circle[data-target-index]')).map(e=>({...e.dataset,cx:Number(e.getAttribute('cx'))}))");assert.equal(markers.length,r.targets.length);
      markers.forEach((marker,i)=>{const target=r.targets[i];assert.equal(marker.utc,target.utc);assert.equal(marker.store,target.store);assert.equal(Number(marker.excess),target.excessC.lower);assert.equal(marker.limiting,String(target.attainsWorstExcess));const fraction=(Date.parse(target.utc)-Date.parse(r.originalTimes[0].utc))/(Date.parse(r.originalTimes.at(-1).utc)-Date.parse(r.originalTimes[0].utc));assert.equal(marker.cx,104+fraction*702);});
      assert.equal(await value("document.querySelectorAll('.target-figure path,.target-figure polyline').length"),0);
      assert.equal(await value("Array.from(document.querySelectorAll('.target-figure svg text')).every(e=>{const box=e.getBBox(),frame=e.ownerSVGElement.viewBox.baseVal;return box.x>=0&&box.y>=0&&box.x+box.width<=frame.width&&box.y+box.height<=frame.height})"),true,'Every original plot label must fit its SVG frame');
      const phases=await value("Array.from(document.querySelectorAll('#target-profile .phase-profile')).map(e=>JSON.parse(e.dataset.weights))");assert.deepEqual(phases,r.witness.phaseProfiles.map(phase=>phase.map(weight=>weight.lower)));
      const replayRows=await value("Array.from(document.querySelectorAll('#three-observation-replay tbody tr')).map(e=>Array.from(e.querySelectorAll('td')).map(c=>c.textContent))");
      assert.equal(replayRows.length,r.original.readings.length);replayRows.forEach((row,i)=>{const p=r.witness.originalObservations[i];assert.equal(row[1],p.utc);assert.equal(row[2],p.store==='surfaceC'?'ground surface':'lower heat store');assert.equal(row[3],p.originalC.lower+' / '+p.originalC.upper);assert.equal(row[4],Object.values(p.endpointStatus).every(status=>status==='within-original-band')?'within original band':'outside original band');});
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#target-time option')).map(e=>Number(e.value))"),r.originalTimes.map(time=>time.index));
    }
    async function allTimes(result){
      const before=await value('window.targetPosts'),r=result.report;
      const rows=await value("(()=>{const time=document.getElementById('target-time'),receiver=document.getElementById('target-receiver'),rows=[];for(const o of receiver.options){receiver.value=o.value;receiver.dispatchEvent(new Event('change'));for(const t of time.options){time.value=t.value;time.dispatchEvent(new Event('change'));rows.push(...Array.from(document.querySelectorAll('.target-time-card')).map(e=>({...e.dataset})));}}return rows})()");
      assert.equal(rows.length,r.witness.originalReplays.length*r.originalTimes.length*2);
      for(const row of rows){const source=Number(row.receiver),index=Number(row.originalIndex),p=r.witness.originalReplays[source].originalCourse[index],store=row.store;assert.equal(row.utc,p.utc);
        const ml=profileFraction(sub(exact(p.additiveC.proposal.lower[store]),exact(p.additiveC.existing.upper[store]))),mu=profileFraction(sub(exact(p.additiveC.proposal.upper[store]),exact(p.additiveC.existing.lower[store])));
        const nl=profileFraction(sub(q(p.originalC.proposal.lower[store]),q(p.originalC.existing.upper[store]))),nu=profileFraction(sub(q(p.originalC.proposal.upper[store]),q(p.originalC.existing.lower[store])));
        assert.equal(Number(row.modelLower),ml.lower);assert.equal(Number(row.modelUpper),mu.upper);assert.equal(Number(row.numericalLower),nl.lower);assert.equal(Number(row.numericalUpper),nu.upper);
        const target=source===0?r.targets.find(target=>target.originalIndex===index&&target.store===store):null;assert.equal(row.targetIndex,target?String(target.targetIndex):'');
        if(target){assert.equal(Number(row.ceiling),target.maximumDifferenceC);assert.equal(row.ceilingStatus,target.withinDeclaredCeiling?'within-authored-ceiling':'above-authored-ceiling');assert.equal(row.replayLowerStatus,target.originalReplay.endpointStatus.lower);assert.equal(row.replayUpperStatus,target.originalReplay.endpointStatus.upper);}
      }
      assert.equal(await value('window.targetPosts'),before);
    }
    async function download(name){const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('target-export');
      const path=directory+'/sky-course-target-inputs.json';let found=false;for(let i=0;i<500;i++){try{await access(path);found=true;break;}catch{await delay(40);}}assert(found);
      const text=await readFile(path,'utf8'),source=JSON.parse(text);assert.deepEqual(Object.keys(source),['kind','model','readings','query']);assert.deepEqual(prepareSkyCourseTargetSource(source.readings,source.query),source);return {path,text,source};}
    await send('Page.navigate',{url:launcherUrl+'sky-three-epochs.html'});await until("Boolean(document.querySelector('a[href=\"sky-course-targets.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-course-targets.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-course-targets.html'});await until("document.getElementById('target-example')?.disabled===false");await observe();
    await click('target-example');await state('incompatible');const actual=await value('window.observedTargetResult');await matches(actual);
    assert.deepEqual(actual.investigation,reference.investigation);assert.equal(actual.report.targets.length,32);assert.equal(actual.report.margin.individuallyPossibleTargets,32);
    assert.equal(actual.report.work.executedThermalCourses,840);assert.equal(actual.report.witness.originalObservations.length,24);assert.deepEqual(actual.report.margin.activeTargetIndices,[10,13,30]);
    assert(actual.report.margin.minimumWorstExcessC.lower>.00015&&actual.report.margin.minimumWorstExcessC.upper<.00016);
    await writeFile(runDirectory+'/runtime-target-course.json',JSON.stringify(actual,null,2));
    checks.push('Actual parent entry and target worker retain all24 original bands and32 literal goals; every goal is separately attainable while one best common profile has positive excess, with full840-course work and three limiting targets');

    await allTimes(actual);const beforeInspection=await value('window.targetPosts');
    await value("document.querySelector('#target-values tbody tr[data-target-index=\"13\"] button').click()");assert.equal(await value("document.getElementById('target-time-view').dataset.originalIndex"),String(actual.report.targets[13].originalIndex));assert.equal(await value("document.getElementById('target-receiver').value"),'0');
    await field('target-time',3,'change');await value("document.getElementById('target-time').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await until("document.getElementById('target-time-view').dataset.originalIndex==='4'");assert.equal(await value('window.targetPosts'),beforeInspection);
    checks.push('All three receivers and17 original times bind both model and original numerical paired endpoints to one actual worker profile;32 plot markers keep original UTC spacing and keyboard/target inspection starts no new worker');

    const saved=await download('initial');assert.deepEqual(saved.source,actual.investigation);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('target-example')?.disabled===false");await observe();await files(saved.path);await state('incompatible');assert.deepEqual(await value('window.observedTargetResult'),actual);await matches(actual);assert.equal(await stored(),originalStorage);
    checks.push('Actual source-only download and fresh reopening preserve all original identities and reconstruct the same-runtime complete report without changing the current site');

    await field('target-ceiling-1-surfaceC',actual.investigation.query.targets[0].maximumDifferenceC+.1);
    assert.equal(await value("document.getElementById('target-run').disabled&&document.getElementById('target-export').disabled&&document.getElementById('target-results').hidden"),true);
    await click('target-cancel');assert.equal(Number(await value("document.getElementById('target-ceiling-1-surfaceC').value")),actual.investigation.query.targets[0].maximumDifferenceC);assert.equal(await value("document.getElementById('target-results').hidden"),true);assert.equal(await value("document.getElementById('target-run').disabled"),false);
    await click('target-shift-apply');assert.equal(await value("document.getElementById('target-run').disabled"),true);
    await value("window.retiredTargetInput=document.getElementById('target-ceiling-1-surfaceC')");await click('target-apply');await state('inputs-ready');
    await value("window.retiredTargetInput.value='400';window.retiredTargetInput.dispatchEvent(new Event('input',{bubbles:true}))");await state('inputs-ready');
    await click('target-run');await state('compatible');const relaxed=await value('window.observedTargetResult');await matches(relaxed);
    assert.deepEqual(relaxed.investigation.readings,actual.investigation.readings);assert.deepEqual(relaxed.report.original,actual.report.original);
    relaxed.investigation.query.targets.forEach((target,i)=>assert.equal(target.maximumDifferenceC,actual.investigation.query.targets[i].maximumDifferenceC+.0002));
    assert(relaxed.report.targets.every(target=>target.withinDeclaredCeiling&&Object.values(target.originalReplay.endpointStatus).every(status=>status==='within-authored-ceiling')));
    await writeFile(runDirectory+'/runtime-target-relaxed.json',JSON.stringify(relaxed,null,2));const relaxedSaved=await download('relaxed');
    checks.push('Draft changes clear result/run/export, Cancel restores applied targets without reviving cached output, and explicit ceiling adjustment/apply produces joint compatibility with byte-identical original observations and parent report; detached editor controls are inert');

    await value("window.retiredTargetTime=document.getElementById('target-time');window.retiredTargetReceiver=document.getElementById('target-receiver');window.retiredTargetButton=document.querySelector('#target-values button')");
    const sources=[raw.readings[0],raw.readings[3],raw.readings[5]].map(input=>{const source=structuredClone(input.source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});return {...input,source};});
    const choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
    const readings=choices.map(([source,index,store])=>{const input=sources[source];return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,reading:{...input.query.reading,utc:originalSkyReadingTimes(input.source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad original bands on a partial original clock'}});});
    const parent=prepareThreeEpochSkySource(readings,{bins:4,splitAfterIntervals:[4,7],sharingSource:'Authored shared partial-clock conditions'}),parentPath=runDirectory+'/partial-original-inquiry.json';await writeFile(parentPath,JSON.stringify(parent));await files(parentPath);await state('draft');
    assert.equal(await value("document.getElementById('target-run').disabled&&document.getElementById('target-export').disabled"),true);assert.equal(await value("document.querySelectorAll('#target-original-records tbody tr').length"),5);
    const selected=['0:surfaceC','3:subsurfaceC','7:surfaceC','10:subsurfaceC'];
    await value('(()=>{const selected='+JSON.stringify(selected)+';for(const row of document.querySelectorAll(".target-edit-row")){const input=row.querySelector("input[type=checkbox]"),checked=selected.includes(row.dataset.originalIndex+":"+row.dataset.store);if(input.checked!==checked){input.checked=checked;input.dispatchEvent(new Event("input",{bubbles:true}));}}})()');
    await field('target-attribution','Explicit original sampled no-warming objectives');await click('target-apply');await click('target-run');await state('compatible');const partial=await value('window.observedTargetResult');await matches(partial);await allTimes(partial);
    assert.deepEqual(partial.investigation.readings,parent.readings);assert.deepEqual(partial.report.targets.map(target=>target.originalIndex+':'+target.store),selected);assert.equal(partial.report.originalTimes.length,11);assert.equal(partial.report.originalTimes.at(-1).minute,127.4);assert.equal(partial.report.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');
    const selectedBefore=await value("({...document.getElementById('target-time-view').dataset})");await value("window.retiredTargetTime.value='0';window.retiredTargetTime.dispatchEvent(new Event('change'));window.retiredTargetReceiver.value='0';window.retiredTargetReceiver.dispatchEvent(new Event('change'));window.retiredTargetButton.click()");assert.deepEqual(await value("({...document.getElementById('target-time-view').dataset})"),selectedBefore);await matches(partial);
    await writeFile(runDirectory+'/runtime-target-partial.json',JSON.stringify(partial,null,2));
    checks.push('Prior three-profile source opens as an unapplied draft; explicit checkbox targets include the initial state on an unfamiliar11-time partial clock with mixed original stores and first-receiver order, and retired selectors/buttons cannot revive the prior inquiry');

    const badFiles=[];for(const [name,data]of [['forged',{...actual.investigation,report:{}}],['duplicate',(()=>{const source=structuredClone(actual.investigation);source.query.targets.push(source.query.targets[0]);return source;})()],['outside',(()=>{const source=structuredClone(actual.investigation);source.query.targets[0].originalIndex=17;return source;})()],['mismatched-source',(()=>{const source=structuredClone(actual.investigation);source.readings[23].source.declaration.reservoirC+=1;return source;})()]]){
      const path=runDirectory+'/'+name+'.json';await writeFile(path,JSON.stringify(data));badFiles.push(path);
    }
    const badUtf=runDirectory+'/bad-utf8.json',malformed=runDirectory+'/malformed.json';await writeFile(badUtf,Buffer.from([0xc3,0x28]));await writeFile(malformed,'{');badFiles.push(badUtf,malformed);
    for(const path of badFiles){await files(path);await state('file-refused');await matches(partial);assert.equal(await value("document.getElementById('target-export').disabled"),false);}
    const uncertain=structuredClone(actual.investigation);uncertain.readings.forEach(input=>{input.source.project.solarStudy.proposal[0].heightMaxM=4;});const uncertainPath=runDirectory+'/uncertain.json';await writeFile(uncertainPath,JSON.stringify(uncertain));await files(uncertainPath);await state('refused');assert.equal(await value("document.getElementById('target-results').hidden&&document.getElementById('target-export').disabled"),true);assert.match(await value("document.getElementById('target-status').textContent"),/resolved existing and proposal geometry endpoints/);
    checks.push('Saved derived fields, duplicate/unoffered targets, conflicting original sources and malformed JSON/UTF8 preserve the prior accepted inquiry; unresolved selected geometry refuses the attempted calculation without a partial report or export');

    const impossible=structuredClone(actual.investigation);impossible.readings[23].query.reading.temperatureC=400;const impossiblePath=runDirectory+'/impossible-original.json';await writeFile(impossiblePath,JSON.stringify(impossible));await files(impossiblePath);await state('not-evaluated-original-incompatible');const empty=await value('window.observedTargetResult');await matches(empty);
    assert.equal(empty.report.original.firstThree.compatibility,'compatible');assert.equal(empty.report.margin,null);assert.equal(empty.report.witness,null);assert.equal(empty.report.exactEvidence,null);assert.equal(empty.report.work.executedTargetWitnessCourses,0);assert.deepEqual((await download('original-incompatible')).source,empty.investigation);
    await writeFile(runDirectory+'/runtime-target-original-incompatible.json',JSON.stringify(empty,null,2));
    checks.push('An incompatible final original observation withholds the target solve, margin and profile while retaining all24 records,32 desired ceilings and the compatible first-three reference; source-only inputs remain downloadable');

    const slow=runDirectory+'/slow-targets.json';await writeFile(slow,saved.text);
    await value("window.targetArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-targets.json')return new Promise(resolve=>{window.releaseTargetFile=()=>window.targetArrayBuffer.call(this).then(resolve)});return window.targetArrayBuffer.call(this)}");
    await files(slow);await until("typeof window.releaseTargetFile==='function'");assert.equal(await value("document.getElementById('target-export').disabled"),true);await matches(empty);
    await field('target-ceiling-1-surfaceC',-.5);await click('target-apply');await click('target-run');await state('not-evaluated-original-incompatible');const newer=await value('window.observedTargetResult');assert.equal(newer.investigation.query.targets[0].maximumDifferenceC,-.5);
    await value('window.releaseTargetFile()');await delay(100);await matches(newer);assert.equal(await value("document.querySelector('#target-original-records tbody tr[data-record=\"23\"]').dataset.temperature"),'400');await value('File.prototype.arrayBuffer=window.targetArrayBuffer');
    await value("window.heldTargetPost=Worker.prototype.postMessage;window.holdTarget=true;Worker.prototype.postMessage=function(m,...a){if(window.holdTarget&&m.operation==='prepare'){window.holdTarget=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseTargetWorker=()=>handler(e)}}return window.heldTargetPost.call(this,m,...a)}");
    await files(saved.path);await until("typeof window.releaseTargetWorker==='function'");await files(impossiblePath);await state('not-evaluated-original-incompatible');await matches(empty);await value('window.releaseTargetWorker()');await delay(100);await matches(empty);await value('Worker.prototype.postMessage=window.heldTargetPost');
    checks.push('A held compatible-file load cannot replace newly applied target edits on the incompatible original record, and a held prior worker cannot overwrite a newer complete original inquiry');

    await files(saved.path);await state('incompatible');await matches(actual);
    for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      for(const [selector,label]of [['#target-editor','editor'],['#target-results','comparison'],['.target-figure','plot'],['#target-time-view','original-time'],['#target-profile','profile']]){
        await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/target-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    for(const selector of ['#target-editor','.target-plot','#target-values','#three-observation-replay']){await value('document.querySelector('+JSON.stringify(selector)+').focus()');assert.equal(await value('document.activeElement===document.querySelector('+JSON.stringify(selector)+')'),true);}
    await files(relaxedSaved.path);await state('compatible');assert.deepEqual(await value('window.observedTargetResult'),relaxed);await matches(relaxed);
    checks.push('Actual1440px/390px target editor, common result, original-time cards and three-profile views fit the viewport; wide plot and complete observation/target tables are keyboard-focusable, and saved relaxed targets reopen exactly');

    let maximumRuntimeTargetDifferenceC=0;
    actual.report.targets.forEach((target,i)=>{for(const field of ['differenceC','excessC']){const difference=Math.abs(target[field].lower-reference.report.targets[i][field].lower);assert(difference<=1e-9);maximumRuntimeTargetDifferenceC=Math.max(maximumRuntimeTargetDifferenceC,difference);}});
    assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    return {checks,sandbox:session.sandbox,exceptions,maximumRuntimeTargetDifferenceC,
      runtimeComparisonScope:'Actual worker report is the exact UI oracle; the separate Node comparison covers every target value/excess with a numerical1e-9C threshold, not a physical error bound.',launcher:{command:'python3 serve.py --port 0',url:launcherUrl}};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

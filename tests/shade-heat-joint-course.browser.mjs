import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeJointCourseExample} from '../shade-heat-joint-example.js';
import {prepareSkyJointEvidence,prepareSkyJointSource} from '../shade-heat-joint-course.js';
import {prepareSkyCourseSource} from '../shade-heat-course-evidence.js';
import {courseWitnessDifferences} from '../shade-heat-course-inputs.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-run-joint-course-'+randomUUID(),checks=[];
const raw=makeJointCourseExample(),goodRaw=makeJointCourseExample(true);
const reference=prepareSkyJointEvidence(raw.readings,raw.query),goodReference=prepareSkyJointEvidence(goodRaw.readings,goodRaw.query);
const impossible=structuredClone(goodReference.investigation);impossible.readings[2].query.reading.temperatureC=400;
let launcher=null,launcherUrl=null;
try{
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Launcher readiness timed out: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',error=>{clearTimeout(timer);reject(error);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000,courseMs:120000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');
    async function until(expression){for(let i=0;i<1500;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Timed out: '+expression+'; '+await value("document.getElementById('joint-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    async function files(selector,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
    async function state(kind){const expression="document.getElementById('joint-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(['jointly-compatible','jointly-incompatible','empty-family','inputs-ready'].includes(kind)?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('joint-status').textContent"));}
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    const observe=()=>value("window.originalJointPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.observedJointRequest=structuredClone(m);const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedJointResult=structuredClone(e.data.result);handler(e)};return window.originalJointPost.call(this,m,...args)}");
    async function matches(r){
      const actual=await value("({...document.getElementById('joint-results').dataset})");
      assert.equal(actual.status,r.jointCompatibility);assert.equal(actual.observations,r.observationCompatibility);assert.equal(Number(actual.cell),r.cellIndex);
      assert.equal(Number(actual.first),r.axes[0].index);assert.equal(Number(actual.second),r.axes[1].index);assert.equal(Number(actual.basis),192);
      assert.equal(Number(actual.courses),r.work.executedThermalCourses);assert.equal(Number(actual.hull),r.hull.length);assert.equal(Number(actual.feasible),r.feasibleRegion.length);
      const cards=await value("Array.from(document.querySelectorAll('.joint-range-card')).map(e=>({...e.dataset}))");
      assert.equal(cards.length,r.individualRanges?.length??0);
      for(let i=0;i<cards.length;i++){assert.equal(Number(cards[i].minimum),r.individualRanges[i].lower.lower);assert.equal(Number(cards[i].maximum),r.individualRanges[i].upper.upper);assert.equal(Number(cards[i].ceiling),r.query.limits[i].maximumDifferenceC);assert.equal(cards[i].possible,String(r.individualRanges[i].individuallyPossible));}
      assert.equal(await value("Boolean(document.getElementById('joint-witness'))"),Boolean(r.witness));
      if(r.witness){
        const marker=await value("({...document.querySelector('[data-joint-witness]').dataset})");assert.equal(Number(marker.x),r.witness.jointValuesC[0].lower);assert.equal(Number(marker.y),r.witness.jointValuesC[1].lower);
        assert.equal(await value("document.getElementById('joint-witness').dataset.support"),r.witness.support.join(','));
        assert.equal(await value("document.getElementById('joint-limit-replay-note').dataset.status"),r.witness.originalLimits.some(l=>Object.values(l.endpointStatus).includes('above-authored-ceiling'))?'above-authored-ceiling':'within-authored-ceiling');
        assert.equal(await value("document.getElementById('joint-replay-note').dataset.replay"),r.witness.originalReplays.some(p=>Object.values(p.originalObservationEndpointStatus).includes('outside-original-band'))?'outside-original-band':'within-original-band');
        assert.deepEqual(await value("Array.from(document.querySelectorAll('#joint-time-select option')).map(o=>Number(o.value))"),r.originalBoundaries.map(x=>x.index));
      }
    }
    async function download(name){const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('joint-export');
      const path=directory+'/experimental-earth-joint-original-time-inputs.json';let found=false;for(let i=0;i<500;i++){try{await access(path);found=true;break;}catch{await delay(40);}}assert(found);
      const text=await readFile(path,'utf8'),source=JSON.parse(text);assert.deepEqual(Object.keys(source),['kind','model','readings','query']);assert.deepEqual(prepareSkyJointSource(source.readings,source.query),source);return {path,text,source};}
    await send('Page.navigate',{url:launcherUrl+'sky-course-evidence.html'});await until("Boolean(document.querySelector('a[href=\"sky-joint-course.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-joint-course.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-joint-course.html'});await until("document.getElementById('joint-example')?.disabled===false");await observe();
    await click('joint-example');await state('jointly-incompatible');const actualBad=await value('window.observedJointResult');await matches(actualBad.report);
    assert.deepEqual(actualBad.investigation,reference.investigation);assert(actualBad.report.individualRanges.every(r=>r.individuallyPossible));assert.equal(actualBad.report.witness,null);
    assert.equal(await value("document.querySelectorAll('#joint-sources .source-card').length"),3);assert.match(await value("document.getElementById('joint-summary').textContent"),/Each ceiling is possible separately/);
    assert.match(await value("document.getElementById('joint-first-time').selectedOptions[0].textContent"),/^08:00:00 UTC/);
    assert.match(await value("document.getElementById('joint-second-time-hint').textContent"),/2026-06-21T09:00:00.000Z/);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
    await value("document.getElementById('joint-summary').scrollIntoView({block:'start',behavior:'instant'})");await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const negativeShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/joint-incompatible-390.png',Buffer.from(negativeShot.data,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
    checks.push('Actual parent entry and worker distinguish separately possible ceilings from a jointly incompatible same-profile pair while retaining all three original bands');

    await click('joint-example-feasible');await state('jointly-compatible');const actualGood=await value('window.observedJointResult');await matches(actualGood.report);
    assert.deepEqual(actualGood.investigation,goodReference.investigation);assert.deepEqual(actualGood.investigation.readings,actualBad.investigation.readings);
    assert(actualGood.report.witness.construction.length>=2&&actualGood.report.witness.construction.length<=3);
    await value("window.jointPost=Worker.prototype.postMessage;window.jointPosts=0;Worker.prototype.postMessage=function(...args){window.jointPosts++;return window.jointPost.apply(this,args)}");
    const trace=courseWitnessDifferences(actualGood.report.witness);
    for(const row of trace){await field('joint-time-select',row.index);const detail=await value("({...document.getElementById('joint-time-detail').dataset})");assert.equal(Number(detail.index),row.index);assert.equal(detail.utc,row.utc);
      for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper'])assert.equal(Number(detail[store+(side==='lower'?'Lower':'Upper')]),row.differenceC[store][side][side]);}
    await field('joint-time-slider',8);await value("document.getElementById('joint-time-slider').focus()");
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await value("document.getElementById('joint-time-detail').dataset.index"),'9');assert.equal(await value('window.jointPosts'),0);await value('Worker.prototype.postMessage=window.jointPost');
    checks.push('A less strict second ceiling constructs one shared profile from multiple family vertices; exact marker/time bindings, all17 original times, separate numeric ceiling/band statuses and keyboard inspection pass without recomputation');

    const saved=await download('shared-profile');assert.deepEqual(saved.source,actualGood.investigation);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('joint-example')?.disabled===false");await observe();await files('#joint-reopen',[saved.path]);await state('jointly-compatible');
    const fresh=await value('window.observedJointResult');assert.deepEqual(fresh,actualGood);await matches(fresh.report);assert.equal(await stored(),originalStorage);
    checks.push('Actual source-only download retains original evidence and authored limits, excludes calculated region/profile/inspection choices and recomputes identically in a fresh document');

    for(const [width,height,mobile] of [[1440,1000,false],[390,844,true]]){await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      for(const [id,label] of [['joint-form','limits'],['joint-summary','joint-region'],['joint-witness','profile'],['joint-time-detail','original-time']]){
        await value('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/joint-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }}
    checks.push('Two original-time goal controls, joint region, source profiles, replay alerts and exact original-time inspection fit desktop and390px');
    await value("window.retiredJointTime=document.getElementById('joint-time-select');window.retiredJointPoint=document.querySelector('#joint-sources input[value=\"1\"]')");

    const originals=structuredClone(raw.readings);originals.forEach((r,i)=>{r.query.bins=[4,16,8][i];});const paths=originals.map((_,i)=>runDirectory+'/original-'+i+'.json');await Promise.all(paths.map((path,i)=>writeFile(path,JSON.stringify(originals[i]))));
    await files('#joint-originals',paths);await state('inputs-ready');await value("(()=>{const e=document.querySelector('#joint-sources input[value=\"2\"]');e.checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await click('joint-run');await state('jointly-incompatible');const changed=await value('window.observedJointResult');await matches(changed.report);assert.equal(changed.report.cellIndex,1);assert.deepEqual(changed.investigation.readings.map(r=>r.query.bins),[8,4,16]);
    await value("window.retiredJointTime.value='0';window.retiredJointTime.dispatchEvent(new Event('input'));window.retiredJointPoint.checked=true;window.retiredJointPoint.dispatchEvent(new Event('input'))");await matches(changed.report);
    const course=prepareSkyCourseSource(raw.readings,{bins:4,splitAfterInterval:8,sharingSource:raw.query.sharingSource}),prior=runDirectory+'/prior-course.json';await writeFile(prior,JSON.stringify(course));
    await field('joint-split',7);await field('joint-first-time',4);await field('joint-second-time',11);await field('joint-first-ceiling',.5);await field('joint-purpose','Explicit goals retained across original evidence intake');
    await files('#joint-originals',[prior]);await state('inputs-ready');assert.deepEqual(await value("['split','first-time','second-time','first-ceiling','purpose'].map(id=>document.getElementById('joint-'+id).value)"),['7','4','11','0.5','Explicit goals retained across original evidence intake']);
    await files('#joint-reopen',[saved.path]);await state('jointly-compatible');await matches(actualGood.report);
    checks.push('Three original files preserve4/16/8 histories and explicit comparison choice; prior original-course intake does not adopt its boundary or replace current limits; detached controls cannot revive retired context');

    const forged=runDirectory+'/forged.json',badUtf=runDirectory+'/bad-utf8.json',mismatch=runDirectory+'/mismatch.json',unresolved=runDirectory+'/unresolved.json';
    await writeFile(forged,JSON.stringify({...course,report:{}}));await writeFile(badUtf,Buffer.from([0xc3,0x28]));
    const wrong=structuredClone(actualGood.investigation);wrong.readings[2].source.declaration.reservoirC+=1;await writeFile(mismatch,JSON.stringify(wrong));
    const uncertain=structuredClone(actualGood.investigation);uncertain.readings.forEach(r=>{r.source.project.solarStudy.proposal[0].heightMaxM=4;});await writeFile(unresolved,JSON.stringify(uncertain));
    for(const group of [[forged],paths.slice(0,2)]){await files('#joint-originals',group);await state('file-refused');await matches(actualGood.report);}
    for(const path of [badUtf,mismatch,unresolved]){await files('#joint-reopen',[path]);await state('file-refused');await matches(actualGood.report);}
    await field('joint-second-time',8);await click('joint-run');await state('refused');assert.equal(await value("document.getElementById('joint-results').hidden"),true);assert.equal(await value("document.getElementById('joint-export').disabled"),true);
    await files('#joint-reopen',[saved.path]);await state('jointly-compatible');await matches(actualGood.report);
    checks.push('Malformed saved results,incomplete originals,invalidUTF8,mismatched original forcing and unresolved selected geometry refuse without replacing prior accepted results; invalid newly authored time pair clears the attempted inquiry');

    const slow=runDirectory+'/slow-original.json';await writeFile(slow,JSON.stringify(originals[2]));
    await value("window.jointArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-original.json')return new Promise(resolve=>{window.releaseJointFile=()=>window.jointArrayBuffer.call(this).then(resolve)});return window.jointArrayBuffer.call(this)}");
    await files('#joint-originals',[paths[0],paths[1],slow]);await until("typeof window.releaseJointFile==='function'");await field('joint-second-ceiling',-2.464896);await click('joint-run');await state('jointly-incompatible');const newer=await value('window.observedJointResult');
    await value('window.releaseJointFile()');await delay(100);await matches(newer.report);await value('File.prototype.arrayBuffer=window.jointArrayBuffer');
    checks.push('A held actual original-file read cannot replace a newer accepted query after a desired-limit edit');

    await value("window.jointPost=Worker.prototype.postMessage;window.holdJoint=true;Worker.prototype.postMessage=function(m,...a){if(window.holdJoint&&m.operation==='prepare'){window.holdJoint=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseJointWorker=()=>handler(e)}}return window.jointPost.call(this,m,...a)}");
    await click('joint-run');await until("typeof window.releaseJointWorker==='function'");const impossiblePath=runDirectory+'/impossible.json';await writeFile(impossiblePath,JSON.stringify(impossible));await files('#joint-reopen',[impossiblePath]);await state('empty-family');const empty=await value('window.observedJointResult');await matches(empty.report);
    await value('window.releaseJointWorker()');await delay(100);await matches(empty.report);await value('Worker.prototype.postMessage=window.jointPost');
    assert.equal(await value("document.getElementById('joint-region')"),null);assert.equal(await value("document.getElementById('joint-witness')"),null);assert.deepEqual((await download('empty-family')).source,impossible);
    checks.push('A held older worker cannot overwrite a newer empty original-band family; original inputs remain downloadable without invented region,witness or favorable result');

    const zero=structuredClone(actualGood.investigation);for(const r of zero.readings)r.source.project.solarStudy.proposal=structuredClone(r.source.project.solarStudy.existing);zero.query.limits.forEach(l=>{l.maximumDifferenceC=0;});
    const zeroPath=runDirectory+'/zero-effect.json';await writeFile(zeroPath,JSON.stringify(zero));await files('#joint-reopen',[zeroPath]);await state('jointly-compatible');const point=await value('window.observedJointResult');await matches(point.report);assert.equal(point.report.dimension,0);assert.equal(await value("document.querySelectorAll('circle[data-region=family]').length"),1);
    await field('joint-second-ceiling',-Number.MIN_VALUE);await click('joint-run');await state('jointly-incompatible');const excluded=await value('window.observedJointResult');await matches(excluded.report);assert.equal(excluded.report.individualRanges[1].individuallyPossible,false);
    checks.push('The exact zero-effect point renders without a fabricated area; a smallest-negative binary64 ceiling correctly excludes it');

    let maximumRuntimeRangeDifferenceC=0;
    for(const [actual,expected]of [[actualBad,reference],[actualGood,goodReference]])for(let i=0;i<2;i++)for(const bound of ['lower','upper']){
      const difference=Math.abs(actual.report.individualRanges[i][bound][bound]-expected.report.individualRanges[i][bound][bound]);assert(difference<=1e-12);maximumRuntimeRangeDifferenceC=Math.max(maximumRuntimeRangeDifferenceC,difference);
    }
    await writeFile(runDirectory+'/runtime-joint-courses.json',JSON.stringify({incompatible:actualBad,feasible:actualGood,maximumRuntimeRangeDifferenceC,scope:'UI bindings use the actual worker report exactly; separate Node comparison is numerical, not bit-identical.'},null,2));
    await value('window.jointRawSource='+JSON.stringify(actualGood.investigation));
    const pairs=await value("(async()=>{const {buildOriginalBoundaryBasis}=await import('./shade-heat-epoch-kernel.js');const source=window.jointRawSource,split=source.query.splitAfterInterval,bases=source.readings.map(input=>buildOriginalBoundaryBasis(input,split));return {split,readings:source.readings.map(input=>input.query.reading),points:bases.map(b=>({cellIndex:b.input.query.reading.cellIndex,pairs:b.pairs.map(p=>({early:p.early,late:p.late,final:p.trace.final,originalBoundaries:p.trace.originalBoundaries,states:p.trace.states}))}))}})()");
    await writeFile(runDirectory+'/runtime-original-pair-values.json',JSON.stringify(pairs,null,2));assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    return {checks,sandbox:session.sandbox,exceptions,maximumRuntimeRangeDifferenceC,launcher:{command:'python3 serve.py --port 0',url:launcherUrl,scope:'Every visible interaction and actual worker uses the maintained documented loopback launcher.'}};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeManySkyExample} from '../shade-heat-many-example.js';
import {prepareManySkyCourseSource} from '../shade-heat-many-course.js';
import {prepareRecordBoundaryEvidence,parseRecordBoundarySource} from '../shade-heat-record-boundaries.js';
import {courseWitnessDifferences} from '../shade-heat-course-inputs.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-run-record-boundaries-'+randomUUID(),checks=[];
const raw=makeManySkyExample(),query={bins:4,splitAfterIntervals:Array.from({length:15},(_,i)=>i+1),sharingSource:raw.query.sharingSource};
const reference=prepareRecordBoundaryEvidence(raw.readings,query);
let launcher=null,launcherUrl=null;
try{
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  launcherUrl=await new Promise((resolve,reject)=>{
    let output='',errors='';const timer=setTimeout(()=>reject(Error('Launcher readiness timed out: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',error=>{clearTimeout(timer);reject(error);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});
  });
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');
    async function until(expression){for(let i=0;i<1500;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Timed out: '+expression+'; '+await value("document.getElementById('record-boundary-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content,event='input'){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event('+JSON.stringify(event)+',{bubbles:true}));})()');}
    async function files(selector,paths){const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
    async function state(kind){const expression="document.getElementById('record-boundary-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(kind==='compared'?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('record-boundary-status').textContent"));}
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    const observe=()=>value("window.rbOriginalPost=Worker.prototype.postMessage;window.rbPosts=0;Worker.prototype.postMessage=function(m,...args){window.rbPosts++;window.rbRequest=structuredClone(m);const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.rbResult=structuredClone(e.data.result);handler(e)};return window.rbOriginalPost.call(this,m,...args)}");
    async function matches(r){
      const data=await value("({...document.getElementById('record-boundary-results').dataset})");
      assert.equal(data.status,r.compatibility);assert.equal(Number(data.offered),r.boundaries.length);
      assert.equal(Number(data.compatible),r.boundaryComparison.allRecordsCompatible.length);assert.equal(Number(data.referenceCompatible),r.boundaryComparison.firstThreeCompatible.length);
      assert.equal(Number(data.records),r.originalRecordCount);assert.equal(Number(data.cell),r.cellIndex);
      const offers=await value("Array.from(document.querySelectorAll('#record-boundary-offers button')).map(e=>({...e.dataset}))");
      assert.equal(offers.length,r.boundaries.length);
      for(let i=0;i<offers.length;i++){assert.equal(Number(offers[i].split),r.boundaries[i].splitAfterInterval);assert.equal(offers[i].status,r.boundaries[i].report.compatibility);}
      assert.equal(await value("document.querySelectorAll('#record-boundary-original-table tbody tr').length"),r.originalRecordCount);
      assert.equal(Number(await value("document.getElementById('record-boundary-time').max")),r.originalTimes.length-1);
    }
    async function download(name){
      const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('record-boundary-export');
      const path=directory+'/complete-record-sky-boundary-inputs.json';let found=false;
      for(let i=0;i<500;i++){try{await access(path);found=true;break;}catch{await delay(40);}}assert(found);
      const text=await readFile(path,'utf8'),source=parseRecordBoundarySource(text);assert.deepEqual(Object.keys(source),['kind','model','readings','query']);return {path,text,source};
    }
    await send('Page.navigate',{url:launcherUrl+'sky-many-readings.html'});await until("Boolean(document.querySelector('a[href=\"sky-record-boundaries.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-record-boundaries.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-record-boundaries.html'});await until("document.documentElement.dataset.recordBoundaryReady==='true'");await observe();
    await click('record-boundary-example');await state('compared');const actual=await value('window.rbResult');await matches(actual.report);
    assert.deepEqual(actual.investigation,reference.investigation);assert.equal(actual.report.boundaryComparison.firstThreeCompatible.length,15);assert.deepEqual(actual.report.boundaryComparison.allRecordsCompatible,[7]);
    await writeFile(runDirectory+'/runtime-record-boundaries.json',JSON.stringify(actual));
    checks.push('Actual parent entry and worker compare all15 offered original times against all24 readings: first-three admits15, complete record admits only08:00; every rejected alternative remains visible');

    const posts=await value('window.rbPosts');
    for(const boundary of actual.report.boundaries){
      await value('document.querySelector(\'#record-boundary-offers button[data-offer="'+boundary.offeredIndex+'"]\').click()');
      const selected=await value("({...document.getElementById('record-boundary-selected').dataset})");assert.equal(Number(selected.split),boundary.splitAfterInterval);assert.equal(selected.status,boundary.report.compatibility);
      assert.equal(await value("Boolean(document.getElementById('record-boundary-witness'))"),boundary.report.compatibility==='compatible');
    }
    await value("document.querySelector('#record-boundary-offers button[data-offer=\"7\"]').click()");
    for(const row of actual.report.pointwiseCourse){
      await field('record-boundary-time',row.index);const detail=await value("({...document.getElementById('record-boundary-time-detail').dataset})");assert.equal(Number(detail.index),row.index);assert.equal(detail.utc,row.utc);
      for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper'])assert.equal(Number(detail[store+(side==='lower'?'Lower':'Upper')]),row.ranges[store][side].differenceC[side]);
      const origins=await value("Array.from(document.querySelectorAll('#record-boundary-time-detail button[data-origin]')).map(e=>({...e.dataset}))");
      assert.equal(origins.length,4);
      for(const origin of origins){const expected=row.ranges[origin.store][origin.side].attainments[0];assert.equal(Number(origin.offer),expected.offeredIndex);assert.equal(Number(origin.witness),expected.witnessId);assert.equal(Number(origin.proof),expected.proofIndex);}
    }
    await field('record-boundary-time',4);await value("document.querySelector('#record-boundary-time-detail button[data-store=\"surfaceC\"][data-side=\"lower\"]').click()");
    const widths=await value("Array.from(document.querySelectorAll('.record-width-change')).map(e=>({...e.dataset}))");
    for(const width of widths){const a=actual.report.firstThree.pointwiseCourse[4].ranges[width.store],b=actual.report.pointwiseCourse[4].ranges[width.store];assert.equal(Number(width.before),a.upper.differenceC.upper-a.lower.differenceC.lower);assert.equal(Number(width.after),b.upper.differenceC.upper-b.lower.differenceC.lower);}
    const witnessId=Number(await value("document.getElementById('record-boundary-witness').dataset.witness"));
    const child=actual.report.boundaries[7].report,witness=child.witnesses.find(w=>w.id===witnessId),trace=courseWitnessDifferences(witness);
    assert.equal(witnessId,actual.report.pointwiseCourse[4].ranges.surfaceC.lower.attainments[0].witnessId);
    for(const store of ['surfaceC','subsurfaceC']){
      const plot=await value('(()=>{const p=document.querySelector(\'.many-plot[data-store="'+store+'"]\');return {ranges:[...p.querySelectorAll("g[data-index]")].map(e=>({...e.dataset})),prior:[...p.querySelectorAll("g[data-prior-index]")].map(e=>({...e.dataset})),markers:[...p.querySelectorAll("circle[data-profile]")].map(e=>({...e.dataset}))}})()');
      assert.equal(plot.ranges.length,17);assert.equal(plot.prior.length,17);assert.equal(plot.markers.length,34);
      for(const row of plot.ranges){const expected=actual.report.pointwiseCourse[Number(row.index)].ranges[store];assert.equal(Number(row.lower),expected.lower.differenceC.lower);assert.equal(Number(row.upper),expected.upper.differenceC.upper);}
      for(const row of plot.prior){const expected=actual.report.firstThree.pointwiseCourse[Number(row.priorIndex)].ranges[store];assert.equal(Number(row.priorLower),expected.lower.differenceC.lower);assert.equal(Number(row.priorUpper),expected.upper.differenceC.upper);}
      for(const marker of plot.markers){assert.equal(Number(marker.boundary),8);assert.equal(Number(marker.profile),witnessId);assert.equal(Number(marker.value),trace[Number(marker.index)].differenceC[store][marker.bound][marker.bound]);}
    }
    const replay=await value("Array.from(document.querySelectorAll('#many-observation-replay tbody tr')).map(r=>Array.from(r.querySelectorAll('td')).map(e=>e.textContent))");
    for(let i=0;i<24;i++){const row=witness.originalObservations[i];assert.equal(replay[i][1],row.utc);assert.equal(replay[i][3],row.originalC.lower+' / '+row.originalC.upper);}
    await value("document.getElementById('record-boundary-time').focus()");for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert.equal(await value("document.getElementById('record-boundary-time-detail').dataset.index"),'5');assert.equal(await value('window.rbPosts'),posts);
    checks.push('All15 alternative selections,17 original times,136 displayed union endpoints and fixed-profile plots bind to the actual worker; every origin retains its boundary/proof/profile and24 original numeric replay rows; keyboard inspection makes no worker request');

    const saved=await download('initial');assert.deepEqual(saved.source,actual.investigation);
    await send('Page.reload',{ignoreCache:true});await until("document.documentElement.dataset.recordBoundaryReady==='true'");await observe();await files('#record-boundary-reopen',[saved.path]);await state('compared');
    assert.deepEqual(await value('window.rbResult'),actual);await matches(actual.report);assert.equal(await stored(),originalStorage);
    checks.push('Actual source-only download and fresh reopen preserve the entire record and offered order, recompute the identical same-runtime report and leave the current site unchanged');

    for(const [width,height,mobile] of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      for(const [selector,label] of [['#record-boundary-form','conditions'],['#record-boundary-results','comparison'],['#record-boundary-plots','unions'],['#record-boundary-time-detail','original-time'],['#record-boundary-witness','profile']]){
        if(label==='profile')await value("document.getElementById('record-boundary-profile-details').open=true");
        await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/record-boundaries-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
      await value("document.getElementById('record-boundary-profile-details').open=false");
    }
    await value("document.getElementById('record-boundary-sources').open=true;document.getElementById('record-boundary-original-table').focus()");
    assert.equal(await value('document.activeElement.id'),'record-boundary-original-table');assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
    checks.push('Actual1440px/390px boundary list, original-UTC conditions, union plots, exact origins and fixed-profile view fit; the24-row source table is keyboard-focusable');

    await value("window.rbRetiredOffer=document.querySelector('#record-boundary-offers button');window.rbRetiredOrigin=document.querySelector('#record-boundary-time-detail button[data-origin]');window.rbRetiredTime=document.getElementById('record-boundary-time')");
    const inputs=structuredClone(raw.readings);inputs.forEach((r,i)=>{r.query.bins=[4,16,8][i%3];});
    const paths=inputs.map((_r,i)=>runDirectory+'/original-'+String(i).padStart(2,'0')+'.json');await Promise.all(paths.map((path,i)=>writeFile(path,JSON.stringify(inputs[i]))));
    await field('record-boundary-splits','12, 8, 3');await files('#record-boundary-originals',paths);await state('not-compared');
    assert.equal(await value("document.getElementById('record-boundary-splits').value"),'12, 8, 3');await field('record-boundary-sharing',query.sharingSource);await field('record-boundary-primary',5,'change');
    await click('record-boundary-run');await state('compared');const reordered=await value('window.rbResult');await matches(reordered.report);
    assert.deepEqual(reordered.investigation.readings,[inputs[5],...inputs.filter((_r,i)=>i!==5)]);assert.equal(reordered.report.cellIndex,1);assert.deepEqual(reordered.investigation.query.splitAfterIntervals,[12,8,3]);
    const beforeRetired=await value("JSON.stringify({...document.getElementById('record-boundary-selected').dataset})+'|'+document.getElementById('record-boundary-time').value");
    await value("window.rbRetiredOffer.click();window.rbRetiredOrigin.click();window.rbRetiredTime.value='0';window.rbRetiredTime.dispatchEvent(new Event('input'))");
    assert.equal(await value("JSON.stringify({...document.getElementById('record-boundary-selected').dataset})+'|'+document.getElementById('record-boundary-time').value"),beforeRetired);
    const many=prepareManySkyCourseSource(raw.readings,raw.query),manyPath=runDirectory+'/prior-many-inputs.json';await writeFile(manyPath,JSON.stringify(many));
    await files('#record-boundary-originals',[manyPath]);await state('not-compared');assert.equal(await value("document.getElementById('record-boundary-splits').value"),'12, 8, 3');
    await files('#record-boundary-originals',[saved.path]);await state('not-compared');assert.equal(await value("document.getElementById('record-boundary-splits').value"),'12, 8, 3');
    checks.push('All24 actual original files retain4/16/8-bin histories and explicit first-record reorder; saved single-boundary and new inquiries supply original records without adopting their offered list; detached controls cannot revive retired results');

    await files('#record-boundary-originals',paths.slice(0,3));await state('not-compared');await field('record-boundary-sharing',query.sharingSource);await click('record-boundary-run');await state('compared');
    const noGain=await value('window.rbResult');await matches(noGain.report);assert.equal(noGain.report.rangeChanges.narrowed,0);assert.equal(noGain.report.boundaryComparison.allRecordsCompatible.length,3);
    await field('record-boundary-time',0);assert.equal(await value("document.querySelectorAll('#record-boundary-time-detail button[data-origin]').length"),12);
    await writeFile(runDirectory+'/runtime-no-gain.json',JSON.stringify(noGain));
    const impossible=structuredClone(actual.investigation);impossible.query.splitAfterIntervals=[8,2];impossible.readings.at(-1).query.reading.temperatureC=400;
    const impossiblePath=runDirectory+'/impossible.json';await writeFile(impossiblePath,JSON.stringify(impossible));await files('#record-boundary-reopen',[impossiblePath]);await state('compared');
    const empty=await value('window.rbResult');await matches(empty.report);assert.equal(empty.report.compatibility,'incompatible');assert.equal(empty.report.firstThree.compatibility,'compatible');
    assert.equal(await value("Boolean(document.getElementById('record-boundary-witness'))"),false);assert.equal(await value("document.querySelectorAll('#record-boundary-time-detail button[data-origin]').length"),0);
    assert.deepEqual((await download('incompatible')).source,empty.investigation);await writeFile(runDirectory+'/runtime-incompatible.json',JSON.stringify(empty));
    checks.push('A three-record no-gain control retains three compatible alternatives and all12 initial-state ties; a final400C record rejects both offered times while preserving the first-three union and source-only export, without a substituted profile');

    await files('#record-boundary-reopen',[saved.path]);await state('compared');
    const badPaths=[];
    for(const [name,data] of [['forged',JSON.stringify({...actual.investigation,report:{}})],['malformed','{'],['utf8',Buffer.from([0xc3,0x28])]]){
      const path=runDirectory+'/'+name+'.json';await writeFile(path,data);badPaths.push(path);
    }
    const mismatch=structuredClone(actual.investigation);mismatch.readings.at(-1).source.declaration.reservoirC+=1;
    const oversized=structuredClone(actual.investigation);for(const input of oversized.readings)input.source.declaration.path.stepMinutes=20;oversized.query.splitAfterIntervals=[1,2,3,4,5,6,7,8,9];
    const unresolved=structuredClone(actual.investigation);for(const input of unresolved.readings)input.source.project.solarStudy.existing[0].heightMaxM=4;
    for(const [name,input] of [['mismatch',mismatch],['aggregate',oversized],['unresolved',unresolved]]){const path=runDirectory+'/'+name+'.json';await writeFile(path,JSON.stringify(input));badPaths.push(path);}
    for(const path of badPaths){await files('#record-boundary-reopen',[path]);await state('file-refused');await matches(actual.report);}
    await files('#record-boundary-originals',paths.slice(0,2));await state('file-refused');await matches(actual.report);
    await field('record-boundary-splits','8, 8');assert.equal(await value("document.getElementById('record-boundary-results').hidden"),true);assert.equal(await value("document.getElementById('record-boundary-export').disabled"),true);
    await click('record-boundary-run');await state('refused');assert.equal(await value("document.getElementById('record-boundary-results').hidden"),true);
    checks.push('Malformed UTF8/JSON, forged outputs, conflicting original declarations, unresolved endpoints, incomplete file lists and excessive aggregate work refuse without replacing admitted evidence; an invalid offered list clears the attempted result and blocks export');

    await files('#record-boundary-reopen',[saved.path]);await state('compared');
    const heldPath=runDirectory+'/held-original-23.json';await writeFile(heldPath,JSON.stringify(inputs[23]));
    await value("window.rbOriginalArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='held-original-23.json')return new Promise(resolve=>{window.rbReleaseFile=()=>window.rbOriginalArrayBuffer.call(this).then(resolve)});return window.rbOriginalArrayBuffer.call(this)}");
    await files('#record-boundary-originals',[...paths.slice(0,23),heldPath]);await until("typeof window.rbReleaseFile==='function'");
    await field('record-boundary-splits','8');await click('record-boundary-run');await state('compared');const single=await value('window.rbResult');assert.deepEqual(single.investigation.query.splitAfterIntervals,[8]);
    await value('window.rbReleaseFile()');await delay(100);await matches(single.report);assert.equal(await value("document.getElementById('record-boundary-splits').value"),'8');await value('File.prototype.arrayBuffer=window.rbOriginalArrayBuffer');
    await value("window.rbHeldPost=Worker.prototype.postMessage;window.rbHold=true;Worker.prototype.postMessage=function(m,...a){if(window.rbHold&&m.operation==='prepare'){window.rbHold=false;const handler=this.onmessage;this.onmessage=e=>{window.rbReleaseWorker=()=>handler(e)}}return window.rbHeldPost.call(this,m,...a)}");
    await click('record-boundary-run');await until("typeof window.rbReleaseWorker==='function'");await files('#record-boundary-reopen',[impossiblePath]);await state('compared');await matches(empty.report);
    await value('window.rbReleaseWorker()');await delay(100);await matches(empty.report);await value('Worker.prototype.postMessage=window.rbHeldPost');
    checks.push('A held24-file load cannot overwrite a newly declared boundary inquiry; a held compatible worker cannot overwrite a newer all-incompatible original record');

    let maximumRuntimeRangeDifferenceC=0;
    for(const family of ['all','firstThree'])for(let index=0;index<17;index++)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper']){
      const a=(family==='all'?actual.report:actual.report.firstThree).pointwiseCourse[index].ranges[store][side].differenceC[side];
      const b=(family==='all'?reference.report:reference.report.firstThree).pointwiseCourse[index].ranges[store][side].differenceC[side];
      const difference=Math.abs(a-b);assert(difference<=1e-9);maximumRuntimeRangeDifferenceC=Math.max(maximumRuntimeRangeDifferenceC,difference);
    }
    assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    return {checks,sandbox:session.sandbox,exceptions,maximumRuntimeRangeDifferenceC,runtimeComparisonScope:'Actual worker reports are the exact DOM oracle. The separate Node comparison checks136 first-three/full-record union endpoints at original times under a1e-9C numerical threshold, not a physical error bound.',launcher:{command:'python3 serve.py --port 0',url:launcherUrl}};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { prepareThirdReceiverEvidence, prepareThirdReceiverSource } from '../shade-heat-third-receiver.js';
import { makeThirdReceiverExample } from '../shade-heat-third-example.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-run-third-receiver-'+randomUUID(),checks=[];
const raw=makeThirdReceiverExample(),reference=prepareThirdReceiverEvidence(raw.readings,raw.query);
const independent=structuredClone(raw.readings);independent[0].query.bins=4;independent[1].query.bins=16;independent[2].query.bins=8;
const query={...raw.query,splitAfterIntervals:[9,8]};
const reversed=prepareThirdReceiverEvidence([independent[1],independent[0],independent[2]],query);
const roles=prepareThirdReceiverEvidence([independent[0],independent[2],independent[1]],query);
const one=prepareThirdReceiverEvidence(roles.investigation.readings,{...query,splitAfterIntervals:[8]});
const impossible=structuredClone(raw);impossible.query.splitAfterIntervals=[8];impossible.readings[2].query.reading.temperatureC=50;
const empty=prepareThirdReceiverEvidence(impossible.readings,impossible.query);
let launcher=null,launcherUrl=null;
try {
  launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  launcherUrl=await new Promise((resolve,reject)=>{
    let output='',errors='';const timer=setTimeout(()=>reject(Error('Documented launcher readiness timed out: '+errors)),10000);
    launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
    launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});
    launcher.once('error',error=>{clearTimeout(timer);reject(error);});
    launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Documented launcher exited '+code+': '+errors));});
  });
  const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:30000},async session=>{
    const {send,evaluate:value,exceptions}=session;assert.ok(session.sandbox.admitted&&session.sandbox.observation.active);
    await send('DOM.enable');await send('Page.enable');
    async function until(expression){for(let i=0;i<1500;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Timed out: '+expression+'; '+await value("document.getElementById('third-status')?.textContent"));}
    const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
    async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
    async function files(selector,paths){const document=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector});assert.ok(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
    const state=async kind=>{
      const expression="document.getElementById('third-status').dataset.state";
      await until(expression+"==="+JSON.stringify(kind)+(['compatible','incompatible','inputs-ready'].includes(kind)?"||['refused','file-refused'].includes("+expression+")":''));
      assert.equal(await value(expression),kind,await value("document.getElementById('third-status').textContent"));
    };
    const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
    async function matches(r){
      const actual=await value("({...document.getElementById('third-results').dataset})");
      assert.equal(actual.status,r.compatibility);assert.equal(Number(actual.cell),r.cellIndex);
      assert.equal(actual.compatible,r.compatibleBoundaries.join(','));assert.equal(actual.prior,r.firstTwoCompatibleBoundaries.join(','));
      assert.equal(actual.excluded,r.excludedByThird.join(','));assert.equal(Number(actual.offered),r.boundaries.length);
      assert.equal(Number(actual.basis),r.work.executedBasisCourses);assert.equal(Number(actual.reused),r.work.reusedCompleteBasisCourses);
      for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']){
        const key=store+bound[0].toUpperCase()+bound.slice(1);
        if(r.ranges)assert.equal(Number(actual[key]),r.ranges[store][bound].differenceC[bound]);else assert.equal(actual[key],undefined);
      }
      assert.deepEqual(await value("Array.from(document.querySelectorAll('#third-alternatives button')).map(e=>[Number(e.dataset.split),e.dataset.prior,e.dataset.status])"),r.boundaries.map(b=>[b.query.splitAfterInterval,b.firstTwo.compatibility,b.compatibility]));
    }
    async function download(name){
      const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('third-export');
      const path=directory+'/experimental-earth-three-receiver-inputs.json';let found=false;
      for(let i=0;i<500;i++){try{await access(path);found=true;break;}catch{await delay(40);}}assert.ok(found);
      const text=await readFile(path,'utf8'),source=JSON.parse(text);assert.deepEqual(Object.keys(source),['kind','model','readings','query']);
      assert.deepEqual(prepareThirdReceiverSource(source.readings,source.query),source);return{path,text,source};
    }
    await send('Page.navigate',{url:launcherUrl+'sky-boundary-evidence.html'});
    await until("Boolean(document.querySelector('a[href=\"sky-third-receiver.html\"]'))");
    assert.equal(await value("document.querySelector('a[href=\"sky-third-receiver.html\"]').target"),'_blank');const originalStorage=await stored();
    await send('Page.navigate',{url:launcherUrl+'sky-third-receiver.html'});await until("document.getElementById('third-example')?.disabled===false");
    await click('third-example');await state('compatible');await matches(reference.report);
    assert.equal(await value("document.querySelectorAll('#third-sources .source-card').length"),3);
    assert.equal(await value("document.querySelector('#third-sources [data-additional=true]').dataset.cell"),'1');
    assert.equal(await value("document.querySelectorAll('#third-results>.site-figure circle').length"),3);
    assert.match(await value("document.querySelector('#third-results .scope-notice').textContent"),/does not identify/);
    checks.push('Ordinary parent entry runs the real15-boundary3-receiver worker: first-two5 versus joint1, all15 retained, original roles and all3 mapped points visible');

    for(const scope of ['prior','joint'])for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']){
      const range=(scope==='prior'?reference.report.firstTwoRanges:reference.report.ranges)[store][bound];
      await value("document.querySelector('#third-results button[data-scope="+scope+"][data-store="+store+"][data-bound="+bound+"]').click()");
      assert.equal(await value("document.getElementById('third-detail').dataset.scope"),scope);
      assert.equal(Number(await value("document.getElementById('third-detail').dataset.split")),range.splitAfterInterval);
      assert.equal(Number(await value("document.getElementById('third-witness').dataset.witness")),range.witnessId);
    }
    await field('third-witness-select',2);await value("document.getElementById('third-witness-select').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
    assert.equal(await value("document.getElementById('third-witness').dataset.witness"),'30');
    const outside=reference.report.boundaries[7].firstTwo.witnesses.find(w=>w.originalReplays.some(p=>Object.values(p.originalObservationEndpointStatus).includes('outside-original-band')));assert.ok(outside);
    await field('third-select',7);await field('third-scope','prior');await field('third-witness-select',outside.id);
    assert.equal(await value("document.getElementById('third-replay-note').dataset.replay"),'outside-original-band');
    await field('third-select',8);await field('third-scope','joint');assert.equal(await value("document.getElementById('third-detail').dataset.status"),'incompatible');
    await field('third-scope','prior');assert.equal(await value("document.getElementById('third-detail').dataset.status"),'compatible');
    checks.push('All8 before/after extrema bind the exact scope,boundary,witness; keyboard selects noncontiguous2/30; original outside-band replay and a third-excluded prior-compatible boundary remain inspectable');

    const saved=await download('authored');assert.deepEqual(saved.source,raw);
    await send('Page.reload',{ignoreCache:true});await until("document.getElementById('third-example')?.disabled===false");
    await files('#third-reopen',[saved.path]);await state('compatible');await matches(reference.report);assert.equal(await stored(),originalStorage);
    checks.push('Actual source-only download reopens in a fresh document and recomputes the complete before/after inquiry with no saved derived results');

    await value("document.querySelector('#third-results button[data-scope=joint][data-store=subsurfaceC][data-bound=upper]').click()");
    for(const [width,height,mobile] of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(80);
      assert.ok(await value('document.documentElement.scrollWidth<=innerWidth+1'));
      if(width===390)assert.ok(await value("Array.from(document.querySelectorAll('.comparison-ranges .range-card strong')).every(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).fontSize)*1.8)"),'Range and unit stay together');
      for(const [id,label] of [['third-sources','originals'],['third-results','range'],['third-alternatives','alternatives'],['third-witness','witness']]){
        await value('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"start",behavior:"instant"})');
        await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/third-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    checks.push('Full15-alternative before/after ranges, source roles, all3point diagram and exact witness fit desktop/390px with units together');
    await value("window.retiredThirdExtreme=document.querySelector('#third-results button[data-scope=prior]');window.retiredThirdRole=document.querySelector('#third-sources button[data-added]')");

    const paths=independent.map((_,i)=>runDirectory+'/original-'+i+'.json');
    await Promise.all(paths.map((path,i)=>writeFile(path,JSON.stringify(independent[i]))));
    await files('#third-originals',paths);await state('inputs-ready');
    await value("(()=>{const e=document.querySelector('#third-sources input[value=\"1\"]');e.checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await field('third-splits','9, 8');await click('third-run');await state('compatible');await matches(reversed.report);
    assert.deepEqual((await download('reversed')).source.readings,reversed.investigation.readings);
    await value("document.querySelector('#third-sources button[data-added=\"0\"]').click()");await click('third-run');await state('compatible');await matches(roles.report);
    const changed=await download('changed-roles');assert.deepEqual(changed.source,roles.investigation);
    assert.deepEqual(changed.source.readings.map(i=>i.query.bins),[4,8,16]);assert.equal(changed.source.readings[2].query.reading.cellIndex,7);
    await value('window.retiredThirdExtreme.click();window.retiredThirdRole.click()');await matches(roles.report);
    await files('#third-reopen',[changed.path]);await state('compatible');await matches(roles.report);
    checks.push('Three actual files preserve4/16/8 histories; comparison reversal and explicit added-reading reassignment preserve source records and nonmonotone offers through actual save/reopen; detached old controls cannot alter newer results');

    const malformed=runDirectory+'/bad-original.json';await writeFile(malformed,JSON.stringify({...independent[2],report:{}}));
    await files('#third-originals',[paths[0],paths[1],malformed]);await state('file-refused');await matches(roles.report);
    await files('#third-originals',paths.slice(0,2));await state('file-refused');await matches(roles.report);
    const utf8=runDirectory+'/bad-utf8.json';await writeFile(utf8,Buffer.from([0xc3,0x28]));await files('#third-reopen',[utf8]);await state('file-refused');await matches(roles.report);
    await field('third-splits','8,,9');await click('third-run');await state('refused');
    assert.equal(await value("document.getElementById('third-results').hidden"),true);assert.equal(await value("document.getElementById('third-export').disabled"),true);
    await files('#third-reopen',[changed.path]);await state('compatible');await matches(roles.report);
    checks.push('Malformed member,incomplete triple and invalidUTF8 retain prior results; a missing interior offer refuses the whole new query');

    const slow=runDirectory+'/slow-third.json';await writeFile(slow,JSON.stringify(independent[2]));
    await value("window.thirdArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-third.json')return new Promise(resolve=>{window.releaseThirdFile=()=>window.thirdArrayBuffer.call(this).then(resolve)});return window.thirdArrayBuffer.call(this)}");
    await files('#third-originals',[paths[0],paths[1],slow]);await until("typeof window.releaseThirdFile==='function'");
    await field('third-splits','8');await click('third-run');await state('compatible');await matches(one.report);
    await value('window.releaseThirdFile()');await delay(100);await matches(one.report);await value('File.prototype.arrayBuffer=window.thirdArrayBuffer');
    checks.push('A delayed third original file cannot restore older roles or boundaries after a newer complete query');

    await value("window.thirdPost=Worker.prototype.postMessage;window.holdThird=true;Worker.prototype.postMessage=function(m,...a){if(window.holdThird&&m.operation==='prepare'){window.holdThird=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseThirdWorker=()=>handler(e)}}return window.thirdPost.call(this,m,...a)}");
    await click('third-run');await until("typeof window.releaseThirdWorker==='function'");
    const impossiblePath=runDirectory+'/impossible.json';await writeFile(impossiblePath,JSON.stringify(impossible));
    await files('#third-reopen',[impossiblePath]);await state('incompatible');await matches(empty.report);
    await value('window.releaseThirdWorker()');await delay(100);await matches(empty.report);await value('Worker.prototype.postMessage=window.thirdPost');
    assert.equal(await value("document.getElementById('third-export').disabled"),false);
    assert.deepEqual((await download('incompatible')).source,impossible);
    await field('third-scope','prior');assert.equal(await value("document.getElementById('third-detail').dataset.status"),'compatible');
    checks.push('A held old actual-worker result cannot replace a newer incompatible joint result; the compatible first-two family and all original source inputs remain inspectable/exportable');

    const mismatch=structuredClone(impossible);mismatch.readings[2].source.declaration.path.gridColumnBearingDeg+=1;
    const mismatchPath=runDirectory+'/mismatch.json',forged=runDirectory+'/forged.json';
    await writeFile(mismatchPath,JSON.stringify(mismatch));await writeFile(forged,JSON.stringify({...impossible,report:{}}));
    for(const path of [mismatchPath,forged]){await files('#third-reopen',[path]);await state('file-refused');await matches(empty.report);}
    await click('third-all');assert.equal(await value("document.getElementById('third-splits').value"),raw.query.splitAfterIntervals.join(', '));
    assert.equal(await value("document.getElementById('third-results').hidden"),true);assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
    checks.push('Mismatched third-source and forged-result files refuse; explicit offer-all invalidates prior output and ordinary working-project storage remains unchanged');
    return{checks,sandbox:session.sandbox,exceptions,launcher:{command:'python3 serve.py --port 0',url:launcherUrl,scope:'Every visible interaction and actual worker uses the unchanged documented loopback launcher.'}};
  });
  const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

import assert from 'node:assert/strict';
import {isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const root=process.argv[2];
if(!root || !isAbsolute(root)) throw Error('Supply repository absolute path');
const moduleAt=name=>import(pathToFileURL(join(root,name)).href);
const {withBrowserSession}=await moduleAt('tests/support/browser-session.mjs');
const {makeExample,validateProject}=await moduleAt('core.js');
const {serializePortableProject}=await moduleAt('project-portability.js');
const project=makeExample();
project.title='Authored maximum-grid latency fixture';
project.source='Synthetic benchmark geometry; not field evidence';
project.width=24;project.height=24;project.selectedIndex=0;
project.weather={...project.weather,durationMinutes:720,stepMinutes:1};
project.existing=Array.from({length:576},(_,i)=>({
  elevationM:Number((0.05+0.002*(23-Math.floor(i/24))).toFixed(3)),
  surface:i%24>=8 && i%24<=15?'sealed':'turf',provenance:'Authored benchmark assumption'
}));
project.proposal=project.existing.map((cell,i)=>({...cell,
  ...(i%24>=10 && i%24<=13?{surface:'garden',provenance:'Authored benchmark proposal'}:{})
}));
validateProject(project);
const bytes=serializePortableProject(project);
const sha=value=>createHash('sha256').update(value).digest('hex');
const sourceSha256=sha(bytes),projectBefore=JSON.stringify(project);
const labels=[];
for(let y=0;y<24 && labels.length<128;y++) for(let j=0;j<24 && labels.length<128;j++) {
  const x=y%2?23-j:j;labels.push(String.fromCharCode(65+x)+(y+1));
}
const runDirectory=join(root,'.browser-timed-route-latency-'+randomUUID());
await withBrowserSession({root,chromeBin:'/usr/bin/google-chrome',runDirectory,commandMs:120000},
async({send,evaluate,exceptions,sandbox,sandboxPath})=>{
  assert.equal(sandbox.admitted,true);
  assert.equal(sandbox.observation.active,true);
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<100;i++) {
    if(await evaluate("!!document.querySelector('#route-traversal-form')")) break;
    await delay(100);
  }
  assert.equal(await evaluate("!!document.querySelector('#route-traversal-form')"),true);
  // app.js uses #import, not #import-file. Exercise its genuine async handler.
  await evaluate(`(()=>{
    const bytes=${JSON.stringify(bytes)};
    window.routeLatencySourceFile=new File([bytes],'authored-latency-project.json',{type:'application/json'});
    const transfer=new DataTransfer();transfer.items.add(window.routeLatencySourceFile);
    const input=document.querySelector('#import');
    if(!input)throw Error('Maintained import input missing');
    input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  let imported;
  for(let i=0;i<300;i++) {
    imported=await evaluate(`({cells:document.querySelectorAll('#existing-grid .cell').length,
      horizon:Number(document.querySelector('#ponding-minute').max),notice:document.querySelector('#toast').textContent})`);
    if(imported.notice.includes('Import refused:')) throw Error(imported.notice);
    if(imported.cells===576 && imported.horizon===720 && imported.notice.includes('Validated project imported.')) break;
    await delay(100);
  }
  assert.equal(imported.cells,576);assert.equal(imported.horizon,720);
  assert.match(imported.notice,/Validated project imported\./);
  await evaluate(`(()=>{
    const threshold=document.querySelector('#ponding-threshold');threshold.value='1';
    threshold.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#route-ponding-cells').value=${JSON.stringify(labels.join(' '))};
    document.querySelector('#route-ponding-form').requestSubmit();
    document.querySelector('#route-traversal-steps').value='1';
    document.querySelector('#route-traversal-start').value='0';
    document.querySelector('#route-traversal-end').value='10';
  })()`);
  const sample=()=>evaluate(`(async()=>{
    const start=performance.now();
    document.querySelector('#route-traversal-form').requestSubmit();
    const synchronousMs=performance.now()-start;
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const nextAnimationFrameMs=performance.now()-start;
    return {synchronousMs,nextAnimationFrameMs,
      text:document.querySelector('#route-traversal-results').textContent,
      error:document.querySelector('#route-traversal-error').textContent,
      parentError:document.querySelector('#route-ponding-error').textContent};
  })()`);
  const first=await sample();
  function check(value) {
    assert.equal(value.error,'');assert.equal(value.parentError,'');
    assert.match(value.text,/Existing:/);assert.match(value.text,/Proposal:/);
    assert.equal(value.text,first.text,'stable displayed calculation');
  }
  check(first);
  const warmup=await sample();check(warmup);
  const measured=[];
  const count=Math.max(first.synchronousMs,warmup.synchronousMs)>1000?3:5;
  for(let i=0;i<count;i++){const value=await sample();check(value);measured.push(value);}
  const summarize=key=>{
    const values=measured.map(v=>v[key]),ordered=values.slice().sort((a,b)=>a-b);
    return {firstCallMs:first[key],warmupMs:warmup[key],medianMs:ordered[Math.floor(ordered.length/2)],maxMs:Math.max(...values),samplesMs:values};
  };
  assert.equal(sha(await evaluate('routeLatencySourceFile.text()')),sourceSha256,'original imported file bytes unchanged');
  assert.equal(JSON.stringify(project),projectBefore,'authored input object unchanged');
  assert.equal(sha(bytes),sourceSha256);
  assert.deepEqual(exceptions,[]);
  console.log(JSON.stringify({repository:root,runDirectory,sandboxPath,activeSandbox:true,
    sourceSha256,sourceBytesUnchanged:true,grid:[24,24],routeCells:128,horizonMinutes:720,
    stepMinutes:1,thresholdMm:1,departureRange:[0,10],repetitions:count,
    synchronousSubmit:summarize('synchronousMs'),submitToNextAnimationFrame:summarize('nextAnimationFrameMs'),
    displayedResults:first.text,exceptions,
    limitation:'Next animation-frame callback is a rendering-opportunity timing, not proof of completed paint. Import, solver generation and route setup excluded.'},null,2));
});

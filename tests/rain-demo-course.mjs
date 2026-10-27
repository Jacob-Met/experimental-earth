import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

export async function runCourtyardDemo({root,runDirectory,source,withBrowserSession,recordOwnedPage}) {
  const fast=process.env.EARTH_DEMO_FAST==='1';
  const sourceCommit=process.env.EARTH_DEMO_SOURCE_COMMIT;
  assert.match(sourceCommit??'',/^[0-9a-f]{40}$/,'Name the verified source commit');
  const demoSource='Fictional demonstration reading — authored, not field data';
  const key='experimental-earth-site-v1', cellIndex=27;
  const chromeBin=process.env.CHROME_BIN??'/opt/google/chrome/chrome';
  let downloadedPath,expectedProject,expectedMetrics;

  async function controls(session) {
    const {send,evaluate}=session;
    await send('Page.enable');await send('Runtime.enable');
    if(process.env.EARTH_DEMO_BASE_URL) {
      await send('Page.navigate',{url:process.env.EARTH_DEMO_BASE_URL});
      session.baseUrl=process.env.EARTH_DEMO_BASE_URL;
    }
    async function wait(expression,label) {
      for(let i=0;i<200;i++) {
        session.signal.throwIfAborted();
        try { if(await evaluate(expression))return; }
        catch(e) {if(!/context.*destroyed|Cannot find context|Cannot find default execution context/i.test(String(e)))throw e;}
        await delay(100,undefined,{signal:session.signal});
      }
      throw Error('Timed out: '+label);
    }
    await wait('location.href==='+JSON.stringify(session.baseUrl)+" && !!document.querySelector('#investigation-navigation') && document.querySelectorAll('#proposal-grid .cell').length===48",'complete maintained application at the actual launch origin');
    async function click(selector) {
      const point=await evaluate("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");if(!e)throw Error('Missing control');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    }
    async function type(selector,value) {
      await click(selector);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
      await send('Input.insertText',{text:String(value)});
      assert.equal(await evaluate('document.querySelector('+JSON.stringify(selector)+').value'),String(value));
    }
    async function select(selector,value) {
      await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');e.value='+JSON.stringify(value)+";e.dispatchEvent(new Event('change',{bubbles:true}));})()");
    }
    const scroll=selector=>evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+");window.scrollBy({top:e.getBoundingClientRect().top-24,behavior:'instant'});})()");
    async function frameReading() {
      const bounds=await evaluate("(()=>{const e=document.querySelector('#observation-list');window.scrollBy({top:e.getBoundingClientRect().top-240,behavior:'instant'});const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,text:e.innerText};})()");
      assert.ok(bounds.top>=120 && bounds.bottom<=760,'Retained notebook reading must remain fully in view');
      assert.ok(bounds.text.includes(demoSource) && bounds.text.includes('12.5'),'Frame the actual attributed reading');
      return {top:bounds.top,bottom:bounds.bottom};
    }
    const project=async()=>JSON.parse(await evaluate('localStorage.getItem('+JSON.stringify(key)+')'));
    const metrics=()=>evaluate("document.querySelector('#metrics').innerText");
    return {wait,click,type,select,scroll,frameReading,project,metrics};
  }

  const result=await withBrowserSession({root,chromeBin,runDirectory},async session=>{
    const {send,evaluate}=session;
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const ui=await controls(session);await ui.click('#reset');
    const original=await ui.project();
    assert.equal(original.width,8);assert.equal(original.height,6);
    assert.notEqual(original.existing[cellIndex].surface,'garden','D4 must be a meaningful authored change');
    assert.ok(!original.observations.some(o=>o.source===demoSource));
    const downloads=session.runDirectory+'/downloads';await mkdir(downloads);
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    await evaluate("window.scrollTo({top:0,behavior:'instant'})");
    const timeline=[],checks=[];
    const recorder=await recordOwnedPage(session,session.runDirectory+'/frames');
    let recording,copied,changed,originalMetrics;
    async function stage(id,label,action,seconds) {
      session.signal.throwIfAborted();
      timeline.push({id,atSeconds:recorder.seconds(),label});
      if(action)await action();
      await delay(seconds*1000*(fast?0.02:1),undefined,{signal:session.signal});
    }
    try {
      await stage('intro','Fictional courtyard and conceptual-model boundary',null,8);
      await stage('matched','Same starting geometry and hypothetical rain',async()=>{
        await ui.click('#copy-existing');copied=await ui.project();
        assert.deepEqual(copied.proposal,copied.existing);
        assert.deepEqual(copied.existing,original.existing);assert.deepEqual(copied.weather,original.weather);
        originalMetrics=await ui.metrics();await ui.scroll('#maps');
        checks.push({name:'Copied alternatives have identical original cells and weather'});
      },8);
      await stage('change','Change only proposed D4 to a hypothetical rain garden',async()=>{
        await ui.click('[data-brush="garden"]');await ui.click('#proposal-grid [data-cell-index="27"]');
        await ui.click('[data-brush="inspect"]');await ui.scroll('#maps');changed=await ui.project();
        assert.deepEqual(changed.existing,copied.existing);assert.deepEqual(changed.weather,copied.weather);
        const differences=changed.proposal.flatMap((cell,i)=>JSON.stringify(cell)!==JSON.stringify(copied.proposal[i])?[i]:[]);
        assert.deepEqual(differences,[cellIndex]);assert.equal(changed.proposal[cellIndex].surface,'garden');
        assert.ok(Number.isFinite(copied.proposal[cellIndex].elevationM));
        assert.deepEqual(changed.proposal[cellIndex],{...copied.proposal[cellIndex],surface:'garden',provenance:'manually edited hypothetical assumption'});
        assert.notEqual(await ui.metrics(),originalMetrics,'Actual displayed calculation must respond');
        checks.push({name:'Only proposed D4 changed; original site and rain preserved',before:copied.proposal[cellIndex],after:changed.proposal[cellIndex]});
      },10);
      await stage('consequences','Actual model quantities and water accounting',async()=>{
        await ui.scroll('#results-title');
        checks.push({name:'Actual comparison text',before:originalMetrics,after:await ui.metrics(),balance:await evaluate("document.querySelector('#balance').innerText")});
      },10);
      await stage('same-time','Both maps at one retained model time',async()=>{
        await ui.select('#map-view','snapshot');
        await evaluate("(async()=>{const {compare}=await import('./core.js');const p=JSON.parse(localStorage.getItem('experimental-earth-site-v1'));const snapshots=compare(p).existing.snapshots;const index=snapshots.findIndex(s=>s.minute===60);if(index<0)throw Error('No retained60minute snapshot');const e=document.querySelector('#map-snapshot-index');e.value=index;e.dispatchEvent(new Event('input',{bubbles:true}));})()");
        await ui.click('#existing-grid [data-cell-index="27"]');await ui.scroll('#maps');
        const times=await evaluate("({existing:document.querySelector('#existing-grid').dataset.minute,proposal:document.querySelector('#proposal-grid').dataset.minute,label:document.querySelector('#map-snapshot-time').innerText})");
        assert.equal(times.existing,times.proposal);assert.equal(Number(times.existing),60);
        checks.push({name:'Actual same-time maps',...times});
      },10);
      await stage('reading','Retain an explicitly fictional teaching observation',async()=>{
        await ui.scroll('#observations-title');
        await delay(fast?30:1500,undefined,{signal:session.signal});
        await ui.type('#obs-minute','60'); // Retarget before entering the new draft.
        await ui.type('#obs-depth','12.5');await ui.type('#obs-uncertainty','2');
        await ui.select('#obs-scenario','existing');await ui.select('#obs-use','challenge');
        await ui.type('#obs-source',demoSource);
        await ui.scroll('#observe-form');
        const before=await ui.project(),metricBefore=await ui.metrics();
        await delay(fast?50:2500,undefined,{signal:session.signal});
        await ui.click('#observe-form button[type="submit"]');
        const after=await ui.project();
        assert.equal(after.observations.length,before.observations.length+1);
        assert.deepEqual(after.observations.slice(0,-1),before.observations);
        assert.deepEqual(after.observations.at(-1),{cellIndex,minute:60,depthMm:12.5,uncertaintyMm:2,source:demoSource,scenario:'existing',use:'challenge'});
        assert.deepEqual({...after,observations:before.observations},before,'Notebook submission must not tune assumptions');
        assert.equal(await ui.metrics(),metricBefore);
        checks.push({name:'Actual retained reading framed in the viewport',...await ui.frameReading()});
        checks.push({name:'One explicitly fictional source-labelled reading; no parameter or model-result change',observation:after.observations.at(-1)});
      },14);
      await stage('export','Download the actual portable project and evidence',async()=>{
        await ui.click('#export');
        for(let i=0;i<100;i++){
          const name=(await readdir(downloads)).find(n=>n==='experimental-earth-site.json');
          if(name){downloadedPath=downloads+'/'+name;break;}
          await delay(100,undefined,{signal:session.signal});
        }
        assert.ok(downloadedPath,'Actual project download must finish');
        expectedProject=await ui.project();expectedMetrics=await ui.metrics();
        const downloaded=JSON.parse(await readFile(downloadedPath,'utf8'));
        for(const field of ['existing','proposal','weather','observations'])assert.deepEqual(downloaded[field],expectedProject[field],field);
        checks.push({name:'Real download retains exact scenario inputs and source-labelled reading',downloadedPath});
      },8);
    } finally {recording=await recorder.stop();}
    assert.deepEqual(session.exceptions,[]);
    const normalizedTimeline=timeline.map(t=>({...t,atSeconds:Math.max(0,t.atSeconds-recording.firstFrameSeconds)}));
    const receipt={status:fast?'PRIVATE_REHEARSAL_RECORDED_UNREVIEWED':'PRIVATE_RECORDED_UNREVIEWED',sourceCommit,source,timeline:normalizedTimeline,recording,checks,sandbox:session.sandbox,
      limits:['Authored conceptual-model example and conspicuously fictional teaching reading','No physical accuracy, cloud qualification or public deployment demonstrated','Actual controls operated through pointer, keyboard and DOM control events','Original JPEG viewport frames; editorial captions belong outside that viewport','Node frame-receipt timing retained; not fixed-rate renderer acquisition','Video encoding and independent visual review still required','Not published or submitted']};
    await writeFile(session.runDirectory+'/recording-receipt.json',JSON.stringify(receipt,null,2));
    return receipt;
  });

  const reopen=await withBrowserSession({root,chromeBin,runDirectory:runDirectory+'-reopen'},async session=>{
    const {send}=session;
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const ui=await controls(session);
    assert.ok(!(await ui.project()).observations.some(o=>o.source===demoSource),'New profile cannot inherit the demonstration');
    const recorder=await recordOwnedPage(session,session.runDirectory+'/frames');
    let recording,received,readingFrame;
    try {
    await delay(fast?50:1500,undefined,{signal:session.signal});
    const {root:dom}=await send('DOM.getDocument');
    const {nodeId}=await send('DOM.querySelector',{nodeId:dom.nodeId,selector:'#import'});
    await send('DOM.setFileInputFiles',{nodeId,files:[downloadedPath]});
    await ui.wait('JSON.parse(localStorage.getItem('+JSON.stringify(key)+')).observations.some(o=>o.source==='+JSON.stringify(demoSource)+')','Actual exported file imported');
    received=await ui.project();
    for(const field of ['existing','proposal','weather','observations'])assert.deepEqual(received[field],expectedProject[field],field);
    assert.equal(await ui.metrics(),expectedMetrics,'Fresh profile must recompute identical displayed quantities');
    await ui.scroll('#observations-title');
    await delay(fast?30:2000,undefined,{signal:session.signal});
    readingFrame=await ui.frameReading();
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(session.runDirectory+'/reopened-notebook.png',Buffer.from(shot.data,'base64'));
    await delay(fast?50:6500,undefined,{signal:session.signal});
    } finally {recording=await recorder.stop();}
    assert.deepEqual(session.exceptions,[]);
    return {status:'FRESH_PROFILE_EXPORT_REOPEN_PASSED',downloadedPath,receivedReading:received.observations.at(-1),sourceCommit,sandbox:session.sandbox,identicalDisplayedCalculation:true,readingFrame,recording};
  });
  await writeFile(runDirectory+'/reopen-receipt.json',JSON.stringify({...reopen.value,session:reopen.receipt},null,2));
  console.log(JSON.stringify({...result.value,session:result.receipt,reopen:{...reopen.value,session:reopen.receipt}},null,2));
}

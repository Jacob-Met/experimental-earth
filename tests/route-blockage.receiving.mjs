import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {withBrowserSession} from './support/browser-session.mjs';
import {compare,validateProject,makeExample} from '../core.js';
import {pondingExposure} from '../ponding-exposure.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const runDirectory=process.env.RECEIVING_OUTPUT_DIR || path.join(os.tmpdir(),'earth-route-blockage-'+randomUUID());
const chromeBin=process.env.CHROME_BIN || (process.platform==='darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/chromium');
const storageKey='experimental-earth-site-v1';
const num=value=>Number(value.toFixed(2)).toLocaleString('en-US');
const label=(index,width)=>String.fromCharCode(65+index%width)+(Math.floor(index/width)+1);

// Independent oracle: partition at all source endpoints and count the cells at
// each midpoint. Never import the production attribution algorithm.
function oracle(exposures,indices,start,end) {
  const cuts=[...new Set([start,end,...indices.flatMap(index=>exposures[index].intervals.flatMap(span=>[
    Math.max(start,Math.min(end,span.startMinute)),Math.max(start,Math.min(end,span.endMinute))
  ]))])].sort((a,b)=>a-b);
  const cells=indices.map((cellIndex,order)=>({cellIndex,order,minutesAbove:0,soleAboveMinutes:0}));
  let aboveMinutes=0,multipleAboveMinutes=0;
  for(let i=1;i<cuts.length;i++) {
    const duration=cuts[i]-cuts[i-1],mid=(cuts[i]+cuts[i-1])/2;
    const active=cells.filter(cell=>exposures[cell.cellIndex].intervals.some(span=>span.startMinute<mid && mid<span.endMinute));
    for(const cell of active)cell.minutesAbove+=duration;
    if(active.length)aboveMinutes+=duration;
    if(active.length===1)active[0].soleAboveMinutes+=duration;
    if(active.length>1)multipleAboveMinutes+=duration;
  }
  cells.sort((a,b)=>b.soleAboveMinutes-a.soleAboveMinutes || a.order-b.order);
  return {cells,aboveMinutes,multipleAboveMinutes,clearMinutes:end-start-aboveMinutes};
}
function expectations(project,indices,threshold) {
  const results=compare(validateProject(project));
  assert.ok(results.existing?.snapshots?.length>=2 && results.proposal?.snapshots?.length>=2);
  const start=results.existing.snapshots[0].minute,end=results.existing.snapshots.at(-1).minute;
  return Object.fromEntries(['existing','proposal'].map(key=>[key,oracle(pondingExposure(results[key],threshold),indices,start,end)]));
}
function chooseRoute(project,limits) {
  const results=compare(validateProject(project));
  const start=results.existing.snapshots[0].minute,end=results.existing.snapshots.at(-1).minute;
  const routes=[];
  for(let y=0;y<project.height;y++)for(let x=0;x<project.width;x++) {
    const index=y*project.width+x;
    if(x+2<project.width)routes.push([index,index+1,index+2]);
    if(y+2<project.height)routes.push([index,index+project.width,index+2*project.width]);
  }
  const positive=results.existing.snapshots.flatMap(s=>s.depthsMm).filter(value=>value>0).sort((a,b)=>a-b);
  const suggested=[0.1,0.5,1,2,3,5,10,20,30,50,...[0.1,0.25,0.5,0.75,0.9].map(q=>positive[Math.floor(q*(positive.length-1))])];
  const thresholds=[...new Set(suggested.filter(Number.isFinite).map(value=>Number(value.toFixed(3))))]
    .filter(value=>value>0 && value>=limits.min && value<=limits.max);
  let best=null;
  for(const threshold of thresholds) {
    const exposures={existing:pondingExposure(results.existing,threshold),proposal:pondingExposure(results.proposal,threshold)};
    for(const indices of routes) {
      const expected=Object.fromEntries(['existing','proposal'].map(key=>[key,oracle(exposures[key],indices,start,end)]));
      const values=Object.values(expected);
      const sole=values.reduce((sum,value)=>sum+value.cells.reduce((n,cell)=>n+cell.soleAboveMinutes,0),0);
      const shared=values.reduce((sum,value)=>sum+value.multipleAboveMinutes,0);
      const contrast=Math.abs(expected.existing.aboveMinutes-expected.proposal.aboveMinutes)+indices.reduce((sum,index)=>
        sum+Math.abs(expected.existing.cells.find(c=>c.cellIndex===index).soleAboveMinutes-
          expected.proposal.cells.find(c=>c.cellIndex===index).soleAboveMinutes),0);
      if(sole>0.02 && shared>0.02 && contrast>0.02) {
        const score=Math.min(sole,shared)+contrast;
        if(!best || score>best.score)best={indices,threshold,expected,score};
      }
    }
  }
  assert.ok(best,'Maintained example must provide a three-cell route with sole/shared duration and paired contrast.');
  return best;
}

const stages=[];
try {
 const receipt=await withBrowserSession({root,chromeBin,runDirectory},async session=>{
  const {baseUrl,send,evaluate,exceptions,sandbox,sandboxPath}=session;
  const ev=(fn,arg=null)=>evaluate('('+fn.toString()+')('+JSON.stringify(arg)+')');
  async function until(fn,arg,message) {
    for(let attempt=0;attempt<200;attempt++) {
      if(await ev(fn,arg))return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error(message);
  }
  async function key(key,code,windowsVirtualKeyCode) {
    await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,
      ...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
  }
  async function type(selector,text) {
    await ev(selector=>{const el=document.querySelector(selector);el.focus();el.select();},selector);
    await send('Input.insertText',{text});
  }
  async function click(selector) {
    const point=await ev(selector=>{const el=document.querySelector(selector);if(!el)throw Error('Missing click target');
      el.scrollIntoView({block:'center',behavior:'instant'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};},selector);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  }
  async function setThreshold(value) {
    await type('#ponding-threshold',String(value));await key('Tab','Tab',9);
    assert.equal(await ev(()=>Number(document.querySelector('#ponding-threshold').value)),value);
  }
  async function submitRoute(text) {await type('#route-ponding-cells',text);await key('Enter','Enter',13);}
  const readStored=()=>ev(key=>localStorage.getItem(key),storageKey);
  const readTables=()=>ev(()=>Object.fromEntries(['existing','proposal'].map(key=>{
    const table=document.querySelector('#route-blockage-'+key);
    return [key,table?{rows:[...table.querySelectorAll('tbody tr')].map(row=>[...row.children].map(cell=>cell.textContent)),
      columnScopes:[...table.querySelectorAll('thead th')].map(el=>el.scope),
      rowScopes:[...table.querySelectorAll('tbody th')].map(el=>el.scope),caption:table.caption?.textContent}:null];
  })));
  async function verify(expected,project,threshold,stage) {
    const actual=await readTables();
    const descriptions=await ev(()=>Array.from(document.querySelectorAll('#route-ponding-windows > details'),el=>el.textContent));
    assert.equal(descriptions.length,2,stage+' paired disclosures '+JSON.stringify(await ev(()=>({input:document.querySelector('#route-ponding-cells').value,error:document.querySelector('#route-ponding-error').textContent,active:document.activeElement?.id,valid:document.querySelector('#route-ponding-form').checkValidity()}))));
    for(const [position,scenario]of ['existing','proposal'].entries()) {
      const value=expected[scenario],wet=value.cells.filter(cell=>cell.minutesAbove>0);
      if(wet.length) {
        assert.ok(actual[scenario],stage+' '+scenario+' table missing');
        // Independent summation can reorder exact values differing only below
        // display precision. Check each displayed row and descending displayed rank.
        const rows=new Map(wet.map(cell=>[label(cell.cellIndex,project.width),
          [label(cell.cellIndex,project.width),num(cell.soleAboveMinutes),num(cell.minutesAbove)]]));
        assert.equal(actual[scenario].rows.length,rows.size);
        assert.equal(new Set(actual[scenario].rows.map(row=>row[0])).size,rows.size);
        for(const row of actual[scenario].rows)assert.deepEqual(row,rows.get(row[0]),stage+' '+scenario+' displayed attribution');
        const ranked=actual[scenario].rows.map(row=>Number(row[1].replaceAll(',','')));
        assert.ok(ranked.every((value,index)=>index===0 || value<=ranked[index-1]),stage+' descending sole duration');
        assert.deepEqual(actual[scenario].columnScopes,['col','col','col']);
        assert.ok(actual[scenario].rowScopes.every(scope=>scope==='row'));
        assert.ok(actual[scenario].caption.includes(num(threshold)+' mm'));
      } else assert.equal(actual[scenario],null,stage+' wholly dry table');
      assert.ok(descriptions[position].includes('Multiple route cells exceed together for '+num(value.multipleAboveMinutes)+' modeled min.'),stage+' shared duration');
      assert.ok(descriptions[position].includes('accounts for '+num(value.aboveMinutes)+' min'),stage+' any-cell duration');
      assert.ok(descriptions[position].includes('not measurements or a forecast'),stage+' evidence qualification');
    }
    stages.push({stage,threshold,expected,actual});return actual;
  }
  async function expandDisclosures() {
    for(let n=1;n<=2;n++) {
      const selector='#route-ponding-windows > details:nth-of-type('+n+')';
      if(!await ev(selector=>document.querySelector(selector).open,selector)) {
        await ev(selector=>{const summary=document.querySelector(selector+' > summary');summary.scrollIntoView({block:'center',behavior:'instant'});summary.focus();},selector);
        await key('Enter','Enter',13);
      }
      await until(selector=>document.querySelector(selector)?.open,selector,'Native keyboard disclosure did not open.');
    }
  }
  async function capture(name,width) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    await expandDisclosures();
    const bounds=await ev(()=>{
      const panel=document.querySelector('#route-ponding-review');panel.scrollIntoView({block:'start',behavior:'instant'});
      const r=panel.getBoundingClientRect();return {clip:{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1},
        left:r.left,right:r.right,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
        clientWidth:panel.clientWidth,scrollWidth:panel.scrollWidth,
        tables:[...panel.querySelectorAll('table')].map(el=>{const t=el.getBoundingClientRect();return {left:t.left,right:t.right,width:t.width};})};
    });
    assert.ok(bounds.documentWidth<=bounds.viewport+1,name+' document fits viewport');
    assert.ok(bounds.left>=-1 && bounds.right<=bounds.viewport+1,name+' panel fits viewport');
    assert.ok(bounds.scrollWidth<=bounds.clientWidth+1,name+' panel has no horizontal overflow');
    for(const table of bounds.tables)assert.ok(table.left>=bounds.left-1 && table.right<=bounds.right+1,name+' table fits panel');
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:bounds.clip});
    const filename=path.join(runDirectory,name+'.png');await fs.writeFile(filename,Buffer.from(screenshot.data,'base64'));
    return {filename,...bounds};
  }
  async function captureVisibleTable(scenario) {
    const selector='#route-blockage-'+scenario;
    await ev(selector=>document.querySelector(selector).scrollIntoView({block:'center',behavior:'instant'}),selector);
    const visible=await ev(selector=>{
      const table=document.querySelector(selector),r=table.getBoundingClientRect();
      const cells=[...table.querySelectorAll('th,td')].map(cell=>{
        const c=cell.getBoundingClientRect(),x=c.left+c.width/2,y=c.top+c.height/2;
        return {text:cell.textContent,within:y>=0 && y<=innerHeight,
          unobscured:cell.contains(document.elementFromPoint(x,y))};
      });
      return {viewport:innerWidth,open:table.closest('details').open,cells,
        clip:{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}};
    },selector);
    assert.equal(visible.viewport,390);assert.equal(visible.open,true);
    assert.ok(visible.cells.every(cell=>cell.within && cell.unobscured),'Every narrow table cell can be read without a fixed control covering it.');
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:visible.clip});
    const filename=path.join(runDirectory,'route-blockage-narrow-'+scenario+'.png');
    await fs.writeFile(filename,Buffer.from(shot.data,'base64'));return {filename,...visible};
  }
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:baseUrl});
  await until(key=>document.readyState==='complete' && !!document.querySelector('#route-ponding-form') && !!localStorage.getItem(key),
    storageKey,'Maintained app did not initialize its route panel and stored example.');
  const originalStored=await readStored(),project=validateProject(JSON.parse(originalStored));
  const limits=await ev(()=>{const el=document.querySelector('#ponding-threshold');return {min:Number(el.min)||0,max:Number(el.max)||1000,step:el.step};});
  assert.equal(limits.step,'any','Receiver expects the maintained arbitrary-resolution threshold control.');
  const choice=chooseRoute(project,limits),routeText=choice.indices.map(index=>label(index,project.width)).join(' ');
  await type('#investigation-search','route');await key('Enter','Enter',13);
  await until(()=>location.hash==='#route-ponding-review' && document.activeElement===document.querySelector('#route-ponding-review h2'),
    null,'Keyboard search did not reach and focus maintained route entry.');
  await setThreshold(choice.threshold);await submitRoute(routeText);
  await verify(choice.expected,project,choice.threshold,'initial paired route');
  const desktop=await capture('route-blockage-desktop',1280),narrow=await capture('route-blockage-narrow',390);
  const narrowTables=[];for(const scenario of ['existing','proposal'])narrowTables.push(await captureVisibleTable(scenario));
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  const changedThreshold=Number(Math.min(limits.max,choice.threshold*1.7+0.1).toFixed(6));
  assert.notEqual(changedThreshold,choice.threshold);
  await setThreshold(changedThreshold);
  await verify(expectations(project,choice.indices,changedThreshold),project,changedThreshold,'threshold change');
  await setThreshold(choice.threshold);
  const beforeReplay=await verify(choice.expected,project,choice.threshold,'threshold restored');
  await ev(()=>document.querySelector('#ponding-minute').focus());await key('End','End',35);
  const replayMinute=await ev(()=>Number(document.querySelector('#ponding-minute').value));
  assert.equal(replayMinute,project.weather.durationMinutes,'Keyboard reaches the modeled horizon.');
  const currentMinuteText=await ev(()=>document.querySelector('#route-ponding-now').textContent);
  assert.ok(currentMinuteText.includes('at '+num(replayMinute)+' min:'),currentMinuteText);
  assert.deepEqual(await readTables(),beforeReplay,'Replay-only input must preserve whole-event attribution.');
  assert.equal(await readStored(),originalStored,'Search, route, threshold and replay queries must not edit source evidence.');

  await click('#copy-existing');
  await until(arg=>localStorage.getItem(arg.key)!==arg.original,{key:storageKey,original:originalStored},'Copy-existing did not persist a changed proposal.');
  const copiedProject=validateProject(JSON.parse(await readStored()));
  const copiedThreshold=await ev(()=>Number(document.querySelector('#ponding-threshold').value));
  const copiedExpected=expectations(copiedProject,choice.indices,copiedThreshold);
  const copiedTables=await verify(copiedExpected,copiedProject,copiedThreshold,'copy-existing rerun');
  assert.deepEqual(copiedExpected.existing,copiedExpected.proposal);
  assert.deepEqual(copiedTables.existing,copiedTables.proposal);
  await submitRoute('A1 C1');
  assert.ok(await ev(()=>document.querySelector('#route-ponding-error').textContent.length>0));
  assert.deepEqual(await readTables(),{existing:null,proposal:null});
  assert.equal(await ev(()=>document.querySelector('#route-ponding-windows').textContent),'');
  await submitRoute(routeText);await verify(copiedExpected,copiedProject,copiedThreshold,'invalid-route recovery');

  const smaller=structuredClone(makeExample());
  smaller.width=2;smaller.height=2;smaller.selectedIndex=0;smaller.observations=[];
  smaller.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'authored receiving control'}));
  smaller.proposal=structuredClone(smaller.existing);validateProject(smaller);
  const fixturePath=path.join(runDirectory,'route-blockage-small-site.json');
  await fs.writeFile(fixturePath,JSON.stringify(smaller,null,2));
  const documentNode=await send('DOM.getDocument',{depth:0});
  const importNode=await send('DOM.querySelector',{nodeId:documentNode.root.nodeId,selector:'#import'});
  assert.ok(importNode.nodeId);await send('DOM.setFileInputFiles',{nodeId:importNode.nodeId,files:[fixturePath]});
  await until(key=>{const p=JSON.parse(localStorage.getItem(key));return p?.width===2 && p?.height===2;},storageKey,'Native file import did not replace project.');
  assert.ok(await ev(()=>document.querySelector('#route-ponding-error').textContent.length>0),'Grid shrink invalidates the declared route.');
  assert.deepEqual(await readTables(),{existing:null,proposal:null});
  assert.equal(await ev(()=>document.querySelector('#route-ponding-windows').textContent),'');
  const importedProject=validateProject(JSON.parse(await readStored()));
  await submitRoute('A1 B1');
  const importedThreshold=await ev(()=>Number(document.querySelector('#ponding-threshold').value));
  await verify(expectations(importedProject,[0,1],importedThreshold),importedProject,importedThreshold,'grid-import recovery');
  const modules=await ev(()=>Promise.all(['route-blockage.js','route-ponding-panel.js','ponding-exposure.js'].map(async name=>{
    const response=await fetch(new URL(name,location.href));return {name,status:response.status,type:response.headers.get('content-type')};
  })));
  assert.ok(modules.every(module=>module.status===200));
  assert.deepEqual(exceptions,[]);
  return {status:'passed',baseUrl,sandbox,sandboxPath,routeText,threshold:choice.threshold,stages,desktop,narrow,narrowTables,replayMinute,modules,exceptions,
    checks:['keyboard navigation and route submission','independent sole/shared duration oracle','threshold refresh','keyboard replay isolation',
      'query controls preserve source','actual copy-existing rerun','invalid route recovery','native file-import invalidation and recovery',
      'desktop and 390px layout','delivered module responses','no page exceptions']};
 });
 await fs.writeFile(path.join(runDirectory,'route-blockage-receipt.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify({status:'passed',runDirectory,receipt},null,2));
} catch(error) {
 await fs.mkdir(runDirectory,{recursive:true});
 await fs.writeFile(path.join(runDirectory,'route-blockage-failure.json'),JSON.stringify({error:String(error),stack:error.stack,stages,receipt:error.receipt},null,2));
 throw error;
}

import assert from 'node:assert/strict';
import {withBrowserSession} from './support/browser-session.mjs';
import {rawDepth,oracle} from './support/route-traversal-oracle.mjs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-departure-inspection-'+randomUUID();
const outcomes=[];
const fmt=n=>n.toLocaleString('en-US',{maximumSignificantDigits:6,useGrouping:false});
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/usr/bin/google-chrome',runDirectory},
async({send,evaluate,exceptions})=>{
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<100;i++) {
    if(await evaluate("!!document.querySelector('#route-traversal-form')")) break;
    await delay(100);
  }
  assert.equal(await evaluate("!!document.querySelector('#route-traversal-form')"),true);
  const read=()=>evaluate(`(()=>{
    const section=document.querySelector('#route-traversal-inspection');
    const result=document.querySelector('#route-traversal-inspection-results');
    return {comparison:document.querySelector('#route-traversal-results').textContent,
      comparisonError:document.querySelector('#route-traversal-error').textContent,
      inputs:['route-traversal-steps','route-traversal-start','route-traversal-end'].map(id=>document.getElementById(id).value),
      visible:!!section&&!section.hidden&&getComputedStyle(section).display!=='none',
      error:document.querySelector('#route-traversal-inspection-error')?.textContent||'',
      text:result?.textContent||'',
      tables:[...(result?.querySelectorAll('table[data-scenario]')||[])].map(table=>({
        scenario:table.dataset.scenario,headers:[...table.querySelectorAll('thead th')].map(x=>x.textContent),
        rows:[...table.querySelectorAll('tr[data-cell-index]')].map(row=>({
          cell:Number(row.dataset.cellIndex),position:Number(row.dataset.routePosition),
          values:[...row.children].map(x=>x.textContent),titles:[...row.children].map(x=>x.title),text:row.textContent
        }))
      }))};
  })()`);
  const compare=async(steps,from,until)=>evaluate(`(()=>{
    document.querySelector('#route-traversal-steps').value=${JSON.stringify(steps)};
    document.querySelector('#route-traversal-start').value=${JSON.stringify(String(from))};
    document.querySelector('#route-traversal-end').value=${JSON.stringify(String(until))};
    document.querySelector('#route-traversal-form').requestSubmit();
  })()`);
  const inspect=minute=>evaluate(`(()=>{
    document.querySelector('#route-traversal-departure').value=${JSON.stringify(String(minute))};
    document.querySelector('#route-traversal-inspection-form').requestSubmit();
  })()`);
  const route=text=>evaluate(`(()=>{
    document.querySelector('#route-ponding-cells').value=${JSON.stringify(text)};
    document.querySelector('#route-ponding-form').requestSubmit();
  })()`);
  function verifyRows(view,models,indices,steps,departure,threshold,width) {
    assert.equal(view.error,'');assert.equal(view.tables.length,2);
    for(const key of ['existing','proposal']) {
      const table=view.tables.find(t=>t.scenario===key);assert.ok(table);
      assert.equal(table.headers.length,4);assert.match(table.headers[0],/Cell/i);
      assert.match(table.headers[1],/Arrival/i);assert.match(table.headers[2],/Depth/i);
      assert.match(table.headers[3],/Threshold/i);
      assert.equal(table.rows.length,indices.length);
      let firstFailure=-1;
      indices.forEach((cell,k)=>{
        const minute=departure+steps.slice(0,k).reduce((a,b)=>a+b,0);
        const depth=rawDepth(models[key],cell,minute),row=table.rows[k];
        const label=String.fromCharCode(65+cell%width)+(1+Math.floor(cell/width));
        assert.equal(row.cell,cell);assert.equal(row.position,k);assert.equal(row.values.length,4);
        assert.equal(row.values[0],label);assert.equal(row.values[1],fmt(minute));assert.equal(row.values[2],fmt(depth));
        assert.equal(row.titles[1],String(minute));assert.equal(row.titles[2],String(depth));
        assert.match(row.values[3],depth>threshold?/Above/:/At\/below/);
        if(depth>threshold&&firstFailure<0)firstFailure=k;
      });
      if(firstFailure>=0) assert.match(table.rows[firstFailure].text,/first.*exceedance/i);
      assert.equal(table.rows.filter(row=>/first.*exceedance/i.test(row.text)).length,
        firstFailure>=0?1:0,'exactly one first marker when any arrival exceeds');
    }
  }
  // Actual maintained entry, explicitly reset to the exact default example.
  const maintained=await evaluate(`(async()=>{
    document.querySelector('#reset').click();
    const {makeExample,compare}=await import('./core.js');
    const project=makeExample();return {project,models:compare(project)};
  })()`);
  await route('D3 E3 F3');await compare('1',0,30);
  const mainBefore=await read();assert.equal(mainBefore.comparisonError,'');assert.equal(mainBefore.visible,true);
  await inspect(10);
  const main=await read();verifyRows(main,maintained.models,[19,20,21],[1,1],10,
    await evaluate("Number(document.querySelector('#ponding-threshold').value)"),8);
  assert.equal(main.comparison,mainBefore.comparison);
  const screenshots={};
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='mobile'});
    await evaluate("(()=>{const r=document.querySelector('#route-traversal-inspection').getBoundingClientRect();window.scrollTo({top:Math.max(0,scrollY+r.top-8),left:0,behavior:'instant'});})()");
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const dimensions=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
    assert.ok(dimensions.scroll<=dimensions.width+1,JSON.stringify(dimensions));
    const region=await evaluate("(()=>{const r=document.querySelector('#route-traversal-inspection').getBoundingClientRect();return {top:r.top,x:scrollX+r.left,y:scrollY+r.top,width:r.width,height:r.height};})()");
    assert.ok(region.top>=0&&region.top<height,'inspection screenshot starts within viewport');
    const {top,...clip}=region;
    const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...clip,scale:1}});
    const path=runDirectory+'/inspection-'+name+'.png';await writeFile(path,Buffer.from(capture.data,'base64'));screenshots[name]=path;
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  outcomes.push({input:'real maintained entry exact arrival rows; desktop and 390px',screenshots,pass:true});

  const series=(times,cells)=>({snapshots:times.map((minute,j)=>({minute,depthsMm:cells.map(c=>c[j])}))});
  const base=series([0,10,20,30],[[0,0,0,0],[0,2,0,0],[0,0,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  const mount=async(model,routeText='A1 B1 C1',dimensions={width:3,height:2})=>{
    await evaluate(`(async()=>{
      const {mountRoutePondingPanel}=await import('./route-ponding-panel.js');
      document.body.innerHTML='<main><section id="ponding-replay"><input id="ponding-minute" value="0"><input id="ponding-threshold" value="1"></section></main>';
      const models={existing:${JSON.stringify(model)},proposal:${JSON.stringify(model)}};
      const project=${JSON.stringify(dimensions)};
      window.inspectionFixture={models,project,before:JSON.stringify({models,project})};
      inspectionFixture.panel=mountRoutePondingPanel({getProject:()=>project,getResults:()=>models});
    })()`);
    await route(routeText);
  };
  await mount(base);assert.equal((await read()).tables.length,0);
  await compare('2, 3',0,25);
  const committed=await read();assert.equal(committed.visible,true);
  assert.deepEqual(oracle(base,[0,1,2],[2,3],1,0,25),[{startMinute:0,endMinute:3},{startMinute:20,endMinute:25}]);
  assert.match(committed.comparison,/Depart 20–25 min/);
  for(const departure of [20.5,18,12]) {
    await inspect(departure);const view=await read();
    verifyRows(view,{existing:base,proposal:base},[0,1,2],[2,3],departure,1,3);
    assert.equal(view.comparison,committed.comparison);assert.deepEqual(view.inputs,committed.inputs);
  }
  outcomes.push({input:'inside-window20.5; failing18; two failures12 use original comparison',pass:true});

  // Real keyboard editing and Enter submit, not synthetic submit only.
  await evaluate("document.querySelector('#route-traversal-departure').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
  await send('Input.insertText',{text:'20.5'});
  const keyboardReady=await evaluate(`(()=>{
    const input=document.querySelector('#route-traversal-departure');
    window.inspectionKeyboardEvents=[];
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter')inspectionKeyboardEvents.push({type:event.type,trusted:event.isTrusted});
    });
    document.querySelector('#route-traversal-inspection-form').addEventListener('submit',event=>
      inspectionKeyboardEvents.push({type:event.type,trusted:event.isTrusted}));
    return {focused:document.activeElement===input,value:input.valueAsNumber,valid:input.validity.valid};
  })()`);
  assert.deepEqual(keyboardReady,{focused:true,value:20.5,valid:true});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.deepEqual(await evaluate('inspectionKeyboardEvents'),[
    {type:'keydown',trusted:true},{type:'submit',trusted:true}
  ],'real trusted Enter submits the focused valid departure');
  verifyRows(await read(),{existing:base,proposal:base},[0,1,2],[2,3],20.5,1,3);
  outcomes.push({input:'keyboard departure and Enter submission',pass:true});

  await evaluate("(()=>{document.querySelector('#route-traversal-steps').value='9';document.querySelector('#route-traversal-start').value='7';document.querySelector('#route-traversal-end').value='8';})()");
  await inspect(20.5);let view=await read();
  verifyRows(view,{existing:base,proposal:base},[0,1,2],[2,3],20.5,1,3);
  assert.deepEqual(view.inputs,['9','7','8']);assert.equal(view.comparison,committed.comparison);
  outcomes.push({input:'unsubmitted comparison drafts ignored and preserved',pass:true});

  const beforeInvalidRange=await read();
  await evaluate("(()=>{document.querySelector('#route-traversal-start').value='';document.querySelector('#route-traversal-form').requestSubmit();})()");
  view=await read();
  assert.equal(view.comparison,beforeInvalidRange.comparison);
  assert.deepEqual(view.tables,beforeInvalidRange.tables);
  assert.match(view.comparisonError,/Timing changes were not compared\. Previous results remain in view\./);
  await compare('2, 3',0,25);
  assert.equal((await read()).tables.length,0,'restored valid comparison clears selected point');
  await inspect(20.5);
  outcomes.push({input:'native-invalid range preserves prior evidence with explicit warning; valid comparison resets',pass:true});

  // Both invalid interior-query range and recovery, without stale rows.
  await inspect(26);view=await read();
  assert.equal(view.tables.length,0);assert.ok(view.error.length>0);
  await inspect(20.5);verifyRows(await read(),{existing:base,proposal:base},[0,1,2],[2,3],20.5,1,3);
  outcomes.push({input:'outside committed range refusal and recovery',pass:true});

  await compare('2, 3',0,25);assert.equal((await read()).tables.length,0,'new comparison clears point evidence');
  await inspect(18);
  await evaluate("(()=>{const x=document.querySelector('#ponding-threshold');x.value='2';x.dispatchEvent(new Event('change',{bubbles:true}));})()");
  view=await read();
  if(view.tables.length)verifyRows(view,{existing:base,proposal:base},[0,1,2],[2,3],18,2,3);
  else assert.equal(view.text,'','refresh clears stale evidence');
  await route('C1 B1 A1');view=await read();assert.equal(view.tables.length,0);assert.equal(view.visible,false);
  outcomes.push({input:'new comparison and route reset; threshold refresh no stale evidence',pass:true});

  await mount(base);await compare('2, 3',0,25);await inspect(20.5);
  assert.equal(await evaluate('JSON.stringify({models:inspectionFixture.models,project:inspectionFixture.project})===inspectionFixture.before'),true);
  await evaluate("(()=>{inspectionFixture.models.proposal.snapshots[3].minute=31;inspectionFixture.panel.refresh();})()");
  view=await read();assert.equal(view.tables.length,0,'mismatched horizon removes evidence');
  await evaluate("(()=>{inspectionFixture.models.proposal.snapshots[3].minute=30;inspectionFixture.panel.refresh();})()");
  await inspect(20.5);verifyRows(await read(),{existing:base,proposal:base},[0,1,2],[2,3],20.5,1,3);
  assert.equal(await evaluate('JSON.stringify({models:inspectionFixture.models,project:inspectionFixture.project})===inspectionFixture.before'),true);
  outcomes.push({input:'source horizon refusal/recovery and fixture custody',pass:true});

  const dry=series([0,10,20],Array.from({length:6},()=>[0,0,0]));
  await mount(dry,'A1 B1');await compare('5',0,15);await inspect(15);
  verifyRows(await read(),{existing:dry,proposal:dry},[0,1],[5],15,1,3);
  outcomes.push({input:'inclusive comparison end15 reaches final retained instant20',pass:true});

  const sharp=series([0,1,2],[[0,0,0],[0,6,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]]);
  await mount(sharp,'A1 B1');await compare('0.01',0,1.99);
  for(const departure of [.16,1.82]) {
    await inspect(departure);view=await read();
    verifyRows(view,{existing:sharp,proposal:sharp},[0,1],[.01],departure,1,3);
    assert.match(view.text,/1\.02/);
  }
  outcomes.push({input:'rounded window endpoints .16 and1.82 are tested exactly and exceed1mm',pass:true});

  const equality=series([0,5,10,15],[[2,1,0,0],[0,0,1,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]);
  await mount(equality,'A1 B1');await compare('5',0,10);
  assert.match((await read()).comparison,/No positive-duration/);
  await inspect(5);verifyRows(await read(),{existing:equality,proposal:equality},[0,1],[5],5,1,3);
  assert.equal(await evaluate('JSON.stringify({models:inspectionFixture.models,project:inspectionFixture.project})===inspectionFixture.before'),true);
  outcomes.push({input:'isolated equality departure inspectable without positive-duration interval',pass:true});

  const longIndices=[];
  for(let y=0;y<24&&longIndices.length<128;y++)for(let j=0;j<24&&longIndices.length<128;j++)
    longIndices.push(y*24+(y%2?23-j:j));
  const longLabels=longIndices.map(i=>String.fromCharCode(65+i%24)+(1+Math.floor(i/24))).join(' ');
  const longDry=series([0,200],Array.from({length:576},()=>[0,0]));
  await mount(longDry,longLabels,{width:24,height:24});await compare('1',0,10);await inspect(5);
  verifyRows(await read(),{existing:longDry,proposal:longDry},longIndices,Array(127).fill(1),5,1,24);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  const region=await evaluate(`(()=>{
    const x=document.querySelector('#route-traversal-inspection-results [role="region"]');
    const r=x.getBoundingClientRect();window.scrollTo({top:Math.max(0,scrollY+r.top-8),left:0,behavior:'instant'});x.focus({preventScroll:true});
    return {clientHeight:x.clientHeight,scrollHeight:x.scrollHeight,tabIndex:x.tabIndex,
      width:innerWidth,documentWidth:document.documentElement.scrollWidth};
  })()`);
  assert.equal(region.tabIndex,0);assert.ok(region.scrollHeight>region.clientHeight);
  assert.ok(region.clientHeight<=500,'arrival evidence has bounded height');
  assert.ok(region.documentWidth<=region.width+1,'large route remains within390px');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35,modifiers:2});
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.ok(await evaluate("document.querySelector('#route-traversal-inspection-results [role=region]').scrollTop>0"),'keyboard scroll reaches later arrival rows');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  outcomes.push({input:'maximum128arrival rows in bounded390px keyboard-scrollable evidence',pass:true});
  assert.deepEqual(exceptions,[]);outcomes.push({input:'browser exceptions',pass:true});
});
console.log(JSON.stringify({pass:outcomes.length,outcomes,runDirectory},null,2));

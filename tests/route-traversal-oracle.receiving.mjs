import assert from 'node:assert/strict';
import {withBrowserSession} from './support/browser-session.mjs';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {oracle} from './support/route-traversal-oracle.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-timed-route-oracle-'+randomUUID();
const outcomes=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/usr/bin/google-chrome',runDirectory},async({send,evaluate,exceptions})=>{
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<60;i++) {
    if(await evaluate("!!document.querySelector('#route-traversal-form')")) break;
    await delay(140);
  }
  assert.equal(await evaluate("!!document.querySelector('#route-traversal-form')"),true,'maintained application mounts traversal');
  outcomes.push({input:'maintained index entry mounts traversal',pass:true});

  // Restore the fictional example through the maintained application control. Compare
  // its rendered traversal with a raw-snapshot partition oracle, independently
  // of both pondingExposure and timedRouteWindows.
  const maintained=await evaluate(`(async()=>{
    const {makeExample,compare}=await import('./core.js');
    document.querySelector('#reset').click();
    const project=makeExample(),results=compare(project);
    const route=[2*project.width+3,2*project.width+4,2*project.width+5];
    const until=Math.min(30,results.existing.snapshots.at(-1).minute-2);
    const threshold=document.querySelector('#ponding-threshold');
    threshold.value='20';threshold.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#route-ponding-cells').value='D3 E3 F3';
    document.querySelector('#route-ponding-form').requestSubmit();
    document.querySelector('#route-traversal-steps').value='1';
    document.querySelector('#route-traversal-start').value='0';
    document.querySelector('#route-traversal-end').value=String(until);
    document.querySelector('#route-traversal-form').requestSubmit();
    const compact=result=>({snapshots:result.snapshots.map(row=>({minute:row.minute,depthsMm:route.map(i=>row.depthsMm[i])}))});
    return {existing:compact(results.existing),proposal:compact(results.proposal),until,
      text:document.querySelector('#route-traversal-results').textContent,
      items:[...document.querySelectorAll('#route-traversal-results li')].map(n=>n.textContent),
      error:document.querySelector('#route-traversal-error').textContent};
  })()`);
  assert.equal(maintained.error,'');assert.ok(maintained.until>0);
  const formatted=value=>Number(value.toFixed(2)).toLocaleString('en-US');
  const expectedItems=[],totals={};
  for(const [key,label] of [['existing','Existing'],['proposal','Proposal']]) {
    const windows=oracle(maintained[key],[0,1,2],[1,1],20,0,maintained.until);
    totals[key]=windows.reduce((sum,w)=>sum+w.endMinute-w.startMinute,0);
    assert.ok(totals[key]>0 && totals[key]<maintained.until,label+' has a nonempty, partially constrained departure window');
    assert.ok(maintained.text.includes(label+': '+formatted(totals[key])+' modeled departure minutes in '+windows.length+' continuous qualifying interval(s).'),maintained.text);
    expectedItems.push(...windows.map(w=>'Depart '+formatted(w.startMinute)+'–'+formatted(w.endMinute)+' min.'));
  }
  assert.deepEqual(maintained.items,expectedItems);
  const maintainedDelta=totals.proposal-totals.existing;
  assert.ok(maintainedDelta>0,'maintained example has a positive proposal difference');
  assert.ok(maintained.text.includes('Proposal minus existing: '+(maintainedDelta>0?'+':'')+formatted(maintainedDelta)+' modeled departure minutes'),maintained.text);
  outcomes.push({input:'maintained example raw-snapshot oracle versus rendered values',totals,delta:maintainedDelta,pass:true});

  const screenshots={},screenshotRegions={};
  for(const [label,width,height,mobile] of [['desktop',1440,1100,false],['mobile',390,1100,true]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    await evaluate("(()=>{const rect=document.querySelector('#route-traversal-review').getBoundingClientRect();window.scrollTo({top:Math.max(0,scrollY+rect.top-8),left:0,behavior:'instant'});})()");
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const dimensions=await evaluate(`(()=>{
      const rect=document.querySelector('#route-traversal-review').getBoundingClientRect();
      return {inner:innerWidth,viewportHeight:innerHeight,doc:document.documentElement.scrollWidth,
        targetTop:rect.top,clip:{x:rect.left+scrollX,y:rect.top+scrollY,width:rect.width,height:rect.height,scale:1}};
    })()`);
    assert.equal(dimensions.inner,width,label+' viewport');
    assert.ok(dimensions.doc<=dimensions.inner+1,JSON.stringify({label,...dimensions}));
    assert.ok(Number.isFinite(dimensions.targetTop) && dimensions.targetTop>=0 && dimensions.targetTop<dimensions.viewportHeight,label+' traversal top must be inside viewport: '+JSON.stringify(dimensions));
    const clip=dimensions.clip;
    assert.ok(Object.values(clip).every(Number.isFinite) && clip.x>=0 && clip.y>=0 && clip.width>0 && clip.height>0,label+' finite positive capture region: '+JSON.stringify(clip));
    const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
    screenshots[label]=runDirectory+'/maintained-traversal-'+label+'.png';
    screenshotRegions[label]=clip;
    await writeFile(screenshots[label],Buffer.from(capture.data,'base64'),{flag:'wx'});
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await evaluate("window.scrollTo({top:0,left:0,behavior:'instant'})");
  outcomes.push({input:'maintained traversal desktop and 390px receiving',screenshots,screenshotRegions,pass:true});

  // Mount the maintained parent and child panels, with independent analytic
  // replay data. B is above 1 mm strictly between minutes 5 and 15. A/C and
  // the proposal stay dry. No production window calculation is used as oracle.
  await evaluate(`(async()=>{
    const {mountRoutePondingPanel}=await import('./route-ponding-panel.js');
    document.body.innerHTML='<main><section id="ponding-replay"><input id="ponding-minute" value="0"><input id="ponding-threshold" value="1"></section></main>';
    const project={width:3,height:2};
    const results={
      existing:{snapshots:[0,10,20].map((minute,i)=>({minute,depthsMm:[0,[0,2,0][i],0,0,0,0]}))},
      proposal:{snapshots:[0,10,20].map(minute=>({minute,depthsMm:[0,0,0,0,0,0]}))}
    };
    window.traversalOracle={project,results,before:JSON.stringify({project,results})};
    window.traversalOracle.panel=mountRoutePondingPanel({getProject:()=>project,getResults:()=>results});
  })()`);
  const submitRoute=async value=>evaluate(`(()=>{
    document.querySelector('#route-ponding-cells').value=${JSON.stringify(value)};
    document.querySelector('#route-ponding-form').requestSubmit();
  })()`);
  const submitTiming=async(steps,from=0,until=10)=>evaluate(`(()=>{
    document.querySelector('#route-traversal-steps').value=${JSON.stringify(steps)};
    document.querySelector('#route-traversal-start').value=${JSON.stringify(String(from))};
    document.querySelector('#route-traversal-end').value=${JSON.stringify(String(until))};
    document.querySelector('#route-traversal-form').requestSubmit();
  })()`);
  const read=async()=>evaluate(`(()=>{
    const node=document.querySelector('#route-traversal-results');
    return {text:node.textContent,items:[...node.querySelectorAll('li')].map(n=>n.textContent),
      error:document.querySelector('#route-traversal-error').textContent,
      routeError:document.querySelector('#route-ponding-error').textContent,children:node.children.length};
  })()`);
  const assertFinding=(actual,existing,proposal,delta,items)=>{
    assert.equal(actual.error,'');assert.equal(actual.routeError,'');
    assert.ok(actual.text.includes(`Existing: ${existing} modeled departure minutes`),actual.text);
    assert.ok(actual.text.includes(`Proposal: ${proposal} modeled departure minutes`),actual.text);
    assert.ok(actual.text.includes(`Proposal minus existing: ${delta} modeled departure minutes`),actual.text);
    assert.deepEqual(actual.items,items);
  };

  await submitRoute('A1 B1 C1');await submitTiming('2, 1');
  assertFinding(await read(),3,10,'+7',['Depart 0–3 min.','Depart 0–10 min.']);
  outcomes.push({input:'analytic crossing shifted by B arrival offset 2',existing:3,proposal:10,delta:7,pass:true});

  await submitTiming('2, 1',3,10);
  assertFinding(await read(),0,7,'+7',['Depart 3–10 min.']);
  assert.equal((await read()).text.split('every cell is at/below threshold at its modeled arrival.').length-1,2,'exact threshold arrival qualifies even without a positive existing window');
  await submitTiming('2, 1',4,10);
  assertFinding(await read(),0,6,'+6',['Depart 4–10 min.']);
  assert.match((await read()).text,/first modeled exceedance is B1 at arrival minute 6 \(1.2 mm\)/);
  await submitTiming('2, 1');
  outcomes.push({input:'exact threshold equality versus first exceedance at declared arrival',pass:true});

  // The parent threshold change must recompute the retained timing query.
  await evaluate("(()=>{const x=document.querySelector('#ponding-threshold');x.value='2';x.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assertFinding(await read(),10,10,'0',['Depart 0–10 min.','Depart 0–10 min.']);
  await evaluate("(()=>{const x=document.querySelector('#ponding-threshold');x.value='1';x.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assertFinding(await read(),3,10,'+7',['Depart 0–3 min.','Depart 0–10 min.']);
  outcomes.push({input:'parent threshold 1 -> 2 -> 1 recomputes retained query',pass:true});

  await submitTiming('5, 1');
  assertFinding(await read(),0,10,'+10',['Depart 0–10 min.']);
  assert.match((await read()).text,/No positive-duration modeled departure window qualifies/);
  outcomes.push({input:'changed B arrival offset 5 removes positive existing window',pass:true});

  // A new parent route intentionally resets the timing query; resubmission
  // must use the new order and its new cumulative arrival offsets.
  await submitRoute('C1 B1 A1');
  assert.equal((await read()).children,0,'new route clears prior traversal');
  await submitTiming('1, 2');
  assertFinding(await read(),4,10,'+6',['Depart 0–4 min.','Depart 0–10 min.']);
  outcomes.push({input:'reversed parent route and new timing recompute',pass:true});

  await submitTiming('1, 2',0,19);
  let actual=await read();
  assert.match(actual.error,/cannot be evaluated/);
  assert.equal(actual.children,0,'invalid departure horizon removes all old results');
  await submitTiming('1, 2');
  assertFinding(await read(),4,10,'+6',['Depart 0–4 min.','Depart 0–10 min.']);
  outcomes.push({input:'invalid arrival horizon then valid recovery',pass:true});

  assert.equal(await evaluate('JSON.stringify({project:traversalOracle.project,results:traversalOracle.results})===traversalOracle.before'),true,'all user queries preserve source before deliberate horizon fixture edit');

  await evaluate("(()=>{traversalOracle.results.proposal.snapshots[2].minute=21;traversalOracle.panel.refresh();})()");
  actual=await read();
  assert.match(actual.error,/matching retained time horizon/);
  assert.equal(actual.children,0,'mismatched replay horizon removes old comparison');
  await evaluate("(()=>{traversalOracle.results.proposal.snapshots[2].minute=20;traversalOracle.panel.refresh();})()");
  assertFinding(await read(),4,10,'+6',['Depart 0–4 min.','Depart 0–10 min.']);
  outcomes.push({input:'mismatched proposal horizon then source refresh recovery',pass:true});

  assert.equal(await evaluate('JSON.stringify({project:traversalOracle.project,results:traversalOracle.results})===traversalOracle.before'),true,'queries preserve project and replay source');
  assert.deepEqual(exceptions,[],'no browser script exceptions');
  outcomes.push({input:'source custody and browser exceptions',pass:true});
});
console.log(JSON.stringify({pass:outcomes.length,outcomes,runDirectory},null,2));

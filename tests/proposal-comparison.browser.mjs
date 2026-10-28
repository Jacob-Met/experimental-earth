import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {compareProposalFiles} from '../compare-rain-proposals.mjs';
import {compare,SURFACES} from '../core.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY||join(root,'.browser-proposal-comparison-'+randomUUID());
await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN||'/opt/google/chrome/chrome'},async session=>{
 let {send,evaluate}=session;const {exceptions}=session;let comparisonSocket;
 try {
 await send('Runtime.enable');await send('Page.enable');
 const product=new URL(process.env.EARTH_RECEIVING_URL||session.baseUrl);
 assert.equal(product.hostname,'127.0.0.1');assert.equal(product.protocol,'http:');
 const wait=async expression=>{for(let n=0;n<200;n++){session.signal.throwIfAborted();try{if(await evaluate(expression))return;}catch(e){if(!/Execution context was destroyed|Cannot find context|Cannot find default execution context/.test(String(e)))throw e;}await delay(100);}throw Error('Timed out: '+expression);};
 const navigate=async path=>{const before=await evaluate('performance.timeOrigin');const url=new URL(path,product).href;await send('Page.navigate',{url});await wait(`performance.timeOrigin!==${before} && location.href===${JSON.stringify(url)} && document.readyState==='complete'`);};
 const downloads=join(runDirectory,'downloads');await mkdir(downloads);
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 let downloadOrdinal=0;
 async function download(action){const prior=new Set(await readdir(downloads));await evaluate(action);for(let n=0;n<100;n++){const files=(await readdir(downloads)).filter(x=>!prior.has(x)&&!x.endsWith('.crdownload'));if(files.length===1){const preserved=join(downloads,`${++downloadOrdinal}-${files[0]}`);await rename(join(downloads,files[0]),preserved);return preserved;}await delay(100);}throw Error('Expected one completed actual download');}
 async function choose(files){const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#proposal-files'});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files});}
 await navigate('/');await wait(`!!document.querySelector('#investigation-navigation')`);
 await evaluate(`document.querySelector('#reset').click()`);
 await evaluate(`document.querySelector('#project-title').value='Courtyard A';document.querySelector('#project-title').dispatchEvent(new Event('change',{bubbles:true}))`);
 const first=await download(`document.querySelector('#export').click()`);
 await evaluate(`document.querySelector('[data-brush="garden"]').click();document.querySelector('#proposal-grid .cell').click()`);
 await evaluate(`document.querySelector('#project-title').value='Courtyard B';document.querySelector('#project-title').dispatchEvent(new Event('change',{bubbles:true}))`);
 const second=await download(`document.querySelector('#export').click()`);
 const firstProject=JSON.parse(await readFile(first,'utf8')),secondProject=JSON.parse(await readFile(second,'utf8'));
 assert.equal(firstProject.title,'Courtyard A');assert.equal(secondProject.title,'Courtyard B');
 assert.notDeepEqual(firstProject.proposal,secondProject.proposal);assert.deepEqual(firstProject.existing,secondProject.existing);assert.deepEqual(firstProject.weather,secondProject.weather);
 const authored=structuredClone(firstProject);authored.title='Lowered garden timing control';
 for(const cell of authored.proposal)if(cell.surface==='garden'){cell.elevationM-=0.025;cell.provenance='Authored hypothetical garden lowered by 0.025 m';}
 const authoredInput=join(runDirectory,'authored-lowered-garden-input.json');await writeFile(authoredInput,JSON.stringify(authored,null,2));
 const mainDocument=await send('DOM.getDocument');const mainImport=await send('DOM.querySelector',{nodeId:mainDocument.root.nodeId,selector:'#import'});
 await send('DOM.setFileInputFiles',{nodeId:mainImport.nodeId,files:[authoredInput]});
 await wait(`document.getElementById('project-title').value==='Lowered garden timing control'`);
 const third=await download(`document.querySelector('#export').click()`),thirdBytes=await readFile(third),thirdProject=JSON.parse(thirdBytes);
 assert.deepEqual(thirdProject,authored,'Ordinary import/export preserves the explicitly authored hypothetical control');
 const authoredSource={path:third,bytes:thirdBytes.length,sha256:createHash('sha256').update(thirdBytes).digest('hex')};
 const beforeStorage=await evaluate(`JSON.stringify({...localStorage})`);
 await evaluate(`document.querySelector('#obs-depth').value='12.5';document.querySelector('#obs-source').value='Unsubmitted ruler reading';for(const id of ['obs-depth','obs-source'])document.getElementById(id).dispatchEvent(new Event('input',{bubbles:true}))`);
 const draft=await evaluate(`({depth:document.querySelector('#obs-depth').value,source:document.querySelector('#obs-source').value,uncertainty:document.querySelector('#obs-uncertainty').value})`);
 assert.equal(await evaluate(`JSON.stringify({...localStorage})`),beforeStorage,'Draft remains unsubmitted');
 const link=await evaluate(`(()=>{const a=document.querySelector('a[href="./proposal-comparison.html"]');return a?{href:a.href,target:a.target}:null})()`);
 assert(link,'Ordinary comparison link is present');assert.equal(link.target,'_blank');assert.equal(link.href,new URL('proposal-comparison.html',product).href);
 const priorTargets=new Set((await(await fetch(session.cdpUrl+'/json',{signal:session.signal})).json()).map(t=>t.id));
 const originalEvaluate=evaluate;
 await send('Runtime.evaluate',{expression:`document.querySelector('a[href="./proposal-comparison.html"]').click()`,userGesture:true});
 let target;
 for(let n=0;n<100;n++){target=(await(await fetch(session.cdpUrl+'/json',{signal:session.signal})).json()).find(t=>!priorTargets.has(t.id)&&t.type==='page'&&t.url===link.href);if(target)break;await delay(100);}
 assert(target,'Actual link click opens a new comparison tab');
 comparisonSocket=new WebSocket(target.webSocketDebuggerUrl);const pending=new Map();let serial=0;
 await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('Comparison CDP connection timeout')),10000);comparisonSocket.onopen=()=>{clearTimeout(timer);yes();};comparisonSocket.onerror=()=>{clearTimeout(timer);no(Error('Comparison CDP connection failed'));};});
 comparisonSocket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.text);const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.no(Error(msg.error.message)):p.yes(msg.result);}};
 comparisonSocket.onclose=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.no(Error('Comparison target closed'));}pending.clear();};
 send=(method,params={})=>new Promise((yes,no)=>{session.signal.throwIfAborted();const id=++serial;const timer=setTimeout(()=>{pending.delete(id);no(Error('Comparison CDP timeout '+method));},10000);pending.set(id,{yes,no,timer});comparisonSocket.send(JSON.stringify({id,method,params}));});
 evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 await send('Runtime.enable');await send('Page.enable');await wait(`!!document.querySelector('#compare-proposals')`);
 assert.equal(await originalEvaluate('location.href'),product.href,'Main draft tab remains open');
 assert.equal(await originalEvaluate(`JSON.stringify({...localStorage})`),beforeStorage);
 assert.deepEqual(await originalEvaluate(`({depth:document.querySelector('#obs-depth').value,source:document.querySelector('#obs-source').value,uncertainty:document.querySelector('#obs-uncertainty').value})`),draft,'Opening comparison preserves actual unfinished reading');
 assert.equal(await evaluate(`document.querySelector('#proposal-files').multiple`),true);
 await choose([first,second]);await wait(`!document.querySelector('#compare-proposals').disabled`);
 await evaluate(`document.querySelector('#compare-proposals').click()`);
 await wait(`!document.querySelector('#comparison-report-download').hidden`);
 const reportPath=await download(`document.querySelector('#comparison-report-download').click()`);
 const actual=JSON.parse(await readFile(reportPath,'utf8'));
 const expected=await compareProposalFiles([first,second]);
 assert.deepEqual(actual,expected,'Browser report equals maintained CLI report from exact exported inputs');
 const sourceFiles=await Promise.all([first,second].map(async path=>{const bytes=await readFile(path);return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}));
 for(let i=0;i<2;i++)assert.equal(actual.candidates[i].originalFile.sha256,sourceFiles[i].sha256);
 assert.notEqual(sourceFiles[0].sha256,sourceFiles[1].sha256,'Distinct exported layouts retain distinct original bytes');
 const renderedSources=await evaluate(`document.querySelector('#comparison-results').textContent`);
 for(const source of sourceFiles){assert(renderedSources.includes(source.path.split('/').at(-1)));assert(renderedSources.includes(source.sha256));}
 // Independent oracle: unchanged core, actual exported projects, no local-depth module.
 const projects=[firstProject,secondProject],runs=projects.map(project=>compare(project));
 const times=runs[0].existing.snapshots.map(snapshot=>snapshot.minute);
 const visible=value=>new Intl.NumberFormat('en-US',{maximumSignificantDigits:7}).format(value);
 async function inspectCell(cellIndex,referenceProjects=projects,referenceRuns=runs){
  await evaluate(`(()=>{const col=document.getElementById('local-cell-column'),row=document.getElementById('local-cell-row');col.value=${JSON.stringify(String(cellIndex%firstProject.width))};col.dispatchEvent(new Event('change',{bubbles:true}));row.value=${JSON.stringify(String(Math.floor(cellIndex/firstProject.width)))};row.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelector('#local-depth-results').children.length`),0,'Changing coordinates clears earlier local values');
  await evaluate(`document.getElementById('inspect-local-depth').click()`);
  await wait(`document.getElementById('local-depth-time') && !document.getElementById('inspect-local-depth').disabled`);
  assert.equal(await evaluate(`Number(document.getElementById('local-depth-time').max)`),times.length-1);
  for(const snapshotIndex of [...new Set([0,times.findIndex(t=>t===firstProject.weather.stormMinutes),times.length-1])].filter(i=>i>=0)){
   await evaluate(`(()=>{const control=document.getElementById('local-depth-time');control.value=${JSON.stringify(String(snapshotIndex))};control.dispatchEvent(new Event('input',{bubbles:true}));})()`);
   const rows=await evaluate(`[...document.querySelectorAll('#local-depth-results tbody tr')].map(tr=>({title:tr.querySelector('th span').textContent,file:tr.querySelector('.local-source-file')?.textContent,cells:[...tr.querySelectorAll('td')].map(td=>td.textContent)}))`);
   const baseline=referenceRuns[0].existing.snapshots[snapshotIndex].depthsMm[cellIndex];
   assert.equal(rows.length,3,'Existing site and every retained proposal are displayed');
   assert.equal(rows[0].title,'Existing site');
   assert.deepEqual(rows[0].cells,[SURFACES[firstProject.existing[cellIndex].surface].label,visible(baseline),'0']);
   for(let i=0;i<referenceProjects.length;i++){
    const depth=referenceRuns[i].proposal.snapshots[snapshotIndex].depthsMm[cellIndex];
    assert.equal(rows[i+1].title,`${i+1}. ${referenceProjects[i].title}`);
    assert.equal(rows[i+1].file,(referenceProjects===projects?sourceFiles[i].path:[first,third][i]).split('/').at(-1));
    const delta=depth-baseline;
    assert.deepEqual(rows[i+1].cells,[SURFACES[referenceProjects[i].proposal[cellIndex].surface].label,visible(depth),(delta>0?'+':'')+visible(delta)]);
   }
   assert.equal(await evaluate(`document.getElementById('local-depth-previous').getAttribute('aria-disabled')`),String(snapshotIndex===0));
   assert.equal(await evaluate(`document.getElementById('local-depth-next').getAttribute('aria-disabled')`),String(snapshotIndex===times.length-1));
  }
 }
 let timingActions=0,reversalEndpointActions=0;
 async function checkTiming(cellIndex,referenceProjects=projects,referenceRuns=runs){
  assert.equal(await evaluate(`document.getElementById('local-depth-timing').open`),false,'Timing findings start collapsed');
  await evaluate(`window.__timingSlider=document.getElementById('local-depth-time');document.querySelector('#local-depth-timing > summary').click()`);
  for(let candidateIndex=0;candidateIndex<referenceProjects.length;candidateIndex++){
   const trace=referenceRuns[candidateIndex].proposal.snapshots.map((snapshot,i)=>snapshot.depthsMm[cellIndex]-referenceRuns[0].existing.snapshots[i].depthsMm[cellIndex]);
   const card=`#local-depth-timing [data-timing-ordinal="${candidateIndex+1}"]`;
   const expectedActions=[];
   for(const [kind,predicate,pick] of [['increase',value=>value>0,Math.max],['decrease',value=>value<0,Math.min]]){
    const eligible=trace.filter(predicate),selector=card+` [data-timing-finding="${kind}"]`;
    const indices=eligible.length?trace.flatMap((value,i)=>value===pick(...eligible)?[i]:[]):[];
    const observed=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),b=el.querySelector('button');return {index:b?Number(b.dataset.snapshotIndex):null,text:el.textContent};})()`);
    assert.equal(observed.index,indices.length?indices[0]:null);
    if(indices.length){
     const value=trace[indices[0]];
     assert(observed.text.includes((value>0?'+':'')+visible(value)+' mm'));
     assert(observed.text.includes(`${indices.length} retained sample`),'Exact tied sample count is disclosed');
     expectedActions.push({kind,index:indices[0]});
    }
   }
   const nonzero=trace.flatMap((value,index)=>value===0?[]:[{value,index}]);
   const reversals=[];
   for(let i=1;i<nonzero.length;i++)if((nonzero[i-1].value>0)!==(nonzero[i].value>0))reversals.push([nonzero[i-1].index,nonzero[i].index]);
   const actualEndpoints=await evaluate(`[...document.querySelectorAll(${JSON.stringify(card+' [data-timing-kind^="reversal-"]')})].map(b=>({kind:b.dataset.timingKind,index:Number(b.dataset.snapshotIndex)}))`);
   const expectedEndpoints=reversals.flatMap(([from,to])=>[{kind:'reversal-from',index:from},{kind:'reversal-to',index:to}]);
   assert.deepEqual(actualEndpoints,expectedEndpoints,'Exact opposite-sign nonzero samples delimit reversals; zeros are not invented crossings');
   if(reversals.length)await evaluate(`document.querySelector(${JSON.stringify(card+' .local-timing-reversals > summary')}).click()`);
   expectedActions.push(...expectedEndpoints);
   for(const action of expectedActions){
    const selector=card+` [data-timing-kind="${action.kind}"][data-snapshot-index="${action.index}"]`;
    await evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(selector)});button.focus();button.click();})()`);
    assert.equal(await evaluate(`document.getElementById('local-depth-time')===window.__timingSlider && Number(window.__timingSlider.value)===${action.index}`),true,'Summary activates the same shared time slider');
    assert.equal(await evaluate(`document.activeElement===window.__timingSlider`),true,'Summary navigation focuses the visible shared time control');
    const rows=await evaluate(`[...document.querySelectorAll('#local-depth-results tbody tr')].map(tr=>[...tr.querySelectorAll('td')].slice(1).map(td=>td.textContent))`);
    const base=referenceRuns[0].existing.snapshots[action.index].depthsMm[cellIndex];
    assert.deepEqual(rows,[[visible(base),'0'],...referenceRuns.map(run=>{const value=run.proposal.snapshots[action.index].depthsMm[cellIndex],delta=value-base;return [visible(value),(delta>0?'+':'')+visible(delta)];})]);
    timingActions++;if(action.kind.startsWith('reversal-'))reversalEndpointActions++;
   }
  }
 }
 await inspectCell(0);await checkTiming(0);await inspectCell(firstProject.width+1);await checkTiming(firstProject.width+1);
 await evaluate(`(()=>{const control=document.getElementById('local-depth-time');control.value=control.max;control.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await evaluate(`document.getElementById('local-depth-previous').click()`);
 assert.equal(await evaluate(`Number(document.getElementById('local-depth-time').value)`),times.length-2);
 await evaluate(`document.getElementById('local-depth-next').click()`);
 assert.equal(await evaluate(`Number(document.getElementById('local-depth-time').value)`),times.length-1);
 assert.deepEqual(JSON.parse(await evaluate(`fetch(document.getElementById('comparison-report-download').href).then(response=>response.text())`)),actual,'Local inspection leaves the original downloadable report unchanged');
 // Frame the already-qualified A1 storm-end values, rather than a zero final state.
 await inspectCell(0);
 await checkTiming(0);
 const captureSnapshot=times.findIndex(minute=>minute===firstProject.weather.stormMinutes);
 assert.ok(captureSnapshot>=0,'Actual export storm end is a retained snapshot');
 await evaluate(`(()=>{const control=document.getElementById('local-depth-time');control.value=${JSON.stringify(String(captureSnapshot))};control.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const capturedValues=await evaluate(`[...document.querySelectorAll('#local-depth-results tbody tr')].map(tr=>[...tr.querySelectorAll('td')].slice(1).map(td=>td.textContent))`);
 const captureBaseline=runs[0].existing.snapshots[captureSnapshot].depthsMm[0];
 assert.deepEqual(capturedValues,[[visible(captureBaseline),'0'],...runs.map(run=>{const depth=run.proposal.snapshots[captureSnapshot].depthsMm[0],delta=depth-captureBaseline;return [visible(depth),(delta>0?'+':'')+visible(delta)];})],'Captured A1 storm-end values match the unchanged core oracle');
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await delay(100);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true,'No page-level horizontal overflow');
  const capture=async name=>{await delay(100);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(runDirectory,name),Buffer.from(shot.data,'base64'));};
  await evaluate('window.scrollTo(0,0)');await capture(`comparison-entry-${width}.png`);
  if(width===390){await evaluate(`document.querySelector('.actions').scrollIntoView({block:'start'})`);await capture('comparison-actions-390.png');}
  await evaluate(`document.querySelector('#comparison-results').scrollIntoView({block:'start'})`);await capture(`comparison-${width}.png`);
  await evaluate(`(()=>{const heading=[...document.querySelectorAll('#comparison-results h2')].find(h=>h.textContent==='Compare modeled outcomes');if(!heading)throw Error('Missing metrics heading');heading.closest('section').scrollIntoView({block:'start'});})()`);await capture(`comparison-metrics-${width}.png`);
  if(width===390){
   await evaluate(`document.querySelector('#compare-proposals').focus()`);
   let reached=false;
   for(let i=0;i<20;i++){
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    if(await evaluate(`document.activeElement===document.querySelector('.table-scroll')`)){reached=true;break;}
   }
   assert(reached,'Actual Tab navigation reaches the first comparison table');
   assert.equal(await evaluate(`document.activeElement.scrollWidth>document.activeElement.clientWidth`),true,'Narrow comparison table has horizontal content');
   await evaluate(`document.activeElement.scrollLeft=0`);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
   await wait(`document.activeElement===document.querySelector('.table-scroll') && document.activeElement.scrollLeft>0`);
   await capture('comparison-keyboard-390.png');
  }
  await evaluate(`(()=>{const heading=[...document.querySelectorAll('#comparison-results h2')].find(h=>h.textContent==='Trade-offs, not a universal winner');if(!heading)throw Error('Missing trade-off heading');heading.closest('section').scrollIntoView({block:'start'});})()`);await capture(`comparison-tradeoffs-${width}.png`);
  await evaluate(`(()=>{const heading=[...document.querySelectorAll('#comparison-results h2')].find(h=>h.textContent==='Original files and changed cells');if(!heading)throw Error('Missing sources heading');heading.closest('section').scrollIntoView({block:'start'});})()`);await capture(`comparison-sources-${width}.png`);
  await evaluate(`document.querySelector('.local-inspection').scrollIntoView({block:'start'})`);await capture(`local-depth-controls-${width}.png`);
  await evaluate(`document.querySelector('#local-depth-results').scrollIntoView({block:'start'})`);await capture(`local-depth-results-${width}.png`);
  if(width===390){
   await evaluate(`document.getElementById('inspect-local-depth').focus()`);
   let localReached=false;
   for(let i=0;i<20;i++){
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    if(await evaluate(`document.activeElement===document.querySelector('.local-depth-table')`)){localReached=true;break;}
   }
   assert(localReached,'Actual Tab navigation reaches the local depth table');
   assert.equal(await evaluate(`document.activeElement.scrollWidth>document.activeElement.clientWidth`),true,'Local depth table contains horizontally scrollable values');
   await evaluate(`document.activeElement.scrollLeft=0`);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
   await wait(`document.activeElement===document.querySelector('.local-depth-table') && document.activeElement.scrollLeft>0`);
   // The keyboard assertion above establishes access; position the numeric columns for inspection.
   await evaluate(`(()=>{const table=document.querySelector('.local-depth-table');table.scrollLeft=table.scrollWidth;table.scrollIntoView({block:'center'});})()`);
   await capture('local-depth-numeric-390.png');
  }
  await evaluate(`document.getElementById('local-depth-timing').scrollIntoView({block:'start'})`);await capture(`local-timing-${width}.png`);
 }
 // A changed storm must retire an earlier successful report, not compare stale rows.
 const changed=JSON.parse(await readFile(second,'utf8'));changed.weather.rainMmHr+=1;
 const changedPath=join(runDirectory,'changed-storm.json');await writeFile(changedPath,JSON.stringify(changed));
 await choose([first,changedPath]);
 assert.equal(await evaluate(`!document.getElementById('local-depth-timing')`),true,'Replacing files retires all timing findings and actions');
 assert.equal(await evaluate(`!document.getElementById('local-depth-time') && !document.querySelector('#local-depth-results tbody tr')`),true,'Replacing files immediately retires local depths from the old sources');
 assert.equal(await evaluate(`document.querySelector('#comparison-report-download').hidden`),true,'New selection retires the old report immediately');
 await wait(`!document.querySelector('#compare-proposals').disabled`);await evaluate(`document.querySelector('#compare-proposals').click()`);
 await wait(`/not the same|unchanged|different|mismatch|refus|unable|error/i.test(document.querySelector('#comparison-status').textContent)`);
 assert.equal(await evaluate(`document.querySelector('#comparison-report-download').hidden`),true,'Mismatched context cannot download a stale report');
 await choose([first,second]);await wait(`!document.querySelector('#compare-proposals').disabled`);
 await evaluate(`document.querySelector('#compare-proposals').click();document.querySelector('#clear-proposals').click()`);
 await delay(250);
 assert.equal(await evaluate(`document.querySelector('#comparison-report-download').hidden && document.querySelector('#comparison-results').children.length===0`),true);
 await choose([first,second]);await wait(`!document.querySelector('#compare-proposals').disabled`);await evaluate(`document.querySelector('#compare-proposals').click()`);await wait(`!document.querySelector('#comparison-report-download').hidden`);
 // A separate, explicitly authored actual export supplies a substantive reversal.
 await choose([first,third]);await wait(`!document.querySelector('#compare-proposals').disabled`);
 await evaluate(`document.getElementById('compare-proposals').click()`);await wait(`!document.getElementById('comparison-report-download').hidden`);
 const authoredReport=JSON.parse(await evaluate(`fetch(document.getElementById('comparison-report-download').href).then(response=>response.text())`));
 assert.deepEqual(authoredReport,await compareProposalFiles([first,third]));
 const authoredProjects=[firstProject,thirdProject],authoredRuns=authoredProjects.map(project=>compare(project));
 await inspectCell(19,authoredProjects,authoredRuns);
 const reversalsBefore=reversalEndpointActions;
 await checkTiming(19,authoredProjects,authoredRuns);
 assert.ok(reversalEndpointActions>reversalsBefore,'Authored D3 control must exercise actual reversal endpoint navigation');
 assert.deepEqual(JSON.parse(await evaluate(`fetch(document.getElementById('comparison-report-download').href).then(response=>response.text())`)),authoredReport,'Timing actions preserve the authored comparison report');
 for(const width of [1440,390]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
  await evaluate(`document.getElementById('local-depth-timing').scrollIntoView({block:'start'})`);await delay(100);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),true);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(runDirectory,`local-timing-authored-${width}.png`),Buffer.from(shot.data,'base64'));
  await evaluate(`document.querySelector('#local-depth-timing [data-timing-ordinal="2"]').scrollIntoView({block:'start'})`);await delay(100);
  const detail=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(runDirectory,`local-timing-authored-detail-${width}.png`),Buffer.from(detail.data,'base64'));
 }
 await evaluate(`document.getElementById('clear-proposals').click()`);
 assert.equal(await evaluate(`!document.getElementById('local-depth-timing') && document.getElementById('comparison-results').children.length===0`),true,'Clear retires authored timing summaries');
 assert.equal(await evaluate(`JSON.stringify({...localStorage})`),beforeStorage,'Comparison never edits the authored workspace');
 assert.deepEqual(await originalEvaluate(`({depth:document.querySelector('#obs-depth').value,source:document.querySelector('#obs-source').value,uncertainty:document.querySelector('#obs-uncertainty').value})`),draft,'Comparison workflow preserves unsubmitted reading in original tab');
 assert.deepEqual(exceptions,[]);
 await writeFile(join(runDirectory,'proposal-comparison.json'),JSON.stringify({productUrl:product.href,sourceFiles,reportPath,exactCliEquality:true,actualNewTabNavigation:true,mainDraftPreserved:true,changedStormRefused:true,clearAndReselect:true,workspaceUnchanged:true,desktopAnd390Screenshots:true,narrowTableKeyboardScroll:true,localDepthExactCoreOracle:true,localCellsChecked:[0,firstProject.width+1],localTimesChecked:[0,firstProject.weather.stormMinutes,times.at(-1)],localReportUnchanged:true,localReplacementClears:true,localDesktopAnd390Screenshots:true,localCaptureCell:0,localCaptureMinute:times[captureSnapshot],localNarrowTableKeyboardScroll:true,localNumeric390Screenshot:true,timingActions,reversalEndpointActions,authoredSource,authoredCell:19,authoredReportUnchanged:true,timingSummariesRetired:true,timingDesktopAnd390Screenshots:true,exceptions,limits:['Reselection during a deterministically deferred file read was not exercised']},null,2));
 } finally {comparisonSocket?.close();}
});

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY || root+'.row-choice-'+randomUUID();
const js=JSON.stringify;
const header='station,minute,depth,uncertainty,unit,source,scenario,use';
const mapping=JSON.stringify({source:'Independent placement',entries:[{station:'east',cell:'B2'}]});
const original=[header,'east,15,1,.1,cm,"logger','continued",existing,calibration','east,30,2,.1,cm,logger,existing,calibration','east,45,3,.1,cm,logger,existing,calibration'].join('\n')+'\n';
const reports=[];
await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN || '/opt/google/chrome/chrome'},async({evaluate,send,exceptions,sandbox})=>{
 async function wait(expression,label=expression) {
  for(let i=0;i<100;i++) {
   try {if(await evaluate(expression))return;}catch(error){
    if(!/Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context/i.test(String(error)))throw error;
   }
   await delay(100);
  }
  throw Error('Timed out: '+label);
 }
 await wait("document.readyState==='complete' && !!document.getElementById('preview-observation-table')");
 if(process.env.EARTH_RECEIVING_URL) {
  const target=new URL(process.env.EARTH_RECEIVING_URL);
  assert.equal(target.protocol,'http:');assert.equal(target.hostname,'127.0.0.1');
  assert.ok(target.port && Number(target.port)>0);assert.equal(target.username,'');assert.equal(target.password,'');
  assert.equal(target.pathname,'/');assert.equal(target.search,'');assert.equal(target.hash,'');
  const prior=await evaluate('performance.timeOrigin');await send('Page.navigate',{url:target.href});
  await wait(`performance.timeOrigin!==${prior} && document.readyState==='complete' && !!document.getElementById('preview-observation-table')`);
 }
 await evaluate("window.q=id=>document.getElementById(id);window.stored=()=>localStorage.getItem('experimental-earth-site-v1');");
 const stored=()=>evaluate('stored()');
 const project=async()=>JSON.parse(await stored());
 const click=id=>evaluate(`q(${js(id)}).click()`);
 const choices=()=>evaluate("Array.from(document.querySelectorAll('input[data-observation-line]:checked'),e=>Number(e.dataset.observationLine))");
 const visibleLines=()=>evaluate("Array.from(document.querySelectorAll('input[data-observation-line]'),e=>Number(e.dataset.observationLine))");
 async function importProject(p){
  const raw=JSON.stringify(p);
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${js(raw)}],'project.json',{type:'application/json'}));q('import').files=dt.files;q('import').dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`JSON.parse(stored()).observations.length===${p.observations.length}`);
  assert.deepEqual((await project()).observations,p.observations);
 }
 async function empty(){
  await click('reset');await wait('!!stored()');
  const p=await project();p.observations=[];await importProject(p);
 }
 async function setMap(text=mapping){
  await evaluate(`q('observation-station-map').value=${js(text)};q('observation-station-map').dispatchEvent(new Event('input',{bubbles:true}));`);
 }
 async function upload(text,name){
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${js(text)}],${js(name)},{type:'text/csv'}));q('observation-table-file').files=dt.files;q('observation-table-file').dispatchEvent(new Event('change',{bubbles:true}));})()`);
 }
 async function preview(text,name,lines){
  await setMap();await upload(text,name);
  await wait(`JSON.stringify(Array.from(document.querySelectorAll('input[data-observation-line]'),e=>Number(e.dataset.observationLine)))===${js(JSON.stringify(lines))}`,'complete preview for '+name);
  assert.deepEqual(await choices(),[],'Fresh preview selects no rows');
 }
 async function select(lines){
  await click('clear-observation-rows');
  for(const line of lines)await evaluate(`document.querySelector('input[data-observation-line="${line}"]').click()`);
 }
 async function append(count){
  await click('append-observation-table');await wait(`JSON.parse(stored()).observations.length===${count}`);
 }
 async function refused(before){
  await click('append-observation-table');await delay(50);assert.equal(await stored(),before,'Refused append must leave persisted bytes unchanged');
 }
 await empty();await preview(original,'physical-lines.csv',[2,4,5]);
 assert.equal(await evaluate("q('append-observation-table').disabled"),true);
 const noChoice=await stored();await refused(noChoice);
 await select([5,2]);await append(2);
 let observations=(await project()).observations;
 assert.deepEqual(observations.map(o=>o.tableSource.line),[2,5]);
 assert.deepEqual(observations.map(o=>o.tableSource.depthValue),['1','3']);
 assert.deepEqual(observations.map(o=>o.tableSource.uncertaintyValue),['.1','.1']);
 assert.deepEqual(observations.map(o=>o.tableSource.unit),['cm','cm']);
 assert.deepEqual(observations.map(o=>o.minute),[15,45]);
 assert.deepEqual(observations.map(o=>o.depthMm),[10,30]);
 assert.equal(observations[0].source,'logger\ncontinued');
 assert.equal(observations[0].tableSource.stationMapping.cell,'B2');
 assert.equal(observations[0].tableSource.stationMapping.source,'Independent placement');
 assert.ok(observations.every(o=>o.tableSource.fileName==='physical-lines.csv'&&o.tableSource.stationValue==='east'));
 await click('append-observation-table');assert.equal((await project()).observations.length,2,'Second click cannot repeat selected rows');
 reports.push('No automatic selection; chosen physical lines2,5 retain raw provenance and original order.');
 await preview(original,'physical-lines.csv',[2,4,5]);await select([4]);await append(3);
 assert.deepEqual((await project()).observations.map(o=>o.tableSource.line),[2,5,4]);
 reports.push('Unselected existing duplicates do not block explicitly chosen fresh line4.');
 await preview(original,'physical-lines.csv',[2,4,5]);await select([2]);const duplicate=await stored();await refused(duplicate);
 assert.match(await evaluate("q('observation-table-status').textContent"),/already/);
 assert.deepEqual(await choices(),[2]);reports.push('Selected duplicate refuses without changing saved bytes or losing choices.');
 await preview(original,'mapping-clear.csv',[2,4,5]);await select([2,5]);
 await setMap(JSON.stringify({source:'Changed placement',entries:[{station:'east',cell:'C2'}]}));
 assert.deepEqual(await choices(),[]);assert.equal(await evaluate("q('append-observation-table').disabled"),true);
 await refused(await stored());await click('preview-observation-table');
 await wait("document.querySelectorAll('input[data-observation-line]').length===3");
 assert.deepEqual(await choices(),[]);reports.push('Changed mapping retires prior choices; explicit re-preview keeps none selected.');
 await select([2]);await evaluate("q('project-title').value='Independent changed context';q('project-title').dispatchEvent(new Event('change',{bubbles:true}));");
 assert.deepEqual(await choices(),[]);await refused(await stored());reports.push('Project changes retire choices before append.');
 await empty();await setMap();await upload(header+'\neast,15,1,.1,cm,valid,existing,calibration\neast,30,not-a-number,.1,cm,invalid,existing,calibration\n','malformed.csv');
 await wait("q('observation-table-status').textContent.startsWith('Import refused')");
 assert.deepEqual(await visibleLines(),[]);assert.equal(await evaluate("getComputedStyle(q('observation-row-actions')).display"),'none');
 await refused(await stored());assert.equal((await project()).observations.length,0);
 reports.push('Malformed unselected source row refuses the entire preview and hides inactive choice controls.');
 async function gate(name){
  await evaluate(`(()=>{if(window.__rowGate)throw Error('prior gate');const native=File.prototype.arrayBuffer;const state={name:${js(name)},native,ready:false,released:false,count:0};window.__rowGate=state;File.prototype.arrayBuffer=function(...args){if(this.name!==state.name)return native.apply(this,args);state.count++;if(state.count!==1)throw Error('repeat gated read');return native.apply(this,args).then(bytes=>new Promise(resolve=>{state.release=()=>{if(state.released)throw Error('released twice');state.released=true;resolve(bytes);};state.ready=true;}));};})()`);
 }
 const held=()=>wait('window.__rowGate?.ready===true');
 const release=async()=>{await evaluate('window.__rowGate.release()');await delay(100);};
 const cleanup=()=>evaluate("(()=>{const s=window.__rowGate;if(!s)return;File.prototype.arrayBuffer=s.native;if(s.ready&&!s.released)s.release();delete window.__rowGate;})()");
 const newer=header+'\neast,60,4,.2,cm,newer-file-witness,existing,calibration\n';
 await empty();await setMap();await gate('old-late.csv');
 try {
  await upload(original,'old-late.csv');await held();await upload(newer,'newer.csv');
  await wait("document.querySelectorAll('input[data-observation-line]').length===1");await select([2]);
  const before=await stored();await release();assert.deepEqual(await choices(),[2]);assert.deepEqual(await visibleLines(),[2]);assert.equal(await stored(),before);
  await append(1);observations=(await project()).observations;
  assert.equal(observations[0].source,'newer-file-witness');assert.equal(observations[0].tableSource.fileName,'newer.csv');assert.equal(observations[0].tableSource.depthValue,'4');
 } finally {await cleanup();}
 reports.push('A genuinely delayed old File.arrayBuffer result cannot replace a newer preview, choice or source.');
 await empty();await preview(newer,'before-pending.csv',[2]);await select([2]);await gate('mapping-pending.csv');
 try {
  await upload(original,'mapping-pending.csv');await held();
  await setMap(JSON.stringify({source:'Changed during pending read',entries:[{station:'east',cell:'C2'}]}));
  const before=await stored();await release();assert.deepEqual(await choices(),[]);assert.equal(await stored(),before);await refused(before);
  await click('preview-observation-table');await wait("document.querySelectorAll('input[data-observation-line]').length===3");
  assert.deepEqual(await choices(),[]);
 } finally {await cleanup();}
 reports.push('Mapping edit during a held file read requires a fresh preview and fresh explicit choices.');
 await empty();
 const ninetyNine=[header,...Array.from({length:99},(_,i)=>'east,15,1,.1,cm,history-'+i+',existing,calibration')].join('\n')+'\n';
 await preview(ninetyNine,'capacity-history.csv',Array.from({length:99},(_,i)=>i+2));
 await click('select-all-observation-rows');assert.equal((await choices()).length,99);await append(99);
 const capacity=header+'\neast,45,2,.1,cm,new-a,existing,calibration\neast,60,3,.1,cm,new-b,existing,calibration\n';
 await preview(capacity,'capacity-new.csv',[2,3]);await select([2,3]);const cap=await stored();await refused(cap);
 assert.match(await evaluate("q('observation-table-status').textContent"),/100/);assert.deepEqual(await choices(),[2,3]);
 await select([3]);await append(100);observations=(await project()).observations;
 assert.equal(observations.at(-1).minute,60);assert.equal(observations.at(-1).tableSource.line,3);
 reports.push('99+2 selected rows refuses atomically; changing choice to one row reaches100 without reloading source.');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:runDirectory});await click('export');
 let portable;
 for(let i=0;i<100;i++){try{portable=JSON.parse(await readFile(runDirectory+'/experimental-earth-site.json','utf8'));break;}catch(error){if(error.code!=='ENOENT')throw error;await delay(100);}}
 assert.ok(portable);assert.deepEqual(portable.observations,observations);
 await empty();await importProject(portable);assert.deepEqual((await project()).observations,observations);
 reports.push('Actual downloaded project export reopens with every chosen source identity intact.');
 await empty();await preview(original,'visual-selection.csv',[2,4,5]);await select([2,5]);
 await evaluate("document.querySelector('[aria-labelledby=observation-import-title] details').open=true;");
 for(const width of [1440,390]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("q('observation-table-preview').scrollIntoView({behavior:'instant',block:'center'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No horizontal overflow at'+width);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(runDirectory+'/selection-'+width+'.png',Buffer.from(shot.data,'base64'));
 }
 // Exercise a native keyboard toggle as well as pointer clicks.
 await evaluate("document.querySelector('input[data-observation-line=\"4\"]').focus()");
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 assert.deepEqual(await choices(),[2,4,5]);
 assert.equal(await evaluate("document.activeElement.dataset.observationLine"),'4');
 reports.push('Desktop/390px screenshots captured without horizontal overflow; native Space toggles focused source row.');
 assert.deepEqual(exceptions,[]);
 const report={source:'independent original CSV receiving',checks:reports,sandbox,exceptions,runDirectory};
 await writeFile(runDirectory+'/row-choice-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
});

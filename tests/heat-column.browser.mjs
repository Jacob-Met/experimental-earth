import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-run-heat-column-'+randomUUID(),checks=[];
const project=makeExample();
const surface={absorptivity:.8,capacityJm2K:20000,exchangeWm2K:10,initialC:20,source:'Independent authored pulse control; not measured surface properties'};
project.surfaceHeatStudy=prepareSurfaceHeatStudy(project,{cellIndex:0,existing:surface,proposal:surface,schedule:[
 {minutes:60,incidentWm2:700,reservoirC:20,source:'Authored 700 W/m² incident pulse for60minutes'},
 {minutes:360,incidentWm2:0,reservoirC:20,source:'Authored dark interval; ambient remains20°C'},
]});
const literal='<img src=x onerror=window.__columnInjected=1> Authored lower store, not measured depth or conductance';
const expectedPeakMinute=75.028516610399405,expectedPeakC=32.33238368285359;
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from independent ${expected}`);
try{
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome'},async session=>{
  const {evaluate,send,exceptions}=session;
  await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
  async function until(expression){for(let i=0;i<125;i++){try{if(await evaluate(expression))return;}catch{}await delay(40);}throw Error('Timed out: '+expression+' '+await evaluate("document.querySelector('#column-status')?.textContent"));}
  const stored=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  async function nativeFile(path){const doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#import'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await delay(150);}
  async function field(id,value){await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
  const click=async id=>evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  async function run(state='compared'){await click('column-run');await until("!document.getElementById('column-run').disabled");assert.equal(await evaluate("document.getElementById('column-status').dataset.state"),state,await evaluate("document.getElementById('column-status').textContent"));}
  async function peak(){await click('column-peak');const r=await evaluate("({minute:Number(document.getElementById('column-summary').dataset.lowerMaximumMinute),maximum:Number(document.getElementById('column-summary').dataset.lowerMaximumC),surface:Number(document.getElementById('column-inspect').dataset.surfaceC),lower:Number(document.getElementById('column-inspect').dataset.subsurfaceC)})");near(r.minute,expectedPeakMinute);near(r.maximum,expectedPeakC);near(r.lower,expectedPeakC);near(r.surface,r.lower);return r;}
  await until("Boolean(document.getElementById('column-form'))");
  const inputPath=runDirectory+'/surface-pulse.json';await writeFile(inputPath,JSON.stringify(project));await nativeFile(inputPath);
  assert.match(await evaluate("document.getElementById('column-basis').textContent"),/2 exposure intervals/);
  for(const target of ['existing','proposal'])for(const [name,value]of Object.entries({capacityJm2K:80000,conductanceWm2K:20,initialC:20,source:literal}))await field('column-'+target+'-'+name,value);
  assert.equal(await evaluate("document.getElementById('column-run').disabled"),true);await evaluate("document.getElementById('column-form').requestSubmit()");await run();
  const accepted=await stored();assert.equal(accepted.heatColumnStudy.schema,'experimental-earth-heat-column/1');assert.deepEqual(accepted.heatColumnStudy.heatStudy,project.surfaceHeatStudy);assert.equal(accepted.heatColumnStudy.lowerLayers.existing.source,literal);
  checks.push('Native original-project import and explicit sourced lower-store declaration preserve the saved surface exposure');
  await peak();await field('column-minute',60);let row=await evaluate("({surface:Number(document.getElementById('column-inspect').dataset.surfaceC),lower:Number(document.getElementById('column-inspect').dataset.subsurfaceC)})");near(row.surface,44.53099896635505);near(row.lower,31.201606805625975);await peak();
  assert.match(await evaluate("document.getElementById('column-inspect').textContent"),/Internal transfer down/);assert.match(await evaluate("document.getElementById('column-inspect').textContent"),/not another external input/);
  checks.push('Independent pulse control reaches delayed interior lower maximum rather than only exposure endpoints, with separate internal energy transfer');
  await evaluate("document.getElementById('column-sources').open=true");assert.ok((await evaluate("document.getElementById('column-sources').textContent")).includes(literal));assert.equal(await evaluate("document.querySelectorAll('#heat-column img').length"),0);assert.equal(await evaluate('window.__columnInjected??null'),null);
  checks.push('Original source declarations remain literal text, with no invented depth or executed markup');
  await field('column-proposal-conductanceWm2K',0);assert.equal(await evaluate("document.getElementById('column-results').children.length"),0);await evaluate("document.getElementById('column-form').requestSubmit()");await run();await evaluate("const e=document.getElementById('column-target');e.value='proposal';e.dispatchEvent(new Event('change'))");await field('column-minute',60);
  row=await evaluate("({surface:Number(document.getElementById('column-inspect').dataset.surfaceC),lower:Number(document.getElementById('column-inspect').dataset.subsurfaceC)})");near(row.lower,20);near(row.surface,66.74326225959115);assert.deepEqual((await stored()).heatColumnStudy.lowerLayers.existing,accepted.heatColumnStudy.lowerLayers.existing);
  checks.push('Changed proposal conductance zero isolates the lower store and recovers independent one-layer surface response');
  const acceptedPath=runDirectory+'/accepted.json';await writeFile(acceptedPath,JSON.stringify(accepted));await nativeFile(acceptedPath);await run();await peak();
  const download=runDirectory+'/download';await mkdir(download);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:download});await click('export');const exportedPath=download+'/experimental-earth-site.json';for(let i=0;i<100;i++){try{await access(exportedPath);break;}catch{await delay(40);}}
  const exported=JSON.parse(await readFile(exportedPath,'utf8'));assert.deepEqual(exported.heatColumnStudy,accepted.heatColumnStudy);await click('column-clear');assert.equal((await stored()).heatColumnStudy,undefined);await send('Page.reload',{ignoreCache:true});await until("Boolean(document.getElementById('column-form'))");await nativeFile(exportedPath);await run();await peak();
  checks.push('Actual downloaded project and fresh native-file reopening preserve raw declarations and recompute both-store response');
  const forged=structuredClone(exported);forged.heatColumnStudy.report={summary:{existing:{subsurface:{maximumC:999,maximumMinute:0}}}};forged.heatColumnStudy.trajectory=[{minute:0,subsurfaceC:999}];const forgedPath=runDirectory+'/forged-derived.json';await writeFile(forgedPath,JSON.stringify(forged));await nativeFile(forgedPath);await run();await peak();
  checks.push('Forged stored derived peaks and traces cannot replace recomputed physical declarations');
  await nativeFile(exportedPath);await run();await field('column-existing-source',' ');await evaluate("document.getElementById('column-form').requestSubmit()");assert.equal(await evaluate("document.getElementById('column-status').dataset.state"),'refused');assert.deepEqual((await stored()).heatColumnStudy,accepted.heatColumnStudy);
  const moved=structuredClone(exported);moved.surfaceHeatStudy.schedule[0].incidentWm2=701;const movedPath=runDirectory+'/changed-exposure.json';await writeFile(movedPath,JSON.stringify(moved));await nativeFile(movedPath);await run('context-changed');assert.equal(await evaluate("document.getElementById('column-results').children.length"),0);await evaluate("document.getElementById('column-form').requestSubmit()");assert.equal(await evaluate("document.getElementById('column-status').dataset.state"),'refused');assert.deepEqual((await stored()).heatColumnStudy,accepted.heatColumnStudy);
  checks.push('Missing source refuses replacement; changed exposure withholds comparison and cannot relabel the retained two-layer study');
  await nativeFile(exportedPath);await run();await peak();await delay(3900);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('column-results').scrollIntoView({block:'start',behavior:'instant'})");let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/column-desktop.png',Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.getElementById('column-minute').scrollIntoView({block:'center',behavior:'instant'});document.getElementById('column-minute').focus()");const before=await evaluate("document.getElementById('column-minute').value");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});assert.notEqual(await evaluate("document.getElementById('column-minute').value"),before);
  await evaluate("document.getElementById('column-peak').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});near(Number(await evaluate("document.getElementById('column-inspect').dataset.subsurfaceC")),expectedPeakC);assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await evaluate("document.getElementById('column-results').scrollIntoView({block:'start',behavior:'instant'})");shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/column-narrow.png',Buffer.from(shot.data,'base64'));await evaluate("document.getElementById('column-inspect').scrollIntoView({block:'start',behavior:'instant'})");shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/column-ledger-narrow.png',Buffer.from(shot.data,'base64'));assert.deepEqual(exceptions,[]);
  checks.push('Actual desktop and390px traces and energy ledger fit viewport; keyboard time and peak controls inspect retained temperatures');
  return {checks,sandbox:session.sandbox,exceptions,independentControl:{expectedPeakMinute,expectedPeakC}};
 });console.log(JSON.stringify({status:'PASS',...result.value,receipt:result.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null},null,2));process.exitCode=1;}

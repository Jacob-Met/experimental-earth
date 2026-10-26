import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample,chooseInfiltrationObservation} from '../core.js';
import {withBrowserSession} from '../tests/support/browser-session.mjs';

const root=resolve(process.argv[2]||'.'),checks=[];
function course(size=12,index=78,duration=45,step=3) {
  const p=makeExample();p.width=p.height=size;p.selectedIndex=0;
  p.existing=Array.from({length:size*size},(_,i)=>({surface:i===index?'sealed':'garden',elevationM:0,provenance:'Authored complete-grid inquiry receiving'}));
  p.proposal=structuredClone(p.existing);
  Object.assign(p.weather,{rainMmHr:10,stormMinutes:15,durationMinutes:duration,stepMinutes:step,mobilityPerHour:.5,boundaryExitPerHour:.2,cellSizeM:1});
  return p;
}
const original=course();assert.equal(chooseInfiltrationObservation(original),null);
try {
 const received=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN||'/usr/bin/google-chrome-stable',runDirectory:process.env.BROWSER_RUN_DIRECTORY},async session=>{
  const {send,evaluate,exceptions}=session;await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  const wait=async(expression,label)=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await delay(25);}throw Error('Timed out: '+label);};
  const text=()=>evaluate("document.querySelector('#infiltration-reading').textContent");
  const load=async p=>{
   await evaluate(`window.receiverReloadPending=true;localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
   await send('Page.reload',{ignoreCache:true});
   await wait(`!window.receiverReloadPending && document.querySelectorAll('#proposal-grid .cell').length===${p.proposal.length} && !!document.querySelector('#infiltration-coverage')`,'fresh source');
  };
  const find=()=>evaluate("document.querySelector('#suggest-infiltration').click()");
  const mode=coverage=>evaluate(`document.querySelector('#infiltration-coverage').value=${JSON.stringify(coverage)};document.querySelector('#infiltration-coverage').dispatchEvent(new Event('change',{bubbles:true}))`);
  const screenshot=async name=>{
   await evaluate("document.documentElement.style.scrollBehavior='auto';document.querySelector('#observations-title').closest('section').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(session.runDirectory,name),Buffer.from(shot.data,'base64'));
  };
  await load(original);const started=performance.now();await find();await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Check G7:')",'omitted consequential cell');
  const elapsedMs=performance.now()-started;
  assert.match(await text(),/0\.634526 L/);assert.match(await text(),/144\/144 cells \(complete grid\)/);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).selectedIndex"),78);
  const retained=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  for(const key of ['existing','proposal','weather','observations'])assert.deepEqual(retained[key],original[key]);
  checks.push('actual complete-grid control finds omitted cell G7, exact displayed modeled effect and all144 cells; original authored source unchanged');
  await screenshot('infiltration-complete-desktop.png');
  await mode('shortlist');await find();await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Evaluated 36/144')",'partial no-effect disposition');
  assert.match(await text(),/untested cells remain unknown/);assert.match(await text(),/complete-grid inquiry may still find/);
  checks.push('explicit legacy shortlist remains partial and cannot call its null a complete-grid negative');
  await load(course(12,0));await find();await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Check A1:')",'new original changes winner');
  assert.match(await text(),/0\.835746 L/);checks.push('new original source changes visible selected location and modeled effect');
  await evaluate("document.querySelector('#rain').value='0';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  await find();await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Evaluated 144/144')",'dry full result');
  assert.match(await text(),/No tested material-range endpoint changes/);checks.push('actual dry event preserves complete no-effect qualification');
  await load(course(24,312,51,3));await find();await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Evaluating')",'live worker progress');
  await evaluate("document.querySelector('#map-view').value='surface';document.querySelector('#map-view').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#cancel-infiltration-inquiry').click()");
  assert.match(await text(),/cancelled; no partial result was adopted/);await delay(150);assert.match(await text(),/cancelled/);
  assert.equal(await evaluate("document.querySelector('#suggest-infiltration').disabled"),false);
  checks.push('largest admitted worker inquiry permits map interaction and explicit cancellation after progress without adopting partial output');
  await find();await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Evaluating')",'second live worker progress');
  await evaluate("document.querySelector('#rain').value='11';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.match(await text(),/Project changed; the pending infiltration inquiry was cancelled/);await delay(200);assert.match(await text(),/Project changed/);
  checks.push('source edit retires in-flight worker; no old result is applied');
  await load(course(24,312,240,5));
  await evaluate("window.receiverWorkers=0;window.OriginalWorker=Worker;window.Worker=class extends OriginalWorker{constructor(...a){super(...a);window.receiverWorkers++}};");
  await find();assert.match(await text(),/exceeds the work limit/);assert.match(await text(),/No cells were evaluated/);assert.equal(await evaluate('window.receiverWorkers'),0);
  await mode('shortlist');await find();await wait("document.querySelector('#infiltration-reading').textContent.includes('36/576 cells')",'explicit bounded shortlist');
  assert.match(await text(),/heuristic shortlist; untested cells remain unknown/);assert.equal(await evaluate('window.receiverWorkers'),1);
  checks.push('over-budget complete inquiry starts no worker and requires explicit shortlist selection; partial scope stays visible');
  await load(original);await evaluate("window.Worker=class {constructor(){throw Error('Receiver unavailable worker control')}}");await find();
  assert.match(await text(),/unavailable worker control/);assert.match(await text(),/No result was adopted/);
  checks.push('unavailable worker is an explicit refusal; no main-thread fallback or false success');
  await load(original);await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await evaluate("document.querySelector('#suggest-infiltration').focus()");
  assert.equal(await evaluate("document.activeElement.id"),'suggest-infiltration');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.querySelector('#infiltration-reading').textContent.startsWith('Check G7:')",'narrow keyboard inquiry');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);await screenshot('infiltration-complete-narrow.png');
  checks.push('390px actual keyboard inquiry, original result and visible controls without horizontal overflow');
  assert.deepEqual(exceptions,[]);
  return {checks,exceptions,sandbox:session.sandbox,diagnosticFirstInquiryMs:elapsedMs,baselineShortlistWinner:null,completeWinner:{cellIndex:78,impactLiters:.6345256532362199},timingQualification:'One receiving run, not a benchmark or wall-clock guarantee'};
 });
 console.log(JSON.stringify({status:'pass',...received.value,session:received.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'fail',error:String(error),checks,receipt:error.receipt??null},null,2));process.exitCode=1;}

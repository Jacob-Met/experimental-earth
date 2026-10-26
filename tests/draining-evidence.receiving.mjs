import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??'/tmp/earth-draining-evidence-'+randomUUID();
const checks=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async session=>{
 const {send,evaluate}=session;await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});await send('Page.reload',{ignoreCache:true});
 async function wait(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Timed out: '+label);}
 const state=value=>"document.querySelector('#de-status')?.dataset.state==="+JSON.stringify(value);
 async function run(expected){await evaluate("document.getElementById('de-form').requestSubmit()");await wait(state(expected),'evidence '+expected);}
 async function openFile(path){const doc=await send('DOM.getDocument');const field=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#de-open'});await send('DOM.setFileInputFiles',{nodeId:field.nodeId,files:[path]});}
 async function field(id,key,value){await evaluate("(()=>{const e=document.querySelector('#de-hypotheses [data-hypothesis=\""+id+"\"] [data-field=\""+key+"\"]');e.value="+JSON.stringify(value)+";e.dispatchEvent(new Event('input',{bubbles:true}))})()");}
 async function candidateState(){return evaluate("[...document.querySelectorAll('#de-results article[data-hypothesis]')].map(e=>({id:e.dataset.hypothesis,calibration:e.dataset.calibration,challenge:e.dataset.challenge}))");}
 const count=subset=>evaluate("Number(document.querySelector('#de-results [data-subset=\""+subset+"\"]').dataset.count)");
 await wait("Boolean(document.getElementById('de-form'))&&document.querySelectorAll('#existing-grid .cell').length===48",'maintained site with evidence consumer');
 const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");assert.ok(original);
 await evaluate("document.getElementById('de-example').click()");await run('one-survivor');
 const readQuestion=()=>evaluate("document.getElementById('de-question')?.textContent??''");
 const originalQuestion=await readQuestion();
 assert.match(originalQuestion,/separates 1 of 1/);
 assert.match(originalQuestion,/draining/);assert.match(originalQuestion,/closed-matched/);
 checks.push('maintained evidence consumer offers a modeled original-event depth question for both calibration-compatible explanations');

 const firstDepth=36-(5+19*Math.log(24/19));
 const prediction=async(id,row)=>Number(await evaluate("document.querySelector('#de-results article[data-hypothesis=\""+id+"\"] p[data-row=\""+row+"\"]').dataset.prediction"));
 assert(Math.abs(await prediction('draining',0)-firstDepth)<1e-8);assert(Math.abs(await prediction('closed-matched',0)-firstDepth)<1e-8);assert(Math.abs(await prediction('draining',1)-(firstDepth-10))<1e-8);
 const before=await candidateState();assert.equal(before.length,4);assert.equal(before.filter(c=>c.calibration==='true').length,2);
 assert.equal(before.find(c=>c.id==='draining').challenge,'true');assert.equal(before.find(c=>c.id==='closed-matched').challenge,'false');
 assert.equal(await count('all'),4);assert.equal(await count('calibration'),2);assert.equal(await count('surviving'),1);
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 checks.push('analytic early-depth ambiguity retains four offered rows, two calibrated explanations and one late survivor without replacing active site');
 const downloads=runDirectory+'/downloads';await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await evaluate("document.getElementById('de-save').click()");
 const savedPath=downloads+'/experimental-earth-draining-evidence.json';let encoded;
 for(let i=0;i<80;i++){try{encoded=await readFile(savedPath,'utf8');break;}catch{await delay(50);}}assert.ok(encoded);
 const saved=JSON.parse(encoded);assert.deepEqual(Object.keys(saved).sort(),['project','schema','study']);assert.equal(saved.schema,'experimental-earth-draining-evidence/1');assert.equal(saved.study.hypotheses.length,4);
 await send('Page.reload',{ignoreCache:true});await wait("Boolean(document.getElementById('de-open'))",'fresh page');await openFile(savedPath);await wait(state('one-survivor'),'fresh original replay');assert.deepEqual(await candidateState(),before);
 assert.equal(await readQuestion(),originalQuestion);
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);checks.push('actual source-only download and fresh-page upload recompute original hypotheses and evidence roles');
 const changed=structuredClone(saved);changed.project.observations.find(o=>o.use==='challenge').depthMm=changed.project.observations.find(o=>o.use==='calibration').depthMm;
 const changedPath=downloads+'/challenge-only.json';await writeFile(changedPath,JSON.stringify(changed));await openFile(changedPath);await wait(state('one-survivor'),'changed held-aside evidence');
 const after=await candidateState();assert.deepEqual(after.map(c=>[c.id,c.calibration]),before.map(c=>[c.id,c.calibration]));assert.equal(after.find(c=>c.id==='closed-matched').challenge,'true');assert.equal(after.find(c=>c.id==='draining').challenge,'false');assert.equal(await count('calibration'),2);assert.equal(await count('surviving'),1);
 checks.push('changing only held-aside depth changes surviving explanation while calibration remains fixed');
 assert.equal(await readQuestion(),originalQuestion);
 checks.push('original-input download/reopen and changed held-aside values preserve the calibration-only question');

 const rejected=structuredClone(saved);rejected.project.observations.find(o=>o.use==='challenge').depthMm=100;
 const rejectedPath=downloads+'/all-challenged.json';await writeFile(rejectedPath,JSON.stringify(rejected));await openFile(rejectedPath);await wait(state('challenged'),'all calibration survivors contradicted');
 assert.equal((await candidateState()).length,4);assert.equal(await count('calibration'),2);assert.equal(await count('surviving'),0);checks.push('all contradicted explanations retain their rows with zero surviving consequences and no fallback');

 const closed=structuredClone(saved);
 closed.project.title='Authored closed receiving layers: independent early and late depth controls';
 closed.project.weather.stepMinutes=5;
 closed.study.hypotheses=[5,6].map(capacityMm=>({id:capacityMm===5?'closed-five':'closed-six',label:'Closed '+capacityMm+' mm store',capacityMm,initialStoredMm:0,drainagePerHour:0,source:'Explicit authored closed-layer control; no field calibration'}));
 closed.project.observations=[
  {cellIndex:0,minute:5,depthMm:1,uncertaintyMm:.1,scenario:'proposal',use:'calibration',source:'Authored analytic early control: 3 mm rain minus 2 mm intake'},
  {cellIndex:0,minute:180,depthMm:31,uncertaintyMm:.1,scenario:'proposal',use:'challenge',source:'Authored analytic closed-five control: 36 mm rain minus 5 mm retained'}
 ];
 const closedPath=downloads+'/closed-five-six.json';await writeFile(closedPath,JSON.stringify(closed));
 await openFile(closedPath);await wait(state('one-survivor'),'independent closed-layer source');
 const closedRows=await candidateState();assert.equal(closedRows.length,2);assert.ok(closedRows.every(c=>c.calibration==='true'));
 assert.equal(closedRows.find(c=>c.id==='closed-five').challenge,'true');assert.equal(closedRows.find(c=>c.id==='closed-six').challenge,'false');
 assert(Math.abs(await prediction('closed-five',0)-1)<1e-8);assert(Math.abs(await prediction('closed-six',0)-1)<1e-8);
 assert(Math.abs(await prediction('closed-five',1)-31)<1e-8);assert(Math.abs(await prediction('closed-six',1)-30)<1e-8);
 const closedQuestion=await readQuestion();assert.match(closedQuestion,/A1/);assert.match(closedQuestion,/minute\s*15/i);assert.match(closedQuestion,/separates 1 of 1/);
 assert.match(closedQuestion,/closed-five/);assert.match(closedQuestion,/closed-six/);
 assert.notEqual(closedQuestion,originalQuestion);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 const swapped=structuredClone(closed);swapped.project.observations[1].depthMm=30;
 swapped.project.observations[1].source='Authored analytic closed-six control: 36 mm rain minus 6 mm retained';
 const swappedPath=downloads+'/closed-challenge-six.json';await writeFile(swappedPath,JSON.stringify(swapped));
 await openFile(swappedPath);await wait(state('one-survivor'),'changed independent challenge');
 const swappedRows=await candidateState();assert.equal(swappedRows.find(c=>c.id==='closed-six').challenge,'true');assert.equal(swappedRows.find(c=>c.id==='closed-five').challenge,'false');
 assert.equal(await readQuestion(),closedQuestion);
 checks.push('unfamiliar closed-five/six original upload matches independent early/late arithmetic and changes its useful question; challenge swap changes survivor without changing question');
 for(const [width,height,name]of [[1280,960,'question-desktop'],[390,844,'question-narrow']]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
  await evaluate("document.getElementById('de-question').scrollIntoView({behavior:'instant',block:'start'})");
  assert(await evaluate("(()=>{const r=document.getElementById('de-question').getBoundingClientRect();return r.top>=-1&&r.top<20&&r.width<=window.innerWidth})()"));
  assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'));
  await writeFile(runDirectory+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:960,deviceScaleFactor:1,mobile:false});
 const wide=structuredClone(closed);wide.project.observations[0].uncertaintyMm=100;
 const widePath=downloads+'/closed-wide-band.json';await writeFile(widePath,JSON.stringify(wide));
 await openFile(widePath);await wait(state('one-survivor'),'wide original calibration band');
 assert.match(await readQuestion(),/No unrecorded/i);assert.doesNotMatch(await readQuestion(),/separates 1 of 1/);
 checks.push('wide original calibration bands produce no separating question; actual question received at desktop and narrow widths');
 const malformedPath=downloads+'/malformed.json';await writeFile(malformedPath,JSON.stringify({...saved,results:{status:'one-survivor'}}));await openFile(malformedPath);await wait(state('refused'),'cached conclusion refused');assert.equal(await evaluate("document.getElementById('de-results').childElementCount"),0);assert(await evaluate("document.getElementById('de-save').disabled"));
 checks.push('malformed source envelope cannot retain successful output or enable save');
 await evaluate("document.getElementById('de-example').click()");
 await evaluate("window.evidenceNativeRead=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){const f=this;return new Promise((resolve,reject)=>{window.releaseEvidenceRead=()=>window.evidenceNativeRead.call(f).then(resolve,reject)})}");
 await openFile(savedPath);await wait(state('opening'),'delayed evidence file');await field('draining','capacityMm','6');
 await evaluate("window.releaseEvidenceRead();File.prototype.arrayBuffer=window.evidenceNativeRead");await delay(100);
 assert.equal(await evaluate("document.querySelector('#de-hypotheses [data-hypothesis=\"draining\"] [data-field=\"capacityMm\"]').value"),'6');assert(await evaluate(state('draft')));assert(await evaluate("document.getElementById('de-save').disabled"));checks.push('late original file cannot overwrite a new receiving declaration or resurrect its report');
 await evaluate("document.getElementById('dl-current').click()");
 for(const [id,value]of [['surface','garden'],['capacity','5'],['initial','0'],['drainage','1'],['source','Authored current-source receiving layer']]){
  await evaluate("(()=>{const e=document.getElementById('dl-"+id+"');e.value="+JSON.stringify(value)+";e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()");
 }
 await evaluate("document.getElementById('de-current').click();document.getElementById('de-add').click()");
 const added=await evaluate("document.querySelector('#de-hypotheses fieldset:last-child').dataset.hypothesis");
 for(const [key,value]of [['label','Distinct authored closed layer'],['capacityMm','10'],['initialStoredMm','0'],['drainagePerHour','0'],['source','Authored alternative for source-retirement control']])await field(added,key,value);
 await evaluate("(()=>{const e=document.getElementById('de-target');e.value='proposal';e.dispatchEvent(new Event('change',{bubbles:true}))})()");await run('need-calibration');
 await evaluate("(()=>{const e=document.getElementById('rain');e.value=Number(e.value)<250?String(Number(e.value)+1):'249';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()");
 await wait("document.getElementById('de-save').disabled&&document.getElementById('de-results').childElementCount===0",'changed active source retires prior evidence');checks.push('editing the actual current site retires the evidence tied to its previous source');
 await evaluate("document.getElementById('de-example').click()");await run('one-survivor');
 await evaluate("document.getElementById('dl-evidence').scrollIntoView({behavior:'instant',block:'start'})");assert(await evaluate("(()=>{const r=document.getElementById('dl-evidence').getBoundingClientRect();return r.top>=-1&&r.top<20})()"));
 await writeFile(runDirectory+'/desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await evaluate("document.getElementById('de-results').scrollIntoView({behavior:'instant',block:'start'})");assert(await evaluate("(()=>{const r=document.getElementById('de-results').getBoundingClientRect();return r.top>=-1&&r.top<20})()"));
 await writeFile(runDirectory+'/desktop-results.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.getElementById('de-results').scrollIntoView({behavior:'instant',block:'start'})");assert(await evaluate("(()=>{const r=document.getElementById('de-results').getBoundingClientRect();return r.top>=-1&&r.top<20})()"));assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'));
 await writeFile(runDirectory+'/mobile.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 assert.equal(session.exceptions.length,0,JSON.stringify(session.exceptions));checks.push('actual evidence controls and results received at desktop and390px with no document overflow or runtime exceptions');
 const receipt={schema:'experimental-earth-draining-evidence-receiving/1',passed:checks.length,checks,sandbox:session.sandbox,runDirectory};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
});

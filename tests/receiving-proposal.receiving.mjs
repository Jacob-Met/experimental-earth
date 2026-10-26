import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {makeDrainingEvidenceExample} from '../draining-layer-evidence.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??'/tmp/earth-receiving-proposal-'+randomUUID();
const checks=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async session=>{
 const {send,evaluate}=session;await send('Runtime.enable');await send('Page.enable');
 async function wait(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Timed out: '+label);}
 async function openFile(path){const doc=await send('DOM.getDocument');const field=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#de-open'});await send('DOM.setFileInputFiles',{nodeId:field.nodeId,files:[path]});await wait("!document.getElementById('de-save').disabled",'original source opened');}
 const text=()=>evaluate("document.getElementById('rp-status').textContent");
 const values=()=>evaluate("[...document.querySelectorAll('#de-hypotheses fieldset')].map(row=>[...row.querySelectorAll('input,textarea')].map(e=>e.value))");
 async function propose(){
  await send('Page.bringToFront');
  await evaluate("document.getElementById('rp-basis').scrollIntoView({behavior:'instant',block:'center'});document.getElementById('rp-basis').focus()");
  assert.equal(await evaluate('document.activeElement.id'),'rp-basis','visible assumption field must receive focus');
  await evaluate("window.proposalTrustedActivation=null;document.getElementById('rp-run').addEventListener('click',event=>{window.proposalTrustedActivation=event.isTrusted},{once:true})");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await wait("document.activeElement.id==='rp-run'",'keyboard navigation to proposal action');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait('window.proposalTrustedActivation===true','trusted keyboard activation');
  await wait("document.getElementById('rp-status').textContent.length>0",'keyboard proposal action result');
 }
 await wait("Boolean(document.getElementById('rp-run'))",'proposal consumer mounted');
 const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 const downloads=runDirectory+'/downloads';await mkdir(downloads);
 const fixture=makeDrainingEvidenceExample();fixture.project.weather.stepMinutes=5;
 // Independently calculated C8,k0.5: q4 and fill time -log(1-4/24)/0.5 hours.
 const fill=-Math.log1p(-4/24)/.5,H=36-(24*fill+4*(1-fill));
 fixture.project.observations=[
 {cellIndex:0,minute:60,depthMm:H,uncertaintyMm:.01,scenario:'proposal',use:'calibration',source:'Authored independent C8/k0.5 storm-end control'},
 {cellIndex:0,minute:180,depthMm:H-8,uncertaintyMm:.01,scenario:'proposal',use:'calibration',source:'Authored independent dry-period calibration'},
 {cellIndex:0,minute:240,depthMm:H-12,uncertaintyMm:.01,scenario:'proposal',use:'challenge',source:'Authored independent later check'}];
 const bundle={schema:'experimental-earth-draining-evidence/1',...fixture};
 const inputPath=downloads+'/original-inverse.json';await writeFile(inputPath,JSON.stringify(bundle));await openFile(inputPath);
 const before=await values();assert.equal(before.length,4);await propose();assert.match(await text(),/Confirm the initially empty/);
 await evaluate("document.getElementById('rp-empty').click();const b=document.getElementById('rp-basis');b.value='Authored isolated initially empty receiver';b.dispatchEvent(new Event('input',{bubbles:true}))");
 await propose();assert.match(await text(),/Review the proposals/);
 assert.equal(await evaluate("document.querySelectorAll('#rp-results article').length"),1);
 const proposed=await evaluate("document.querySelector('#rp-results article').textContent");assert.match(proposed,/8 mm storage/);assert.match(proposed,/0.5 \/hour drainage/);assert.match(proposed,/Original calibration: all bands compatible/);assert.match(proposed,/Held aside: all bands compatible/);
 assert.deepEqual(await values(),before);checks.push('keyboard-run original calibration inverse recovers independently authored 8 mm/0.5 per hour without modifying offered hypotheses');
 for(const [width,height,name]of [[1280,960,'proposal-desktop'],[390,844,'proposal-narrow']]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});await evaluate("document.getElementById('receiver-proposals').scrollIntoView({behavior:'instant',block:'start'})");assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'));await writeFile(runDirectory+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));}
 await evaluate("document.querySelector('#rp-results article button').click()");const added=await values();assert.equal(added.length,5);assert.deepEqual(added.slice(0,4),before);assert(Math.abs(Number(added[4][1])-8)<1e-10);assert(Math.abs(Number(added[4][3])-.5)<1e-10);
 assert.equal(await evaluate("document.querySelectorAll('#rp-results article').length"),0);
 await evaluate("document.getElementById('de-form').requestSubmit()");await wait("!document.getElementById('de-save').disabled",'added explanation evaluated');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await evaluate("document.getElementById('de-save').click()");
 const savedPath=downloads+'/experimental-earth-draining-evidence.json';let encoded;for(let i=0;i<80;i++){try{encoded=await readFile(savedPath,'utf8');break;}catch{await delay(50);}}assert.ok(encoded);
 const saved=JSON.parse(encoded);assert.equal(saved.study.hypotheses.length,5);assert.deepEqual(saved.project.observations,bundle.project.observations);assert.match(saved.study.hypotheses[4].source,/Initially empty/);
 await send('Page.reload',{ignoreCache:true});await wait("Boolean(document.getElementById('rp-run'))",'fresh consumer');await openFile(savedPath);assert.deepEqual(await values(),added);assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 checks.push('explicit add preserves four prior explanations; actual source-only download and fresh reopen retain editable inferred proposal and original observations');
 const changed=structuredClone(bundle);changed.project.observations[2].depthMm=100;const changedPath=downloads+'/held-aside-conflict.json';await writeFile(changedPath,JSON.stringify(changed));await openFile(changedPath);
 await evaluate("document.getElementById('rp-empty').click();const b=document.getElementById('rp-basis');b.value='Authored isolated initially empty receiver';b.dispatchEvent(new Event('input',{bubbles:true}))");await propose();const challenged=await evaluate("document.querySelector('#rp-results article').textContent");assert.match(challenged,/8 mm storage/);assert.match(challenged,/0.5 \/hour drainage/);assert.match(challenged,/Held aside: conflicting band/);
 assert.equal(await evaluate("document.querySelector('#rp-results article button').disabled"),false);checks.push('held-aside conflict challenges original proposal without refitting its values');
 const conflict=structuredClone(bundle);conflict.project.observations.push({...conflict.project.observations[2],minute:120,use:'calibration',depthMm:100});const conflictPath=downloads+'/calibration-conflict.json';await writeFile(conflictPath,JSON.stringify(conflict));await openFile(conflictPath);await propose();assert.match(await text(),/conflict with other original calibration/);assert(await evaluate("[...document.querySelectorAll('#rp-results article button')].every(b=>b.disabled)"));
 await evaluate("document.getElementById('de-example').click()");assert.equal(await evaluate("document.getElementById('rp-results').childElementCount"),0);await propose();assert.match(await text(),/Supply two calibration readings/);assert.equal(await evaluate("document.querySelectorAll('#rp-results article').length"),0);
 checks.push('conflicting calibration cannot be added; original one-calibration example cannot borrow its held-aside answer; changed source clears proposals');
 assert.equal(session.exceptions.length,0,JSON.stringify(session.exceptions));
 await writeFile(runDirectory+'/browser.json',JSON.stringify({schema:'experimental-earth-receiving-proposal/1',checks,passed:checks.length,sandbox:session.sandbox},null,2));console.log(JSON.stringify({passed:checks.length,checks,runDirectory}));
});

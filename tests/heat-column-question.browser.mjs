import assert from 'node:assert/strict';import{fileURLToPath}from'node:url';import{randomUUID}from'node:crypto';import{mkdir,writeFile,readFile,access}from'node:fs/promises';import{setTimeout as delay}from'node:timers/promises';
import{makeExample}from'../core.js';import{prepareSurfaceHeatStudy}from'../surface-heat.js';import{prepareHeatColumnStudy}from'../heat-column.js';import {prepareHeatColumnEvidence} from '../heat-column-evidence.js';
import{withBrowserSession}from'./support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-column-evidence-'+randomUUID(),checks=[];
const project=makeExample(),surface={absorptivity:.8,capacityJm2K:20000,exchangeWm2K:10,initialC:20,source:'Independent authored pulse; no measured surface properties'};
project.surfaceHeatStudy=prepareSurfaceHeatStudy(project,{cellIndex:0,existing:surface,proposal:surface,schedule:[{minutes:60,incidentWm2:700,reservoirC:20,source:'Authored heating pulse'},{minutes:360,incidentWm2:0,reservoirC:20,source:'Authored dark interval'}]});
const lower={capacityJm2K:80000,conductanceWm2K:20,initialC:20,source:'Authored lower store; no inferred depth'};project.heatColumnStudy=prepareHeatColumnStudy(project,{existing:lower,proposal:lower});
const literal='<img src=x onerror=window.__columnEvidenceInjected=1> Authored control, not an independent physical reading';
const hypotheses=[[60000,27.510121852810165],[80000,20],[120000,16.295174716022963],[240000,14.009639299457522],[500000,13.122086618787623]].map(([capacityJm2K,conductanceWm2K])=>({label:'C2 '+capacityJm2K,capacityJm2K,conductanceWm2K,source:literal}));
const calibration={minute:60,temperatureC:44.53099896635513,halfWidthC:.05,use:'calibration',source:'Authored60minute surface control'},challenge={minute:120,temperatureC:27.439654304992075,halfWidthC:.25,use:'challenge',source:literal};
project.heatColumnEvidence=prepareHeatColumnEvidence(project,{target:'existing',associationSource:literal,hypotheses,readings:[calibration,challenge]});
try { const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome'},async session=>{
 const {evaluate,send,exceptions}=session;await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
 for(let i=0;i<150;i++){if(await evaluate("Boolean(document.getElementById('column-question-form'))"))break;await delay(40);}
 const path=runDirectory+'/question-source.json';await writeFile(path,JSON.stringify(project));const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#import'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path]});await delay(250);
 const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await evaluate("document.getElementById('column-question-form').requestSubmit()");
 assert.equal(await evaluate("document.getElementById('column-question-status').dataset.state"),'question');
 assert.ok((await evaluate("document.getElementById('column-question-result').textContent")).includes(literal));
 assert.equal(await evaluate("document.querySelectorAll('#heat-column-question img').length"),0);
 assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
 checks.push('Imported source yields a question and literal sources, with original project unchanged');
 await evaluate("document.getElementById('column-question-width').value='100';document.getElementById('column-question-width').dispatchEvent(new Event('input',{bubbles:true}))");
 assert.equal(await evaluate("document.getElementById('column-question-result').children.length"),0);
 await evaluate("document.getElementById('column-question-form').requestSubmit()");assert.equal(await evaluate("document.getElementById('column-question-status').dataset.state"),'no-separating-time');
 await evaluate("document.getElementById('column-question-width').value='.25';document.getElementById('column-question-form').requestSubmit()");
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.getElementById('heat-column-question').scrollIntoView({block:'start',behavior:'instant'})");
 const desktop=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/question-desktop.png',Buffer.from(desktop.data,'base64'));
 await evaluate("document.querySelector('#column-question-result summary').focus()");assert.equal(await evaluate("document.activeElement===document.querySelector('#column-question-result summary')"),true);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});for(let i=0;i<50;i++){if(await evaluate("document.querySelector('#column-question-result details').open"))break;await delay(20);}assert.equal(await evaluate("document.querySelector('#column-question-result details').open"),true);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.getElementById('heat-column-question').scrollIntoView({block:'start',behavior:'instant'})");
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/question-narrow.png',Buffer.from(shot.data,'base64'));
 await send('Page.reload',{ignoreCache:true});await delay(300);assert.equal(await evaluate("document.getElementById('column-question-result').children.length"),0);
 await evaluate("document.getElementById('column-question-form').requestSubmit()");assert.equal(await evaluate("document.getElementById('column-question-status').dataset.state"),'question');
 assert.deepEqual(exceptions,[]);checks.push('Settings invalidate derived result, wide bands preserve no-signal, 390px fits, reopening recomputes');return {checks,sandbox:session.sandbox,exceptions};
 });await writeFile(runDirectory+'/receipt.json',JSON.stringify(result,null,2));console.log(JSON.stringify({runDirectory,...result}));}catch(error){console.error(error);process.exitCode=1;}

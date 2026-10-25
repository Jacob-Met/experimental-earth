import assert from 'node:assert/strict';
import {withBrowserSession} from './support/browser-session.mjs';
import {makeExample} from '../core.js';
import {fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.QA_OUTPUT?resolve(process.env.QA_OUTPUT):await mkdtemp(join(tmpdir(),'earth-storage-change-'));
await mkdir(output,{recursive:true});
const files=['observed-storage-change.js','observed-storage-change-panel.js','observed-storage-panel.js','observed-storage.js','core.js','tests/observed-storage-change.browser.mjs'];
const sourceHashes={};for(const path of files)sourceHashes[path]=createHash('sha256').update(await readFile(join(root,path))).digest('hex');
const receipt={passed:false,sourceHashes,download:'Export Blob intercepted and reimported; browser download transport not tested',screenshots:[],checks:[],exceptions:[]};
try {
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory:join(output,'browser-session')},async(session)=>{
 const {evaluate,send,exceptions}=session;receipt.sandboxAdmitted=session.sandbox.admitted;receipt.browser=session.sandbox.browser.product;receipt.exceptions=exceptions;
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 // Page.navigate returns before module initialization; static #import can exist
 // before its event listener. Wait for the dynamically mounted consumer first.
 for(let i=0;i<200;i++){if(await evaluate("!!document.querySelector('#storage-change-run')"))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate("!!document.querySelector('#storage-change-run')"),true,'Application module mounted before import');
 const p=makeExample();p.observations=[{cellIndex:0,minute:5,depthMm:8,uncertaintyMm:1,scenario:'existing',use:'challenge',source:'Authored <source> earlier'},{cellIndex:0,minute:10,depthMm:3,uncertaintyMm:1,scenario:'existing',use:'challenge',source:'Authored later'}];
 const intake=async data=>evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(data))}],'change.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,250));for(const [id,value] of [['#evidence-map-scenario','existing'],['#evidence-map-role','challenge']]){const select=document.querySelector(id);select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}for(let i=0;i<100;i++){if(document.querySelector('#storage-change-start').options.length===2)return;await new Promise(r=>setTimeout(r,50));}throw Error('Expected two source times: '+JSON.stringify({parentTimes:document.querySelector('#storage-minute').options.length,scenario:document.querySelector('#evidence-map-scenario').value,role:document.querySelector('#evidence-map-role').value,summary:document.querySelector('#evidence-map-summary').textContent,toast:document.querySelector('#toast')?.textContent,body:document.body.innerText.slice(-3000)}));})()`);
 const state=()=>evaluate("document.querySelector('#storage-change-result').dataset.state");
 const run=()=>evaluate("document.querySelector('#storage-change-run').click()");
 await intake(p);assert.deepEqual(await evaluate("Array.from(document.querySelector('#storage-change-start').options,o=>o.value)"),['5','10']);await run();assert.equal(await state(),'error');assert.match(await evaluate("document.querySelector('#storage-change-result').textContent"),/Declare why/);
 await evaluate("document.querySelector('#storage-change-basis').value='Authored same-event whole-cell control'");await run();assert.equal(await state(),'bounded',await evaluate("document.querySelector('#storage-change-result').textContent"));
 assert.match(await evaluate("document.querySelector('#storage-change-result').textContent"),/Whole-site change remains unknown/);
 assert.match(await evaluate("document.querySelector('#storage-change-result').textContent"),/Authored <source> earlier/);
 const exported=await evaluate(`(async()=>{let blob;const original=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{blob=b;return original.call(URL,b)};HTMLAnchorElement.prototype.click=function(){};try{document.querySelector('#export').click();return await blob.text();}finally{URL.createObjectURL=original;HTMLAnchorElement.prototype.click=click;}})()`);
 assert.deepEqual(JSON.parse(exported).observations,p.observations);
 await intake({...p,observations:[p.observations[0],{...p.observations[1],cellIndex:1}]});await run();assert.equal(await state(),'no-common-readings');
 await intake(JSON.parse(exported));assert.equal(await state(),'not-compared');await run();assert.equal(await state(),'bounded',await evaluate("document.querySelector('#storage-change-result').textContent"));
 await evaluate("{const b=document.querySelector('#storage-change-basis');b.dispatchEvent(new Event('input'));}");assert.equal(await state(),'not-compared');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
 await send('Page.bringToFront');await evaluate("(()=>{const button=document.querySelector('#storage-change-run');button.scrollIntoView({block:'center'});button.focus();})()");assert.equal(await evaluate("document.activeElement.id"),'storage-change-run');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});assert.equal(await state(),'bounded',await evaluate("document.querySelector('#storage-change-result').textContent"));
 receipt.checks=['declaration refusal','original source text','no-common negative control','export Blob/reimport','retirement','390px containment','Enter activation'];
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
  await new Promise(r=>setTimeout(r,80));
  const clip=await evaluate("(()=>{const r=document.querySelector('#observed-storage-change').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
  const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
  await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));receipt.screenshots.push(name+'.png');
 }
 assert.equal(exceptions.length,0,'No page exceptions');receipt.passed=true;
});

} catch(error) {receipt.failure=String(error.stack);throw error;} finally {await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({output,passed:receipt.passed,checks:receipt.checks.length}));}

import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
function fixture(){const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=p.proposal=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored'}));Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,20]};p.observations=[{cellIndex:0,minute:20,depthMm:10,uncertaintyMm:0,source:'authored',scenario:'existing',use:'calibration'},{cellIndex:0,minute:35,depthMm:15,uncertaintyMm:0,source:'authored',scenario:'existing',use:'challenge'}];return p;}
await withBrowserSession({root:resolve('.'),chromeBin:process.env.BROWSER_EXECUTABLE,runDirectory:process.env.RUN_DIRECTORY},async({evaluate,send,exceptions})=>{
 await new Promise(r=>setTimeout(r,350));const p=fixture();
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);await send('Page.reload',{ignoreCache:true});await new Promise(r=>setTimeout(r,350));
 const text=()=>evaluate("document.querySelector('#clock-results').textContent");
 await evaluate("document.querySelector('#compare-clock').click()");assert.match(await text(),/Describe why/);
 await evaluate("document.querySelector('#clock-reason').value='authored timing fixture';document.querySelector('#clock-offsets').value='0,10,30';document.querySelector('#compare-clock').click()");
 assert.match(await text(),/10 min: one-survivor/);assert.match(await text(),/30 min: refused/);assert.match(await text(),/0 min: calibration-rejected/);
 const saved=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.deepEqual(saved.observations,p.observations);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('#clock-study').scrollIntoView()");await new Promise(r=>setTimeout(r,250));assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
 const clip=await evaluate("(()=>{let r=document.querySelector('#clock-study').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");console.log(JSON.stringify(clip));const shot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});await writeFile(process.env.SCREENSHOT,Buffer.from(shot.data,'base64'));
 await evaluate("document.querySelector('#rain').value=0;document.querySelector('#rain').dispatchEvent(new Event('change'))");assert.equal(await text(),'');assert.deepEqual(exceptions,[]);console.log('PASS analytic clock offset, source requirement, window refusal, retained evidence, stale clearing and narrow layout');
});

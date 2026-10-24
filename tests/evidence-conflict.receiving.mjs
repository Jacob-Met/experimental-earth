import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeExample} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';
const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=p.proposal=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'analytic authored fixture'}));Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,20]};p.observations=[20,10].map(depthMm=>({cellIndex:0,minute:60,depthMm,uncertaintyMm:0,source:'authored <b>not markup</b>',scenario:'existing',use:'calibration'}));
await withBrowserSession({root:resolve('.'),chromeBin:process.env.BROWSER_EXECUTABLE,runDirectory:process.env.RUN_DIRECTORY},async({evaluate,send,exceptions})=>{
 await new Promise(r=>setTimeout(r,350));
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
 await send('Page.reload',{ignoreCache:true});await new Promise(r=>setTimeout(r,350));
 await evaluate("document.querySelector('#compare-infiltration').click();document.querySelector('#evidence-conflicts').open=true");
 const text=await evaluate("document.querySelector('#evidence-conflicts').textContent");
 assert.match(text,/Smallest jointly incompatible subset: readings 1, 2/);assert.match(text,/no shared candidate: 1 and 2/);assert.match(text,/reading 1 were left out diagnostically, remaining calibration bands permit 20 mm\/h/);
 assert.equal(await evaluate("document.querySelectorAll('#evidence-conflicts b').length"),0);
 const saved=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.deepEqual(saved.observations,p.observations);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('#evidence-conflicts').scrollIntoView()");await new Promise(r=>setTimeout(r,250));
 assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
 if(process.env.SCREENSHOT){const clip=await evaluate("(()=>{let r=document.querySelector('#evidence-conflicts').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");console.log(JSON.stringify(clip));const s=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});await writeFile(process.env.SCREENSHOT,Buffer.from(s.data,'base64'));}
 await evaluate("document.querySelector('#rain').value=0;document.querySelector('#rain').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('#evidence-conflicts')===null"),true);
 const joint=await evaluate(`(async()=>{const {renderEvidenceConflict}=await import('./evidence-conflict-panel.js');const project={observations:[0,1,2].map(i=>({scenario:'existing',use:'calibration',source:'authored support-matrix fixture '+i}))};const sets=[[0,1],[1,2],[0,2]];const report={status:'calibration-rejected',candidates:sets.map((support,rateMmHr)=>({rateMmHr,calibration:{errors:[0,1,2].map(index=>({index,withinBand:support.includes(index)}))}}))};return renderEvidenceConflict(project,{target:'existing'},report).textContent})()`);
 assert.match(joint,/Smallest jointly incompatible subset: readings 1, 2, 3/);assert.match(joint,/No pair of individually supported readings has disjoint/);
 assert.deepEqual(exceptions,[]);console.log('PASS conflict pair, omission support, safe source text, no evidence mutation, stale removal, narrow layout');
});

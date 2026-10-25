import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {fixture} from './wetting-front-refinement-fixture.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),runDirectory=resolve(process.env.BROWSER_RUN_DIRECTORY||`.browser-refinement-${Date.now()}`);
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory},async({send,evaluate,exceptions})=>{
 async function wait(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);}
 await wait("!!document.querySelector('#soil-search-form')");
 const {p,q}=fixture();
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))});location.reload()`);
 await wait("!!document.querySelector('#soil-search-form')");
 await evaluate(`(()=>{const f=document.querySelector('#soil-search-form');for(const [name,value] of Object.entries(${JSON.stringify({target:q.target,surface:q.surface,kmin:10,kmax:30,kcount:3,amin:0,amax:20,acount:3,basis:q.basis})}))f.elements.namedItem(name).value=value;for(let n=f;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;f.requestSubmit()})()`);
 await wait("document.querySelector('#soil-search-status').textContent.includes('9 tested pairs')");
 assert.match(await evaluate("document.querySelector('#soil-search-status').textContent"),/0 agree/);
 await evaluate("document.querySelector('#soil-search-refine').click()");
 await wait("document.querySelector('#soil-search-results').textContent.includes('automatically proposed pairs')");
 const refined=await evaluate("document.querySelector('#soil-search-status').textContent");assert.doesNotMatch(refined,/; 0 agree/);
 const count=await evaluate("document.querySelectorAll('#soil-search-results tbody tr').length");assert.ok(count>9&&count<=609);
 const unchanged=await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1'))");assert.deepEqual(unchanged,p);
 await evaluate("[...document.querySelectorAll('#soil-search-results tbody input')].slice(0,2).forEach(x=>x.click());document.querySelector('#soil-search-prepare').click()");
 assert.match(await evaluate("document.querySelector('#soil-search-status').textContent"),/comparison draft/);
 // Save actual browser-produced source input, then reopen via the ordinary file control.
 await evaluate("window.__saved=null;URL.createObjectURL=b=>{window.__saved=b;return 'blob:test'};HTMLAnchorElement.prototype.click=function(){};document.querySelector('#soil-search-save').click()");
 const saved=await evaluate("window.__saved.text()");assert.ok(JSON.parse(saved).method);
 await evaluate(`(()=>{const input=document.querySelector('#soil-search-import'),d=new DataTransfer();d.items.add(new File([${JSON.stringify(saved)}],'original-refinement.json',{type:'application/json'}));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait("document.querySelector('#soil-search-results').textContent.includes('Recomputed saved source')");
 assert.equal(await evaluate("document.querySelectorAll('#soil-search-results tbody tr').length"),count);
 for(const [name,width] of [['desktop',1280],['narrow',390]]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await evaluate("document.documentElement.style.scrollBehavior='auto';document.querySelector('#soil-search-status').scrollIntoView({behavior:'instant',block:'start'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
   const visible=await evaluate("(()=>{const s=document.querySelector('#soil-search-status').getBoundingClientRect(),t=document.querySelector('#soil-search-results .wf-table').getBoundingClientRect();return {statusTop:s.top,statusBottom:s.bottom,tableTop:t.top,tableBottom:t.bottom,height:innerHeight}})()");
   assert.ok(visible.statusTop>=-1&&visible.statusBottom<=visible.height,'Computed status must be visible');
   assert.ok(visible.tableTop>=0&&visible.tableTop<visible.height&&visible.tableBottom>visible.tableTop,'Result table must be visible');
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(runDirectory,`${name}.png`),Buffer.from(shot.data,'base64'));assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));}
 await evaluate("const f=document.querySelector('#soil-search-form');f.elements.namedItem('kmax').value='29';f.dispatchEvent(new Event('input',{bubbles:true}))");
 assert.equal(await evaluate("document.querySelector('#soil-search-results').children.length"),0);
 assert.equal(await evaluate("document.querySelector('#soil-search-refine').disabled"),true);
 assert.deepEqual(exceptions,[]);
 await writeFile(resolve(runDirectory,'refinement.json'),JSON.stringify({baseline:'9 tested; none compatible',refined,saveReopen:true,staleRetired:true,viewports:[1280,390],exceptions},null,2));
 console.log(JSON.stringify({runDirectory,refined,passed:true}));
});

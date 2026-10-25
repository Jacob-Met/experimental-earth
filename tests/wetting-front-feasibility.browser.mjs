import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {withBrowserSession} from './support/browser-session.mjs';
import {unequalBands} from './wetting-front-feasibility-fixture.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),runDirectory=resolve(process.env.BROWSER_RUN_DIRECTORY||`.browser-feasibility-${Date.now()}`);
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory},async({send,evaluate,exceptions})=>{
 async function wait(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression);}
 await wait("!!document.querySelector('#soil-search-form')");
 const {p,q}=unequalBands();
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))});location.reload()`);
 await wait("!!document.querySelector('#soil-search-form')");
 await evaluate(`(()=>{const f=document.querySelector('#soil-search-form');for(const [name,value] of Object.entries(${JSON.stringify({target:q.target,surface:q.surface,kmin:10,kmax:30,kcount:3,amin:0,amax:20,acount:3,basis:q.basis})}))f.elements.namedItem(name).value=value;for(let n=f;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;f.requestSubmit()})()`);
 await wait("document.querySelector('#soil-search-status').textContent.includes('9 tested pairs')");
 assert.match(await evaluate("document.querySelector('#soil-search-status').textContent"),/0 agree/);
 await evaluate("document.querySelector('#soil-search-refine').click()");
 await wait("document.querySelector('#soil-search-results').textContent.includes('automatically proposed pairs')");
 assert.match(await evaluate("document.querySelector('#soil-search-status').textContent"),/; 0 agree/);
 await evaluate("document.querySelector('#soil-search-feasibility').click()");
 await wait("document.querySelector('#soil-search-results').textContent.includes('original-band crossing proposals')");
 const refined=await evaluate("document.querySelector('#soil-search-status').textContent");assert.doesNotMatch(refined,/; 0 agree/);
 const count=await evaluate("document.querySelectorAll('#soil-search-results tbody tr').length");assert.ok(count>9&&count<=609);
 const unchanged=await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1'))");assert.deepEqual(unchanged,p);
 await evaluate("[...document.querySelectorAll('#soil-search-results tbody tr')].filter(tr=>tr.cells[4].textContent==='3/3').slice(0,2).forEach(tr=>tr.querySelector('input').click());document.querySelector('#soil-search-prepare').click()");
 assert.match(await evaluate("document.querySelector('#soil-search-status').textContent"),/comparison draft/);
 // Save actual browser-produced source input, then reopen via the ordinary file control.
 await evaluate("window.__saved=null;URL.createObjectURL=b=>{window.__saved=b;return 'blob:test'};HTMLAnchorElement.prototype.click=function(){};document.querySelector('#soil-search-save').click()");
 const saved=await evaluate("window.__saved.text()");assert.ok(JSON.parse(saved).method);
 await evaluate(`(()=>{const input=document.querySelector('#soil-search-import'),d=new DataTransfer();d.items.add(new File([${JSON.stringify(saved)}],'original-refinement.json',{type:'application/json'}));input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait("document.querySelector('#soil-search-results').textContent.includes('Recomputed saved source')");
 assert.equal(await evaluate("document.querySelectorAll('#soil-search-results tbody tr').length"),count);
 for(const [name,width] of [['desktop',1280],['narrow',390]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  for(const [part,selector] of [['status','#soil-search-status'],['table','#soil-search-results .wf-table']]){
   await evaluate(`document.documentElement.style.scrollBehavior='auto';document.querySelector(${JSON.stringify(selector)}).scrollIntoView({behavior:'instant',block:'start'});new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
   const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}})()`);
   assert.ok(box.top>=-1&&box.top<box.height&&box.bottom>0,'Critical result must be visible');
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(runDirectory,`${name}-${part}.png`),Buffer.from(shot.data,'base64'));
   assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  }
 }
 await evaluate("const f=document.querySelector('#soil-search-form');f.elements.namedItem('kmax').value='29';f.dispatchEvent(new Event('input',{bubbles:true}))");
 assert.equal(await evaluate("document.querySelector('#soil-search-results').children.length"),0);
 assert.equal(await evaluate("document.querySelector('#soil-search-refine').disabled"),true);
 // Carry the selected compatible proposals through the maintained paired-site consumer.
 await evaluate("document.querySelector('#wetting-front-form').requestSubmit()");
 await wait("document.querySelectorAll('#wetting-front-results .wf-choice').length===2");
 assert.ok(await evaluate("[...document.querySelectorAll('#wetting-front-results .wf-choice')].every(x=>x.textContent.includes('Calibration: 3/3 inside bands'))"));
 assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).observations"),p.observations);
 assert.deepEqual(exceptions,[]);
 await writeFile(resolve(runDirectory,'feasibility.json'),JSON.stringify({baseline:'Grid and simplex have no compatible proposal',refined,saveReopen:true,pairedConsumerCompatible:2,staleRetired:true,viewports:[1280,390],exceptions},null,2));
 console.log(JSON.stringify({runDirectory,refined,passed:true}));
});

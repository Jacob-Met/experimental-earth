import assert from 'node:assert/strict';
import {withBrowserSession} from './support/browser-session.mjs';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.browser-timed-route-'+randomUUID();
const outcomes=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/usr/local/bin/google-chrome',runDirectory}, async ({send,evaluate,exceptions})=>{
  await send('Runtime.enable');await send('Page.enable');
  // App startup computes the retained model and mounts the route panel.
  for(let i=0;i<60;i++){
    if(await evaluate("!!document.querySelector('#route-traversal-form')")) break;
    await delay(140);
  }
  assert.equal(await evaluate("!!document.querySelector('#route-traversal-form')"),true,'mounted app traversals');
  await evaluate("localStorage.clear()");
  const initial=await evaluate("({horizon:Number(document.querySelector('#ponding-minute').max), width:document.querySelectorAll('#existing-grid .cell').length, original:document.querySelector('#route-ponding-cells').value})");
  assert.equal(initial.width,48,'real application site');
  assert.ok(initial.horizon>3);
  await evaluate("(()=>{document.querySelector('#route-ponding-cells').value='D3 E3 F3';document.querySelector('#route-ponding-form').requestSubmit()})()");
  assert.match(await evaluate("document.querySelector('#route-ponding-windows').textContent"),/Authored route/);
  const upper=Math.min(10,initial.horizon-2);
  await evaluate(`(()=>{document.querySelector('#route-traversal-steps').value='1';document.querySelector('#route-traversal-start').value='0';document.querySelector('#route-traversal-end').value='${upper}';document.querySelector('#route-traversal-form').requestSubmit()})()`);
  const text=await evaluate("document.querySelector('#route-traversal-results').textContent");
  assert.match(text,/Existing:/);
  assert.match(text,/Proposal:/);
  assert.match(text,/modeled departure minutes/);
  assert.match(text,/first modeled exceedance|every cell is at\/below threshold/);
  assert.equal(await evaluate("document.querySelector('#route-traversal-error').textContent"),'');
  outcomes.push({input:'D3 E3 F3,1min/step,0..'+upper,pass:true,summary:text.slice(0,600)});
  await evaluate("(()=>{document.querySelector('#route-traversal-end').value='99999';document.querySelector('#route-traversal-form').requestSubmit()})()");
  assert.match(await evaluate("document.querySelector('#route-traversal-error').textContent"),/cannot be evaluated/);
  assert.equal(await evaluate("document.querySelector('#route-traversal-results').children.length"),0,'no stale results after refusal');
  await evaluate(`(()=>{document.querySelector('#route-traversal-end').value='${upper}';document.querySelector('#route-traversal-form').requestSubmit()})()`);
  assert.equal(await evaluate("document.querySelector('#route-traversal-error').textContent"),'');
  outcomes.push({input:'invalid horizon then recovery',pass:true});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(100);
  const dimensions=await evaluate("({inner:innerWidth,doc:document.documentElement.scrollWidth,form:!!document.querySelector('#route-traversal-form')})");
  assert.ok(dimensions.doc<=dimensions.inner+1,JSON.stringify(dimensions));
  outcomes.push({input:'390px mobile',pass:true,dimensions});
  assert.deepEqual(exceptions,[],'no browser script exceptions');
  outcomes.push({input:'browser exception recorder',pass:true});
});
console.log(JSON.stringify({pass:outcomes.length,outcomes,runDirectory},null,2));

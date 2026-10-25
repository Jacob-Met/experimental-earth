import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
export async function receiveRateEvents({evaluate,send,delay,report,artifactDirectory,pairPath}){
  const pair=JSON.parse(await readFile(pairPath,'utf8'));
  assert.equal(pair.sourceSha256,'6db82e5c484e99f1663e9b0e7259572be97a7c99e12a928db204403b7a23c9d9');
  const kinds=['DRY','WET'];for(const k of kinds)assert.ok(pair.events[k]?.length>=2,`Missing original ${k} event`);
  for(let i=0;i<40;i++){try{if(await evaluate("document.documentElement.dataset.rateEventsReady==='true'"))break;}catch{}await delay(100);}
  assert.equal(await evaluate("document.documentElement.dataset.rateEventsReady"),'true','Wait for installed module handlers, not just parsed HTML.');
  await evaluate("document.querySelector('#example').click()");
  for(let i=0;i<30;i++){if(!(await evaluate("document.querySelector('#download').disabled")))break;await delay(100);}
  assert.equal(await evaluate("document.querySelectorAll('#results article:first-of-type tbody tr').length"),13,await evaluate("JSON.stringify({ready:document.documentElement.dataset.rateEventsReady,status:document.querySelector('#status').textContent,results:document.querySelector('#results').textContent})"));
  assert.equal(await evaluate("document.querySelectorAll('#results article:nth-of-type(2) tbody tr').length"),38);
  assert.ok(await evaluate("document.querySelector('#results').textContent.includes('6db82e5c484e99f1663e9b0e7259572be97a7c99e12a928db204403b7a23c9d9')"));
  await evaluate("(async()=>{globalThis.exampleSource=await fetch('./research/usda-er2-rate-comparison.json').then(r=>r.text());globalThis.actualFetch=fetch;globalThis.fetch=()=>new Promise(resolve=>globalThis.finishExample=resolve);document.querySelector('#example').click();document.querySelector('[data-field=event]').value='Newer example source';document.querySelector('[data-field=event]').dispatchEvent(new Event('input',{bubbles:true}));globalThis.finishExample({ok:true,text:async()=>globalThis.exampleSource});globalThis.fetch=globalThis.actualFetch})()");await delay(50);
  assert.equal(await evaluate("document.querySelector('[data-field=event]').value"),'Newer example source');
  assert.equal(await evaluate("document.querySelector('#download').disabled"),true);
  async function upload(selector,path){const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector});assert.ok(nodeId,selector);await send('DOM.setFileInputFiles',{nodeId,files:[path]});}
  const originals=[];
  for(let i=0;i<2;i++){
    const csv='minute,rain_mm_hr,runon_mm_hr,runoff_mm_hr,source_line\n'+pair.events[kinds[i]].map(({raw:r,sourceLine})=>[r.Time,r.Precipitation,r['Run-on'],r.Runoff,sourceLine].join(',')).join('\n');
    originals.push(csv);const path=`${artifactDirectory}/original-${kinds[i]}.csv`;await writeFile(path,csv);
    await evaluate(`{const p=document.querySelector('[data-event="${i}"]');p.querySelector('[data-field="event"]').value=${JSON.stringify('ER2/N/1/2013-07-30 '+kinds[i])};p.querySelector('[data-field="source"]').value='USDA DOI10.15482/USDA.ADC/1358583; original revised flow rates. Sequential runs have different forcing and antecedent conditions.';}`);
    await upload(`[data-event="${i}"] [data-file]`,path);
    for(let j=0;j<30;j++){if(await evaluate(`document.querySelector('[data-event="${i}"] [data-field="text"]').value===${JSON.stringify(csv)}`))break;await delay(100);}
    assert.equal(await evaluate(`document.querySelector('[data-event="${i}"] [data-field="text"]').value`),csv);
    assert.equal(await evaluate(`document.querySelector('[data-event="${i}"] [data-file]').value`),'');
  }
  await evaluate("document.querySelector('#compare').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate("document.querySelector('#download').disabled"),false,await evaluate("document.querySelector('#status').textContent"));
  assert.equal(await evaluate("document.querySelectorAll('#results article').length"),2);
  assert.equal(await evaluate("document.querySelectorAll('#results article:first-of-type tbody tr').length"),pair.events.DRY.length);
  assert.equal(await evaluate("document.querySelectorAll('#results article:nth-of-type(2) tbody tr').length"),pair.events.WET.length);
  assert.equal(await evaluate("document.querySelectorAll('#results svg path,#results svg polyline,#results svg line').length"),0);
  assert.ok(await evaluate("document.querySelector('#results').textContent.includes('not file authentication')"));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:artifactDirectory});await evaluate("document.querySelector('#download').click()");
  const savedPath=artifactDirectory+'/original-rate-comparison.json';for(let i=0;i<30;i++){try{await access(savedPath);break;}catch{}await delay(100);}
  const saved=JSON.parse(await readFile(savedPath,'utf8'));assert.deepEqual(saved.events.map(e=>e.text),originals);assert.equal(saved.events[0].samples,undefined);
  // Diverge from the original before the actual downloaded-file replay.
  await evaluate("document.querySelector('[data-field=event]').value='Changed original';document.querySelector('[data-field=event]').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#download').disabled"),true);assert.equal(await evaluate("document.querySelector('#results').childElementCount"),0);
  await upload('#reopen',savedPath);for(let i=0;i<30;i++){if(!(await evaluate("document.querySelector('#download').disabled")))break;await delay(100);}
  assert.equal(await evaluate("document.querySelector('[data-field=event]').value"),saved.events[0].source.event);
  assert.equal(await evaluate("document.querySelector('#download').disabled"),false);
  assert.equal(await evaluate("document.querySelector('#reopen').value"),'');
  await evaluate("document.querySelector('[data-field=event]').value='Same-file restore control';document.querySelector('[data-field=event]').dispatchEvent(new Event('input',{bubbles:true}))");
  await upload('#reopen',savedPath);for(let i=0;i<30;i++){if(!(await evaluate("document.querySelector('#download').disabled")))break;await delay(100);}
  assert.equal(await evaluate("document.querySelector('[data-field=event]').value"),saved.events[0].source.event);
  // Newer source edits cancel a delayed replay; stale data cannot restore exports.
  await evaluate("globalThis.actualText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>globalThis.completeRateRead=resolve)}");
  const delayed=artifactDirectory+'/delayed-comparison.json';await writeFile(delayed,JSON.stringify(saved));await upload('#reopen',delayed);
  await evaluate(`document.querySelector('[data-field=event]').value='Newer source';document.querySelector('[data-field=event]').dispatchEvent(new Event('input',{bubbles:true}));globalThis.completeRateRead(${JSON.stringify(JSON.stringify(saved))});File.prototype.text=globalThis.actualText`);await delay(50);
  assert.equal(await evaluate("document.querySelector('[data-field=event]').value"),'Newer source');assert.equal(await evaluate("document.querySelector('#download').disabled"),true);assert.equal(await evaluate("document.querySelector('#results').childElementCount"),0);
  await upload('#reopen',savedPath);await delay(150);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
  const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))})");
  assert.ok(Math.abs(layout.width-390)<=1&&layout.scroll<=391,JSON.stringify(layout));assert.ok(layout.buttons.every(b=>b.width>=150&&b.height<80),JSON.stringify(layout));
  const tables=await evaluate("[...document.querySelectorAll('#results .table-scroll')].map(w=>({client:w.clientWidth,scroll:w.scrollWidth,singleLines:[...w.querySelectorAll('th,td')].every(c=>{const r=document.createRange();r.selectNodeContents(c);return r.getClientRects().length===1})}))");
  assert.ok(tables.length>=2&&tables.every(t=>t.scroll>t.client&&t.singleLines),JSON.stringify(tables));
  await evaluate("document.querySelector('#results .table-scroll').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  for(let i=0;i<10;i++){if(await evaluate("document.querySelector('#results .table-scroll').scrollLeft>0"))break;await delay(50);}
  assert.ok(await evaluate("document.querySelector('#results .table-scroll').scrollLeft>0"),'Original table must be horizontally keyboard-scrollable.');
  await evaluate("document.querySelector('#results .table-scroll').scrollLeft=0");
  await evaluate("document.querySelector('#results').scrollIntoView({block:'start',behavior:'instant'})");
  report.push('Acquired DRY/WET original CSV files, keyboard comparison, full source rows/point marks, original-only actual download/divergence/reopen, delayed replay cancellation and strict390');
}

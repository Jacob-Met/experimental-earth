import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
const root = process.env.APP_ROOT || new URL('../', import.meta.url).pathname;
const applicationUrl = process.env.APP_URL;
if (applicationUrl) { const u=new URL(applicationUrl);assert.equal(u.protocol,'http:');assert.equal(u.hostname,'127.0.0.1'); }
const runDirectory = process.env.BROWSER_RUN_DIRECTORY;
if (!runDirectory) throw Error('BROWSER_RUN_DIRECTORY is required for retained evidence');
await mkdir(runDirectory, { recursive: true });
const reports = [], photos = [], visibility = [];
const harness = await readFile(new URL('./observation-export.browser.mjs', import.meta.url),'utf8');
const injection = /await send\('Page.addScriptToEvaluateOnNewDocument', \{ source: ("(?:\\.|[^"])*") \}\);/.exec(harness);
assert.ok(injection, 'Reuse the maintained native-worker delivery fixture');
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN||'/opt/google/chrome/chrome',runDirectory:runDirectory+'/browser'},async({send,evaluate,exceptions,sandbox,baseUrl})=>{
 await send('Runtime.enable');await send('Page.enable');
 if(applicationUrl) await send('Page.navigate',{url:applicationUrl});
 async function wait(expression){for(let i=0;i<200;i++){try{if(await evaluate(expression))return;}catch(e){if(!/context.*destroyed|Cannot find.*context/i.test(String(e)))throw e;}await delay(75);}throw Error('Timed out: '+expression);}
 async function ready(){await wait("document.getElementById('rain-comparison-status')?.dataset.state==='ready' && !!document.getElementById('investigation-navigation')");}
 await ready();
 await evaluate("window.q=id=>document.getElementById(id);window.proj=()=>JSON.parse(localStorage.getItem('experimental-earth-site-v1'));");
 async function key(key,code,number){const text=key==='Enter'?{text:String.fromCharCode(13),unmodifiedText:String.fromCharCode(13)}:{};await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:number,...text});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:number});}
 const active=()=>evaluate("(()=>{const a=document.activeElement;return {tag:a.tagName,id:a.id,field:a.dataset.evidenceField||null,remove:a.hasAttribute('data-observation-remove'),connected:a.isConnected,inert:!!a.closest('[inert]'),row:a.closest('.observation')?.querySelector('strong')?.textContent||null,start:a.selectionStart,end:a.selectionEnd}})()");
 const rows=()=>evaluate("[...q('observation-list').querySelectorAll('.observation')].map(x=>x.querySelector('strong').textContent)");
 async function focus(field,row=0){await evaluate("(()=>{const r=q('observation-list').querySelectorAll('.observation')["+row+"];const e=r.querySelector("+JSON.stringify(field==='remove'?'button[data-observation-remove]':'[data-evidence-field="'+field+'"]')+");e.scrollIntoView({behavior:'instant',block:'center'});e.focus({preventScroll:true});})()");}
 async function change(field,row=0){await focus(field,row);const last=await evaluate("document.activeElement.selectedIndex===document.activeElement.options.length-1");await key(last?'ArrowUp':'ArrowDown',last?'ArrowUp':'ArrowDown',last?38:40);}
 async function add(minute){await evaluate("q('obs-minute').value='"+minute+"';q('obs-minute').dispatchEvent(new Event('input',{bubbles:true}));q('obs-depth').value='12';q('obs-uncertainty').value='1';q('obs-source').value='Focus course "+minute+"';q('obs-scenario').value='existing';q('obs-use').value='calibration';q('observe-form').requestSubmit();");await ready();}
 async function assertField(field,minute){const a=await active();assert.equal(a.field,field);assert.equal(a.connected,true);assert.equal(a.inert,false);assert.ok(a.row.includes(' · '+minute+' min ·'));return a;}
 for(const minute of [5,10,15]) await add(minute);
 const initial=await evaluate('proj()');
 await change('scenario');await assertField('scenario',15);
 await key('ArrowUp','ArrowUp',38);await assertField('scenario',15);
 await key('ArrowUp','ArrowUp',38);await assertField('scenario',15);
 assert.equal(await evaluate("q('observation-list').querySelector('[data-evidence-field=use]').disabled"),true);
 assert.equal(await evaluate('proj().observations[2].use'),'unassigned');
 await key('ArrowDown','ArrowDown',40);await assertField('scenario',15);
 await key('Tab','Tab',9);await assertField('use',15);
 await key('ArrowDown','ArrowDown',40);await assertField('use',15);
 await key('ArrowDown','ArrowDown',40);await assertField('use',15);
 assert.equal(await evaluate('proj().observations[2].use'),'challenge');
 const afterRoles=await evaluate('proj()');
 const expected=structuredClone(initial);expected.observations[2].use='challenge';
 assert.deepEqual(afterRoles,expected,'Only deliberately changed evidence role differs');
 reports.push('Native arrow and Tab continuation stays on exact reading/control, including unassigned scenario disabling/resetting use; original project otherwise exact.');
 async function bounds(label) { await evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))"); const v=await evaluate("(()=>{const a=document.activeElement,r=a.getBoundingClientRect();return {tag:a.tagName,id:a.id,field:a.dataset.evidenceField||null,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right},scrollY,viewport:{width:innerWidth,height:innerHeight},scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior,visible:r.width>0&&r.height>0&&r.top>=0&&r.left>=0&&r.bottom<=innerHeight&&r.right<=innerWidth,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===a}})()");visibility.push({label,...v});console.log(JSON.stringify({visibility:visibility.at(-1)}));return v; }
 async function photo(name,width){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await focus('use');assert.equal((await bounds(name+' before')).visible,true);await key('ArrowUp','ArrowUp',38);await assertField('use',15);const v=await bounds(name+' after');assert.equal(v.visible,true,'Restored control remains visible');assert.equal(v.hit,true,'Restored control is unobscured');const png=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/'+name,Buffer.from(png.data,'base64'));photos.push(name);}
 await photo('notebook-focus-desktop.png',1440);await photo('notebook-focus-narrow.png',390);
 await focus('remove');await key('Enter','Enter',13);assert.equal((await rows()).length,2);let a=await active();assert.equal(a.remove,true);assert.ok(a.row.includes(' · 10 min ·'));
 await key('Enter','Enter',13);assert.equal((await rows()).length,1);assert.ok((await active()).row.includes(' · 5 min ·'));
 await key('Enter','Enter',13);assert.equal((await rows()).length,0);assert.equal((await active()).id,'obs-depth');
 reports.push('Genuine Enter removes rows in sequence without refocusing and reaches depth entry when the notebook is empty.');
 for(const minute of [5,10,15,20])await add(minute);
 await focus('remove',2);await key('Enter','Enter',13);assert.ok((await active()).row.includes(' · 5 min ·'));
 await key('Enter','Enter',13);assert.ok((await active()).row.includes(' · 15 min ·'));
 reports.push('Middle removal follows reverse visual order; removing oldest falls back to previous visible reading.');
 // Every pending reply below is computed by the native application worker.
 await send('Page.addScriptToEvaluateOnNewDocument',{source:JSON.parse(injection[1])});
 await send('Page.reload',{ignoreCache:true});
 await wait("!!window.__csvWorkerDelivery && document.getElementById('rain-comparison-status')?.dataset.state==='ready'");
 await evaluate("window.q=id=>document.getElementById(id);window.proj=()=>JSON.parse(localStorage.getItem('experimental-earth-site-v1'));");
 async function importProject(value){await evaluate("(()=>{const d=new DataTransfer();d.items.add(new File(["+JSON.stringify(JSON.stringify(value))+"],'focus-project.json',{type:'application/json'}));q('import').files=d.files;q('import').dispatchEvent(new Event('change',{bubbles:true}));})()");}
 let large=await evaluate('proj()');large.title='Large focus source A';large.weather.durationMinutes=720;
 await importProject(large);await ready();
 assert.ok(await evaluate('__csvWorkerDelivery.workers.length>0'));
 async function hold(){await evaluate('__csvWorkerDelivery.hold=true');}
 async function queued(){await wait("__csvWorkerDelivery.workers.some(w=>!w.stopped&&w.queue.length)");}
 async function release(){await evaluate('__csvWorkerDelivery.release()');await ready();}
 async function pending(){await queued();const a=await active();assert.equal(a.id,'rain-comparison-message');assert.equal(await evaluate("q('observation-list').closest('.workspace').inert"),true);}
 await hold();await change('scenario');await pending();
 const savedBefore=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await release();assert.equal((await active()).field,'scenario');assert.equal((await active()).inert,false);assert.equal((await bounds('pending completion')).visible,true,'Pending completion keeps the reading visible');
 reports.push('Real completed worker reply remains held while notebook is inert; accepting it restores the original scenario control.');
 await hold();await change('scenario');await pending();
 await evaluate("window.staleFocusWorker=__csvWorkerDelivery.workers.findLast(w=>!w.stopped&&w.queue.length);window.staleFocusData=staleFocusWorker.queue[0].data;q('project-title').focus();q('project-title').value='Newer focus title';q('project-title').dispatchEvent(new Event('change',{bubbles:true}));q('project-title').setSelectionRange(2,7);");
 await queued();
 await evaluate("staleFocusWorker.dispatchEvent(new MessageEvent('message',{data:staleFocusData}))");
 assert.equal((await active()).id,'project-title');assert.equal(await evaluate("q('rain-comparison-status').dataset.state"),'pending');
 await release();a=await active();assert.equal(a.id,'project-title');assert.equal(a.start,2);assert.equal(a.end,7);assert.equal(await evaluate('proj().title'),'Newer focus title');
 reports.push('Superseding same-project work and delivering an old native reply preserves newer title focus and selection.');
 await hold();await change('scenario');await pending();
 const replacement=await evaluate('proj()');replacement.title='Replacement focus source B';
 await evaluate("window.staleFocusWorker=__csvWorkerDelivery.workers.findLast(w=>!w.stopped&&w.queue.length);window.staleFocusData=staleFocusWorker.queue[0].data;");
 await importProject(replacement);await queued();
 await evaluate("staleFocusWorker.dispatchEvent(new MessageEvent('message',{data:staleFocusData}))");
 assert.equal(await evaluate("q('rain-comparison-status').dataset.state"),'pending');
 await release();assert.equal((await active()).id,'project-title');assert.equal(await evaluate('proj().title'),replacement.title);
 assert.deepEqual(await evaluate('proj().observations'),replacement.observations);
 reports.push('Replacement project with lookalike reading values rejects old row identity and stale reply; no replacement reading gains focus.');
 await hold();await change('scenario');await pending();
 const accepted=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 await evaluate('__csvWorkerDelivery.failCompleted()');await wait("q('rain-comparison-status').dataset.state==='failed'");
 assert.equal((await active()).id,'rain-comparison-message');assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),accepted);
 await evaluate("q('retry-rain-comparison').focus()");await key('Enter','Enter',13);assert.equal((await active()).id,'rain-comparison-message','Retry must retain focus before its button disappears');await queued();await release();assert.equal((await active()).field,'scenario');
 reports.push('Worker failure preserves accepted save and pending focus; explicit native Retry returns to the original reading after success.');
 await hold();await focus('remove');await key('Enter','Enter',13);await pending();
 const countBefore=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).observations.length;
 await release();assert.equal(await evaluate('proj().observations.length'),countBefore-1);assert.equal((await active()).remove,true);
 reports.push('Pending removal keeps explicit deletion identity until native worker success and focuses the remaining reading.');
 await hold();await change('scenario');await pending();
 const priorRestore=await evaluate('proj()');
 await evaluate("q('restore-rain-comparison').focus()");await key('Enter','Enter',13);await ready();
 assert.equal((await active()).id,'project-title');assert.deepEqual(await evaluate('proj()'),priorRestore);
 reports.push('Explicit restore retains its established project-title destination and restores the exact accepted project.');
 assert.deepEqual(exceptions,[]);
 const result={reports,photos,visibility,applicationUrl:await evaluate('location.href'),sandbox,exceptions,sourceRoot:root,at:new Date().toISOString(),execution:'Root executed real Chromium with maintained sandbox admission; peers reviewed code and receiver plan.'};
 await writeFile(runDirectory+'/receiving.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
});

import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??resolve(root,'.browser-run-navigation-'+randomUUID());
const checks=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async session=>{
  const {send,evaluate,baseUrl,exceptions}=session;
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  async function wait(expression,label){
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}
    throw Error('Timed out: '+label);
  }
  async function click(selector){
    const rect=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing click target');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
  }
  async function search(value){
    await evaluate(`(()=>{const e=document.getElementById('investigation-search');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  }
  async function screenshot(name){
    const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(resolve(runDirectory,name),Buffer.from(data,'base64'));
  }
  await wait("document.querySelectorAll('#existing-grid .cell').length===48 && !!document.getElementById('investigation-search')",'maintained app and navigation');
  const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const inventory=await evaluate(`(()=>{const links=[...document.querySelectorAll('#investigation-results a')];return{count:links.length,unique:new Set(links.map(a=>a.hash)).size,allReachable:links.every(a=>!!document.getElementById(decodeURIComponent(a.hash.slice(1)))),titles:links.map(a=>a.querySelector('strong').textContent),height:document.documentElement.scrollHeight};})()`);
  assert.ok(inventory.count>=40,'assembled workbenches must be discoverable');assert.equal(inventory.unique,inventory.count);assert.ok(inventory.allReachable);
  assert.ok(inventory.titles.includes('How does a surface warm up and cool down?'));
  checks.push({name:'actual mounted inventory and destinations',count:inventory.count,pageHeight:inventory.height});
  await search('surface warm');
  assert.ok(await evaluate("!!document.querySelector('#investigation-results a[href=\"#surface-heat\"]')"));
  const composing=await evaluate("(()=>{const e=document.getElementById('investigation-search');e.focus();const before=location.hash;e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,isComposing:true}));return{before,after:location.hash,focusStayed:document.activeElement===e};})()");
  assert.equal(composing.after,composing.before);assert.equal(composing.focusStayed,true);
  checks.push({name:'IME composition Enter preserves search focus and fragment'});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("location.hash==='#surface-heat' && document.activeElement.closest('section.panel')?.id==='surface-heat'",'Enter reaches question and moves keyboard focus');
  checks.push({name:'search and keyboard Enter reach actual heat workbench'});
  await wait("!document.querySelector('.investigation-return').hidden",'return link after navigation');
  await click('.investigation-return');
  await wait("document.activeElement.id==='investigation-search'",'return restores search focus');
  await evaluate("document.getElementById('surface-heat').scrollIntoView({behavior:'instant'})");
  await wait("!document.querySelector('.investigation-return').hidden",'return link after manual scroll');
  await click('.investigation-return');
  await wait("document.activeElement.id==='investigation-search'",'repeated return fragment preserves search focus');
  await search('zzzz no such investigation');
  assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),0);
  assert.match(await evaluate("document.getElementById('investigation-search-status').textContent"),/No matching/);
  await click('#investigation-search-clear');
  assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),inventory.count);
  assert.equal(await evaluate("document.getElementById('investigation-search').value"),'');
  checks.push({name:'return, no-match and clear'});
  await search('heat');await evaluate("document.getElementById('investigation-navigation').scrollIntoView({behavior:'instant'})");
  await screenshot('navigation-desktop.png');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await delay(100);
  const widths=await evaluate("(()=>{const n=document.getElementById('investigation-navigation');return {viewport:innerWidth,width:n.getBoundingClientRect().width,scroll:n.scrollWidth,client:n.clientWidth};})()");
  assert.ok(widths.width<=390);assert.ok(widths.scroll<=widths.client+1);
  await screenshot('navigation-390.png');checks.push({name:'390px navigation layout',...widths});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

  // Dynamic tools are discovered from mounted content, including a closed parent.
  await evaluate(`(()=>{const d=document.createElement('details');d.id='navigation-receiving-details';d.innerHTML='<summary>Receiving-only group</summary><section class="panel" id="navigation-receiving-panel"><span class="eyebrow">METADATA ALBITE</span><h2>Receiving-only alpine soil question</h2><p>Receiving-only initial introduction.</p><input id="navigation-receiving-input"></section>';document.querySelector('.workspace').append(d);})()`);
  await wait("document.querySelectorAll('#investigation-results a').length>0",'navigation stays ready');
  await search('alpine soil');
  await wait("!!document.querySelector('#investigation-results a[href=\"#navigation-receiving-panel\"]')",'new mounted question');
  await click('#investigation-results a');
  await wait("document.getElementById('navigation-receiving-details').open && document.activeElement.tagName==='H2'",'closed parent is opened');
  await evaluate("document.getElementById('navigation-receiving-input').focus();document.querySelector('#navigation-receiving-panel h2').textContent='Receiving-only revised alpine question'");
  await delay(100);
  assert.equal(await evaluate("document.activeElement.id"),'navigation-receiving-input','index refresh must not steal an active form focus');
  await search('revised alpine');
  assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),1);
  // A rerender may replace the entire panel while its question and ID stay equal.
  await evaluate("(()=>{const p=document.getElementById('navigation-receiving-panel');p.replaceWith(p.cloneNode(true));document.getElementById('navigation-receiving-details').open=false;})()");
  await delay(100);
  await evaluate("document.getElementById('investigation-search').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.getElementById('navigation-receiving-details').open && document.activeElement===document.querySelector('#navigation-receiving-panel h2')",'identical replacement has live destination and focus');
  checks.push({name:'identical panel replacement retains live destination and keyboard focus'});
  await evaluate("(()=>{const h=document.querySelector('#navigation-receiving-panel h2');h.replaceWith(h.cloneNode(true));})()");
  await delay(100);
  await evaluate("document.getElementById('investigation-search').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait("document.activeElement===document.querySelector('#navigation-receiving-panel h2')",'heading-only replacement and repeated fragment focus');
  await evaluate("location.hash='#%6eavigation-receiving-panel'");
  await wait("document.activeElement===document.querySelector('#navigation-receiving-panel h2')",'equivalently encoded fragment reaches heading');
  const beforeRepeat=await evaluate("({hash:location.hash,length:history.length})");
  await evaluate("document.getElementById('investigation-search').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.equal(await evaluate("document.activeElement===document.querySelector('#navigation-receiving-panel h2')"),true);
  assert.deepEqual(await evaluate("({hash:location.hash,length:history.length})"),beforeRepeat);
  checks.push({name:'heading replacement and same-fragment activation focus the live heading'});
  await evaluate("document.querySelector('#navigation-receiving-panel p').textContent='Receiving-only quartz convection introduction';document.querySelector('#navigation-receiving-panel .eyebrow').textContent='METADATA CORUNDUM'");
  await delay(100);
  await search('quartz convection');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),1);
  await search('receiving-only initial');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),0);
  await search('corundum');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),1);
  await search('albite');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),0);
  await evaluate("(()=>{for(const [selector,text] of [['p','Receiving-only feldspar introduction'],['.eyebrow','METADATA KYANITE']]){const old=document.querySelector('#navigation-receiving-panel '+selector);const node=old.cloneNode(true);node.textContent=text;old.replaceWith(node);}})()");
  await delay(100);
  await search('feldspar');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),1);
  await search('quartz convection');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),0);
  await search('kyanite');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),1);
  await search('corundum');assert.equal(await evaluate("document.querySelectorAll('#investigation-results a').length"),0);
  checks.push({name:'changed and replaced introduction/topic text updates positive and negative search matches'});
  await search('revised alpine');
  await evaluate("document.getElementById('navigation-receiving-panel').hidden=true");
  await wait("document.querySelectorAll('#investigation-results a').length===0",'hidden tools excluded');
  await evaluate("document.getElementById('navigation-receiving-details').remove()");
  await search('');
  await wait("document.querySelectorAll('#investigation-results a').length==="+inventory.count,'removed tool retired');
  checks.push({name:'dynamic questions, closed parent, hidden/removal and form focus preservation'});
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original,'navigation must preserve exact retained project');
  checks.push({name:'all navigation leaves original project bytes unchanged'});

  // A native fragment requested before modules mount resolves after app startup.
  await send('Page.navigate',{url:baseUrl+'#surface-heat'});
  await wait("document.querySelectorAll('#existing-grid .cell').length===48 && document.activeElement.closest('section.panel')?.id==='surface-heat'",'direct link after fresh app load');
  checks.push({name:'direct fragment on fresh load'});

  // Exercise the unchanged scientific consumer reached through the finder.
  await click('#heat-example');await click('#heat-save');await click('#heat-run');
  await wait("document.getElementById('heat-status').dataset.state==='compared' && !!document.getElementById('heat-summary')",'existing heat comparison');
  const summary=await evaluate("document.getElementById('heat-summary').textContent");
  const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.ok(JSON.parse(saved).surfaceHeatStudy);
  const downloads=resolve(runDirectory,'downloads');await mkdir(downloads);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await click('#export');
  let file;
  for(let i=0;i<100;i++){file=(await readdir(downloads)).find(n=>n.endsWith('.json'));if(file)break;await delay(100);}
  assert.ok(file,'ordinary project export downloads JSON');
  const downloaded=JSON.parse(await readFile(resolve(downloads,file),'utf8'));
  assert.deepEqual(downloaded.surfaceHeatStudy,JSON.parse(saved).surfaceHeatStudy);
  await click('#reset');
  assert.equal(await evaluate("!!JSON.parse(localStorage.getItem('experimental-earth-site-v1')).surfaceHeatStudy"),false);
  const {root:dom}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:dom.nodeId,selector:'#import'});
  await send('DOM.setFileInputFiles',{nodeId,files:[resolve(downloads,file)]});
  await wait("!!JSON.parse(localStorage.getItem('experimental-earth-site-v1')).surfaceHeatStudy",'ordinary import retains original heat declaration');
  assert.deepEqual(await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).surfaceHeatStudy"),downloaded.surfaceHeatStudy);
  await click('#heat-run');
  await wait("document.getElementById('heat-status').dataset.state==='compared'",'reopened existing heat calculation');
  assert.equal(await evaluate("document.getElementById('heat-summary').textContent"),summary);
  checks.push({name:'existing heat calculation, actual export, reset, file import and identical recomputation',summary});
  assert.deepEqual(exceptions,[]);
  checks.push({name:'no application runtime exceptions'});
  await writeFile(resolve(runDirectory,'navigation-receipt.json'),JSON.stringify({checks,sandbox:session.sandbox},null,2)+'\n');
});
console.log(JSON.stringify({status:'passed',checks,runDirectory},null,2));

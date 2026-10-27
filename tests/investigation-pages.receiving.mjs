import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';

const root=process.env.BROWSER_SOURCE_ROOT??fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??resolve(root,'.browser-run-investigation-pages-'+randomUUID());
const report={status:'running',sourceRoot:root,checks:[],activations:[]};
const routes=[
  {query:'ponded',path:'ponded-uptake.html',heading:'What does a ponded soil test support?',selector:'#ponded-uptake h2',ready:"!!document.getElementById('uptake-input') && !!document.getElementById('uptake-run')",assets:['ponded-uptake-panel.js','ponded-uptake.js']},
  {query:'noaa',path:'noaa-hourly.html',heading:'What can these hourly surface readings challenge?',selector:'h1',ready:"document.getElementById('hypotheses')?.value && JSON.parse(document.getElementById('hypotheses').value).length===3 && document.getElementById('hourly-course-proposals')?.children.length>0",assets:['noaa-hourly.css','noaa-hourly-page.js','noaa-hourly.js']},
  {query:'rainfall runoff',path:'rate-events.html',heading:'Compare original rainfall and runoff events',selector:'h1',ready:"document.documentElement.dataset.rateEventsReady==='true'",assets:['rate-events.css','rate-events-page.js','rate-events.js']}
];
async function wait(probe,label,ms=15000) {
  const end=Date.now()+ms;
  do {const value=await probe();if(value)return value;await delay(75);}while(Date.now()<end);
  throw Error('Timed out: '+label);
}
async function pages(cdpUrl) {
  const response=await fetch(cdpUrl+'/json/list',{signal:AbortSignal.timeout(3000)});
  assert.ok(response.ok,'owned browser target list');
  return (await response.json()).filter(x=>x.type==='page');
}
async function connect(url) {
  const ws=new WebSocket(url),pending=new Map(),listeners=new Map();let serial=0;
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data)),request=pending.get(message.id);
    if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.no(Error(message.error.message)):request.yes(message.result);}
    else for(const listener of listeners.get(message.method)??[])listener(message.params);
  });
  ws.addEventListener('close',()=>{for(const p of pending.values()){clearTimeout(p.timer);p.no(Error('Child CDP closed'));}pending.clear();});
  await new Promise((yes,no)=>{
    const timer=setTimeout(()=>{ws.close();no(Error('Child CDP connection timeout'));},5000);
    ws.addEventListener('open',()=>{clearTimeout(timer);yes();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);no(Error('Child CDP connection failed'));},{once:true});
  });
  const client={
    on(method,listener){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(listener);},
    send(method,params={}){return new Promise((yes,no)=>{
      if(ws.readyState!==WebSocket.OPEN){no(Error('Child CDP disconnected'));return;}
      const id=++serial,timer=setTimeout(()=>{pending.delete(id);no(Error('Child CDP timed out: '+method));},5000);
      pending.set(id,{yes,no,timer});try{ws.send(JSON.stringify({id,method,params}));}catch(e){pending.delete(id);clearTimeout(timer);no(e);}
    });},
    async evaluate(expression){const r=await client.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;},
    close(){ws.close();}
  };
  return client;
}
async function receiveChild(session,before,route,activation) {
  let target,child;
  try {
    target=await wait(async()=>{
      const fresh=(await pages(session.cdpUrl)).filter(t=>!before.has(t.id));
      assert.ok(fresh.length<=1,'one activation must create only one page');
      return fresh[0]?.webSocketDebuggerUrl?fresh[0]:null;
    },'native new tab');
    child=await connect(target.webSocketDebuggerUrl);
    const initial=await wait(async()=>{const u=await child.evaluate('location.href');return u!=='about:blank'?u:null;},'native destination');
    const expected=new URL(route.path,session.baseUrl);
    assert.equal(new URL(initial).origin,expected.origin);assert.equal(new URL(initial).pathname,expected.pathname);
    assert.equal(await child.evaluate('window.opener===null'),true,'new tab must not retain an opener');
    const responses=[],failures=[],exceptions=[],requests=new Map();let receiving=false,loaderId;
    child.on('Network.requestWillBeSent',e=>{if(receiving){requests.set(e.requestId,{url:e.request.url,type:e.type,loaderId:e.loaderId});if(e.type==='Document')loaderId=e.loaderId;}});
    child.on('Network.responseReceived',e=>{const r=requests.get(e.requestId);if(r)responses.push({...r,status:e.response.status,mime:e.response.mimeType});});
    child.on('Network.loadingFailed',e=>{const r=requests.get(e.requestId);if(r)failures.push({...r,error:e.errorText});});
    child.on('Runtime.exceptionThrown',e=>{if(receiving)exceptions.push(e.exceptionDetails.exception?.description??e.exceptionDetails.text);});
    await Promise.all([child.send('Page.enable'),child.send('Runtime.enable'),child.send('Network.enable')]);
    await child.send('Network.setCacheDisabled',{cacheDisabled:true});
    await child.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    const token=randomUUID();
    await child.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__investigationPageAudit={token:"+JSON.stringify(token)+",errors:[]};addEventListener('error',e=>window.__investigationPageAudit.errors.push(String(e.message)));addEventListener('unhandledrejection',e=>window.__investigationPageAudit.errors.push(String(e.reason)));"});
    receiving=true;await child.send('Page.reload',{ignoreCache:true});
    const info=await wait(async()=>{
      try{return await child.evaluate("(()=>{const a=window.__investigationPageAudit;if(a?.token!=="+JSON.stringify(token)+"||document.readyState!=='complete'||!("+route.ready+"))return null;return{url:location.href,title:document.title,heading:document.querySelector("+JSON.stringify(route.selector)+")?.textContent.trim(),openerNull:window.opener===null,errors:a.errors};})()");}
      catch(e){if(/Execution context was destroyed|Cannot find context|Cannot find default execution context/.test(e.message))return null;throw e;}
    },'instrumented '+route.path+' startup');
    assert.equal(new URL(info.url).pathname,expected.pathname);assert.equal(info.heading,route.heading);assert.ok(info.title);
    assert.equal(info.openerNull,true);assert.deepEqual(info.errors,[]);assert.deepEqual(exceptions,[]);assert.ok(loaderId);
    const current=r=>r.loaderId===loaderId&&new URL(r.url).origin===expected.origin;
    const local=responses.filter(current),critical=local.filter(r=>['Document','Script','Stylesheet'].includes(r.type));
    assert.deepEqual(failures.filter(r=>current(r)&&['Document','Script','Stylesheet'].includes(r.type)),[]);
    assert.deepEqual(critical.filter(r=>r.status<200||r.status>=400),[]);
    for(const asset of route.assets)assert.ok(local.some(r=>new URL(r.url).pathname===new URL(asset,expected).pathname&&r.status>=200&&r.status<300),'served required asset '+asset);
    for(const r of critical){if(r.type==='Script')assert.match(r.mime,/javascript|ecmascript/i);if(r.type==='Stylesheet')assert.match(r.mime,/^text\/css/);}
    if(activation==='mouse'){const shot=await child.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(runDirectory,route.path.replace('.html','')+'-390.png'),Buffer.from(shot.data,'base64'));}
    assert.equal((await pages(session.cdpUrl)).filter(t=>!before.has(t.id)).length,1);
    return {route:route.path,activation,nativeOpenedPath:new URL(initial).pathname,newTargetCount:1,instrumentedReload:{path:new URL(info.url).pathname,heading:info.heading,openerNull:info.openerNull,ready:true,requiredAssetsPassed:true,runtimeExceptions:exceptions,pageErrors:info.errors,localAssets:local.map(r=>new URL(r.url).pathname)}};
  } finally {
    child?.close();
    if(target){const response=await fetch(session.cdpUrl+'/json/close/'+encodeURIComponent(target.id),{signal:AbortSignal.timeout(3000)});assert.ok(response.ok,'close only the received child');}
  }
}
try {
  await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async session=>{
    const {send,evaluate}=session;
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
    const ready=expression=>wait(()=>evaluate(expression),expression);
    await ready("document.querySelectorAll('#existing-grid .cell').length===48&&!!document.querySelector('#investigation-search')&&!!localStorage.getItem('experimental-earth-site-v1')");
    async function key(key,code=key,number){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,...(number?{windowsVirtualKeyCode:number}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,...(number?{windowsVirtualKeyCode:number}:{})});}
    async function click(selector){
      const rect=await evaluate("(()=>{const e=document.querySelector("+JSON.stringify(selector)+");if(!e)throw Error('missing target');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()");
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
    }
    async function search(text){await click('#investigation-search');await evaluate("document.querySelector('#investigation-search').select()");await key('Backspace','Backspace',8);if(text)await send('Input.insertText',{text});}
    const matching=()=>evaluate("[...document.querySelectorAll('#investigation-results a')].map(a=>({path:new URL(a.href).pathname,href:a.href,title:a.querySelector('strong')?.textContent,target:a.target,rel:a.rel,text:a.textContent}))");
    report.sourceLinks=await evaluate("[...document.querySelectorAll('main a[href]')].filter(a=>!a.closest('#investigation-navigation')&&/\\.html(?:[?#]|$)/i.test(a.getAttribute('href'))).map(a=>({title:a.textContent.trim(),path:new URL(a.href).pathname,href:a.href}))");
    for(const route of routes){
      await search(route.query);const result=(await matching()).find(a=>a.path===new URL(route.path,session.baseUrl).pathname);
      assert.ok(result,'finder must offer actual '+route.path+' for '+route.query);
      const original=report.sourceLinks.find(a=>a.path===result.path);
      assert.ok(original);assert.equal(result.title,original.title);assert.equal(result.target,'_blank');assert.ok(result.rel.split(/\s+/).includes('noopener'));assert.match(result.text,/Opens in a new tab/);
    }
    report.checks.push('all three actual destinations and original labels are discoverable');
    const originalUrl=await evaluate('location.href'),originalProject=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
    async function exportProject(label){
      const directory=resolve(runDirectory,label);await mkdir(directory);
      await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('#export');
      const name=await wait(async()=>{const files=await readdir(directory);return files.find(f=>f.endsWith('.json'));},'actual project download');
      return readFile(resolve(directory,name),'utf8');
    }
    const originalExport=await exportProject('original-export');
    await click('#column-existing-source');await evaluate("document.querySelector('#column-existing-source').select()");
    const sentinel='private-draft-'+randomUUID();await send('Input.insertText',{text:sentinel});
    const draft=await evaluate("({value:document.querySelector('#column-existing-source').value,selectionStart:document.querySelector('#column-existing-source').selectionStart,selectionEnd:document.querySelector('#column-existing-source').selectionEnd})");
    assert.equal(draft.value,sentinel);
    await evaluate("window.__navigationSubmits=0;document.addEventListener('submit',()=>window.__navigationSubmits++,true);window.__draftReads=0;(()=>{const e=document.querySelector('#column-existing-source'),p=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value');Object.defineProperty(e,'value',{configurable:true,get(){window.__draftReads++;return p.get.call(this)},set(v){p.set.call(this,v)}})})()");
    await search(sentinel);assert.equal((await matching()).length,0);assert.equal(await evaluate('window.__draftReads'),0,'finder must not inspect unfinished field values');
    await evaluate("delete document.querySelector('#column-existing-source').value");
    report.checks.push('private unfinished draft is not searched or read');
    for(const activation of ['mouse','keyboard'])for(const route of routes){
      await search(route.query);const result=(await matching()).find(a=>a.path===new URL(route.path,session.baseUrl).pathname);assert.ok(result);
      const before=new Set((await pages(session.cdpUrl)).map(t=>t.id));
      const selector='#investigation-results a[href='+JSON.stringify(result.href)+']';
      if(activation==='mouse')await click(selector);
      else{
        let reached=false;
        for(let i=0;i<14;i++){await key('Tab','Tab',9);if(await evaluate("document.activeElement?.href==="+JSON.stringify(result.href))){reached=true;break;}}
        assert.ok(reached,'native Tab reaches '+route.path);await key('Enter','Enter',13);
      }
      report.activations.push(await receiveChild(session,before,route,activation));
      await send('Page.bringToFront');
      assert.equal(await evaluate('location.href'),originalUrl);
      assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),originalProject);
      assert.deepEqual(await evaluate("({value:document.querySelector('#column-existing-source').value,selectionStart:document.querySelector('#column-existing-source').selectionStart,selectionEnd:document.querySelector('#column-existing-source').selectionEnd})"),draft);
    }
    const finalExport=await exportProject('retained-export');
    assert.equal(finalExport,originalExport,'ordinary download preserves exact original project bytes');
    assert.equal(await evaluate('window.__navigationSubmits'),0);
    report.checks.push('six native openings preserve opener URL, exact project/download bytes and unfinished draft/selection without form submission');
    report.projectSha256=createHash('sha256').update(originalExport).digest('hex');
    const beforeEmpty=new Set((await pages(session.cdpUrl)).map(t=>t.id));await search('no such investigation '+randomUUID());await key('Enter','Enter',13);
    assert.equal((await matching()).length,0);assert.deepEqual(new Set((await pages(session.cdpUrl)).map(t=>t.id)),beforeEmpty);
    await search('ponded');await evaluate("document.querySelector('#investigation-navigation').scrollIntoView({block:'start',behavior:'instant'})");
    const widths=await evaluate("(()=>{const n=document.querySelector('#investigation-navigation');return{viewport:innerWidth,width:n.getBoundingClientRect().width,scroll:n.scrollWidth,client:n.clientWidth}})()");
    assert.ok(widths.width<=390);assert.ok(widths.scroll<=widths.client+1);report.widths=widths;
    let shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(runDirectory,'finder-390.png'),Buffer.from(shot.data,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await search('noaa');await evaluate("document.querySelector('#investigation-navigation').scrollIntoView({block:'start',behavior:'instant'})");
    shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(runDirectory,'finder-desktop.png'),Buffer.from(shot.data,'base64'));
    report.checks.push('no-match Enter opens nothing; new cards remain contained at 390px');
    // Dynamic source metadata, eligibility and duplicate retirement are actual DOM behavior.
    await evaluate("(()=>{const d=document.createElement('div');d.id='receiving-page-sources';d.innerHTML='<p><a id=\"receiving-page-first\" href=\"./rate-events.html?receiving=1#source\"><span>Receiving alpha source</span></a></p><p><a id=\"receiving-page-second\" href=\"./rate-events.html?receiving=1#source\">Receiving duplicate source</a></p>';document.querySelector('main').append(d)})()");
    await search('Receiving alpha');await ready("document.querySelectorAll('#investigation-results a').length===1");
    await evaluate("document.querySelector('#receiving-page-first span').textContent='Receiving beta source'");
    await ready("document.querySelectorAll('#investigation-results a').length===0");await search('Receiving beta');assert.equal((await matching()).length,1);
    await evaluate("document.querySelector('#receiving-page-first span').textContent=''");
    await ready("document.querySelectorAll('#investigation-results a').length===0");
    await evaluate("document.querySelector('#receiving-page-first span').textContent='Receiving beta source'");
    await ready("document.querySelectorAll('#investigation-results a').length===1");
    assert.ok((await matching())[0].href.endsWith('?receiving=1#source'));
    assert.equal(await evaluate("document.querySelector('#investigation-search').value"),'Receiving beta');
    assert.equal(await evaluate("(()=>{const span=document.querySelector('#receiving-page-first span');window.__receivingTitleText=span.firstChild;window.__receivingTitleText.data='';return window.__receivingTitleText.isConnected&&span.firstChild===window.__receivingTitleText})()"),true);
    await ready("document.querySelectorAll('#investigation-results a').length===0");
    await evaluate("window.__receivingTitleText.data='Receiving beta source'");
    await ready("document.querySelectorAll('#investigation-results a').length===1");
    assert.ok((await matching())[0].href.endsWith('?receiving=1#source'));
    assert.equal(await evaluate("document.querySelector('#investigation-search').value"),'Receiving beta');
    report.checks.push('temporarily empty source titles restore through childList and retained Text characterData mutations without changing the query');
    await evaluate("document.querySelector('#receiving-page-first span').setAttribute('contenteditable','true')");
    await ready("document.querySelectorAll('#investigation-results a').length===0");
    await evaluate("document.querySelector('#receiving-page-first span').removeAttribute('contenteditable')");
    await ready("document.querySelectorAll('#investigation-results a').length===1");
    await evaluate("document.querySelector('#receiving-page-first').hidden=true");await search('Receiving duplicate');await ready("document.querySelectorAll('#investigation-results a').length===1");
    await evaluate("document.querySelector('#receiving-page-first').remove()");await ready("document.querySelectorAll('#investigation-results a').length===1");
    for(const href of ['./index.html?receiving=1#source','./?receiving=1','https://example.invalid/other.html','javascript:alert(1)']){
      await evaluate("document.querySelector('#receiving-page-second').setAttribute('href',"+JSON.stringify(href)+")");await ready("document.querySelectorAll('#investigation-results a').length===0");
    }
    await evaluate("document.querySelector('#receiving-page-second').href='./rate-events.html?receiving=2'");
    await ready("document.querySelectorAll('#investigation-results a').length===1");assert.ok((await matching())[0].href.endsWith('?receiving=2'));
    await evaluate("document.querySelector('#receiving-page-second').download='source.html'");await ready("document.querySelectorAll('#investigation-results a').length===0");
    await evaluate("document.querySelector('#receiving-page-second').removeAttribute('download')");await ready("document.querySelectorAll('#investigation-results a').length===1");
    await evaluate("document.querySelector('#receiving-page-sources').remove()");await ready("document.querySelectorAll('#investigation-results a').length===0");
    report.checks.push('live source labels/href/visibility/download/editability update; duplicate successor retained; current/external/script URLs excluded');
    await search('surface warm');const beforeSection=new Set((await pages(session.cdpUrl)).map(t=>t.id));await click('#investigation-results a[href="#surface-heat"]');
    await ready("location.hash==='#surface-heat'&&document.activeElement.closest('section.panel')?.id==='surface-heat'");
    assert.deepEqual(new Set((await pages(session.cdpUrl)).map(t=>t.id)),beforeSection);
    assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),originalProject);
    assert.equal(await evaluate("document.querySelector('#column-existing-source').value"),sentinel);
    assert.deepEqual(session.exceptions,[]);
    report.checks.push('mounted section still reveals/focuses in same tab; source and draft remain; no observed runtime exceptions');
    report.sandbox=session.sandbox;
  });
  report.status='passed';
} catch(error) {
  report.status='failed';report.failure=String(error.stack??error);
  await writeFile(resolve(runDirectory,'investigation-pages-receipt.json'),JSON.stringify(report,null,2)+'\n');
  throw error;
}
await writeFile(resolve(runDirectory,'investigation-pages-receipt.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

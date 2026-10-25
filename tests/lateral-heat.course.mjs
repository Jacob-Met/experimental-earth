/** Maintained HAMON Chromium owner + actual EARTH original-input receiving. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {withBrowserSession} from './support/browser-session.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runDirectory=resolve(process.env.BROWSER_RUN_DIRECTORY || `/tmp/earth-lateral-${randomUUID()}`);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const report={status:'FAIL',checks:[],scope:'Authored coupled-model software receiving; no physical temperature validation'};
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN || '/opt/google/chrome/chrome',runDirectory},async({evaluate,send,exceptions})=>{
  await send('Runtime.enable');await send('Page.enable');
  // Receive module startup with exception events enabled in this same browser.
  await evaluate('window.__lateralReloadMarker=true');
  await send('Page.reload',{ignoreCache:true});
  const pass=text=>report.checks.push(text);
  const text=id=>evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
  async function waitFor(expression){
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}
    const diagnostic=await evaluate(`({heat:document.getElementById('heat-status')?.textContent,lateral:document.getElementById('lateral-status')?.textContent,active:document.activeElement?.id,runDisabled:document.getElementById('lateral-run')?.disabled,neighbor:document.getElementById('lateral-neighbor')?.value,capacity:document.getElementById('lateral-neighbor-capacityJm2K')?.value,edge:document.getElementById('lateral-conductance')?.value,invalid:[...document.querySelectorAll('#heat-form :invalid,#lateral-form :invalid')].map(x=>({id:x.id,message:x.validationMessage})),savedHeat:Boolean(JSON.parse(localStorage.getItem('experimental-earth-site-v1')||'null')?.surfaceHeatStudy)})`);
    throw Error('Condition did not arrive: '+expression+'; '+JSON.stringify({diagnostic,exceptions}));
  }
  async function compare(){await evaluate("document.getElementById('lateral-form').requestSubmit()");await waitFor("document.getElementById('lateral-status').textContent.startsWith('Compared original inputs')");}
  async function screenshot(name,selector,width,height){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
    await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();window.scrollTo({top:window.scrollY+r.top-24,left:0,behavior:'instant'});return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`);await delay(100);
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/'+name,Buffer.from(shot.data,'base64'));
  }
  await waitFor("window.__lateralReloadMarker!==true && Boolean(document.getElementById('lateral-form'))");
  await evaluate("document.getElementById('heat-example').click();document.getElementById('heat-form').requestSubmit();document.getElementById('lateral-example').click();document.getElementById('lateral-run').focus()");
  await evaluate("window.__lateralKeyboardReceipt={};document.getElementById('lateral-run').addEventListener('keydown',e=>{if(e.key==='Enter')window.__lateralKeyboardReceipt.keyTrusted=e.isTrusted},{once:true});document.getElementById('lateral-form').addEventListener('submit',e=>{window.__lateralKeyboardReceipt.submitTrusted=e.isTrusted},{once:true})");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor("document.getElementById('lateral-status').textContent.startsWith('Compared original inputs')");
  assert.deepEqual(await evaluate('window.__lateralKeyboardReceipt'),{keyTrusted:true,submitTrusted:true});
  const initial=await text('lateral-results');
  assert.match(initial,/Final proposal minus existing/);assert.match(initial,/without lateral exchange/);assert.match(initial,/halving 30 to 15 s/);
  const originalWorkspace=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  pass('Real keyboard comparison receives both cells, isolated control and refinement');
  await screenshot('lateral-declaration-desktop.png','#lateral-heat',1280,900);
  await screenshot('lateral-desktop.png','#lateral-results',1280,900);
  const downloads=runDirectory+'/downloads';await mkdir(downloads);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await evaluate("document.getElementById('lateral-export').click()");
  const downloaded=downloads+'/experimental-earth-lateral-heat.json';
  for(let i=0;i<100;i++){try{await access(downloaded);break;}catch{await delay(50);}}
  const bytes=await readFile(downloaded,'utf8'),bundle=JSON.parse(bytes);
  assert.equal(bundle.schema,'experimental-earth-lateral-bundle/1');assert.ok(bundle.project.surfaceHeatStudy);assert.match(bundle.study.neighbor.source,/Fictional/);
  await evaluate("document.getElementById('lateral-neighbor-capacityJm2K').value='';document.getElementById('lateral-neighbor-capacityJm2K').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('lateral-form').requestSubmit()");
  assert.equal(await text('lateral-results'),'');assert.equal(await evaluate("document.getElementById('lateral-export').disabled"),true);
  assert.equal(await evaluate("document.getElementById('lateral-form').checkValidity()"),false);
  pass('Blank required heat capacity cannot preserve a successful result or export');
  await evaluate('window.__lateralReloadMarker=true');
  await send('Page.reload',{ignoreCache:true});await waitFor("window.__lateralReloadMarker!==true && Boolean(document.getElementById('lateral-import'))");
  let doc=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#lateral-import'});
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[downloaded]});
  await waitFor("document.getElementById('lateral-status').textContent.startsWith('Compared original inputs')");
  const reopened=await text('lateral-results');assert.match(reopened,/Reopened original project/);
  assert.equal(await evaluate("document.getElementById('lateral-neighbor-capacityJm2K').value"),'80000');
  assert.equal(await evaluate("document.getElementById('lateral-conductance').value"),'80');
  assert.equal(reopened.split('Final proposal minus existing:')[1],initial.split('Final proposal minus existing:')[1]);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),originalWorkspace);
  pass('Actual download bytes and native file reopen recompute same effect without workspace mutation');
  await screenshot('lateral-narrow.png','#lateral-heat',390,844);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await screenshot('lateral-narrow-results.png','#lateral-results',390,844);
  await evaluate("document.getElementById('lateral-table-scroll').focus()");
  const initialScroll=await evaluate("document.getElementById('lateral-table-scroll').scrollLeft");assert.equal(initialScroll,0);
  for(let i=0;i<64;i++){
    if(await evaluate("(()=>{const e=document.getElementById('lateral-table-scroll');return e.scrollLeft>=e.scrollWidth-e.clientWidth-1;})()"))break;
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39,nativeVirtualKeyCode:39});await delay(30);
  }
  await delay(150);
  const tableScroll=await evaluate("(()=>{const e=document.getElementById('lateral-table-scroll');return {left:e.scrollLeft,max:e.scrollWidth-e.clientWidth,focused:document.activeElement===e};})()");
  assert.ok(tableScroll.focused&&tableScroll.max>0&&tableScroll.left>=tableScroll.max-1,JSON.stringify(tableScroll));
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await screenshot('lateral-narrow-right-edge.png','#lateral-results',390,844);
  pass('390px controls stay bounded and actual keyboard scrolling reaches the final result columns');
  const bad=structuredClone(bundle);bad.study.neighborIndex=bad.study.heatStudy.cellIndex;
  const badPath=downloads+'/wrong-cell.json';await writeFile(badPath,JSON.stringify(bad));
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[badPath]});
  await waitFor("!document.getElementById('lateral-status').textContent.startsWith('Compared original inputs')");
  assert.equal(await text('lateral-results'),'');assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),originalWorkspace);
  pass('Wrong-cell source refuses without changing workspace');
  await evaluate("document.getElementById('lateral-current').click();document.getElementById('lateral-example').click()");await compare();
  await evaluate("document.getElementById('cell-size').value='3';document.getElementById('cell-size').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await text('lateral-results'),'');
  await evaluate("document.getElementById('lateral-form').requestSubmit()");assert.match(await text('lateral-status'),/current place/);
  pass('Metric-source change invalidates and cannot silently rebind the original exposure');
  assert.deepEqual(exceptions,[]);report.status='PASS';report.originalInputBytes=Buffer.byteLength(bytes);
  await writeFile(runDirectory+'/lateral-receipt.json',JSON.stringify(report,null,2));
});
console.log(JSON.stringify({runDirectory,...report},null,2));

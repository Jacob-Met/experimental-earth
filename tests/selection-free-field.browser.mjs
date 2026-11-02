import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {makeExample,validateProject} from '../core.js';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY ?? (root + '.browser-run-selection-free-field-' + randomUUID());
const report={checks:[]};
function fixture(){
 const p=makeExample();p.width=3;p.height=4;p.existing=p.existing.slice(0,12);p.proposal=p.proposal.slice(0,12);
 p.title='Synthetic source - 3 by 4';p.source='Held-back original authored source';
 p.existing[0].surface='sealed';p.existing[0].provenance='Original existing source reference A';
 p.proposal[0].surface='turf';p.proposal[0].provenance='Original proposal source reference B';
 p.observations=[];delete p.selectedIndex;return validateProject(p);
}
try {
 await withBrowserSession({root,chromeBin:process.env.CHROME_BIN ?? '/usr/bin/chromium',runDirectory,commandMs:15000},async s=>{
  await s.send('Runtime.enable');await s.send('Page.enable');await s.send('Page.navigate',{url:s.baseUrl});await delay(1100);
  await s.evaluate('localStorage.clear()');await s.send('Page.reload',{ignoreCache:true});await delay(950);
  const p=fixture(), stored=()=>s.evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const snap=()=>s.evaluate('(()=>({count:document.querySelectorAll("#existing-grid .cell").length,ready:document.querySelector("#rain-comparison-status")?.dataset.state,selection:document.querySelector("#selection")?.textContent,tabStops:document.querySelectorAll("#existing-grid .cell[tabindex=\\"0\\"]").length,toast:document.querySelector("#toast")?.textContent}))()');
  const upload=async project=>{
    const raw=JSON.stringify(project);
    const code='(async()=>{const input=document.querySelector("#import"),f=new File(['+JSON.stringify(raw)+'],"original-site.json",{type:"application/json"}),d=new DataTransfer();d.items.add(f);input.files=d.files;input.dispatchEvent(new Event("change",{bubbles:true}));await new Promise(r=>setTimeout(r,250))})()';
    await s.evaluate(code);await delay(350);
  };
  await upload(p);
  let state=await snap(),adopted=JSON.parse(await stored());
  assert.equal(state.ready,'ready');assert.equal(state.count,12);
  assert.equal(state.tabStops,1);assert.match(state.selection,/Selected A1/);
  assert.deepEqual(adopted,{...p,selectedIndex:0});
  report.checks.push('held-back 3x4 selection-free original imported and persisted exactly plus editor focus');
  const originalBytes=JSON.stringify(adopted);
  await s.send('Page.reload',{ignoreCache:true});await delay(950);
  state=await snap();assert.equal(state.ready,'ready');assert.equal(state.count,12);assert.equal(await stored(),originalBytes);
  report.checks.push('fresh browser reload preserves original source and focus');
  await s.evaluate('(()=>{document.querySelector("[data-brush=garden]").click();document.querySelector("#proposal-grid .cell").click()})()');await delay(160);
  const edited=JSON.parse(await stored());
  assert.equal(edited.proposal[0].surface,'garden');assert.deepEqual(edited.existing,p.existing);assert.equal(edited.source,p.source);
  report.checks.push('real edited proposal updates while preserving original existing source and provenance');
  const exportCode='(async()=>{const old=URL.createObjectURL;let blob;URL.createObjectURL=function(v){blob=v;return old.call(this,v)};try{document.querySelector("#export").click();return JSON.parse(await blob.text())}finally{URL.createObjectURL=old}})()';
  const exported=await s.evaluate(exportCode);assert.deepEqual(exported,edited);
  report.checks.push('native Export project produced original plus edited portable JSON');
  await s.evaluate('document.querySelector("#reset").click()');await delay(120);
  assert.equal(JSON.parse(await stored()).width,8);
  await upload(exported);state=await snap();assert.equal(state.ready,'ready');assert.equal(state.count,12);assert.deepEqual(JSON.parse(await stored()),edited);
  report.checks.push('exported source reimport survives resetting to default example');
  const before=await stored();await upload({...p,selectedIndex:12});state=await snap();
  assert.equal(await stored(),before);assert.match(state.toast,/Import refused: Selected cell out of range/);
  assert.equal(state.ready,'ready');report.checks.push('invalid-index import refused without replacing working source');
  await s.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(150);
  const dims=await s.evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
  const shot=await s.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await writeFile(join(runDirectory,'field-mobile.png'),Buffer.from(shot.data,'base64'));
  report.checks.push('actual 390px Chromium screenshot without horizontal overflow');
  assert.deepEqual(s.exceptions,[]);report.checks.push('no uncaught browser exceptions');
  report.sandboxAdmitted=s.sandbox.admitted;report.dims=dims;
 });
 report.status='PASS';
} catch(e){report.status='FAIL';report.error=String(e?.stack||e);process.exitCode=1;}
await writeFile(process.env.RESULT_FILE ?? join(runDirectory,'field-result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

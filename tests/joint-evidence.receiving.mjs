import assert from 'node:assert/strict';
import {readFile,access,mkdir,writeFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('../examples/joint-evidence-ambiguity.json',import.meta.url),'utf8'));

export async function receiveJointEvidence({evaluate,send,delay,report,artifactDirectory}) {
  const query=expression=>evaluate(expression);
  const state=()=>query("document.querySelector('#joint-status').dataset.state");
  const current=async()=>JSON.parse(await query("localStorage.getItem('experimental-earth-site-v1')"));
  async function importProject(p){
    await evaluate(`(async()=>{const input=document.querySelector('#import');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(p))}],'joint-site.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,150));})()`);
    assert.deepEqual(await current(),p,'actual file import must finish before receiving continues');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await importProject(fixture);
  assert.equal(await state(),'unconfigured');
  await query("document.querySelector('#joint-pairs').value='1, 0.1\\n21, 0.13333333333333333';document.querySelector('#joint-form').requestSubmit();document.querySelector('#joint-compare').click()");
  assert.equal(await state(),'needs-challenge');assert.equal(await query("document.querySelectorAll('[data-pair-label]').length"),2);
  assert.match(await query("document.querySelector('#joint-support').textContent"),/Within every calibration band: Pair 1, Pair 2/);
  const volumeOnly=await current();assert.deepEqual(volumeOnly.jointEvidenceStudy.depthReferences,[]);
  await query("document.querySelector('#joint-depth-choices input').click();document.querySelector('#joint-form').requestSubmit()");
  assert.equal(await state(),'error');assert.deepEqual(await current(),volumeOnly);
  await query("document.querySelector('#joint-association').value='Same authored event, scenario and minute-zero origin';document.querySelector('#joint-form').requestSubmit();document.querySelector('#joint-compare').click()");
  assert.equal(await state(),'one-survivor');
  const points=await query("[...document.querySelectorAll('#joint-plane circle')].map(e=>({x:Number(e.getAttribute('cx')),y:Number(e.getAttribute('cy'))}))");
  assert.equal(points.length,2);assert.ok(Math.abs(points[0].x-points[1].x)<1e-9);assert.notEqual(points[0].y,points[1].y);
  report.push('joint: explicit pairs retain equal-volume ambiguity; undeclared depth association refuses; associated held-aside depth distinguishes alternatives');
  const saved=await current(),downloadDir=artifactDirectory+'/joint-download';await mkdir(downloadDir,{recursive:true});
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});await query("document.querySelector('#export').click()");
  const path=downloadDir+'/experimental-earth-site.json';for(let i=0;i<60;i++){try{await access(path);break;}catch{await delay(50);}}
  const exported=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(exported,saved);
  await query("document.querySelector('#joint-pairs').value='1, 0.1\\n1, 0.1';document.querySelector('#joint-pairs').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#joint-form').requestSubmit()");
  assert.equal(await state(),'error');assert.deepEqual(await current(),saved);
  await send('Page.reload',{ignoreCache:true});await delay(350);
  assert.equal(await state(),'saved');await query("document.querySelector('#joint-compare').click()");assert.equal(await state(),'one-survivor');
  report.push('joint: duplicate pair refusal preserves accepted source; actual project download and reload retain pair set, roles and explicit depth association');
  const changed=structuredClone(exported);changed.observations[0].source='A different notebook source';await importProject(changed);
  await query("document.querySelector('#joint-compare').click()");assert.equal(await state(),'depth-evidence-changed');assert.equal(await query("document.querySelectorAll('[data-pair-label]').length"),0);
  await importProject(exported);await query("document.querySelector('#rain').value='62';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#joint-compare').click()");
  assert.equal(await state(),'context-changed');assert.deepEqual((await current()).jointEvidenceStudy,saved.jointEvidenceStudy);
  await importProject(exported);await query("document.querySelector('#joint-compare').click()");assert.equal(await state(),'one-survivor');
  await delay(4000);
  for(const width of [1280,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
    await query("document.documentElement.style.scrollBehavior='auto';document.querySelector('#joint-setup').open=false;document.querySelector('#joint-evidence-panel').scrollIntoView({block:'start',behavior:'instant'})");await delay(100);
    const size=await query("(()=>{const panel=document.querySelector('#joint-evidence-panel');return {width:innerWidth,height:innerHeight,layout:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,scale:visualViewport.scale,top:panel.getBoundingClientRect().top,scrollMarginTop:parseFloat(getComputedStyle(panel).scrollMarginTop)};})()");
    assert.equal(size.width,width,JSON.stringify(size));assert.ok(size.layout>=width-20&&size.layout<=width,JSON.stringify(size));assert.ok(size.scroll<=size.layout+1,JSON.stringify(size));assert.equal(size.scale,1,JSON.stringify(size));
    assert.ok(Number.isFinite(size.scrollMarginTop)&&size.scrollMarginTop>=0&&size.scrollMarginTop<size.height,JSON.stringify(size));
    assert.ok(Number.isFinite(size.top)&&size.top>=0&&size.top<size.height,JSON.stringify(size));
    assert.ok(Math.abs(size.top-size.scrollMarginTop)<=1,JSON.stringify(size));
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(artifactDirectory+`/joint-evidence-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  report.push('joint: changed depth source and changed storm retire comparison; exact export import restores it; desktop and 390px receiving preserve page width');
}

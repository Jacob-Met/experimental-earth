import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { makeExample } from '../core.js';
const p=makeExample();p.proposal=structuredClone(p.existing);p.proposal[1].elevationM-=.025;
p.existing[1].terrainSource={kind:'supplied-elevation-table/1',fileName:'authored.csv',line:3,datum:'Authored local zero',source:'Authored control <img onerror=alert(1)>',unit:'cm',elevationValue:p.existing[1].elevationM*100,uncertaintyValue:5,cellSizeM:p.weather.cellSizeM};
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory:process.env.BROWSER_RUN_DIRECTORY??`/tmp/earth-terrain-sensitivity-${randomUUID()}`},async({send,evaluate,baseUrl,exceptions,runDirectory})=>{
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:baseUrl});
  const settlePanel=async()=>{
    const rect=await evaluate(`(async()=>{
      const panel=document.querySelector('#terrain-sensitivity-panel');
      const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
      await document.fonts.ready;
      const deadline=performance.now()+2500;let stable=0,lastTop=null,attempts=0;
      let result;
      do {
        // Viewport changes and dynamically mounted styles can alter document
        // geometry after the first scroll. Measure and correct, never crop or
        // relax visibility to hide the resulting displacement.
        await frame();await frame();
        const before=panel.getBoundingClientRect();
        window.scrollTo({top:window.scrollY+before.top,left:0,behavior:'instant'});
        await frame();await frame();attempts++;
        const r=panel.getBoundingClientRect();
        const visible=id=>{const b=(id==='heading'?panel.querySelector('h2'):document.getElementById(id)).getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right};};
        const stylesReady=[...document.querySelectorAll('link[rel="stylesheet"]')].every(link=>Boolean(link.sheet));
        result={top:r.top,bottom:r.bottom,height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollWidth,attempts,stylesReady,heading:visible('heading'),button:visible('terrain-sensitivity-run')};
        stable=stylesReady&&Math.abs(r.top)<=1&&lastTop!==null&&Math.abs(r.top-lastTop)<.5?stable+1:0;
        lastTop=r.top;
      } while(stable<2&&performance.now()<deadline);
      result.stable=stable;return result;
    })()`);
    assert.ok(rect.stable>=2&&Math.abs(rect.top)<=1&&rect.bottom>0,JSON.stringify(rect));
    for(const control of [rect.heading,rect.button])assert.ok(control.top>=0&&control.bottom<=rect.height&&control.left>=0&&control.right<=rect.width,JSON.stringify(rect));
    return rect;
  };

  for(let i=0;i<60;i++){await delay(100);if(await evaluate("!!document.querySelector('#terrain-sensitivity-form')"))break;}
  assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-run').disabled"),true);
  const upload=async project=>{await evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(project))}],'supplied-project.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);};
  await upload(p);assert.match(await evaluate("document.querySelector('#terrain-sensitivity-source').textContent"),/Authored control <img/);
  assert.equal(await evaluate("document.querySelectorAll('#terrain-sensitivity-source img').length"),0);
  const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#terrain-sensitivity-run').click()");
  assert.match(await evaluate("document.querySelector('#terrain-sensitivity-status').textContent"),/refused.*Confirm/);
  await evaluate("document.querySelector('#terrain-sensitivity-transfer').click();document.querySelector('#terrain-sensitivity-run').focus()");
  assert.equal(await evaluate('document.activeElement.id'),'terrain-sensitivity-run');
  assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-transfer').checked"),true);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  assert.match(await evaluate("document.querySelector('#terrain-sensitivity-results').textContent"),/reverses/,await evaluate("document.querySelector('#terrain-sensitivity-status').textContent"));
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
  assert.equal(await evaluate("document.querySelectorAll('#terrain-sensitivity-results > details').length"),3);
  await evaluate("document.querySelector('#terrain-sensitivity-results > details').open=true;document.querySelector('#terrain-sensitivity-results > details details').open=true");
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await settlePanel();
  const desktop=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/desktop.png',Buffer.from(desktop.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);
  const dimensions=await settlePanel();assert.ok(dimensions.scroll<=dimensions.width+1,JSON.stringify(dimensions));
  const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/mobile.png',Buffer.from(mobile.data,'base64'));
  await evaluate("document.querySelector('#terrain-sensitivity-transfer').click()");assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-results').children.length"),0);
  await evaluate("document.querySelector('#terrain-sensitivity-transfer').click();document.querySelector('#terrain-sensitivity-run').click();document.querySelector('#rain').value='24';document.querySelector('#rain').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-results').children.length"),0);assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-transfer').checked"),false);
  await upload(JSON.parse(original));await evaluate("document.querySelector('#terrain-sensitivity-transfer').click();document.querySelector('#terrain-sensitivity-run').click()");
  assert.match(await evaluate("document.querySelector('#terrain-sensitivity-results').textContent"),/reverses/,await evaluate("document.querySelector('#terrain-sensitivity-status').textContent"));
  await send('Page.reload',{ignoreCache:true});await delay(250);
  assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-results').children.length"),0);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),original);
  const interior=JSON.parse(original);delete interior.existing[1].terrainSource;interior.existing[0].terrainSource={...p.existing[1].terrainSource,line:2,elevationValue:interior.existing[0].elevationM*100};
  await upload(interior);await evaluate("document.querySelector('#terrain-sensitivity-transfer').click();document.querySelector('#terrain-sensitivity-run').click()");
  assert.match(await evaluate("document.querySelector('#terrain-sensitivity-results').textContent"),/Peak standing water:[^()]+\(lower\)/);
  const interiorSource=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#terrain-sensitivity-samples').value='5';document.querySelector('#terrain-sensitivity-samples').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.querySelector('#terrain-sensitivity-results').children.length"),0);
  await evaluate("document.querySelector('#terrain-sensitivity-run').click()");
  assert.match(await evaluate("document.querySelector('#terrain-sensitivity-results').textContent"),/Peak standing water:[^()]+\(reverses\)/);
  assert.equal(await evaluate("document.querySelectorAll('#terrain-sensitivity-results > details').length"),5);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"),interiorSource);
  await settlePanel();
  const dense=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/interior-five-mobile.png',Buffer.from(dense.data,'base64'));
  const incompatible=JSON.parse(original);incompatible.proposal[1].terrainSource={...incompatible.existing[1].terrainSource,elevationValue:incompatible.proposal[1].elevationM*100,source:'Separate supplied proposal'};
  await upload(incompatible);await evaluate("document.querySelector('#terrain-sensitivity-transfer').click();document.querySelector('#terrain-sensitivity-run').click()");
  assert.match(await evaluate("document.querySelector('#terrain-sensitivity-status').textContent"),/separately surveyed/);
  assert.deepEqual(exceptions,[]);
  return {checks:['actual file source receiving and literal provenance','explicit transfer refusal and keyboard computation','three paired cases and sign reversal','original project immutability','desktop and 390px local inspection','query/weather invalidation','original input reopen and recomputation','explicit denser sampling exposes missed interior reversal without adopting input','sample count invalidates derived output','separate proposal survey refusal'],dimensions,runDirectory};
});
console.log(JSON.stringify({status:'PASS',...result},null,2));

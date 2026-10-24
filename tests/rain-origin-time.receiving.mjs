import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';
export async function receiveRainOriginTimes({ evaluate, send, delay, report, artifactDirectory }) {
  const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const get=(id,field='textContent')=>evaluate('document.getElementById('+JSON.stringify(id)+').'+field);
  const click=id=>get(id,'click()');
  const set=(id,value)=>evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(value))+';e.dispatchEvent(new Event("change"));})()');
  const state=()=>get('origin-status','dataset.state');
  const load=async p=>{
    await evaluate("localStorage.setItem('experimental-earth-site-v1',"+JSON.stringify(JSON.stringify(p))+")");
    await send('Page.reload',{ignoreCache:true});await delay(350);
    await evaluate("document.getElementById('rain-origin').open=true");
  };
  try {
    const p=makeExample();p.rainOriginStudy={targetCells:[29],fate:'stored'};
    await load(p);await click('origin-run');
    assert.ok((await get('origin-summary')).includes('113.3 L supplied by rainfall'));
    assert.ok((await get('origin-total')).includes('at 240 minutes'));
    await set('origin-time',12);assert.equal(await state(),'explained');
    assert.equal(await get('origin-minute'),'60 of 240 minutes');
    assert.ok((await get('origin-summary')).includes('173.4 L supplied by rainfall'));
    assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).rainOriginStudy.minute,60);
    for(const width of [1360,390]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
      if(artifactDirectory){
        const clip=await evaluate("(()=>{const r=document.getElementById('rain-origin').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
        writeFileSync(artifactDirectory+'/rain-origin-time-'+width+'.png',Buffer.from(shot.data,'base64'));
      }
    }
    report.push('exact-time origins show 173.3857 L at minute 60 versus 113.3168 L at event end, at desktop and 390px');
    await evaluate("document.querySelector('#origin-existing-map [data-cell-index=\"0\"]').click();document.getElementById('origin-time').focus()");
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await delay(80);assert.equal(await get('origin-minute'),'65 of 240 minutes');
    assert.equal(await evaluate("document.querySelector('#origin-existing-map [data-cell-index=\"0\"]').getAttribute('aria-pressed')"),'true');
    await send('Page.reload',{ignoreCache:true});await delay(350);assert.equal(await state(),'not-explained');
    await evaluate("document.getElementById('rain-origin').open=true");await click('origin-run');
    assert.equal(await get('origin-minute'),'65 of 240 minutes');
    await set('origin-fate','absorbed');await click('origin-run');assert.equal(await get('origin-minute'),'65 of 240 minutes');
    await set('origin-time',0);assert.ok((await get('origin-total')).includes('through 0 minutes'));
    assert.ok((await get('origin-status')).includes('No rainfall reaches'));assert.doesNotMatch(await get('origin-results'),/NaN|Infinity/);
    report.push('real keyboard time input preserves origin inspection; saved time reopens and survives fate edits; minute-zero rain stays zero');
    const stale=makeExample();stale.rainOriginStudy={targetCells:[29],fate:'stored',minute:60};
    Object.assign(stale.weather,{durationMinutes:30,stormMinutes:30});await load(stale);await click('origin-run');
    assert.equal(await state(),'error');assert.ok((await get('origin-status')).includes('within the modeled event'));
    assert.equal(await get('origin-final','hidden'),false);await click('origin-final');
    assert.equal(await state(),'explained');assert.equal(await get('origin-minute'),'30 of 30 minutes');
    assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).rainOriginStudy.minute,undefined);
    report.push('a stale query leaves ordinary site loading intact and can explicitly return to the current modeled end');
    const f=makeExample();Object.assign(f.weather,{durationMinutes:12.3,stormMinutes:5,stepMinutes:5});
    f.rainOriginStudy={targetCells:[29],fate:'stored',minute:7};await load(f);await click('origin-run');
    assert.equal(await state(),'error');assert.ok((await get('origin-status')).includes('not interpolated'));
    await click('origin-final');assert.equal(await get('origin-time','max'),'3');
    assert.equal(await get('origin-minute'),'12.3 of 12.3 minutes');await set('origin-time',2);
    assert.equal(await get('origin-minute'),'10 of 12.3 minutes');
    report.push('between-step queries refuse while exact fractional-end and earlier-step origins remain available');
  } finally {
    await send('Emulation.clearDeviceMetricsOverride');
    await evaluate(original===null?"localStorage.removeItem('experimental-earth-site-v1')":"localStorage.setItem('experimental-earth-site-v1',"+JSON.stringify(original)+")");
    await send('Page.reload',{ignoreCache:true});await delay(350);
  }
}

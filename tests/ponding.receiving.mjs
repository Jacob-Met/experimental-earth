import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Receives the actual app through the existing CDP browser harness. */
export async function receivePonding({evaluate,send,delay,report,artifactDirectory}) {
  const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  async function importProject(project) {
    await evaluate(`(async()=>{const input=document.querySelector('#import');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(project))}],'ponding-control.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,80));})()`);
  }
  try {
    const p=JSON.parse(original);
    p.width=2;p.height=2;p.selectedIndex=0;p.observations=[];
    p.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'authored receiving control'}));
    p.proposal=structuredClone(p.existing);
    p.weather={...p.weather,rainMmHr:61,stormMinutes:10.3,durationMinutes:10.3,stepMinutes:3,mobilityPerHour:0,boundaryExitPerHour:0};
    delete p.weather.rainfallSeries;delete p.infiltrationStudy;
    await importProject(p);
    assert.equal(await evaluate("document.querySelectorAll('#ponding-existing .replay-cell').length"),4);
    await evaluate("(()=>{const t=document.querySelector('#ponding-threshold');t.value='5';t.dispatchEvent(new Event('change'));const r=document.querySelector('#ponding-minute');r.value=r.max;r.dispatchEvent(new Event('input'));})()");
    assert.equal(await evaluate("Number(document.querySelector('#ponding-minute').value)"),10.3,'fractional event end must be reachable');
    assert.match(await evaluate("document.querySelector('#ponding-existing button').textContent"),/10.3 mm/);
    const detail=await evaluate("document.querySelector('#ponding-detail').textContent");
    assert.match(detail,/Existing: 5.3 min/);assert.match(detail,/Proposal minus existing: 0 min/);
    assert.match(detail,/5–10.3 min/);
    assert.match(detail,/14.05 mm·min accumulated depth above threshold/);
    assert.match(detail,/Still above threshold at the last snapshot; later clearance unknown/);
    report.push('ponding analytic 2×2 rain control: final10.3mm, above5mm for5.3minutes, identical proposal');
    if (artifactDirectory) {
      for (const [width,height,label] of [[1280,1000,'desktop-1280'],[390,844,'mobile-390']]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width===390});
        await evaluate("document.querySelector('#ponding-minute').focus();document.querySelector('#ponding-replay').scrollIntoView({block:'start',behavior:'instant'})");
        await delay(80);
        const clip=await evaluate("(()=>{const r=document.querySelector('#ponding-replay').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()");
        const screenshot=await send('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true});
        writeFileSync(join(artifactDirectory,`ponding-${label}.png`),Buffer.from(screenshot.data,'base64'));
      }
    }

    await evaluate("(()=>{const t=document.querySelector('#ponding-threshold');t.value='0';t.dispatchEvent(new Event('change'));})()");
    assert.match(await evaluate("document.querySelector('#ponding-error').textContent"),/greater than 0/);
    assert.equal(await evaluate("document.querySelector('#ponding-threshold').value"),'5');
    await evaluate("document.querySelector('[data-brush=garden]').click();document.querySelector('#proposal-grid button').click()");
    assert.notEqual(await evaluate("document.querySelector('#ponding-existing button').textContent"),await evaluate("document.querySelector('#ponding-proposal button').textContent"));
    await evaluate("document.querySelector('#ponding-proposal button:nth-child(2)').click()");
    assert.match(await evaluate("document.querySelector('#ponding-detail h3').textContent"),/B1/);
    report.push('ponding threshold refusal preserves accepted diagnostic; ordinary proposal edit immediately refreshes replay; cell selection works');
    await send('Page.reload',{ignoreCache:true});await delay(400);
    assert.equal(await evaluate("document.querySelectorAll('#ponding-existing button').length"),4);
    assert.equal(await evaluate("Number(document.querySelector('#ponding-minute').max)"),10.3);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    const dims=await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");
    assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
    report.push('ponding imported project survives reload and390px layout; view controls are transient');
  } finally {
    await importProject(JSON.parse(original));
  }
}

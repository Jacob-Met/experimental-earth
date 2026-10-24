import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bandFlip, rankingFlip, noFlow } from './fixtures/resolution.mjs';

// Extend the existing admitted browser course; do not launch another browser.
export async function receiveInfiltrationResolution({ evaluate, send, delay, report, artifactDirectory }) {
  const storage = "localStorage.getItem('experimental-earth-site-v1')";
  const original = await evaluate(storage);
  const state = () => evaluate("document.querySelector('#resolution-status').dataset.state");
  const runStudy = () => evaluate("document.querySelector('#infiltration-form').requestSubmit()");
  const runResolution = () => evaluate("document.querySelector('#compare-resolution').click()");
  async function importProject(project) {
    const data = typeof project === 'string' ? project : JSON.stringify(project);
    await evaluate(`(async()=>{const input=document.querySelector('#import');const file=new File([${JSON.stringify(data)}],'resolution-control.json',{type:'application/json'});const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,120));})()`);
  }
  async function prepare(project=bandFlip()) {
    await importProject(project);
    await runStudy();
    assert.equal(await evaluate("document.querySelector('#compare-resolution').disabled"),false);
  }
  async function assertCleared() {
    assert.equal(await state(),'not-compared');
    assert.equal(await evaluate("document.querySelector('#resolution-results').childElementCount"),0);
    assert.equal(await evaluate("document.querySelector('#compare-resolution').disabled"),true);
  }
  const decisions = () => evaluate("Array.from(document.querySelectorAll('.resolution-table tbody tr'),r=>Array.from(r.children,c=>c.textContent))");
  try {
    await prepare();
    const savedBefore = await evaluate(storage);
    await runResolution();
    assert.equal(await state(),'step-sensitive');
    assert.deepEqual((await decisions()).map(row=>row[2]),['9','none','none']);
    await evaluate("document.querySelector('.resolution-candidate[data-rate=\"9\"]').open=true");
    const detail = await evaluate("document.querySelector('.resolution-candidate[data-rate=\"9\"]').textContent");
    for(const value of ['6.940985617982156','7.4517560219159105','7.702638318799191']) {
      assert.ok(detail.includes(`${value} mm predicted`),`Full precision missing: ${value}`);
    }
    assert.ok(detail.includes('authored numerical-resolution control, not a measurement'));
    assert.ok(detail.includes('observed 7 ± 0.2 mm'));
    assert.equal((detail.match(/outside the stated band/g)||[]).length,2);
    assert.equal((detail.match(/inside the stated band/g)||[]).length,1);
    assert.equal(await evaluate(storage),savedBefore,'resolution comparison must not change the saved project');
    report.push('resolution band flip: full rate-9 predictions, original source and unchanged saved project');

    await evaluate("document.querySelector('#find-infiltration-reading').focus()");
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    const focus = await evaluate("(()=>{const e=document.activeElement,s=getComputedStyle(e);return {id:e.id,visible:e.matches(':focus-visible'),outline:s.outlineStyle,width:parseFloat(s.outlineWidth)}})()");
    assert.equal(focus.id,'compare-resolution');
    assert.equal(focus.visible,true);
    assert.notEqual(focus.outline,'none');
    assert.ok(focus.width>0);
    report.push('native keyboard Tab reaches resolution action with visible focus');

    for(const [width,height,mobile,label] of [[1280,1000,false,'desktop-1280'],[390,844,true,'mobile-390']]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
      await evaluate("document.querySelector('.resolution-check').scrollIntoView({behavior:'instant',block:'start'})");
      await delay(150);
      const overview = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      writeFileSync(join(artifactDirectory,`resolution-overview-${label}.png`),Buffer.from(overview.data,'base64'));
      await evaluate("document.querySelector('.resolution-candidate[data-rate=\"9\"]').scrollIntoView({behavior:'instant',block:'start'})");
      await delay(150);
      const dimensions = await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth,open:document.querySelector('.resolution-candidate[data-rate=\"9\"]').open})");
      assert.ok(dimensions.scroll<=dimensions.inner+1,JSON.stringify(dimensions));
      assert.equal(dimensions.open,true);
      const screenshot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      writeFileSync(join(artifactDirectory,`resolution-${label}.png`),Buffer.from(screenshot.data,'base64'));
    }
    report.push('open resolution predictions fit 1280px and 390px without horizontal overflow; screenshots retained');

    await evaluate("document.querySelector('#study-rates').value='3,,9';document.querySelector('#study-rates').dispatchEvent(new Event('input',{bubbles:true}))");
    await assertCleared();
    await runStudy();
    await assertCleared();
    assert.equal(await evaluate(storage),savedBefore);
    assert.ok((await evaluate("document.querySelector('#toast').textContent")).includes('distinct'));
    report.push('candidate input and invalid submit clear/disable numerical results without changing saved evidence');

    await prepare(); await runResolution();
    await evaluate("document.querySelector('#rain').value='47';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
    await assertCleared();
    report.push('weather change clears numerical comparison and requires a fresh study');

    await prepare(); await runResolution();
    await evaluate("(()=>{const role=document.querySelector('.observation [data-evidence-field=use]');role.value='challenge';role.dispatchEvent(new Event('change',{bubbles:true}));})()");
    await assertCleared();
    report.push('evidence role change clears numerical comparison and disables stale action');

    const minimum = bandFlip(); minimum.weather.stepMinutes=1;
    await prepare(minimum); await runResolution();
    assert.equal(await state(),'minimum-step');
    assert.equal(await evaluate("document.querySelector('#resolution-results').childElementCount"),0);
    assert.ok((await evaluate("document.querySelector('#resolution-status').textContent")).includes('No finer supported interval'));
    const unassigned=bandFlip();unassigned.observations[0].use='unassigned';
    await prepare(unassigned);await runResolution();
    assert.equal(await state(),'no-assigned-readings');
    assert.equal(await evaluate("document.querySelector('#resolution-results').childElementCount"),0);
    report.push('minimum interval and unassigned evidence refuse numerical comparison without manufactured rows');

    const analytic=noFlow();analytic.weather.stepMinutes=1.5;
    await prepare(analytic);
    const analyticSaved=await evaluate(storage);
    await runResolution();
    assert.equal(await state(),'no-decision-change');
    assert.deepEqual((await decisions()).map(row=>row[0]),['1.5','1']);
    assert.deepEqual((await decisions()).map(row=>row[2]),['10','10']);
    assert.ok((await evaluate("document.querySelector('#resolution-status').textContent")).includes('does not establish convergence or physical accuracy'));
    assert.equal(await evaluate(storage),analyticSaved);
    report.push('no-flow 1.5-minute control deduplicates to two intervals and qualifies agreement without claiming convergence');

    await prepare(rankingFlip());await runResolution();
    assert.equal(await state(),'step-sensitive');
    const ranked=await decisions();
    assert.deepEqual(ranked.map(row=>row[1]),['3','9','9']);
    assert.deepEqual(ranked.map(row=>row[2]),['3, 9','3, 9','3, 9']);
    report.push('closest calibration candidate changes 3→9→9 while compatible set stays unchanged');
  } finally {
    await importProject(original);
  }
  assert.equal(await evaluate(storage),original,'receiving must restore the previous saved project');
}

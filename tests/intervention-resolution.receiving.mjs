import assert from 'node:assert/strict';
import { makeExample } from '../core.js';

export async function receiveInterventionResolution({evaluate,send,delay,report}) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
  p.existing = [
    ['sealed',.031],['garden',.04],['turf',-.032],['garden',.026],
  ].map(([surface,elevationM])=>({surface,elevationM,provenance:'authored step receiving'}));
  p.proposal=structuredClone(p.existing);p.proposal[3].elevationM=-.036;
  Object.assign(p.weather,{rainMmHr:67,stormMinutes:19,durationMinutes:60,stepMinutes:5,
    cellSizeM:1,mobilityPerHour:2.79,boundaryExitPerHour:1.91});
  p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[1,9,24]};
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
  await send('Page.reload',{ignoreCache:true});await delay(350);
  await evaluate("document.querySelector('#check-intervention-step').click()");
  assert.equal(await evaluate("document.querySelector('#intervention-step-status').dataset.state"),'compared');
  const message=await evaluate("document.querySelector('#intervention-step-status').textContent");
  assert.ok(message.includes('5, 2.5, 1.25 min'));assert.ok(message.includes('1 candidate metric signs change'));
  const detail=await evaluate("document.querySelector('#intervention-step-results').textContent");
  assert.ok(detail.includes('SIGN CHANGED'));assert.ok(detail.includes('24 mm/h'));
  assert.ok(detail.includes('0.23517'));assert.ok(detail.includes('0.13962'));
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")),p);
  report.push('actual browser paired step challenge preserves all rates and reveals changing exit consequence without changing saved project');
  await evaluate("document.querySelector('#copy-existing').click()");
  assert.equal(await evaluate("document.querySelector('#intervention-step-status').dataset.state"),'not-compared');
  assert.equal(await evaluate("document.querySelector('#intervention-step-results').textContent"),'');
  report.push('site edit invalidates numerical-sensitivity report');
  p.weather.stepMinutes=1;
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
  await send('Page.reload',{ignoreCache:true});await delay(350);
  await evaluate("document.querySelector('#check-intervention-step').click()");
  assert.equal(await evaluate("document.querySelector('#intervention-step-status').dataset.state"),'minimum-step');
  assert.ok((await evaluate("document.querySelector('#intervention-step-status').textContent")).includes('one minute'));
  report.push('browser refuses unsupported finer resolution rather than extrapolating');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await send('Emulation.clearDeviceMetricsOverride');
  report.push('numerical-sensitivity panel fits 390px mobile viewport');
  await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(original)})`);
  await send('Page.reload',{ignoreCache:true});await delay(350);
}

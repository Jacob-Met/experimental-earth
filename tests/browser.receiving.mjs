import { receiveRainOrigins } from './rain-origin.receiving.mjs';
import { receivePonding } from './ponding.receiving.mjs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { withBrowserSession } from './support/browser-session.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import { receiveDecisionQuestion } from './decision-question.receiving.mjs';
import { receiveIntervention } from './intervention.receiving.mjs';
import { receiveInfiltration } from './infiltration.receiving.mjs';
import { receiveInfiltrationResolution } from './infiltration-resolution.receiving.mjs';
import { receiveOutletEvidence } from './outlet-evidence.receiving.mjs';
import { receiveJointEvidence } from './joint-evidence.receiving.mjs';
import { receiveJointEvents } from './joint-event.receiving.mjs';
import { receiveEventChallenge } from './event-challenge.receiving.mjs';
import { receiveLocalWaterBudget } from './local-water-budget.receiving.mjs';
import { receiveRainTrace } from './rain-trace.receiving.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const chromeBin = process.env.CHROME_BIN ?? (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/chromium');
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? (root + ".browser-run-" + randomUUID());
const report = [];
let exceptions = [];
try {
  const result = await withBrowserSession({root, chromeBin, runDirectory}, async session => {
  const {baseUrl, send, evaluate} = session;
  exceptions = session.exceptions;
  await send('Runtime.enable'); await send('Page.enable');
  // Wait for the owned page navigation before testing storage.
  for(let n=0;n<30;n++){
    await send('Page.navigate',{url:baseUrl});
    await delay(200);
    try{if(await evaluate('location.origin')===new URL(baseUrl).origin)break;}catch{}
  }
  assert.equal(await evaluate('location.origin'),new URL(baseUrl).origin,'local server must finish loading before storage test');
  // Repeatable test: discard only this test browser profile's previous workspace.
  await evaluate("localStorage.clear()");
  await send('Page.reload',{ignoreCache:true});
  await delay(350);
  for(let n=0;n<30;n++){if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===48)break;await delay(120);}
  assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"),48);
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .cell').length"),48);
  assert.equal(await evaluate("document.querySelectorAll('.metric').length"),6);
  assert.equal(await evaluate("document.querySelectorAll('#chart path').length"),2);
  const infiltration=await evaluate("Array.from(document.querySelectorAll('.metric')).find(e=>e.textContent.includes('Water infiltrated')).textContent");
  assert.ok(infiltration.includes('more'),'infiltration gain must be labeled more, not less');
  report.push('initial 96 cells, six metrics and two live chart curves');
  await evaluate("document.querySelector('[data-brush=\"garden\"]').click();document.querySelector('#proposal-grid .cell').click()");
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"),true);
  await evaluate("document.querySelector('[data-brush=\"inspect\"]').click();document.querySelector('#obs-minute').value='60';document.querySelector('#obs-depth').value='14';document.querySelector('#obs-uncertainty').value='3';document.querySelector('#obs-source').value='fictional ruler check';document.querySelector('#observe-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelectorAll('.observation').length"),1);
  const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.ok(saved.includes('fictional ruler check'));
  const parsed=JSON.parse(saved);
  assert.equal(parsed.proposal[0].surface,'garden');
  assert.equal(parsed.observations.length,1);
  report.push('brush edit, sourced field observation, local-save');
  await send('Page.reload',{ignoreCache:true});
  await delay(500);
  assert.equal(await evaluate("document.querySelectorAll('.observation').length"),1);
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"),true);
  await evaluate("document.querySelector('#copy-existing').click()");
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Turf')"),true);
  await evaluate(`(async()=>{const original=${JSON.stringify(saved)};const input=document.querySelector('#import');const file=new File([original],'site.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"),true);
  report.push('reload durability, scenario reset, portable JSON import');
  await evaluate("document.querySelector('#suggest').click()");
  await evaluate("document.querySelector('#suggest-infiltration').click()");
  for(let n=0;n<30;n++){
    if((await evaluate("document.querySelector('#infiltration-reading').textContent")).startsWith('Check '))break;
    await delay(100);
  }
  const materialSensitivity=await evaluate("document.querySelector('#infiltration-reading').textContent");
  assert.ok(materialSensitivity.includes('Evaluated 48/48 cells'),materialSensitivity);
  assert.ok(materialSensitivity.includes('invented example bounds'),materialSensitivity);
  report.push('one-cell infiltration-rate sensitivity, distinct from scenario difference');
  assert.equal(await evaluate("document.querySelector('[data-brush=\"inspect\"]').getAttribute('aria-pressed')"),'true');
  await evaluate("document.querySelector('#rain').value='47';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  const last=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.equal(last.weather.rainMmHr,47);
  const residual=await evaluate("document.querySelector('#balance').textContent");
  assert.ok(residual.includes('Mass balance'));
  report.push('sensitivity suggestion and parameter-change recomputation');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(250);
  const dims=await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth,grids:document.querySelectorAll('.cell').length})");
  assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
  assert.equal(dims.grids,96);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  writeFileSync(process.env.BROWSER_SCREENSHOT ?? (session.runDirectory + '/browser-mobile-390.png'),Buffer.from(shot.data,'base64'));
  report.push('390px mobile layout no horizontal overflow');
  await receivePonding({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveInfiltration({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveIntervention({ evaluate, send, delay, report });
  await receiveInfiltrationResolution({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveEventChallenge(evaluate, report, {send, artifactDirectory:session.runDirectory});
  await receiveOutletEvidence({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveJointEvidence({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveJointEvents({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  const decisionVisuals = await receiveDecisionQuestion({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveLocalWaterBudget({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveRainTrace({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  await receiveRainOrigins({ evaluate, send, delay, report, artifactDirectory:session.runDirectory });
  assert.deepEqual(exceptions,[]);
  return {checks:report,exceptions,dimensions:dims,decisionVisuals,sandbox:session.sandbox,sandboxPath:session.sandboxPath};
  });
  console.log(JSON.stringify({status:'PASS',browser:chromeBin,...result.value,session:result.receipt},null,2));
} catch(e) {
  console.error(JSON.stringify({status:'FAIL',error:String(e),cause:e.cause?String(e.cause):null,receiptPath:e.receipt?.receiptFile??null,cleanup:e.receipt?.cleanup??null,checks:report,exceptions},null,2));
  process.exitCode=1;
}

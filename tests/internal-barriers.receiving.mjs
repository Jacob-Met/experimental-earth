import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { makeExample } from '../core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? '/tmp/earth-barriers-' + randomUUID();
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const report = [];
const result = await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
  const { send, evaluate, baseUrl, exceptions } = session;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: baseUrl });
  for (let i = 0; i < 40; i++) {
    await delay(100);
    if (await evaluate("document.querySelectorAll('#existing-grid .cell').length") === 48) break;
  }
  assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"), 48);
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, (_, i) => ({ surface: 'sealed', elevationM: i === 0 ? 1 : 0, provenance: 'authored browser control' }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { rainMmHr: 60, stormMinutes: 5, durationMinutes: 5, stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 1, boundaryExitPerHour: 0 });
  const upload = async value => {
    await evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'walls.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,160));})()`);
  };
  const saved = () => evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const edge = async (direction, source) => {
    await evaluate(`document.querySelector('#barrier-target').value='proposal';document.querySelector('#barrier-target').dispatchEvent(new Event('change'));document.querySelector('#barrier-direction').value=${JSON.stringify(direction)};document.querySelector('#barrier-direction').dispatchEvent(new Event('change'));document.querySelector('#barrier-source').value=${JSON.stringify(source)}`);
  };
  await upload(p);
  const baseline = await evaluate("document.querySelector('#metrics').textContent");
  await edge('east', 'Hypothetical <wall> & supplied note');
  await evaluate("document.querySelector('#barrier-close').click()");
  let next = JSON.parse(await saved());
  assert.equal(next.proposal[0].internalBarriers.east.closed, true);
  assert.deepEqual(next.existing, p.existing);
  assert.notEqual(await evaluate("document.querySelector('#metrics').textContent"), baseline);
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .internal-barrier-east').length"), 1);
  assert.match(await evaluate("document.querySelector('#barrier-details').textContent"), /Hypothetical <wall> & supplied note/);
  assert.equal(await evaluate("document.querySelectorAll('#barrier-details wall').length"), 0);
  report.push('sourced proposal closure recalculates paired result, preserves baseline and renders actual map edge');

  await evaluate("document.querySelector('#proposal-grid [data-cell-index=\"1\"]').click()");
  await edge('west', 'Proposed west-side opening');
  assert.match(await evaluate("document.querySelector('#barrier-edge-state').textContent"), /closed/);
  await evaluate("document.querySelector('#barrier-open').click()");
  next = JSON.parse(await saved());
  assert.equal(next.proposal[0].internalBarriers.east.closed, false);
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .internal-barrier').length"), 0);
  assert.equal(await evaluate("document.querySelector('#metrics').textContent"), baseline);
  report.push('same edge edited from opposite endpoint restores original modeled results');

  const beforeRefusal = await saved();
  await edge('west', '   '); await evaluate("document.querySelector('#barrier-close').click()");
  assert.equal(await saved(), beforeRefusal);
  assert.match(await evaluate("document.querySelector('#barrier-status').textContent"), /Describe/);
  assert.equal(await evaluate("document.querySelector('#barrier-direction option[value=east]').disabled"), true);
  report.push('missing source refuses mutation and exterior edge choices are disabled');

  await edge('west', 'Retained wall source'); await evaluate("document.querySelector('#barrier-close').click()");
  const closedSnapshot = JSON.parse(await saved());
  await send('Page.reload', { ignoreCache: true }); await delay(400);
  assert.equal(JSON.parse(await saved()).proposal[0].internalBarriers.east.source, 'Retained wall source');
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .internal-barrier-east').length"), 1);
  await evaluate("window.__barrierExport=null;window.__barrierOriginalURL=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(t=>window.__barrierExport=t);return window.__barrierOriginalURL(blob)};document.querySelector('#export').click()");
  for (let i = 0; i < 10; i++) { if (await evaluate('window.__barrierExport !== null')) break; await delay(50); }
  const portable = JSON.parse(await evaluate('window.__barrierExport'));
  assert.equal(portable.proposal[0].internalBarriers.east.source, 'Retained wall source');
  await evaluate("document.querySelector('#copy-existing').click()");
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .internal-barrier').length"), 0);
  await upload(portable);
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .internal-barrier-east').length"), 1);
  report.push('actual export, reload, scenario copy and portable import preserve intended edge/source');

  const malformed = structuredClone(closedSnapshot);
  malformed.proposal[1].internalBarriers = { east: { closed: true, source: 'Impossible exterior record' } };
  const beforeMalformed = await saved(); await upload(malformed);
  assert.equal(await saved(), beforeMalformed);
  assert.match(await evaluate("document.querySelector('#toast').textContent"), /exterior/);
  report.push('malformed portable exterior edge is rejected without replacing accepted project');

  await evaluate("document.querySelector('#proposal-grid [data-cell-index=\"0\"]').click()");
  await edge('east', 'Retained wall source');
  const capture = async name => {
    await evaluate("document.querySelector('#internal-barriers').scrollIntoView({block:'center'})");
    await delay(100);
    const clip = await evaluate("(()=>{const r=document.querySelector('#internal-barriers').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    writeFileSync(session.runDirectory + '/' + name, Buffer.from(shot.data, 'base64'));
    return clip;
  };
  const desktopClip = await capture('barriers-desktop.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(150);
  const mobileClip = await capture('barriers-mobile.png');
  const dimensions = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  assert.ok(dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions));
  assert.ok(mobileClip.width <= 390);
  assert.deepEqual(exceptions, []);
  report.push('desktop and 390px controls fit without horizontal overflow or browser exceptions');
  return { checks: report, exceptions, dimensions, desktopClip, mobileClip, sandbox: session.sandbox };
});
console.log(JSON.stringify({ status: 'PASS', ...result.value, session: result.receipt }, null, 2));

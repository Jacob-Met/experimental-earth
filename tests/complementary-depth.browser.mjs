import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeExample } from '../core.js';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = await mkdtemp(join(tmpdir(), 'earth-complementary-'));
const checks = [];
const project = makeExample(); project.weather.rainMmHr = 12;
project.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [0, 3, 9, 22] };
project.observations = [{ cellIndex: 0, minute: 0, depthMm: 0, uncertaintyMm: 0,
  source: 'Authored common-start control; not acquired field evidence', scenario: 'existing', use: 'calibration' }];

await withBrowserSession({ root, chromeBin: process.env.CHROME_BIN, runDirectory: join(output, 'session') }, async session => {
  const { evaluate, send, exceptions } = session;
  await send('Runtime.enable'); await send('Page.enable');
  const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 30)); }
    throw Error(`Timeout: ${expression}`);
  };
  await wait("!!document.querySelector('#complementary-depth-plan')");
  const load = value => evaluate(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'source.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await load(project);
  await wait("document.querySelector('#study-rates').value==='0, 3, 9, 22'");
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  await evaluate("document.querySelector('#complementary-depth-plan').open=true;document.querySelector('#complementary-tolerance').value='4';document.querySelector('#complementary-depth-plan form').requestSubmit()");
  assert.match(await evaluate("document.querySelector('#complementary-results').textContent"), /5 of 6 candidate pairs/);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#complementary-results h4'),e=>e.textContent)"), ['1. F2 at 45 min · existing', '2. F2 at 235 min · existing']);
  assert.match(await evaluate("document.querySelector('#complementary-results').textContent"), /Still unresolved.*9 \/ 22 mm\/h/);
  assert.equal(await evaluate("localStorage.getItem('experimental-earth-site-v1')"), original);
  checks.push('authored source import, complementary 45/235-minute questions, unresolved pair and source nonmutation');
  for (const [name, width, height] of [['desktop', 1440, 1000], ['narrow', 390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await evaluate("(async()=>{document.querySelector('#complementary-depth-plan').scrollIntoView({behavior:'instant',block:'start'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()");
    assert.ok(await evaluate("(()=>{const r=document.querySelector('#complementary-depth-plan').getBoundingClientRect();return r.top>=-1&&r.top<innerHeight&&r.bottom>0;})()"), 'Complementary plan must be inside screenshot viewport');
    const image = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(output, `${name}.png`), Buffer.from(image.data, 'base64'));
  }
  checks.push('desktop and390px actual layout');
  await evaluate("document.querySelector('#obs-depth').value='99';document.querySelector('#obs-source').value='old draft';document.querySelector('#complementary-results button').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.deepEqual(await evaluate("['obs-minute','obs-depth','obs-source','obs-uncertainty','obs-scenario','obs-use'].map(id=>document.getElementById(id).value)"), ['45', '', '', '4', 'existing', 'challenge']);
  assert.equal(await evaluate("document.querySelector('#complementary-results').children.length"), 0);
  checks.push('keyboard preparation keeps actual depth/source empty and refresh invalidates result');
  await evaluate("document.querySelector('#complementary-depth-plan form').requestSubmit();document.querySelector('#complementary-tolerance').dispatchEvent(new Event('input',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#complementary-results').children.length"), 0);
  await evaluate("document.querySelector('#complementary-depth-plan form').requestSubmit()");
  await load(makeExample());
  await wait("document.querySelector('#complementary-results').children.length===0");
  checks.push('query changes and replacement project invalidate prior plan');
  await load(project); await wait("document.querySelector('#study-rates').value==='0, 3, 9, 22'");
  await send('Page.reload', { ignoreCache: true }); await wait("!!document.querySelector('#complementary-depth-plan')");
  assert.equal(await evaluate("document.querySelector('#complementary-results').children.length"), 0);
  await evaluate("document.querySelector('#complementary-tolerance').value='4';document.querySelector('#complementary-depth-plan form').requestSubmit()");
  assert.match(await evaluate("document.querySelector('#complementary-results').textContent"), /5 of 6 candidate pairs/);
  checks.push('reloaded source recomputes plan without trusting retained derived results');
  assert.deepEqual(exceptions, []);
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ checks, exceptions, sandboxAdmitted: session.sandbox.admitted }, null, 2));
});
console.log(JSON.stringify({ passed: checks.length, output }));

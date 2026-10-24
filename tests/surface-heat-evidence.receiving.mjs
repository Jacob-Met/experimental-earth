import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { makeExample } from '../core.js';
import { formatHeatReadings } from '../surface-heat-evidence-table.js';

export async function receiveHeatEvidence({ evaluate, send, delay, report, artifactDirectory }) {
  const stored = async () => JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  const load = value => evaluate(`(async()=>{const i=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'temperature-project.json',{type:'application/json'}));i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,160));})()`);
  const state = () => evaluate("document.querySelector('#heat-evidence-status').dataset.state");
  async function run(expected) {
    await evaluate("document.querySelector('#heat-evidence-run').click()");
    for (let i = 0; i < 60; i++) { if (!(await evaluate("document.querySelector('#heat-evidence-run').disabled"))) break; await delay(25); }
    assert.equal(await state(), expected, await evaluate("document.querySelector('#heat-evidence-status').textContent"));
  }
  async function nativeFile(selector, path) {
    const doc = await send('DOM.getDocument'), input = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
    await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] }); await delay(120);
  }
  await load(makeExample());
  await evaluate("document.querySelector('#heat-example').click();document.querySelector('#heat-form').requestSubmit();document.querySelector('#heat-evidence-example').click()");
  assert.equal((await stored()).surfaceHeatEvidence, undefined);
  assert.equal(await evaluate("document.querySelector('#heat-evidence-run').disabled"), true);
  await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()"); await run('ambiguous');
  const accepted = await stored();
  const energy = await evaluate("({min:Number(document.querySelector('#heat-evidence-energy').dataset.minimum),max:Number(document.querySelector('#heat-evidence-energy').dataset.maximum)})");
  assert.ok(energy.min > 0); assert.equal(energy.max, 2 * energy.min);
  assert.equal(await evaluate("document.querySelectorAll('.heat-candidate').length"), 3);
  report.push('Actual source-bound draft/save/compare retains two temperature-compatible hypotheses with doubled stored-energy implications');

  const changed = structuredClone(accepted.surfaceHeatEvidence.readings);
  for (const r of changed.filter(r => r.use === 'challenge')) r.temperatureC += 20;
  const challengeFile = artifactDirectory + '/challenge-readings.csv'; await writeFile(challengeFile, formatHeatReadings(changed));
  await nativeFile('#heat-readings-file', challengeFile);
  assert.equal(await evaluate("document.querySelector('#heat-evidence-results').textContent"), '');
  await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()"); await run('challenged');
  const challenged = await stored();
  assert.deepEqual(challenged.surfaceHeatEvidence.hypotheses, accepted.surfaceHeatEvidence.hypotheses);
  assert.deepEqual(challenged.surfaceHeatEvidence.readings.filter(r => r.use === 'calibration'), accepted.surfaceHeatEvidence.readings.filter(r => r.use === 'calibration'));
  report.push('Actual CSV-file input changes only challenge evidence, rejects the retained alternatives and leaves original hypotheses/calibration untouched');

  await evaluate("document.querySelector('#heat-readings').value='minute,temperature_c,half_width_c,use,source\\n0,0x20,1,calibration,malformed';document.querySelector('#heat-readings').dispatchEvent(new Event('input'));document.querySelector('#heat-evidence-form').requestSubmit()");
  assert.equal(await state(), 'refused'); assert.deepEqual(await stored(), challenged);
  report.push('Malformed numeric evidence cannot replace the accepted project');

  const literal = '<img src=x onerror=window.__heatEvidenceInjected=1> ' + 'sensor-source-'.repeat(25);
  const sourceProject = structuredClone(accepted); sourceProject.surfaceHeatEvidence.readings[0].source = literal;
  await load(sourceProject); await run('ambiguous');
  assert.equal(await evaluate("document.querySelectorAll('#heat-evidence-results img').length"), 0);
  assert.equal(await evaluate('window.__heatEvidenceInjected??null'), null);
  assert.ok((await evaluate("document.querySelector('#heat-evidence-results').textContent")).includes(literal));
  const dir = artifactDirectory + '/heat-evidence-download'; await mkdir(dir);
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await evaluate("document.querySelector('#export').click()");
  const path = dir + '/experimental-earth-site.json';
  for (let i = 0; i < 60; i++) { try { await access(path); break; } catch { await delay(40); } }
  const exported = JSON.parse(await readFile(path, 'utf8')); assert.deepEqual(exported.surfaceHeatEvidence, sourceProject.surfaceHeatEvidence);
  await evaluate("document.querySelector('#heat-evidence-clear').click()"); await send('Page.reload', { ignoreCache: true }); await delay(300);
  await nativeFile('#import', path); await run('ambiguous');
  assert.deepEqual((await stored()).surfaceHeatEvidence, sourceProject.surfaceHeatEvidence);
  report.push('Literal sources and actual full-project download/fresh native-file reopening preserve raw evidence and recompute ambiguity');

  const moved = structuredClone(exported); moved.surfaceHeatStudy.schedule[0].incidentWm2 += 1;
  await load(moved); await run('context-changed');
  await evaluate("document.querySelector('#heat-evidence-form').requestSubmit()"); assert.equal(await state(), 'refused');
  assert.deepEqual((await stored()).surfaceHeatEvidence, exported.surfaceHeatEvidence);
  report.push('A changed exposure refuses reuse or silent reassociation of the original readings');

  await load(exported); await run('ambiguous');
  const late = artifactDirectory + '/late-readings.csv'; await writeFile(late, formatHeatReadings(changed));
  await evaluate("(()=>{const original=File.prototype.text;File.prototype.text=function(){if(this.name==='late-readings.csv')return new Promise(resolve=>{window.releaseHeatTable=async()=>{File.prototype.text=original;resolve(await original.call(this));};});return original.call(this);};})()");
  await nativeFile('#heat-readings-file', late);
  assert.equal(await evaluate('typeof window.releaseHeatTable'), 'function');
  const currentTable = await evaluate("document.querySelector('#heat-readings').value");
  await evaluate("document.querySelector('#heat-evidence-association').value='Newer explicit association draft';document.querySelector('#heat-evidence-association').dispatchEvent(new Event('input'));window.releaseHeatTable()"); await delay(60);
  assert.equal(await evaluate("document.querySelector('#heat-readings').value"), currentTable);
  await load(exported); await run('ambiguous');
  await evaluate("document.querySelector('#heat-evidence-run').click();document.querySelector('#heat-evidence-example').click()"); await delay(80);
  assert.equal(await evaluate("document.querySelector('#heat-evidence-results').textContent"), '');
  assert.equal(await evaluate("document.querySelector('#heat-evidence-run').disabled"), true);
  report.push('Newer draft edits cancel delayed CSV input and pending comparison; reimporting identical saved bytes resets the draft');

  await load(exported); await run('ambiguous');
  await delay(3900); // Let the actual import notice expire before visual inspection.
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('#heat-evidence-results').scrollIntoView({block:'start',behavior:'instant'})");
  let image = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(artifactDirectory + '/heat-evidence-desktop.png', Buffer.from(image.data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.heat-candidate').open=true;document.querySelector('#heat-evidence-results').scrollIntoView({block:'start',behavior:'instant'})"); await delay(50);
  const sizes = await evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})'); assert.ok(sizes.scroll <= sizes.viewport + 1, JSON.stringify(sizes));
  image = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(artifactDirectory + '/heat-evidence-mobile.png', Buffer.from(image.data, 'base64'));
  await evaluate("document.querySelector('.heat-candidate summary').focus()");
  assert.equal(await evaluate("document.activeElement.matches('.heat-candidate summary')"), true);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await delay(50);
  assert.equal(await evaluate("document.querySelector('.heat-candidate').open"), false);
  report.push('Desktop and 390px temperature/energy comparison remains readable within the viewport; keyboard opens/closes exact candidate evidence');
}

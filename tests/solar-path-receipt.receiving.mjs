import assert from 'node:assert/strict';
import {mkdir, readFile, access} from 'node:fs/promises';
import {join} from 'node:path';
import {makeExample} from '../core.js';
import {parseSunPathInvestigation} from '../solar-path-receipt.js';
import {receiveSunPath} from './solar-path.receiving.mjs';

export async function receiveSunPathInvestigation({evaluate, send, delay, report, artifactDirectory}) {
  // Keep the complete original consumer course, then save its consequential fixture.
  await receiveSunPath({evaluate, send, delay, report});
  await send('DOM.enable');
  const stored = () => evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const original = JSON.parse(await stored());
  const downloadDirectory = join(artifactDirectory, 'download'); await mkdir(downloadDirectory);
  const downloaded = join(downloadDirectory, 'experimental-earth-sun-path.json');
  await send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadDirectory});
  assert.equal(await evaluate("document.querySelector('#sun-path-save').disabled"), false);
  assert.match(await evaluate("document.querySelector('#sun-path-save').textContent"), /location and site/);
  await evaluate("document.querySelector('#sun-path-save').click()");
  for (let i = 0; i < 80; i++) {try {await access(downloaded); break;} catch {await delay(40);}}
  const text = await readFile(downloaded, 'utf8'), accepted = JSON.parse(text);
  assert.deepEqual(accepted.project, original); assert.equal(accepted.selectedCellIndex, 1);
  assert.equal(accepted.declaration.latitudeDeg, 51.5); assert.equal(accepted.report, undefined);
  const expected = parseSunPathInvestigation(text);
  assert.equal(expected.report.samples[0].proposal[1].status, 'blocked');
  assert.equal(expected.report.samples.at(-1).proposal[1].status, 'no-mapped-blocker');
  report.push('actual download retains original site, location and selected sample as inputs; independent native reopen recomputes the changing result');

  const active = makeExample(); active.title = 'Different active project; keep me unchanged';
  const loadProject = value => evaluate(`(async()=>{const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'active-project.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,120));})()`);
  await loadProject(active); const activeBytes = await stored();
  await send('Page.reload', {ignoreCache: true});
  for (let i = 0; i < 100; i++) {await delay(30); try {if (await evaluate("!!document.querySelector('#sun-path-open')")) break;} catch {}}
  const openState = () => evaluate("document.querySelector('#sun-path-open-status').dataset.state");
  async function settled(expectedState = 'reopened') {
    for (let i = 0; i < 100; i++) {if (await openState() !== 'opening') break; await delay(25);}
    assert.equal(await openState(), expectedState, await evaluate("document.querySelector('#sun-path-open-status').textContent"));
  }
  async function openActual() {
    await evaluate("document.querySelector('#sun-path-retained').open=true");
    const doc = await send('DOM.getDocument');
    const node = await send('DOM.querySelector', {nodeId: doc.root.nodeId, selector: '#sun-path-open'});
    await send('DOM.setFileInputFiles', {nodeId: node.nodeId, files: [downloaded]}); await settled();
  }
  const chooseFile = (value, name = 'edited-inputs.json') => evaluate(`(()=>{const input=document.querySelector('#sun-path-open'),dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],${JSON.stringify(name)},{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const retainedText = () => evaluate("document.querySelector('#sun-path-retained-results').textContent");
  const firstStatus = () => evaluate("document.querySelector('#sun-path-retained-results [data-target=proposal]').dataset.status");
  await openActual();
  assert.equal(await stored(), activeBytes);
  assert.equal(await evaluate("document.querySelector('#sun-path-retained-cell').value"), '1');
  assert.equal(await evaluate("document.querySelectorAll('#sun-path-retained-cell option').length"), 8);
  assert.equal(await evaluate("document.querySelectorAll('#sun-path-cell option').length"), 48);
  assert.equal(await evaluate("document.querySelectorAll('#sun-path-retained-results tbody tr').length"), 17);
  assert.equal(await firstStatus(), 'blocked');
  assert.equal(await evaluate("document.querySelector('#sun-path-latitude').value"), '');
  assert.equal(await evaluate("document.querySelector('#sun-path-save').disabled"), true);
  report.push('fresh-page native file reopen inspects the original eight-cell site alongside a different 48-cell active project without adopting inputs or changing storage');

  assert.equal(await evaluate("document.querySelectorAll('#sun-path-retained img,#sun-path-retained svg script').length"), 0);
  assert.equal(await evaluate('window.__sunPathInjected??null'), null);
  assert.ok((await retainedText()).includes(accepted.declaration.locationSource));
  assert.ok((await retainedText()).includes(accepted.project.solarStudy.proposal[0].source));
  await evaluate("document.querySelector('#sun-path-retained-cell').focus()");
  await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40});
  await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40});
  assert.equal(await evaluate("document.querySelector('#sun-path-retained-cell').value"), '2');
  assert.equal(await firstStatus(), 'footprint');
  await evaluate("document.querySelector('#sun-path-retained-cell').value='1';document.querySelector('#sun-path-retained-cell').dispatchEvent(new Event('change',{bubbles:true}))");
  const originalInspection = await retainedText();
  report.push('retained source words render literally and actual keyboard selection uses the retained grid and consequential statuses');

  for (const [name, mutate] of [
    ['unsupported-model', r => {r.model.version = 'unknown';}],
    ['cached-conclusion', r => {r.report = {blockedHours: 8};}],
    ['changed-terrain', r => {r.project.existing[0].elevationM += .25;}],
    ['wrong-selected-cell', r => {r.selectedCellIndex = 40;}],
  ]) {
    const invalid = structuredClone(accepted); mutate(invalid);
    await chooseFile(invalid, name + '.json'); await settled('refused');
    assert.equal(await retainedText(), originalInspection); assert.equal(await stored(), activeBytes);
  }
  await evaluate("(()=>{const input=document.querySelector('#sun-path-open'),dt=new DataTransfer();dt.items.add(new File(['x'.repeat(5*1024*1024+1)],'too-large.json'));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await settled('refused'); assert.match(await evaluate("document.querySelector('#sun-path-open-status').textContent"), /5 MiB/);
  assert.equal(await retainedText(), originalInspection);
  report.push('unsupported model, cached verdicts, changed terrain, foreign sample and oversized files refuse transactionally while preserving the accepted inspection');

  const rotated = structuredClone(accepted); rotated.declaration.gridColumnBearingDeg = 270;
  await chooseFile(rotated); await settled();
  assert.equal(await firstStatus(), 'no-mapped-blocker'); assert.equal(await stored(), activeBytes);
  report.push('edited valid input files are visibly recalculated: rotating the same declared site changes the original blocked sample');

  // Delay File.text itself so supersession/close exercise the real asynchronous import handler.
  await evaluate("window.__sunOriginalFileText=File.prototype.text;File.prototype.text=function(){if(this.name==='delayed-sun-inputs.json')return new Promise(resolve=>{window.__releaseSunFile=()=>window.__sunOriginalFileText.call(this).then(resolve)});return window.__sunOriginalFileText.call(this)}");
  try {
    await chooseFile(accepted, 'delayed-sun-inputs.json'); assert.equal(await openState(), 'opening');
    await chooseFile(rotated); await settled();
    await evaluate('window.__releaseSunFile()'); await delay(80);
    assert.equal(await firstStatus(), 'no-mapped-blocker');
    await chooseFile(accepted, 'delayed-sun-inputs.json'); assert.equal(await openState(), 'opening');
    await evaluate("document.querySelector('#sun-path-forget').click();window.__releaseSunFile()"); await delay(80);
    assert.equal(await openState(), 'closed'); assert.equal(await retainedText(), '');
    assert.equal(await evaluate("document.querySelector('#sun-path-retained-inspection').hidden"), true);
  } finally {await evaluate('File.prototype.text=window.__sunOriginalFileText;delete window.__sunOriginalFileText;delete window.__releaseSunFile');}
  assert.equal(await stored(), activeBytes);
  report.push('a delayed older import cannot replace a newer accepted investigation, and closing cancels a pending import without changing the active project');

  await openActual();
  const independentlyRetained = await retainedText();
  const another = makeExample(); another.title = 'Active project changed after independent reopen';
  await loadProject(another); assert.equal(await retainedText(), independentlyRetained);
  const newestActive = await stored();
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}); await delay(100);
  assert.equal(await evaluate('innerWidth'), 390);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), true);
  assert.equal(await stored(), newestActive);
  const external = await evaluate("performance.getEntriesByType('resource').map(r=>r.name).filter(u=>!u.startsWith(location.origin+'/'))");
  assert.deepEqual(external, []);
  report.push('independent retained source survives active-project replacement, remains usable at an actual 390px viewport, and makes no external request');
}

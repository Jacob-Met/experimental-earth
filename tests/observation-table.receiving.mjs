import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export async function receiveObservationTable({ evaluate, send, delay, report, artifactDirectory = fileURLToPath(new URL('../', import.meta.url)) }) {
  const original = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const project = JSON.parse(original); project.observations = [];
  async function importProject(data) {
    await evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(data)}],'project.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));})()`);
  }
  async function choose(text, name = 'unit-readings.csv') {
    await evaluate(`(async()=>{const input=document.querySelector('#observation-table-file');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(text)}],${JSON.stringify(name)},{type:'text/csv'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,120));})()`);
  }
  const stored = async () => JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  const header = 'cell,minute,depth,uncertainty,unit,source,scenario,use';
  const text = `${header}\nA1,30,1,.01,cm,"Analytic fixture, calibration",existing,calibration\nB1,60,20,.2,mm,Analytic held-aside fixture,existing,challenge`;
  await importProject(JSON.stringify(project));
  await choose(text);
  assert.equal((await stored()).observations.length, 0);
  assert.equal(await evaluate("document.querySelectorAll('#observation-table-preview li').length"), 2);
  assert.equal(await evaluate("document.querySelector('#append-observation-table').disabled"), false);
  assert.ok((await evaluate("document.querySelector('#observation-table-status').textContent")).includes('1 converted'));
  await evaluate("document.querySelector('#append-observation-table').click()");
  const saved = await stored();
  assert.equal(saved.observations.length, 2);
  assert.equal(saved.observations[0].depthMm, 10); assert.equal(saved.observations[0].uncertaintyMm, .1);
  assert.equal(saved.observations[0].tableSource.line, 2);
  assert.ok((await evaluate("document.querySelector('#observation-list').textContent")).includes('original 1 ± .01 cm'));
  await evaluate("document.querySelector('#infiltration-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('#study-status').dataset.state"), 'one-survivor');
  report.push('unit table preview leaves notebook unchanged; explicit append feeds actual candidate comparison');

  await send('Page.reload', { ignoreCache: true }); await delay(350);
  assert.equal((await stored()).observations[0].tableSource.fileName, 'unit-readings.csv');
  assert.equal(await evaluate("document.querySelectorAll('.table-origin').length"), 2);
  await choose(text);
  assert.ok((await evaluate("document.querySelector('#observation-table-status').textContent")).includes('already'));
  assert.equal(await evaluate("document.querySelector('#append-observation-table').disabled"), true);
  assert.equal((await stored()).observations.length, 2);
  const portable = JSON.stringify(await stored());
  await importProject(portable);
  assert.deepEqual((await stored()).observations, saved.observations);
  report.push('table source/quantities survive reload and portable project import; repeat evidence refused');

  await choose(`${header}\nA1,20,5,1,mm,valid,existing,calibration\nA2,20,5,1,feet,bad,existing,challenge`, 'bad.csv');
  assert.ok((await evaluate("document.querySelector('#observation-table-status').textContent")).includes('Line 3'));
  assert.equal((await stored()).observations.length, 2);
  assert.equal(await evaluate("document.querySelectorAll('#observation-table-preview li').length"), 0);
  report.push('one invalid unit refuses the entire table with its source row; no partial evidence');

  const extra = `${header}\nA2,40,.5,.01,in,Extra authored reading,existing,unassigned`;
  await choose(extra, 'extra.csv');
  assert.equal(await evaluate("document.querySelector('#append-observation-table').disabled"), false);
  await evaluate("document.querySelector('#project-title').value='Changed context';document.querySelector('#project-title').dispatchEvent(new Event('change',{bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('#append-observation-table').disabled"), true);
  assert.equal(await evaluate("document.querySelectorAll('#observation-table-preview li').length"), 0);
  await evaluate("document.querySelector('#append-observation-table').click()");
  assert.equal((await stored()).observations.length, 2);
  await choose(extra, 'extra.csv');
  report.push('project edits invalidate pending import; a fresh preview is required');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(100);
  const dims = await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth})");
  assert.ok(dims.scroll <= dims.inner + 1, JSON.stringify(dims));
  await evaluate("document.querySelector('.observation-import').scrollIntoView({behavior:'instant',block:'start'})");
  await delay(100);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(artifactDirectory, 'table-mobile-390.png'), Buffer.from(shot.data, 'base64'));
  report.push('actual table preview and unit provenance fit the 390px notebook');
  await importProject(original);
}

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBrowserSession } from './support/browser-session.mjs';
import { parseShadeHeatSampling } from '../shade-heat-sampling.js';
import { serializeShadeHeatInvestigation } from '../shade-heat.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { prepareSurfaceHeatStudy } from '../surface-heat.js';
import { prepareHeatColumnStudy } from '../heat-column.js';
import { authoredPowerWeather } from './weather-power-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = join(tmpdir(), 'earth-shade-sampling-' + randomUUID()), checks = [];
const format = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pair = (a, b) => format(a) + ' / ' + format(b);
const raw = JSON.stringify(authoredPowerWeather());

function largeSource(base) {
  const p = structuredClone(base), old = p.heatColumnStudy;
  p.width = 14; p.height = 14;
  p.existing = Array.from({ length: 196 }, () => structuredClone(base.existing[0])); p.proposal = structuredClone(p.existing);
  p.solarStudy = prepareSolarStudy(p, { headingDeg: 0, elevationDeg: 45, sunSource: 'Authored browser budget control',
    existing: [], proposal: [{ cellIndex: 6, heightMinM: 3, heightMaxM: 3, source: 'Authored column' }] });
  p.heatColumnStudy = undefined; p.surfaceHeatStudy = undefined;
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 5, existing: old.heatStudy.existing, proposal: old.heatStudy.proposal,
    schedule: [{ minutes: 60, incidentWm2: 0, reservoirC: 20, source: 'Authored declaration' }] });
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: old.lowerLayers.existing, proposal: old.lowerLayers.proposal });
  return p;
}

try {
  const result = await withBrowserSession({ root, runDirectory, chromeBin: process.env.CHROME_BIN || '/opt/google/chrome/chrome', commandMs: 30000 }, async session => {
    const { send, evaluate, exceptions } = session;
    assert.equal(session.sandbox.admitted, true); assert.equal(session.sandbox.observation.active, true);
    await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
    async function until(expression) {
      for (let i = 0; i < 300; i++) {
        try { if (await evaluate(expression)) return; } catch {}
        await delay(40);
      }
      throw Error('Timeout: ' + expression + '; status=' + await evaluate("document.querySelector('#shade-sampling-status')?.textContent"));
    }
    const click = id => evaluate('document.getElementById(' + JSON.stringify(id) + ').click()');
    async function file(selector, path) {
      const doc = await send('DOM.getDocument'), found = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      assert.ok(found.nodeId, selector); await send('DOM.setFileInputFiles', { nodeId: found.nodeId, files: [path] });
    }
    const stored = () => evaluate("localStorage.getItem('experimental-earth-site-v1')");
    async function parentRun() { await evaluate("document.getElementById('shade-form').requestSubmit()"); await until("document.getElementById('shade-status').dataset.state==='compared'"); }
    async function samplingRun() { await click('shade-sampling-run'); await until("document.getElementById('shade-sampling-status').dataset.state==='compared'"); }
    async function reopen(path) { await file('#shade-sampling-import', path); await until("document.getElementById('shade-sampling-status').dataset.state==='compared'"); }
    const summaryText = () => evaluate("document.getElementById('shade-sampling-summary')?.textContent");
    const rawPath = join(runDirectory, 'authored-original-hourly.json'); await writeFile(rawPath, raw);
    await until("Boolean(document.getElementById('shade-sampling-import'))");
    const original = await stored();
    await click('shade-example'); await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), true);
    assert.equal(await evaluate("document.getElementById('shade-sampling-results').children.length"), 0);
    await file('#shade-weather-import', rawPath); await until("document.getElementById('shade-startUtc').value==='2025-06-21T00:00:00.000Z'");
    await parentRun(); await samplingRun();
    assert.equal(await evaluate("document.querySelectorAll('#shade-sampling-chart path[data-bound]').length"), 6);
    assert.equal(await evaluate("document.querySelectorAll('#shade-sampling-chart path[data-kind=beam-band]').length"), 3);
    assert.equal(await stored(), original);
    checks.push('Original hourly source admits all three complete solar grids; constant weather does not; working site is unchanged');

    const downloads = join(runDirectory, 'downloads'); await mkdir(downloads);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    await click('shade-sampling-export');
    const exported = join(downloads, 'experimental-earth-shade-heat-sampling-inputs.json');
    let text;
    for (let i = 0; i < 120; i++) { try { text = await readFile(exported, 'utf8'); break; } catch { await delay(40); } }
    assert.equal(typeof text, 'string', 'Actual input download must exist');
    const envelope = JSON.parse(text), parsed = parseShadeHeatSampling(text), report = parsed.report;
    assert.deepEqual(Object.keys(envelope).sort(), ['kind', 'model', 'source']);
    assert.equal(envelope.source.declaration.weather.rawText, raw);
    assert.equal(envelope.source.kind, 'experimental-earth/shade-heat-inputs/2');

    for (const target of ['existing', 'proposal']) for (const store of ['surfaceC', 'subsurfaceC']) {
      await evaluate("document.getElementById('shade-sampling-target').value=" + JSON.stringify(target) + ";document.getElementById('shade-sampling-target').dispatchEvent(new Event('change'))");
      await evaluate("document.getElementById('shade-sampling-store').value=" + JSON.stringify(store) + ";document.getElementById('shade-sampling-store').dispatchEvent(new Event('change'))");
      const name = store === 'surfaceC' ? 'surface' : 'subsurface';
      const expected = report.courses.map(course => {
        const a = course.targets[target].lower, b = course.targets[target].upper;
        return [course.solarStepMinutes + ' min · ' + course.intervals.length + ' intervals', pair(a.means[store], b.means[store]),
          pair(a[name].maximumC, b[name].maximumC), pair(a.final[store], b.final[store])];
      });
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#shade-sampling-summary tbody tr'),tr=>Array.from(tr.children,td=>td.textContent))"), expected);
      for (const minute of [731, 1440]) {
        await evaluate("document.getElementById('shade-sampling-time').value=" + minute + ";document.getElementById('shade-sampling-time').dispatchEvent(new Event('input'))");
        const visible = await evaluate("({data:{...document.getElementById('shade-sampling-inspect').dataset},rows:Array.from(document.querySelectorAll('#shade-sampling-inspect tbody tr'),tr=>Array.from(tr.children,td=>td.textContent)),text:document.getElementById('shade-sampling-inspect').textContent})");
        assert.equal(Number(visible.data.minute), minute);
        const expectedCooling = report.courses.map(course => {
          const points = t => ['lower','upper'].map(b => course.targets[t][b].trajectory.find(p=>p.minute===minute)[store]);
          const e=points('existing'),p=points('proposal');
          return pair(e[0]-p[1],e[1]-p[0]);
        });
        assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#shade-sampling-benefit tbody tr'),tr=>tr.children[1].textContent)"),expectedCooling);
        for (const [column, metric] of [[2,'mean'],[3,'peak']]) {
          const expectedColumn = report.courses.map(course => {
            const values = target => ['lower','upper'].map(bound => {
              const courseBound=course.targets[target][bound];
              return metric==='mean' ? courseBound.means[store] : courseBound[name].maximumC;
            });
            const e=values('existing'),p=values('proposal');
            return pair(e[0]-p[1],e[1]-p[0]);
          });
          assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#shade-sampling-benefit tbody tr'),tr=>tr.children["+column+"].textContent)"),expectedColumn);
        }


        report.courses.forEach((course, index) => {
          const values = ['lower', 'upper'].map(bound => course.targets[target][bound].trajectory.find(point => point.minute === minute)[store]);
          assert.equal(visible.rows[index][1], pair(...values) + ' °C');
          assert.equal(Number(visible.data['grid' + course.solarStepMinutes + 'Lower']), values[0]);
          assert.equal(Number(visible.data['grid' + course.solarStepMinutes + 'Upper']), values[1]);
          const interval = course.intervals.find(row => minute >= row.fromMinute && minute < row.toMinute) ?? course.intervals.at(-1);
          assert.ok(visible.text.includes(interval.weather.sourceKey)); assert.ok(visible.text.includes(interval.sampleUtc.replace('.000Z', 'Z')));
        });
      }
    }
    for(const field of ['surfaceC','subsurfaceC']){
 await evaluate("document.getElementById('shade-sampling-store').value="+JSON.stringify(field)+";document.getElementById('shade-sampling-store').dispatchEvent(new Event('change'))");
 assert.equal(await evaluate("document.querySelector('#shade-sampling-max-cooling .shade-sampling-caption').textContent"),'Greatest coincident cooling among 1,441 common-minute samples · '+(field==='surfaceC'?'Ground surface':'Lower heat store'));
 for(const course of report.courses)for(const bound of ['lower','upper']){
  const e=course.targets.existing[bound].trajectory.filter(p=>Number.isInteger(p.minute));
  const other=bound==='lower'?'upper':'lower', p=new Map(course.targets.proposal[other].trajectory.map(r=>[r.minute,r[field]]));
  let best=-Infinity,at=0;for(const point of e){const delta=point[field]-p.get(point.minute);if(delta>best){best=delta;at=point.minute;}}
  const selector='#shade-sampling-max-cooling button[data-grid="'+course.solarStepMinutes+'"][data-bound="'+bound+'"]';
  const cellColumn=bound==='lower'?1:3;
  const displayed=await evaluate("(()=>{const b=document.querySelector("+JSON.stringify(selector)+");return {label:b.textContent,value:b.closest('tr').children["+cellColumn+"].textContent}})()");
  assert.equal(displayed.label,String(at));assert.equal(displayed.value,format(best));
  await evaluate("document.querySelector('#shade-sampling-max-cooling button[data-grid=\""+course.solarStepMinutes+"\"][data-bound=\""+bound+"\"]').click()");
  assert.equal(await evaluate("Number(document.getElementById('shade-sampling-inspect').dataset.minute)"),at);
 }
}
checks.push('Rendered endpoint and off-hour common-minute values plus analytic day means and peaks match recomputed retained inputs for both sites and heat stores');
    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-sampling-import'))"); await reopen(exported);
    assert.equal(await evaluate("document.getElementById('shade-sampling-results').dataset.sourceMode"), 'Reopened sampling inputs');

    const reopenedMax=report.courses.map(course=>{
      const e=new Map(course.targets.existing.lower.trajectory.map(p=>[p.minute,p.surfaceC]));
      const p=new Map(course.targets.proposal.upper.trajectory.map(p=>[p.minute,p.surfaceC]));
      let best=-Infinity,at=0;for(let t=0;t<=1440;t++){const v=e.get(t)-p.get(t);if(v>best){best=v;at=t;}}
      return [format(best),String(at)];
    });
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#shade-sampling-max-cooling tbody tr'),tr=>[tr.children[1].textContent,tr.children[2].textContent])"),reopenedMax);
    assert.equal(await stored(), original); assert.equal(await evaluate("document.getElementById('shade-results').children.length"), 0);
    checks.push('Actual input-only download retains raw hourly source and recomputes in a fresh page without replacing the parent or working site');

    const retained = await summaryText(), bad = structuredClone(envelope); bad.model.version = 99;
    const badPath = join(runDirectory, 'wrong-model.json'); await writeFile(badPath, JSON.stringify(bad));
    await file('#shade-sampling-import', badPath); await until("document.getElementById('shade-sampling-status').dataset.state==='file-refused'");
    assert.equal(await summaryText(), retained); assert.equal(await evaluate("document.getElementById('shade-sampling-export').disabled"), false);
    const invalidPath = join(runDirectory, 'invalid-utf8.json'); await writeFile(invalidPath, Buffer.from([0xff, 0xfe, 0x7b]));
    await file('#shade-sampling-import', invalidPath); await until("document.getElementById('shade-sampling-status').textContent.includes('encoded data')");
    assert.equal(await summaryText(), retained);
    const largePath = join(runDirectory, 'oversized.json'); await writeFile(largePath, Buffer.alloc(5 * 1024 * 1024 + 1, 32));
    await evaluate("window.__samplingReadCount=0;window.__samplingArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){window.__samplingReadCount++;return window.__samplingArrayBuffer.call(this)}");
    await file('#shade-sampling-import', largePath); await until("document.getElementById('shade-sampling-status').dataset.state==='file-refused'");
    assert.equal(await evaluate('window.__samplingReadCount'), 0); await evaluate('File.prototype.arrayBuffer=window.__samplingArrayBuffer');
    assert.equal(await summaryText(), retained); assert.equal(await stored(), original);
    checks.push('Wrong model, invalid UTF8 and oversized inputs refuse atomically; the byte limit precedes reading');

    const large = largeSource(envelope.source.project), largeParent = join(runDirectory, 'hourly-budget-source.json');
    await writeFile(largeParent, serializeShadeHeatInvestigation(large, envelope.source.declaration));
    await file('#shade-import', largeParent); await until("document.getElementById('shade-status').dataset.state==='compared'");
    await click('shade-sampling-run'); await until("document.getElementById('shade-sampling-status').dataset.state==='refused'");
    assert.match(await evaluate("document.getElementById('shade-sampling-status').textContent"), /complete.*budget/i);
    assert.equal(await evaluate("document.getElementById('shade-sampling-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('shade-sampling-export').disabled"), true); assert.equal(await stored(), original);
    checks.push('A site admitted for hourly forcing refuses the complete combined-grid work budget without a partial comparison');

    await reopen(exported);
    await evaluate("window.__samplingOldArrayBuffer=File.prototype.arrayBuffer;window.__releaseSampling=null;File.prototype.arrayBuffer=async function(){await new Promise(resolve=>window.__releaseSampling=resolve);return window.__samplingOldArrayBuffer.call(this)}");
    await file('#shade-sampling-import', exported); await until('Boolean(window.__releaseSampling)');
    assert.equal(await evaluate("document.getElementById('shade-sampling-export').disabled"), true);
    await click('shade-example'); await until("document.getElementById('shade-status').dataset.state==='compared'");
    await evaluate('window.__releaseSampling();File.prototype.arrayBuffer=window.__samplingOldArrayBuffer'); await delay(80);
    assert.equal(await evaluate("document.getElementById('shade-sampling-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('shade-sampling-import').value"), '');
    await reopen(exported); assert.equal(await summaryText(), retained); assert.equal(await stored(), original);
    checks.push('A delayed sampling read cannot replace a newly selected parent source; downloads pause and the same file can be selected again');

    await file('#shade-weather-import', rawPath); await until("document.getElementById('shade-reservoirC').disabled"); await parentRun(); await samplingRun();
    await evaluate("window.__samplingOldTimer=window.setTimeout;window.__samplingQueued=[];window.setTimeout=(fn,ms,...args)=>ms===20?(window.__samplingQueued.push(()=>fn(...args)),0):window.__samplingOldTimer(fn,ms,...args);document.getElementById('shade-sampling-run').click();document.getElementById('shade-orientationSource').value+=' edited';document.getElementById('shade-orientationSource').dispatchEvent(new Event('input'));window.setTimeout=window.__samplingOldTimer;window.__samplingQueued.forEach(fn=>fn())");
    await delay(80); assert.equal(await evaluate("document.getElementById('shade-sampling-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('shade-sampling-export').disabled"), true);
    await parentRun(); await samplingRun(); await click('shade-weather-clear');
    assert.equal(await evaluate("document.getElementById('shade-sampling-results').children.length"), 0);
    assert.equal(await evaluate("document.getElementById('shade-sampling-run').disabled"), true);
    checks.push('Declaration edits cancel queued sampling results and detaching hourly weather invalidates the child comparison');

    await send('Page.reload', { ignoreCache: true }); await until("Boolean(document.getElementById('shade-sampling-import'))"); await reopen(exported);
    await until("!document.getElementById('toast').classList.contains('show')");
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }); await delay(120);
    await evaluate("document.getElementById('shade-sampling').scrollIntoView({block:'start',behavior:'instant'})");
    let shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(runDirectory, 'sampling-desktop.png'), Buffer.from(shot.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await delay(120);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    assert.ok(await evaluate("document.getElementById('shade-sampling-chart').getBoundingClientRect().right<=innerWidth+1"));
    assert.ok(await evaluate("Array.from(document.querySelectorAll('#shade-sampling .shade-sampling-caption')).every(el=>el.getBoundingClientRect().right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1)"));
    await evaluate("document.getElementById('shade-sampling').scrollIntoView({block:'start',behavior:'instant'})");
    shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(runDirectory, 'sampling-narrow.png'), Buffer.from(shot.data, 'base64'));
    await evaluate("document.getElementById('shade-sampling-chart').scrollIntoView({block:'start',behavior:'instant'})");
    shot = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(runDirectory, 'sampling-narrow-chart.png'), Buffer.from(shot.data, 'base64'));
    await evaluate("document.querySelector('#shade-sampling-summary [role=region]').focus()");
    assert.equal(await evaluate("document.activeElement.getAttribute('role')"), 'region');
    assert.deepEqual(exceptions, []); assert.equal(await stored(), original);
    checks.push('The complete comparison and captions fit 390px, wide data tables scroll locally, keyboard focus reaches the scroll region, and no browser exception occurs');
    
    await evaluate("document.getElementById('shade-window-form').requestSubmit()");
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#shade-window-results h4'),x=>x.textContent)"),['60 minute solar grid: failed','30 minute solar grid: failed','15 minute solar grid: failed']);
    await evaluate("document.querySelector('#shade-window-results button').click()");
    assert.equal(await evaluate("Number(document.querySelector('#shade-sampling-inspect').dataset.minute)"),683);
    await evaluate("document.querySelector('#shade-window-form [name=thresholdC]').value='0';document.querySelector('#shade-window-form [name=thresholdC]').dispatchEvent(new Event('input',{bubbles:true}))");
    assert.equal(await evaluate("document.querySelector('#shade-window-results').children.length"),0);
    assert.equal(await evaluate("document.querySelector('#shade-window-export').disabled"),true);
    await evaluate("document.getElementById('shade-window-form').requestSubmit()");
    assert.equal(await evaluate("document.querySelectorAll('#shade-window-results h4').length"),3);
    assert.ok(await evaluate("Array.from(document.querySelectorAll('#shade-window-results h4')).every(x=>x.textContent.endsWith('supported'))"));
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
    assert.equal(await evaluate("document.querySelector('#shade-window-export').disabled"),false);
    await evaluate("window.__windowDownloads=[];const old=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.__windowDownloads.push(this.download);return old.call(this)}");
    await click('shade-window-export');
    assert.deepEqual(await evaluate('window.__windowDownloads'),['experimental-earth-cooling-window-inputs.json']);
    const windowExport=join(downloads,'experimental-earth-cooling-window-inputs.json');
    let windowText;for(let i=0;i<120;i++){try{windowText=await readFile(windowExport,'utf8');break;}catch{await delay(40);}}
    assert.deepEqual(exceptions, []);assert.equal(typeof windowText,'string','Window download exists');
    const windowSource=JSON.parse(windowText);assert.deepEqual(Object.keys(windowSource).sort(),['kind','query','sampling']);
    await send('Page.reload',{ignoreCache:true});await until("Boolean(document.getElementById('shade-window-import'))");
    await file('#shade-window-import',windowExport);await until("document.querySelector('#shade-window-results')?.children.length===3");
    assert.equal(await evaluate("document.querySelector('#shade-window-form [name=thresholdC]').value"),'0');
    assert.equal(await evaluate("document.querySelectorAll('#shade-window-results h4').length"),3);
    assert.ok(await evaluate("Array.from(document.querySelectorAll('#shade-window-results h4')).every(x=>x.textContent.endsWith('supported'))"));
    await evaluate("window.__oldWindowBuffer=File.prototype.arrayBuffer;window.__releaseOldSampling=null;File.prototype.arrayBuffer=async function(){if(this.name==='experimental-earth-shade-heat-sampling-inputs.json')await new Promise(resolve=>window.__releaseOldSampling=resolve);return window.__oldWindowBuffer.call(this)}");
    await file('#shade-sampling-import',exported);await until('Boolean(window.__releaseOldSampling)');
    await file('#shade-window-import',windowExport);await until("document.querySelector('#shade-sampling-results').dataset.sourceMode==='Reopened window inputs'&&document.querySelector('#shade-window-results').children.length===3");
    await evaluate('window.__releaseOldSampling();File.prototype.arrayBuffer=window.__oldWindowBuffer');await delay(80);
    assert.equal(await evaluate("document.querySelector('#shade-sampling-results').dataset.sourceMode"),'Reopened window inputs');
    assert.equal(await evaluate("document.querySelector('#shade-window-results').children.length"),3);
    assert.match(await evaluate("document.querySelector('#shade-window-query').textContent"),/Ground surface.*600–780.*≥ 0 °C/);
    await evaluate("window.__statusBuffer=File.prototype.arrayBuffer;window.__releaseStatus=null;File.prototype.arrayBuffer=async function(){if(this.name==='experimental-earth-shade-heat-sampling-inputs.json')await new Promise(resolve=>window.__releaseStatus=resolve);return window.__statusBuffer.call(this)}");
    await file('#shade-sampling-import',exported);await until('Boolean(window.__releaseStatus)');
    await file('#shade-window-import',badPath);await until("document.querySelector('#shade-window-status').textContent.startsWith('File refused:')");
    assert.equal(await evaluate("document.querySelector('#shade-sampling-status').dataset.state"),'compared');
    assert.equal(await evaluate("document.querySelector('#shade-sampling-export').disabled"),false);
    await evaluate('window.__releaseStatus();File.prototype.arrayBuffer=window.__statusBuffer');await delay(80);
    assert.equal(await evaluate("document.querySelector('#shade-sampling-status').dataset.state"),'compared');
    await evaluate("window.__reverseBuffer=File.prototype.arrayBuffer;window.__releaseWindow=null;window.__releaseSampling=null;File.prototype.arrayBuffer=async function(){await new Promise(resolve=>{if(this.name==='experimental-earth-cooling-window-inputs.json')window.__releaseWindow=resolve;else window.__releaseSampling=resolve});return window.__reverseBuffer.call(this)}");
    await file('#shade-window-import',windowExport);await until('Boolean(window.__releaseWindow)');
    await file('#shade-sampling-import',exported);await until('Boolean(window.__releaseSampling)');
    await evaluate('window.__releaseWindow()');await delay(80);
    assert.equal(await evaluate("document.querySelector('#shade-sampling-status').dataset.state"),'reading');
    await evaluate('window.__releaseSampling();File.prototype.arrayBuffer=window.__reverseBuffer');await until("document.querySelector('#shade-sampling-results').dataset.sourceMode==='Reopened sampling inputs'");
    assert.equal(await evaluate("document.querySelector('#shade-window-results').children.length"),0);
    await file('#shade-window-import',windowExport);await until("document.querySelector('#shade-window-results').children.length===3");
    const queryStamp=await evaluate("document.querySelector('#shade-window-query').textContent");
    await file('#shade-window-import',badPath);await until("document.querySelector('#shade-window-status').textContent.startsWith('File refused:')");
    assert.equal(await evaluate("document.querySelector('#shade-window-query').textContent"),queryStamp);
    assert.equal(await evaluate("document.querySelector('#shade-window-results').children.length"),3);
    assert.equal(await evaluate("document.querySelector('#shade-window-export').disabled"),false);
    await evaluate("document.querySelector('#shade-window').scrollIntoView({block:'start',behavior:'instant'})");
    await delay(150);
    const windowShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(runDirectory,'window-narrow.png'),Buffer.from(windowShot.data,'base64'));
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
    await evaluate("document.querySelector('#shade-window').scrollIntoView({block:'start',behavior:'instant'})");await delay(150);
    const desktopWindowShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(runDirectory,'window-desktop.png'),Buffer.from(desktopWindowShot.data,'base64'));
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);
    await evaluate("document.querySelector('#shade-window').scrollIntoView({block:'start',behavior:'instant'})");await delay(200);
    const windowBox=await evaluate("(()=>{const b=document.querySelector('#shade-window').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width}})()");
    assert.ok(Math.abs(windowBox.y)<5,'Window heading must be at screenshot top');
    const finalNarrow=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(runDirectory,'window-narrow.png'),Buffer.from(finalNarrow.data,'base64'));
    await click('shade-example');await until("document.getElementById('shade-status').dataset.state==='compared'");
    assert.equal(await evaluate("document.querySelector('#shade-window-results').children.length"),0);
    assert.equal(await stored(),original);
    checks.push('Declared window classification, definite counterexample jump, query invalidation, input-only download/fresh replay and parent replacement preserve source');
assert.deepEqual(exceptions, []);
return { checks, sandbox: session.sandbox, exceptions };
  });
  const files = {};
  for (const relative of ['shade-heat-window.js', 'shade-heat-window-view.js', 'shade-heat-benefit.js', 'shade-heat.js', 'shade-heat-sampling.js', 'shade-heat-panel.js', 'shade-heat-sampling-panel.js', 'shade-heat.css', 'tests/shade-heat-sampling.browser.mjs']) {
    files[relative] = createHash('sha256').update(await readFile(join(root, relative))).digest('hex');
  }
  const receipt = { status: 'PASS', sourceRoot: root, sourceFiles: files, ...result.value, receipt: result.receipt };
  await writeFile(join(runDirectory, 'browser.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), stack: error.stack, checks, runDirectory, receipt: error.receipt ?? null }, null, 2));
  process.exitCode = 1;
}

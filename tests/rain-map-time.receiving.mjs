import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample, compare } from '../core.js';

/** Authored independent control: equal global totals, opposite local changes. */
function control() {
  const project = makeExample();
  project.title = 'Authored paired map-time control';
  project.width = project.height = 2; project.selectedIndex = 0;
  project.existing = ['turf', 'garden', 'turf', 'garden'].map(surface =>
    ({ elevationM: 0, surface, provenance: 'authored map-time control, not a measurement' }));
  project.proposal = project.existing.map(cell => ({ ...cell,
    surface: cell.surface === 'turf' ? 'garden' : 'turf' }));
  Object.assign(project.weather, { rainMmHr: 60, stormMinutes: 6, durationMinutes: 10.3,
    stepMinutes: 3, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  project.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [1, 9, 24] };
  project.observations = [{ cellIndex: 0, minute: 6, depthMm: 5.1, uncertaintyMm: 0.001,
    scenario: 'existing', use: 'calibration', source: 'authored analytic control, not a field reading' }];
  return project;
}

export async function receiveRainMapTime({ evaluate, send, delay, report, artifactDirectory }) {
  const storeKey = 'experimental-earth-site-v1';
  const original = await evaluate(`localStorage.getItem('${storeKey}')`);
  const saved = async () => JSON.parse(await evaluate(`localStorage.getItem('${storeKey}')`));
  const project = control(), reference = compare(project);
  const times = [0, 3, 6, 9, 10.3];
  const analytic = { turf: [0, 2.55, 5.1, 4.65, 4.455], garden: [0, 1.8, 3.6, 2.4, 1.88] };
  for (const target of ['existing', 'proposal']) {
    assert.deepEqual(reference[target].snapshots.map(snapshot => snapshot.minute), times);
    reference[target].snapshots.forEach((snapshot, step) => snapshot.depthsMm.forEach((depth, cell) => {
      assert.ok(Math.abs(depth - analytic[project[target][cell].surface][step]) < 1e-10,
        `${target} cell ${cell} at ${snapshot.minute}: ${depth} disagrees with independent control`);
    }));
  }
  reference.existing.snapshots.forEach((step, i) => {
    assert.ok(Math.abs(step.storedLiters - reference.proposal.snapshots[i].storedLiters) < 1e-10);
  });
  const waitFor = async (expression, message) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    assert.fail(message);
  };
  const importProject = async value => {
    await evaluate(`(()=>{const file=new File([${JSON.stringify(JSON.stringify(value))}],'rain-map-time-control.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor("document.querySelector('#import').value===''&&document.querySelector('#toast').textContent==='Validated project imported.'", 'ordinary control import must finish');
  };
  const view = mode => evaluate(`(()=>{const select=document.querySelector('#map-view');select.value=${JSON.stringify(mode)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const focus = async selector => {
    const received = await evaluate(`(async()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element||!element.getClientRects().length||element.closest('[hidden],[aria-hidden="true"]'))return false;element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));element.focus();return document.activeElement===element;})()`);
    assert.equal(received, true, `native control must be visible and focused: ${selector}`);
  };
  const press = async key => {
    const codes = { Home: 36, End: 35, ArrowLeft: 37, ArrowRight: 39, Enter: 13, ' ': 32 };
    const parameters = { key, code: key === ' ' ? 'Space' : key,
      windowsVirtualKeyCode: codes[key], nativeVirtualKeyCode: codes[key] };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...parameters,
      ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : key === ' ' ? { text: ' ', unmodifiedText: ' ' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...parameters });
  };
  const snapshot = async (expected, index) => {
    const minute = expected.existing.snapshots[index].minute;
    const actual = await evaluate(`(()=>{const range=document.querySelector('#map-snapshot-index');return {index:Number(range.value),min:range.min,max:Number(range.max),step:range.step,time:document.querySelector('#map-snapshot-time').textContent,spoken:range.getAttribute('aria-valuetext'),grids:['existing','proposal'].map(target=>{const grid=document.getElementById(target+'-grid');return {view:grid.dataset.view,minute:grid.dataset.minute,cells:Array.from(grid.querySelectorAll('.cell'),cell=>({index:Number(cell.dataset.cellIndex),depth:Number(cell.dataset.depthMm),text:cell.querySelector('span').textContent,label:cell.getAttribute('aria-label'),alpha:Number(cell.style.getPropertyValue('--water-alpha'))}))};})};})()`);
    assert.equal(actual.index, index); assert.equal(actual.min, '0'); assert.equal(actual.step, '1');
    assert.equal(actual.max, expected.existing.snapshots.length - 1);
    assert.ok(actual.time.includes(`${minute} min`), actual.time);
    assert.ok(actual.spoken.includes(`${minute} minutes after event start`), actual.spoken);
    for (const [targetIndex, target] of ['existing', 'proposal'].entries()) {
      const grid = actual.grids[targetIndex], retained = expected[target].snapshots[index];
      assert.equal(grid.view, 'snapshot'); assert.equal(grid.minute, String(minute));
      assert.deepEqual(grid.cells.map(cell => cell.index), retained.depthsMm.map((_, cell) => cell));
      assert.deepEqual(grid.cells.map(cell => cell.depth), retained.depthsMm,
        `${target} map must use the exact retained snapshot at ${minute}`);
      grid.cells.forEach((cell, i) => {
        const text = retained.depthsMm[i].toLocaleString('en-US', { maximumFractionDigits: 1 });
        assert.equal(cell.text, `${text} mm`);
        assert.ok(cell.label.includes(`modeled ${text} millimeters depth at ${minute} minutes after event start`), cell.label);
        assert.equal(cell.alpha, Math.min(0.66, retained.depthsMm[i] / 50 * 0.65));
      });
    }
  };
  const screenshot = async name => {
    if (!artifactDirectory) return;
    const image = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${artifactDirectory}/${name}.png`, Buffer.from(image.data, 'base64'));
  };
  const restoreSpy = () => evaluate("(()=>{const state=window.__rainMapIsolation;if(state){Storage.prototype.setItem=state.setItem;delete window.__rainMapIsolation;}})()");
  let courseError;
  try {
    await importProject(project);
    const capabilities = await evaluate("({modes:Array.from(document.querySelector('#map-view').options,option=>option.value),range:!!document.querySelector('#map-snapshot-index')})");
    assert.ok(capabilities.modes.includes('snapshot') && capabilities.range,
      `paired intermediate map control is missing: ${JSON.stringify(capabilities)}`);
    for (const mode of ['peak', 'final', 'surface']) {
      await view(mode);
      assert.equal(await evaluate("document.querySelector('#map-snapshot-controls').hidden"), true);
      for (const target of ['existing', 'proposal']) {
        if (mode === 'surface') {
          assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#${target}-grid .cell'),cell=>({text:cell.querySelector('span').textContent,alpha:Number(cell.style.getPropertyValue('--water-alpha')),hasDepth:cell.hasAttribute('data-depth-mm')}))`),
            Array.from({ length: 4 }, () => ({ text: '0 cm', alpha: 0, hasDepth: false })));
        } else {
          const depths = await evaluate(`Array.from(document.querySelectorAll('#${target}-grid .cell'),cell=>Number(cell.dataset.depthMm))`);
          assert.deepEqual(depths, reference[target][mode === 'peak' ? 'peakDepthMm' : 'finalDepthMm']);
        }
      }
    }
    report.push('ordinary imported alternating-surface control retains peak/final/surface views; independent native-step depths distinguish local outcomes despite identical whole-site curves');

    // A real comparison is invalidated by rerun(), unlike an inert test marker.
    await evaluate("document.querySelector('#infiltration-form').requestSubmit()");
    assert.notEqual(await evaluate("document.querySelector('#study-status').dataset.state"), 'not-compared');
    assert.equal(await evaluate("document.querySelectorAll('#study-results .study-candidate').length"), 3);
    await evaluate(`(()=>{const values={'obs-minute':'2.25','obs-depth':'7.125','obs-uncertainty':'0.4','obs-source':'Unsubmitted field notebook draft','obs-scenario':'proposal','obs-use':'challenge','terrain-datum':'Unsubmitted courtyard datum','terrain-spacing':'1'};for(const [id,value] of Object.entries(values)){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}const state={setItem:Storage.prototype.setItem,writes:[],drafts:values,raw:localStorage.getItem('${storeKey}'),study:document.querySelector('#study-results').firstElementChild,studyState:document.querySelector('#study-status').dataset.state,observation:document.querySelector('#observation-list').firstElementChild,metric:document.querySelector('#metrics').firstElementChild,chart:document.querySelector('#chart').firstElementChild};window.__rainMapIsolation=state;Storage.prototype.setItem=function(key,value){state.writes.push(String(key));return state.setItem.call(this,key,value);};})()`);
    await evaluate("document.querySelector('[data-brush=raise]').click()");
    await view('snapshot'); await snapshot(reference, 0);
    assert.equal(await evaluate("document.querySelector('#map-snapshot-prev').getAttribute('aria-disabled')"), 'true');
    await focus('#map-snapshot-prev'); await press('Enter'); await snapshot(reference, 0);
    assert.equal(await evaluate('document.activeElement.id'), 'map-snapshot-prev');
    await focus('#map-snapshot-index'); await press('ArrowRight'); await snapshot(reference, 1);
    assert.equal(await evaluate('document.activeElement.id'), 'map-snapshot-index');
    await focus('#map-snapshot-next'); await press('Enter'); await snapshot(reference, 2);
    await press('Enter'); await snapshot(reference, 3);
    assert.notDeepEqual(reference.existing.snapshots[3].depthsMm, reference.existing.peakDepthMm);
    assert.notDeepEqual(reference.existing.snapshots[3].depthsMm, reference.existing.finalDepthMm);
    await press('Enter'); await snapshot(reference, 4);
    assert.equal(await evaluate('document.activeElement.id'), 'map-snapshot-next');
    assert.equal(await evaluate("document.querySelector('#map-snapshot-next').getAttribute('aria-disabled')"), 'true');
    await press('Enter'); await snapshot(reference, 4);
    await focus('#map-snapshot-index'); await press('Home'); await snapshot(reference, 0);
    await press('End'); await snapshot(reference, 4);
    await press('ArrowLeft'); await snapshot(reference, 3);
    for (const mode of ['peak', 'final', 'surface']) await view(mode);
    await view('snapshot'); await snapshot(reference, 3);
    const isolation = await evaluate(`(()=>{const s=window.__rainMapIsolation;return {writes:s.writes,savedUnchanged:localStorage.getItem('${storeKey}')===s.raw,drafts:Object.fromEntries(Object.keys(s.drafts).map(id=>[id,document.getElementById(id).value])),expectedDrafts:s.drafts,studySame:document.querySelector('#study-results').firstElementChild===s.study,studyStateSame:document.querySelector('#study-status').dataset.state===s.studyState,observationSame:document.querySelector('#observation-list').firstElementChild===s.observation,metricSame:document.querySelector('#metrics').firstElementChild===s.metric,chartSame:document.querySelector('#chart').firstElementChild===s.chart,raiseActive:document.querySelector('[data-brush=raise]').getAttribute('aria-pressed')};})()`);
    assert.deepEqual(isolation.writes, []); assert.equal(isolation.savedUnchanged, true);
    assert.deepEqual(isolation.drafts, isolation.expectedDrafts);
    for (const key of ['studySame', 'studyStateSame', 'observationSame', 'metricSame', 'chartSame']) assert.equal(isolation[key], true, key);
    assert.equal(isolation.raiseActive, 'true');
    assert.deepEqual(await saved(), project);
    await restoreSpy();
    report.push('native range Home/End/arrows and focused previous/next reach exact shared 0/3/6/9/10.3-minute snapshots; drydown is neither peak nor final and endpoint activation is a focused no-op');
    report.push('time/view navigation makes no storage writes or project changes and preserves notebook/terrain drafts plus the real comparison, notebook, metric and chart nodes');

    // Confirm that the invalidation sentinel responds to an actual site edit.
    await focus('#proposal-grid [data-cell-index="0"]'); await press('ArrowRight');
    assert.equal(await evaluate('document.activeElement.dataset.cellIndex'), '1');
    assert.deepEqual(await saved(), project, 'grid arrows alone must not paint');
    await press('Enter');
    const edited = await saved();
    const expectedEdit = structuredClone(project); expectedEdit.selectedIndex = 1;
    Object.assign(expectedEdit.proposal[1], { elevationM: 0.025, provenance: 'manually edited hypothetical assumption' });
    assert.deepEqual(edited, expectedEdit);
    assert.equal(await evaluate("document.querySelector('#study-status').dataset.state"), 'not-compared');
    assert.equal(await evaluate("document.querySelector('#study-results').childElementCount"), 0);
    assert.equal(await evaluate('document.activeElement.dataset.cellIndex'), '1');
    await snapshot(compare(edited), 3);
    report.push('grid arrows still only move focus in snapshot mode; native Enter applies the active brush, preserves cell focus and invalidates the previously retained comparison');

    const duration = async minutes => {
      await evaluate(`document.querySelector('#duration').value=${JSON.stringify(String(minutes))};document.querySelector('#duration').dispatchEvent(new Event('change',{bubbles:true}))`);
      return compare(await saved());
    };
    await snapshot(await duration(9.6), 3); // Previous 9-minute time remains exact.
    await focus('#map-snapshot-index'); await press('End');
    await snapshot(compare(await saved()), 4);
    await snapshot(await duration(6.6), 3); // Previous 9.6-minute time clamps to 6.6.
    await snapshot(await duration(12), 2); // Previous 6.6 now maps to native minute 6.
    const coarser = await saved(); coarser.weather.stepMinutes = 4;
    await importProject(coarser);
    await snapshot(compare(coarser), 1); // Previous 6 ties between 4 and 8: choose 4.
    report.push('duration and ordinary project replacement rebind to native snapshots: preserve9, clamp6.6, nearest6 and earlier4 on a 4/8-minute tie');

    await importProject(project); await view('snapshot');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.bringToFront');
    await focus('#map-snapshot-index'); await press('Home'); await press('ArrowRight');
    await press('ArrowRight'); await press('ArrowRight'); await snapshot(reference, 3);
    await evaluate("(async()=>{await document.fonts.ready;document.querySelector('#maps').scrollIntoView({block:'start',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()");
    const desktop = await evaluate(`(()=>{const boxes=['map-snapshot-controls','existing-grid','proposal-grid'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};});return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,boxes,controlsFit:Array.from(document.querySelectorAll('#map-snapshot-controls button,#map-snapshot-controls input')).every(element=>{const r=element.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth;})};})()`);
    assert.ok(desktop.scrollWidth <= desktop.width + 1, JSON.stringify(desktop));
    assert.equal(desktop.controlsFit, true);
    for (const box of desktop.boxes) {
      assert.ok(box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= desktop.width &&
        box.top >= 0 && box.bottom <= desktop.height, JSON.stringify(desktop));
    }
    await screenshot('rain-map-time-desktop-1280');
    if (artifactDirectory) writeFileSync(`${artifactDirectory}/rain-map-time-desktop-layout.json`, `${JSON.stringify(desktop, null, 2)}\n`);
    report.push('1280px desktop visibly contains both paired maps and the shared time controls at the exact minute9 analytic drydown; screenshot retained');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 1, mobile: true });
    await send('Page.bringToFront');
    await focus('#map-snapshot-index'); await press('Home'); await press('ArrowRight');
    await press('ArrowRight'); await press('ArrowRight'); await snapshot(reference, 3);
    await evaluate("(async()=>{document.querySelector('#maps').scrollIntoView({block:'start',behavior:'instant'});await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()");
    const layout = await evaluate(`(()=>{const controls=document.querySelector('#map-snapshot-controls');const r=controls.getBoundingClientRect();const active=document.activeElement,s=getComputedStyle(active);return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},buttonsFit:Array.from(controls.querySelectorAll('button,input')).every(element=>{const b=element.getBoundingClientRect();return b.width>0&&b.left>=0&&b.right<=innerWidth;}),focusId:active.id,focusVisible:active.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth)};})()`);
    assert.ok(layout.scrollWidth <= layout.width + 1, JSON.stringify(layout));
    assert.ok(layout.controls.left >= 0 && layout.controls.right <= layout.width && layout.controls.top >= 0 && layout.controls.bottom <= 1100, JSON.stringify(layout));
    assert.equal(layout.buttonsFit, true); assert.equal(layout.focusId, 'map-snapshot-index');
    assert.equal(layout.focusVisible, true); assert.notEqual(layout.outline, 'none'); assert.ok(layout.outlineWidth > 0);
    await screenshot('rain-map-time-mobile-390');
    if (artifactDirectory) writeFileSync(`${artifactDirectory}/rain-map-time-layout.json`, `${JSON.stringify(layout, null, 2)}\n`);
    report.push('390px paired maps and native time controls fit the page with visible range focus; exact minute9 drydown screenshot retained');
  } catch (error) {
    courseError = error;
    try { await screenshot('rain-map-time-failure'); }
    catch (shotError) { report.push(`Map-time failure screenshot unavailable: ${String(shotError)}`); }
    throw error;
  } finally {
    try {
      await restoreSpy(); await send('Emulation.clearDeviceMetricsOverride');
      await evaluate(original === null ? `localStorage.removeItem('${storeKey}')` :
        `localStorage.setItem('${storeKey}',${JSON.stringify(original)})`);
      await send('Page.reload', { ignoreCache: true });
    } catch (restoreError) {
      if (!courseError) throw restoreError;
      report.push(`Map-time workspace restoration also failed: ${String(restoreError)}`);
    }
  }
}

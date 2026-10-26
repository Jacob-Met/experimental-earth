import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { makeExample } from '../core.js';

export async function openWaterBudgetWorkbench({ evaluate, send, delay }) {
  const selector = '#investigation-results a[data-investigation-id="local-budget-panel"]';
  let available = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    available = await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
    if (available) break;
    await delay(50);
  }
  assert.ok(available, 'ordinary investigation navigation must offer the water-budget workbench');
  await evaluate("(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()");
  const traceKey = '__customWaterBudgetNavigationTrace';
  await evaluate(`(()=>{const trace={events:[]};trace.capture=event=>{const target=event.target;trace.events.push({type:event.type,tag:target.tagName,id:target.id,investigation:target.closest?.('[data-investigation-id]')?.dataset.investigationId??null,x:event.clientX,y:event.clientY});};window.${traceKey}=trace;for(const type of ['mousedown','mouseup','click'])document.addEventListener(type,trace.capture,true);})()`);
  let lastPoint = null;
  const diagnostic = () => evaluate(`(()=>{const active=document.activeElement;const point=${JSON.stringify(lastPoint)};const hit=point?document.elementFromPoint(point.x,point.y):null;const link=document.querySelector(${JSON.stringify(selector)});const r=link?.getBoundingClientRect();return {active:{tag:active?.tagName,id:active?.id,html:active?.outerHTML?.slice(0,600)},hit:hit?.outerHTML?.slice(0,600),point,hash:location.hash,readyState:document.readyState,fontStatus:document.fonts.status,viewport:{width:innerWidth,height:innerHeight,scrollX,scrollY,visual:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop,scale:visualViewport.scale}:null},browseOpen:document.querySelector('#investigation-browse')?.open,linkRect:r?{left:r.left,top:r.top,width:r.width,height:r.height}:null,events:window.${traceKey}?.events};})()`);
  const clickVisible = async target => {
    const point = await evaluate(`(async()=>{const element=document.querySelector(${JSON.stringify(target)});element.scrollIntoView({block:'center',behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const r=element.getBoundingClientRect();const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);const x=(left+right)/2,y=(top+bottom)/2;const hit=document.elementFromPoint(x,y);return {x,y,visible:right>left&&bottom>top&&getComputedStyle(element).visibility!=='hidden',hit:hit===element||element.contains(hit)};})()`);
    lastPoint = { x: point.x, y: point.y };
    if (!point.visible || !point.hit) {
      assert.fail(`navigation target must be visible and receive the pointer: ${target}; ${JSON.stringify(await diagnostic())}`);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 });
  };
  try {
    if (!await evaluate("document.querySelector('#investigation-browse').open")) {
      await clickVisible('#investigation-browse > summary');
    }
    await clickVisible(selector);
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await evaluate("document.activeElement.id==='local-budget-title'")) break;
      await delay(25);
    }
    const activeId = await evaluate('document.activeElement.id');
    if (activeId !== 'local-budget-title') {
      assert.equal(activeId, 'local-budget-title',
        `native navigation must focus the water-budget heading; ${JSON.stringify(await diagnostic())}`);
    }
    assert.ok(await evaluate("(()=>{const control=document.querySelector('#local-budget-scope');return control.getClientRects().length>0&&!control.closest('[hidden],[aria-hidden=\"true\"]')&&getComputedStyle(control).visibility!=='hidden';})()"), 'water-budget controls must be visible after ordinary navigation');
  } finally {
    await evaluate(`(()=>{const trace=window.${traceKey};if(trace)for(const type of ['mousedown','mouseup','click'])document.removeEventListener(type,trace.capture,true);delete window.${traceKey};})()`);
  }
}

export async function receiveCustomWaterBudget({ evaluate, send, delay, report, artifactDirectory }) {
  const storageKey = 'experimental-earth-site-v1';
  const original = await evaluate(`localStorage.getItem('${storageKey}')`);
  const saved = async () => JSON.parse(await evaluate(`localStorage.getItem('${storageKey}')`));
  const state = () => evaluate("document.querySelector('#local-budget-status').dataset.state");
  const row = component => evaluate(`Array.from(document.querySelectorAll('#local-budget-results [data-component=${component}] td')).map(x=>x.textContent)`);
  const waitFor = async (expression, message) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate(expression)) return;
      await delay(50);
    }
    assert.fail(message);
  };
  const reload = async ({ navigate = false } = {}) => {
    await send('Page.reload', { ignoreCache: true }); await delay(350);
    await waitFor("!!document.querySelector('#local-budget-area-grid')", 'ordinary app did not mount the area picker');
    if (navigate) await openWaterBudgetWorkbench({ evaluate, send, delay });
  };
  const setScope = scope => evaluate(`(()=>{const s=document.querySelector('#local-budget-scope');s.value=${JSON.stringify(scope)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const focusCell = async index => {
    const focused = await evaluate(`(()=>{const button=document.querySelector('#local-budget-area-grid [data-cell-index="${index}"]');if(!button||!button.getClientRects().length||button.closest('[hidden],[aria-hidden="true"]'))throw Error('Custom picker cell is not visible');button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});button.focus();return document.activeElement===button;})()`);
    assert.equal(focused, true, 'native keyboard course must start with a visible, focused picker button');
  };
  const focusedCell = () => evaluate("document.activeElement.closest('#local-budget-area-grid') ? Number(document.activeElement.dataset.cellIndex) : null");
  const press = async key => {
    const codes = { ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40],
      ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], Enter: ['Enter', 13], ' ': ['Space', 32] };
    const [code, keyCode] = codes[key];
    const parameters = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await send('Input.dispatchKeyEvent', { type: 'keyDown', ...parameters,
      ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : key === ' ' ? { text: ' ', unmodifiedText: ' ' } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...parameters });
  };
  const importJson = async json => {
    await evaluate(`(()=>{const file=new File([${JSON.stringify(json)}],'custom-area-site.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await waitFor("document.querySelector('#import').value==='' && document.querySelector('#toast').textContent==='Validated project imported.'", 'ordinary project import did not complete');
  };
  const screenshot = async name => {
    if (!artifactDirectory) return;
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${artifactDirectory}/${name}.png`, Buffer.from(shot.data, 'base64'));
  };
  const expectStudy = async (scope, cellIndices) => {
    const project = await saved();
    assert.deepEqual(project.localWaterBudgetStudy, {
      schema: 'experimental-earth-local-water-budget/1', scope,
      width: project.width, height: project.height, cellIndices,
    });
    return project;
  };
  const p = makeExample(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'authored custom-area browser control' }));
  p.proposal = p.existing.map(cell => ({ ...cell, surface: 'garden' }));
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  const unchangedGeometry = project => {
    assert.deepEqual(project.existing, p.existing);
    assert.deepEqual(project.proposal, p.proposal);
  };

  let courseError;
  try {
    await evaluate(`localStorage.setItem('${storageKey}',${JSON.stringify(JSON.stringify(p))})`);
    await reload({ navigate: true }); await setScope('custom');
    assert.equal(await state(), 'no-area');
    assert.equal(await evaluate("document.querySelector('#trace-local-budget').disabled"), true);
    await evaluate("document.querySelector('[data-brush=raise]').click()");
    assert.equal(await evaluate("document.querySelector('[data-brush=raise]').getAttribute('aria-pressed')"), 'true');
    await focusCell(0); await press('Enter');
    await expectStudy('custom', [0]);
    await press('ArrowRight'); assert.equal(await focusedCell(), 1);
    await press('ArrowDown'); assert.equal(await focusedCell(), 3);
    unchangedGeometry(await expectStudy('custom', [0]));
    await press('Enter'); await expectStudy('custom', [0, 3]);
    await press(' '); await expectStudy('custom', [0]);
    await press(' '); const selected = await expectStudy('custom', [0, 3]);
    unchangedGeometry(selected); assert.equal(selected.selectedIndex, 0);
    assert.equal(await focusedCell(), 3);
    assert.equal(await evaluate("document.querySelectorAll('#local-budget-area-grid [tabindex=\"0\"]').length"), 1);
    assert.equal(await evaluate("document.querySelector('#local-budget-area-grid [data-cell-index=\"3\"]').getAttribute('aria-pressed')"), 'true');
    await evaluate("document.querySelector('#trace-local-budget').click()");
    assert.equal(await state(), 'computed');
    assert.deepEqual(await row('storedLiters'), ['42', '12', '-30']);
    assert.deepEqual(await row('absorbedLiters'), ['18', '48', '+30']);
    assert.equal(await evaluate("document.querySelector('#local-budget-results').dataset.cellCount"), '2');
    assert.equal(await evaluate("document.querySelector('#local-budget-results details p').textContent"), 'A1, B2');
    report.push('custom area uses the same disconnected cells in both scenarios: native Enter/Space and arrows select A1/B2 without painting under an active raise brush; analytic stored water is 42→12 L');

    // Exercise the ordinary Export listener and inspect the actual Blob and
    // connected download anchor, preventing only the browser's final download.
    const exported = await evaluate(`(async()=>{
      const create=URL.createObjectURL;let blob,url,anchor;
      const capture=event=>{const link=event.target.closest?.('a');if(link&&link.href===url&&link.download){anchor={download:link.download,href:link.href,connected:link.isConnected};event.preventDefault();}};
      URL.createObjectURL=function(value){blob=value;url=create.call(URL,value);return url;};
      document.addEventListener('click',capture,true);
      try {document.querySelector('#export').click();return {json:blob?await blob.text():null,type:blob?.type,anchor};}
      finally {URL.createObjectURL=create;document.removeEventListener('click',capture,true);}
    })()`);
    assert.equal(exported.type, 'application/json');
    assert.equal(exported.anchor?.download, 'experimental-earth-site.json');
    assert.equal(exported.anchor?.connected, true);
    assert.match(exported.anchor.href, /^blob:/);
    const portable = JSON.parse(exported.json);
    assert.deepEqual(portable.localWaterBudgetStudy, selected.localWaterBudgetStudy);
    unchangedGeometry(portable);

    await evaluate("document.querySelector('#local-budget-clear-area').click()");
    assert.equal(await state(), 'no-area');
    assert.equal(await evaluate("document.querySelector('#trace-local-budget').disabled"), true);
    assert.equal(await evaluate("document.querySelectorAll('#local-budget-results table').length"), 0);
    await expectStudy('custom', []);
    await focusCell(0); await press('Enter');
    assert.equal(await state(), 'computed', 'adding an area after clearing must reuse the unchanged ledger');
    assert.deepEqual(await row('storedLiters'), ['21', '6', '-15']);
    await focusCell(3); await press(' ');
    assert.deepEqual(await row('storedLiters'), ['42', '12', '-30']);
    report.push('empty custom area shows no-area with tracing disabled; selecting cells again reuses the current ledger without a new trace');

    // Suspend only this file read so a real picker edit can win the import race.
    const delayed = { ...portable, title: 'Delayed import must not replace this workspace',
      localWaterBudgetStudy: { ...portable.localWaterBudgetStudy, cellIndices: [2] } };
    await evaluate(`(()=>{
      const originalText=File.prototype.text;window.__customBudgetPendingRead={started:false};
      File.prototype.text=function(){if(this.name==='delayed-custom-area.json'){window.__customBudgetPendingRead.started=true;return new Promise(resolve=>{window.__customBudgetPendingRead.release=()=>resolve(${JSON.stringify(JSON.stringify(delayed))});});}return originalText.call(this);};
      try {const file=new File(['{}'],'delayed-custom-area.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#import');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
      finally {File.prototype.text=originalText;}
    })()`);
    assert.equal(await evaluate('window.__customBudgetPendingRead.started'), true);
    await focusCell(1); await press('Enter');
    const duringRead = await expectStudy('custom', [0, 1, 3]);
    await evaluate('window.__customBudgetPendingRead.release()');
    await waitFor("document.querySelector('#toast').textContent.includes('Import refused: Workspace changed while reading')", 'pending import overwrote or failed to acknowledge the newer custom selection');
    assert.deepEqual(await saved(), duringRead);
    unchangedGeometry(duringRead);
    assert.deepEqual(await row('storedLiters'), ['63', '18', '-45']);
    report.push('an ordinary import suspended during File.text is refused after a custom-area edit, preserving the newer saved selection');

    await importJson(exported.json); await reload();
    unchangedGeometry(await expectStudy('custom', [0, 3]));
    assert.equal(await evaluate("document.querySelector('#local-budget-scope').value"), 'custom');
    assert.equal(await state(), 'not-computed');
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#local-budget-area-grid [aria-pressed=true]')).map(b=>Number(b.dataset.cellIndex))"), [0, 3]);
    await evaluate("document.querySelector('#trace-local-budget').click()");
    assert.deepEqual(await row('storedLiters'), ['42', '12', '-30']);
    report.push('ordinary Export creates a portable JSON Blob/download anchor; ordinary Import and reload restore custom scope and membership and recompute the 42→12 L result');

    await evaluate("document.querySelector('[data-brush=raise]').click();document.querySelector('#local-budget-results [data-neighbor=\"1\"] button').click()");
    const neighbor = await expectStudy('cell', [0, 3]);
    unchangedGeometry(neighbor); assert.equal(neighbor.selectedIndex, 1);
    assert.equal(await evaluate("document.querySelector('[data-brush=inspect]').getAttribute('aria-pressed')"), 'true');
    await reload();
    assert.equal(await evaluate("document.querySelector('#local-budget-scope').value"), 'cell');
    await expectStudy('cell', [0, 3]);
    await evaluate("document.querySelector('#trace-local-budget').click()");
    assert.deepEqual(await row('storedLiters'), ['21', '6', '-15']);
    await setScope('custom');
    assert.deepEqual(await row('storedLiters'), ['42', '12', '-30']);
    await evaluate("document.querySelector('#rain').value='35';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await state(), 'stale');
    assert.equal(await evaluate("document.querySelector('#local-budget-results').textContent"), '');
    await evaluate("document.querySelector('#trace-local-budget').click()");
    assert.deepEqual(await row('storedLiters'), ['52', '22', '-30']);
    await expectStudy('custom', [0, 3]);
    report.push('neighbor navigation saves cell scope and retains the authored custom area; weather edits remove stale results and retracing uses the changed rainfall');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('#local-budget-custom-area').scrollIntoView({block:'start',behavior:'instant'})");
    await focusCell(0); await press('ArrowRight'); await press('ArrowDown');
    assert.equal(await focusedCell(), 3);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    assert.ok(await evaluate("(()=>{const r=document.activeElement.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})()"));
    await screenshot('custom-water-budget-mobile');

    // A wide imported site catches contained scrolling and focus problems that
    // the two-column analytic control cannot expose.
    const wide = { ...p, width: 24, height: 2,
      existing: Array.from({ length: 48 }, () => ({ ...p.existing[0] })),
      proposal: Array.from({ length: 48 }, () => ({ ...p.proposal[0] })),
      localWaterBudgetStudy: { schema: 'experimental-earth-local-water-budget/1',
        scope: 'custom', width: 24, height: 2, cellIndices: [0, 23] } };
    await importJson(JSON.stringify(wide));
    assert.equal(await evaluate("document.querySelectorAll('#local-budget-area-grid button').length"), 48);
    await evaluate("document.querySelector('#local-budget-custom-area').scrollIntoView({block:'start',behavior:'instant'})");
    await focusCell(22); await press('ArrowRight'); await press('ArrowDown');
    assert.equal(await focusedCell(), 47);
    await press(' '); await expectStudy('custom', [0, 23, 47]);
    assert.equal(await focusedCell(), 47);
    assert.equal(await evaluate("document.querySelectorAll('#local-budget-area-grid [tabindex=\"0\"]').length"), 1);
    const layout = await evaluate(`(()=>{const scroll=document.querySelector('.local-budget-area-scroll');const box=scroll.getBoundingClientRect();const focus=document.activeElement.getBoundingClientRect();return {pageFits:document.documentElement.scrollWidth<=innerWidth,contained:box.left>=0&&box.right<=innerWidth,scrollable:scroll.scrollWidth>scroll.clientWidth,scrolled:scroll.scrollLeft>0,focusVisible:focus.left>=box.left-1&&focus.right<=box.right+1};})()`);
    assert.deepEqual(layout, { pageFits: true, contained: true, scrollable: true, scrolled: true, focusVisible: true });
    await screenshot('custom-water-budget-mobile-wide-picker');
    report.push('390px custom picker and results fit the page; an imported 24-column area scrolls within its picker and keeps native keyboard focus on the far-edge cell after toggling');
  } catch (error) {
    courseError = error;
    try { await screenshot('custom-water-budget-failure'); }
    catch (screenshotError) { report.push(`Custom-area failure screenshot could not be retained: ${String(screenshotError)}`); }
    throw error;
  } finally {
    try {
      await send('Emulation.clearDeviceMetricsOverride');
      await evaluate(original === null ? `localStorage.removeItem('${storageKey}')` :
        `localStorage.setItem('${storageKey}',${JSON.stringify(original)})`);
      await reload();
    } catch (restoreError) {
      if (!courseError) throw restoreError;
      report.push(`Custom-area workspace restoration also failed: ${String(restoreError)}`);
    }
  }
}

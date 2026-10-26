import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const chromeBin = process.env.CHROME_BIN ?? '/opt/google/chrome/chrome';
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? (root + '.browser-draft-' + randomUUID());
const baseline = process.env.EARTH_DRAFT_BASELINE === '1';
const source = Object.fromEntries(['app.js', 'index.html', 'tests/observation-draft.browser.mjs'].map(path => [path,
  createHash('sha256').update(readFileSync(root + path)).digest('hex')]));
const checks = [];
let exceptions = [];
const keyboardProbe = {};
function failureDetails(error, depth = 0) {
  if (!error || typeof error !== 'object') return { message: String(error) };
  return { name: error.name, message: error.message, stack: error.stack, code: error.code,
    actual: error.actual, expected: error.expected, operator: error.operator,
    failure: error.receipt?.failure ?? error.failure,
    cause: error.cause && depth < 6 ? failureDetails(error.cause, depth + 1) : undefined };
}

try {
  const result = await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
    const { send, evaluate, baseUrl } = session;
    exceptions = session.exceptions;
    const stored = () => evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1'))");
    const draft = () => evaluate(`({depth:document.querySelector('#obs-depth').value,
      source:document.querySelector('#obs-source').value,
      cell:document.querySelector('#obs-cell').value,
      minute:Number(document.querySelector('#obs-minute').value),
      status:document.querySelector('#observation-draft-status')?.textContent ?? ''})`);
    const fill = (depth, source, minute = 30) => evaluate(`(() => {
      for (const [id,value] of Object.entries(${JSON.stringify({ 'obs-depth': depth, 'obs-source': source, 'obs-minute': minute, 'obs-uncertainty': 0.2, 'obs-scenario': 'existing', 'obs-use': 'calibration' })})) {
        const input=document.getElementById(id);input.value=String(value);
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
    })()`);
    const importText = text => evaluate(`(async () => {
      const input=document.querySelector('#import'), transfer=new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(text)}],'draft-investigation.json',{type:'application/json'}));
      input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,200));
    })()`);
    async function loaded() {
      for (let i = 0; i < 50; i++) {
        await delay(100);
        try { if (await evaluate("document.querySelectorAll('#existing-grid .cell').length") === 48) return; } catch {}
      }
      assert.fail('Maintained application did not mount the original 48-cell grid');
    }
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: baseUrl });
    await loaded();
    const initial = await stored();
    initial.observations = [];
    initial.selectedIndex = 0;
    await importText(JSON.stringify(initial));
    await fill(12.5, 'Original A1 field notebook — authored attribution regression');

    if (baseline) {
      await evaluate("document.querySelector('#existing-grid [data-cell-index=\"1\"]').click();document.querySelector('#observe-form').requestSubmit()");
      const after = await stored();
      assert.equal(after.observations.length, 1);
      assert.equal(after.observations[0].cellIndex, 1);
      assert.equal(after.observations[0].depthMm, 12.5);
      assert.match(after.observations[0].source, /^Original A1/);
      checks.push('Maintained baseline accepted the unchanged A1 draft as B1 after an ordinary grid click');
      return { baselineDefect: after.observations[0], checks, source, exceptions, sandbox: session.sandbox };
    }

    await evaluate("document.querySelector('#existing-grid [data-cell-index=\"0\"]').click()");
    assert.equal((await draft()).depth, '12.5');
    assert.match((await draft()).source, /^Original A1/);
    checks.push('Inspecting the same selected cell preserves an unfinished reading');

    await evaluate("document.querySelector('#existing-grid [data-cell-index=\"0\"]').focus()");
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    keyboardProbe.afterArrow = await evaluate("({focusedCell:document.activeElement.dataset.cellIndex,selectedIndex:JSON.parse(localStorage.getItem('experimental-earth-site-v1')).selectedIndex})");
    assert.equal(await evaluate('document.activeElement.dataset.cellIndex'), '1');
    assert.equal((await stored()).selectedIndex, 0);
    assert.equal((await draft()).depth, '12.5');
    // Enter needs its carriage-return text to produce native button activation,
    // not merely an isolated keydown event with no keypress/default action.
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    for (let i = 0; i < 20 && (await stored()).selectedIndex !== 1; i++) await delay(50);
    keyboardProbe.afterEnter = await evaluate("({focusedCell:document.activeElement.dataset.cellIndex,selectedIndex:JSON.parse(localStorage.getItem('experimental-earth-site-v1')).selectedIndex})");
    assert.equal((await stored()).selectedIndex, 1);
    const retired = await draft();
    assert.equal(retired.cell, 'B1');
    assert.equal(retired.depth, '');
    assert.equal(retired.source, '');
    assert.match(retired.status, /Unsaved reading cleared.*selected cell or site changed/);
    await evaluate("document.querySelector('#observe-form').requestSubmit()");
    assert.equal((await stored()).observations.length, 0);
    checks.push('Arrow focus alone preserves the draft; keyboard selection of B1 retires it visibly and prevents misattributed submission');

    await fill(7.25, 'Actual B1 field notebook — authored attribution regression');
    assert.equal((await draft()).status, '');
    await evaluate("document.querySelector('#observe-form').requestSubmit();document.querySelector('#infiltration-form').requestSubmit()");
    const accepted = await stored();
    assert.deepEqual(accepted.observations, [{ cellIndex: 1, minute: 30, depthMm: 7.25, uncertaintyMm: 0.2,
      source: 'Actual B1 field notebook — authored attribution regression', scenario: 'existing', use: 'calibration' }]);
    const inference = await evaluate(`(async()=>{
      const {compareInfiltration}=await import('./infiltration-study.js');
      const result=compareInfiltration(JSON.parse(localStorage.getItem('experimental-earth-site-v1')));
      return {status:result.status,counts:result.counts,consumerState:document.querySelector('#study-status').dataset.state};
    })()`);
    assert.equal(inference.counts.calibration, 1);
    assert.equal(inference.counts.challenge, 0);
    assert.notEqual(inference.consumerState, 'need-calibration');
    assert.match(await evaluate("document.querySelector('#study-results').textContent"), /Calibration · B1 at 30 min: observed 7\.25/);
    checks.push('Fresh explicit B1 evidence is retained at B1 and reaches the maintained infiltration consumer');

    assert.equal(await evaluate("document.querySelector('#suggest').disabled"), false);
    await evaluate("document.querySelector('#suggest').click()");
    const suggestion = await draft();
    await fill(44, 'Draft for a different event minute', suggestion.minute === 0 ? 1 : 0);
    const sameCell = (await stored()).selectedIndex;
    await evaluate("document.querySelector('#suggest').click()");
    assert.equal((await stored()).selectedIndex, sameCell);
    assert.equal((await draft()).minute, suggestion.minute);
    assert.equal((await draft()).depth, '');
    assert.equal((await draft()).source, '');
    assert.match((await draft()).status, /target cell or time/);
    assert.deepEqual((await stored()).observations, accepted.observations);
    checks.push('A suggested time change retires a draft even when the selected cell does not change; saved evidence is preserved');

    await fill(6, 'Unfinished current-site measurement');
    await importText('{"schema":"invalid"}');
    assert.equal((await draft()).depth, '6');
    assert.equal((await draft()).source, 'Unfinished current-site measurement');
    assert.deepEqual((await stored()).observations, accepted.observations);
    checks.push('Rejected project replacement preserves the current draft and retained observations');

    const replacement = await stored();
    replacement.title = 'Explicitly reopened original site';
    await importText(JSON.stringify(replacement));
    assert.equal((await draft()).depth, '');
    assert.equal((await draft()).source, '');
    assert.match((await draft()).status, /selected cell or site changed/);
    assert.deepEqual((await stored()).observations, accepted.observations);
    checks.push('Accepted project replacement retires an unfinished draft even at the same cell, without modifying saved readings');

    const downloadPath = session.runDirectory + '/experimental-earth-site.json';
    assert.equal(existsSync(downloadPath), false, 'Use a fresh run directory so a prior export cannot satisfy receiving');
    const expectedExport = JSON.stringify(await stored(), null, 2);
    await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: session.runDirectory });
    await evaluate("document.querySelector('#export').click()");
    for (let i = 0; i < 80 && !existsSync(downloadPath); i++) await delay(100);
    assert.equal(existsSync(downloadPath), true, 'The ordinary Export control did not complete a project download');
    const downloadedText = readFileSync(downloadPath, 'utf8');
    const downloadSha256 = createHash('sha256').update(downloadedText).digest('hex');
    assert.equal(downloadSha256, createHash('sha256').update(expectedExport).digest('hex'));
    assert.deepEqual(JSON.parse(downloadedText).observations, accepted.observations);
    await evaluate('localStorage.clear()');
    await send('Page.reload', { ignoreCache: true });
    await loaded();
    await importText(downloadedText);
    assert.deepEqual((await stored()).observations, accepted.observations);
    assert.match(await evaluate("document.querySelector('#observation-list').textContent"), /B1.*Actual B1/s);
    checks.push('Ordinary Export completes a disk download matching the exact project SHA256; fresh-runtime reopen uses those disk bytes and retains B1 attribution');

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await fill(8, 'Narrow-screen draft for the current cell');
    const current = (await stored()).selectedIndex;
    const next = current === 0 ? 1 : 0;
    await evaluate(`document.querySelector('#existing-grid [data-cell-index="${next}"]').click();document.querySelector('#observation-draft-status').scrollIntoView({behavior:'instant',block:'center'})`);
    assert.equal((await draft()).depth, '');
    assert.match((await draft()).status, /Unsaved reading cleared/);
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const inspectStatus = () => evaluate(`(() => {
        const status=document.querySelector('#observation-draft-status'), rect=status.getBoundingClientRect();
        const style=getComputedStyle(status), x=rect.left+rect.width/2, y=rect.top+rect.height/2;
        const topmost=document.elementFromPoint(x,y);
        return {top:rect.top,bottom:rect.bottom,height:rect.height,viewportHeight:innerHeight,scrollY,
          display:style.display,visibility:style.visibility,opacity:Number(style.opacity),
          unobscured:topmost===status || status.contains(topmost),text:status.textContent};
      })()`);
    const inViewport = value => value.height > 0 && value.top >= 0 && value.bottom <= value.viewportHeight;
    const visible = value => inViewport(value) && value.unobscured && value.display !== 'none' && value.visibility === 'visible' && value.opacity > 0;
    let statusVisibility, previousStatus = null, stableSamples = 0, scrollAttempts = 1;
    const viewportSamples = [];
    for (let i = 0; i < 60; i++) {
      statusVisibility = await inspectStatus();
      // A later grid-focus/layout update can supersede the first scroll. Only
      // correct an out-of-view target; do not keep moving an already visible one.
      if (!inViewport(statusVisibility)) {
        viewportSamples.push({ phase: 'before-scroll', top: statusVisibility.top, bottom: statusVisibility.bottom, scrollY: statusVisibility.scrollY });
        await evaluate("document.querySelector('#observation-draft-status').scrollIntoView({behavior:'instant',block:'center'})");
        scrollAttempts++;
        stableSamples = 0; previousStatus = null;
        await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        statusVisibility = await inspectStatus();
      }
      const stable = previousStatus && ['top', 'bottom', 'height', 'scrollY'].every(key => Math.abs(previousStatus[key] - statusVisibility[key]) <= 0.5)
        && previousStatus.viewportHeight === statusVisibility.viewportHeight;
      stableSamples = visible(statusVisibility) ? (stable ? stableSamples + 1 : 1) : 0;
      viewportSamples.push({ phase: 'observed', top: statusVisibility.top, bottom: statusVisibility.bottom, scrollY: statusVisibility.scrollY,
        unobscured: statusVisibility.unobscured, stableSamples });
      previousStatus = visible(statusVisibility) ? statusVisibility : null;
      if (stableSamples >= 4) break;
      await delay(80);
    }
    assert.ok(statusVisibility.height > 0 && statusVisibility.top >= 0 && statusVisibility.bottom <= statusVisibility.viewportHeight,
      `Cleared-draft message is not inside the viewport: ${JSON.stringify(statusVisibility)}`);
    assert.equal(statusVisibility.unobscured, true, JSON.stringify(statusVisibility));
    assert.equal(statusVisibility.visibility, 'visible');
    assert.notEqual(statusVisibility.display, 'none');
    assert.ok(statusVisibility.opacity > 0);
    assert.ok(stableSamples >= 4, `Cleared-draft message did not settle across separated visible observations: ${JSON.stringify(viewportSamples)}`);
    const dimensions = await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth})');
    assert.ok(dimensions.scroll <= dimensions.inner + 1, JSON.stringify(dimensions));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(session.runDirectory + '/observation-draft-mobile.png', Buffer.from(shot.data, 'base64'));
    checks.push('The 390px cleared-draft explanation remains in a stable unobscured viewport rectangle across four separated observations before capture, without horizontal overflow');
    assert.deepEqual(exceptions, []);
    return { checks, source, keyboardProbe, inference, dimensions, statusVisibility, viewportReceiving: { scrollAttempts, stableSamples, samples: viewportSamples }, download: { path: downloadPath, sha256: downloadSha256, bytes: Buffer.byteLength(downloadedText) }, exceptions, sandbox: session.sandbox, sandboxPath: session.sandboxPath };
  });
  console.log(JSON.stringify({ status: baseline ? 'BASELINE_DEFECT_CONFIRMED' : 'PASS', ...result.value, session: result.receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: failureDetails(error), checks, source, keyboardProbe, exceptions, receiptFailure: error.receipt?.failure ?? null, receiptPath: error.receipt?.receiptFile ?? null }, null, 2));
  process.exitCode = 1;
}

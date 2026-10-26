import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { receiveLocalWaterBudget } from './local-water-budget.receiving.mjs';
import { openWaterBudgetWorkbench, receiveCustomWaterBudget } from './custom-water-budget.receiving.mjs';

// This focused consumer course supplements the full browser driver. It does not
// reinterpret or hide failures in the full driver's other receiving courses.
const scope = 'local-and-custom-water-budget';
const root = fileURLToPath(new URL('../', import.meta.url));
const chromeBin = process.env.CHROME_BIN ?? (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/chromium');
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? `${root}.custom-water-budget-browser-${randomUUID()}`;
const report = [];
let exceptions = [];

try {
  const result = await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
    const { baseUrl, send, evaluate } = session;
    exceptions = session.exceptions;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.navigate', { url: baseUrl });
    const origin = new URL(baseUrl).origin;
    let loaded = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { loaded = await evaluate('location.origin') === origin; } catch { /* navigation replaces the context */ }
      if (loaded) break;
      await delay(100);
    }
    assert.ok(loaded, 'owned browser must load the ordinary local app before storage setup');
    // withBrowserSession owns this fresh profile; no user's browser is touched.
    await evaluate('localStorage.clear()');
    await send('Page.reload', { ignoreCache: true }); await delay(350);
    let mounted = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      mounted = await evaluate("document.querySelectorAll('#existing-grid .cell').length===48 && document.querySelectorAll('#proposal-grid .cell').length===48 && !!document.querySelector('#local-budget-area-grid')");
      if (mounted) break;
      await delay(100);
    }
    assert.ok(mounted, 'ordinary application and custom-area picker must mount from served project assets');
    report.push('ordinary app entry point mounted both 48-cell grids and the custom-area picker in the maintained sandboxed session');
    const course = { evaluate, send, delay, report, artifactDirectory: session.runDirectory };
    await openWaterBudgetWorkbench(course);
    report.push('ordinary Browse investigations link opened the visible water-budget workbench and focused its heading');
    await receiveLocalWaterBudget(course);
    await receiveCustomWaterBudget(course);
    assert.deepEqual(exceptions, [], 'browser runtime exceptions must remain empty');
    return { scope, checks: report, exceptions,
      sandbox: session.sandbox, sandboxPath: session.sandboxPath };
  });
  console.log(JSON.stringify({ status: 'PASS', browser: chromeBin,
    ...result.value, session: result.receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', scope, browser: chromeBin,
    error: String(error), stack: error.stack ?? null,
    cause: error.cause ? String(error.cause) : null,
    receiptPath: error.receipt?.receiptFile ?? null,
    cleanup: error.receipt?.cleanup ?? null, checks: report, exceptions }, null, 2));
  process.exitCode = 1;
}

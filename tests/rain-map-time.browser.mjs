import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
import { receiveRainMapTime } from './rain-map-time.receiving.mjs';

const scope = 'paired-rain-map-time';
const root = fileURLToPath(new URL('../', import.meta.url));
const chromeBin = process.env.CHROME_BIN ?? (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/chromium');
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? `${root}.rain-map-time-browser-${randomUUID()}`;
const report = [];
let exceptions = [];
try {
  const result = await withBrowserSession({ root, chromeBin, runDirectory }, async session => {
    const { evaluate } = session;
    exceptions = session.exceptions;
    await session.send('Runtime.enable'); await session.send('Page.enable');
    let completedReloads = 0;
    const ready = async previousTimeOrigin => {
      const deadline = Date.now() + 20_000;
      let snapshot = null, navigationError = null;
      while (Date.now() < deadline) {
        session.signal.throwIfAborted();
        try {
          snapshot = await evaluate(`({timeOrigin:performance.timeOrigin,origin:location.origin,
            readyState:document.readyState,mounted:!!document.querySelector('#investigation-navigation')&&
              !!document.querySelector('#investigation-results a[data-investigation-id="maps"]'),
            existingCells:document.querySelectorAll('#existing-grid .cell').length})`);
          if ((previousTimeOrigin === undefined || snapshot.timeOrigin !== previousTimeOrigin) &&
              snapshot.origin === new URL(session.baseUrl).origin && snapshot.readyState === 'complete' && snapshot.mounted) return;
        } catch (error) {
          if (!/Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context/i.test(String(error))) throw error;
          navigationError = String(error);
        }
        await delay(75);
      }
      throw Error(`Ordinary app did not become ready: ${JSON.stringify({ previousTimeOrigin, snapshot, navigationError, exceptions })}`);
    };
    const send = async (method, parameters = {}) => {
      if (method !== 'Page.reload') return session.send(method, parameters);
      const previousTimeOrigin = await evaluate('performance.timeOrigin');
      const result = await session.send(method, parameters);
      await ready(previousTimeOrigin); completedReloads++;
      return result;
    };
    // The maintained session already navigated once to this fresh profile's app.
    await ready();
    assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"), 48);
    report.push('ordinary source-root app completed startup in the maintained sandboxed browser before receiving');
    await receiveRainMapTime({ evaluate, send, delay, report, artifactDirectory: session.runDirectory });
    assert.deepEqual(exceptions, []);
    return { scope, checks: report, exceptions, completedReloads,
      sandbox: session.sandbox, sandboxPath: session.sandboxPath };
  });
  console.log(JSON.stringify({ status: 'PASS', browser: chromeBin,
    ...result.value, session: result.receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', scope, browser: chromeBin,
    error: String(error), stack: error.stack ?? null, cause: error.cause ? String(error.cause) : null,
    receiptPath: error.receipt?.receiptFile ?? null, cleanup: error.receipt?.cleanup ?? null,
    checks: report, exceptions }, null, 2));
  process.exitCode = 1;
}

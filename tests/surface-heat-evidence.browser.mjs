import { withBrowserSession } from './support/browser-session.mjs';
import { receiveHeatEvidence } from './surface-heat-evidence.receiving.mjs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url)), report = [];
try {
  const result = await withBrowserSession({ root, chromeBin: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome',
    runDirectory: root + '.browser-run-heat-evidence-' + randomUUID() }, async session => {
    await session.send('Runtime.enable'); await session.send('Page.enable'); await session.send('DOM.enable');
    for (let i = 0; i < 60; i++) { if (await session.evaluate("Boolean(document.querySelector('#heat-evidence-form'))")) break; await delay(80); }
    assert.equal(await session.evaluate("Boolean(document.querySelector('#heat-evidence-form'))"), true);
    await receiveHeatEvidence({ ...session, delay, report, artifactDirectory: session.runDirectory });
    assert.deepEqual(session.exceptions, []);
    return { checks: report, sandbox: session.sandbox, exceptions: session.exceptions };
  });
  console.log(JSON.stringify({ status: 'PASS', ...result.value, receipt: result.receipt }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: String(error), checks: report, receipt: error.receipt ?? null }, null, 2));
  process.exitCode = 1;
}

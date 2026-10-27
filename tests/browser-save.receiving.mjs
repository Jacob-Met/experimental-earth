import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

/** A failed browser save must remain visible while the live project is recoverable. */
export async function receiveBrowserSave({ evaluate, send, delay, report }) {
  const key = 'experimental-earth-site-v1';
  const warning = 'Browser save failed. Keep this tab open and export the current project to retain changes.';
  const source = 'browser-save receiving: authored reading during quota failure';
  const hookToken = randomUUID();
  assert.equal(await evaluate('Boolean(window.__earthBrowserSaveReceiving)'), false,
    'preexisting browser-save receiving hooks must be reconciled before changing the workspace');
  const incomingWorkspace = await evaluate(`localStorage.getItem(${JSON.stringify(key)})`);
  const initialWidth = await evaluate('innerWidth');
  let changedViewport = false, testError, cleanupError;
  const snapshot = () => evaluate(`(() => {
    const status = document.querySelector('#project-save-status');
    const rect = status?.getBoundingClientRect();
    const style = status && getComputedStyle(status);
    return {
      stored: localStorage.getItem(${JSON.stringify(key)}),
      rows: document.querySelectorAll('#observation-list .observation').length,
      readings: document.querySelector('#observation-list').textContent,
      state: status?.dataset.saveState,
      status: status?.textContent.trim(),
      role: status?.getAttribute('role'),
      live: status?.getAttribute('aria-live'),
      atomic: status?.getAttribute('aria-atomic'),
      visible: !!status && !status.hidden && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0,
      statusLeft: rect?.left, statusRight: rect?.right,
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      toast: document.querySelector('#toast').textContent,
      toastShown: document.querySelector('#toast').classList.contains('show'),
    };
  })()`);
  function assertUnsaved(state) {
    assert.equal(state.state, 'unsaved');
    assert.equal(state.status, warning);
    assert.equal(state.visible, true, 'the warning remains an inline part of the page');
    assert.equal(state.role, 'status');
    assert.equal(state.live, 'polite');
    assert.equal(state.atomic, 'true');
  }

  try {
    await evaluate("document.querySelector('#reset').click()");
    let state = await snapshot();
    assert.equal(state.state, 'saved');
    assert.equal(state.status, 'Saved in this browser.');
    assert.equal(state.rows, 0);
    assert.equal(JSON.parse(state.stored).observations.length, 0);
    const beforeFailure = state.stored;

    await evaluate(`(() => {
      if (window.__earthBrowserSaveReceiving) throw Error('Browser-save receiving hooks already exist');
      const descriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
      window.__earthBrowserSaveReceiving = {
        token: ${JSON.stringify(hookToken)},
        setItemDescriptor: descriptor,
        createObjectURL: URL.createObjectURL,
        blobs: [],
      };
      Object.defineProperty(Storage.prototype, 'setItem', { ...descriptor, value: function(key, value) {
        if (this === localStorage && String(key) === ${JSON.stringify(key)}) {
          throw new DOMException('Authored browser-save receiving failure', 'QuotaExceededError');
        }
        return descriptor.value.apply(this, arguments);
      }});
      const input = (id, value) => {
        const element = document.querySelector(id);
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      };
      input('#obs-minute', '60');
      input('#obs-depth', '14');
      input('#obs-uncertainty', '3');
      input('#obs-source', ${JSON.stringify(source)});
      document.querySelector('#obs-scenario').value = 'existing';
      document.querySelector('#obs-use').value = 'challenge';
      document.querySelector('#observe-form').requestSubmit();
    })()`);
    state = await snapshot();
    assert.equal(state.stored, beforeFailure, 'failed saving leaves the previous stored bytes unchanged');
    assert.equal(state.rows, 1, 'the authored reading remains in the live project');
    assert.ok(state.readings.includes(source));
    assertUnsaved(state);
    assert.ok(state.toast.includes('added to this project.'));
    assert.ok(state.toast.includes(warning), 'the later observation notice retains the save warning');
    assert.doesNotMatch(state.toast, /retained locally/i);

    await delay(4100);
    state = await snapshot();
    assert.equal(state.toastShown, false, 'the transient observation notice has expired');
    assertUnsaved(state);

    if (initialWidth !== 390) {
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      changedViewport = true;
    }
    state = await snapshot();
    assert.equal(state.width, 390);
    assertUnsaved(state);
    assert.ok(state.scrollWidth <= state.width + 1, JSON.stringify(state));
    assert.ok(state.statusLeft >= -1 && state.statusRight <= state.width + 1,
      'the persistent warning fits the narrow viewport');
    report.push('failed key-specific browser save keeps the live reading, preserves stored bytes, and exposes a persistent polite warning after toast expiry at 390px');

    const exported = await evaluate(`(async () => {
      const hooks = window.__earthBrowserSaveReceiving;
      if (hooks?.token !== ${JSON.stringify(hookToken)}) throw Error('Browser-save receiving hook ownership changed');
      URL.createObjectURL = function(blob) {
        hooks.blobs.push(blob);
        return hooks.createObjectURL.apply(this, arguments);
      };
      try {
        document.querySelector('#export').click();
        if (hooks.blobs.length !== 1) throw Error('Expected one actual project Export Blob');
        const blob = hooks.blobs[0];
        return { type: blob.type, project: JSON.parse(await blob.text()) };
      } finally { URL.createObjectURL = hooks.createObjectURL; }
    })()`);
    assert.equal(exported.type, 'application/json');
    assert.equal(exported.project.observations.length, 1);
    assert.equal(exported.project.observations[0].source, source);
    assert.equal(exported.project.observations[0].minute, 60);
    assert.equal(exported.project.observations[0].depthMm, 14);
    state = await snapshot();
    assertUnsaved(state);
    assert.equal(state.stored, beforeFailure, 'Export does not claim to repair browser storage');
    assert.ok(state.toast.includes('Portable project downloaded.'));
    assert.ok(state.toast.includes(warning), 'Export success does not replace the unsaved warning');
    report.push('the actual Export handler includes the unsaved authored reading while keeping browser-save failure visible');

    await evaluate(`(() => {
      const hooks = window.__earthBrowserSaveReceiving;
      if (hooks?.token !== ${JSON.stringify(hookToken)}) throw Error('Browser-save receiving hook ownership changed');
      Object.defineProperty(Storage.prototype, 'setItem', hooks.setItemDescriptor);
    })()`);
    state = await snapshot();
    assertUnsaved(state);
    assert.equal(state.stored, beforeFailure, 'restoring storage capability alone does not save or claim success');

    await evaluate(`(() => {
      const title = document.querySelector('#project-title');
      title.value = 'Browser-save receiving: recovered workspace';
      title.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    state = await snapshot();
    assert.equal(state.state, 'saved');
    assert.equal(state.status, 'Saved in this browser.');
    assert.equal(state.visible, true);
    assert.ok(!state.toast.includes(warning), 'a successful ordinary save retires the stale toast warning');
    const saved = JSON.parse(state.stored);
    assert.equal(saved.title, 'Browser-save receiving: recovered workspace');
    assert.equal(saved.observations.length, 1);
    assert.equal(saved.observations[0].source, source);

    // The caller provides the maintained ready-aware reload wrapper.
    await send('Page.reload', { ignoreCache: true });
    state = await snapshot();
    assert.equal(state.state, 'saved');
    assert.equal(state.status, 'Saved in this browser.');
    assert.equal(state.rows, 1);
    assert.ok(state.readings.includes(source));
    assert.deepEqual(JSON.parse(state.stored).observations, saved.observations);
    report.push('restoring the setter alone stays unsaved; a successful ordinary save clears the warning and the authored reading survives reload');
  } catch (error) {
    testError = error;
  } finally {
    try {
      await evaluate(`(() => {
        const hooks = window.__earthBrowserSaveReceiving;
        if (hooks) {
          if (hooks.token !== ${JSON.stringify(hookToken)}) throw Error('Preserving browser-save receiving hooks owned by another invocation');
          Object.defineProperty(Storage.prototype, 'setItem', hooks.setItemDescriptor);
          URL.createObjectURL = hooks.createObjectURL;
          delete window.__earthBrowserSaveReceiving;
        }
        const incoming = ${JSON.stringify(incomingWorkspace)};
        if (incoming === null) localStorage.removeItem(${JSON.stringify(key)});
        else localStorage.setItem(${JSON.stringify(key)}, incoming);
      })()`);
      if (changedViewport) await send('Emulation.clearDeviceMetricsOverride');
      await send('Page.reload', { ignoreCache: true });
    } catch (error) { cleanupError = error; }
  }
  if (testError && cleanupError) throw new AggregateError([testError, cleanupError], 'Browser-save receiving and cleanup both failed');
  if (testError) throw testError;
  if (cleanupError) throw cleanupError;
}

import { makeExample, validateProject } from './core.js';

export const SAVED_PROJECT_KEY = 'experimental-earth-site-v1';
export const RECOVERY_PREFIX = 'experimental-earth-unreadable-v1-';

/** Retain unreadable source before any replacement; failed custody pauses saving. */
export function openSavedProject(getStorage = () => globalThis.localStorage) {
  let storage, original = null, project = makeExample();
  let blocked = null, writeFailed = false, openedUnreadable = false;
  const recoveries = [];
  try {
    storage = getStorage();
    original = storage.getItem(SAVED_PROJECT_KEY);
  } catch {
    blocked = 'read';
  }
  if (!blocked) {
    // These are application-owned recovery records, never automatically removed.
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(RECOVERY_PREFIX)) {
          const raw = storage.getItem(key);
          if (raw !== null) recoveries.push({ key, raw });
        }
      }
    } catch { /* A known unreadable original is still protected below. */ }
    if (original !== null) {
      try { project = validateProject(JSON.parse(original)); }
      catch {
        openedUnreadable = true;
        if (!recoveries.some(entry => entry.raw === original)) {
          const entry = { key: null, raw: original };
          recoveries.push(entry);
          try {
            const key = RECOVERY_PREFIX + Date.now() + '-' + crypto.randomUUID();
            if (storage.getItem(key) !== null) throw Error('Recovery key already exists');
            storage.setItem(key, original);
            if (storage.getItem(key) !== original) throw Error('Recovery source was not retained');
            entry.key = key;
          } catch {
            // In particular, quota exhaustion must not turn fallback into deletion.
            blocked = 'archive';
          }
        }
      }
    }
  }
  let lastStored = original;
  return {
    project,
    status() {
      return { blocked, writeFailed, openedUnreadable,
        recoveries: recoveries.map(entry => ({ ...entry })) };
    },
    save(next) {
      if (blocked) return false;
      try {
        validateProject(next);
        const raw = JSON.stringify(next);
        // Detect observed changes immediately before writing; this is not a cross-tab lock.
        if (storage.getItem(SAVED_PROJECT_KEY) !== lastStored) {
          blocked = 'changed';
          return false;
        }
        storage.setItem(SAVED_PROJECT_KEY, raw);
        // A completed setter does not prove that the exact project can be reopened.
        // Do not advance our last-confirmed source or show Saved until readback matches.
        if (storage.getItem(SAVED_PROJECT_KEY) !== raw) {
          writeFailed = true;
          return false;
        }
        lastStored = raw;
        writeFailed = false;
        return true;
      } catch {
        writeFailed = true;
        return false;
      }
    },
  };
}

export function downloadableOriginal(raw) {
  const utf8 = new TextEncoder().encode(raw);
  const wrapped = new TextDecoder('utf-8', { ignoreBOM: true }).decode(utf8) !== raw;
  // JSON escapes isolated UTF-16 surrogates, preserving code units that UTF-8 cannot encode.
  return { wrapped, content: wrapped
    ? JSON.stringify({ schema: 'experimental-earth-original-text/1', raw }, null, 2)
    : raw };
}

export function mountSavedProjectRecovery(store) {
  const host = document.createElement('details');
  host.id = 'saved-project-recovery';
  host.className = 'saved-project-recovery';
  host.innerHTML = '<summary>Saved project recovery</summary><p id="saved-project-recovery-status" role="status" aria-live="polite"></p><ul id="saved-project-recovery-files"></ul>';
  document.querySelector('main').prepend(host);
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./saved-project-recovery.css', import.meta.url);
  document.head.append(style);
  let signature = null;
  function refresh() {
    const state = store.status();
    const nextSignature = JSON.stringify([state.blocked, state.writeFailed,
      state.openedUnreadable, state.recoveries.map(entry => entry.key)]);
    if (signature === nextSignature) return;
    const first = signature === null;
    signature = nextSignature;
    host.hidden = !state.blocked && !state.recoveries.length;
    if (first) host.open = Boolean(state.blocked || state.openedUnreadable);
    else if (state.blocked) host.open = true;
    let message = state.openedUnreadable
      ? 'The saved project could not be reopened. Its original data was retained, and this workspace opened the fictional example. Download the original below to inspect or repair it.'
      : state.recoveries.length
        ? 'Earlier unreadable saved data remains available below. These copies are kept in this browser until you remove its site data.'
        : 'Browser storage is unavailable. The current workspace remains open in this tab.';
    if (state.blocked === 'read') message = 'The saved project could not be read. Saving is paused so it cannot be replaced. Export this workspace before leaving, then reload when browser storage is available.';
    if (state.blocked === 'archive') message = 'The saved project could not be reopened or copied for recovery. Its original data is unchanged in this browser. The fictional example is open, and saving is paused. Download the original below and export this workspace before leaving.';
    if (state.blocked === 'changed') message = 'The saved project changed in another tab. Saving here is paused to preserve that version. Export this workspace before reloading. Any recovery copies remain available below.';
    host.querySelector('p').textContent = message;
    const list = host.querySelector('ul');
    list.replaceChildren();
    state.recoveries.forEach((entry, index) => {
      const item = document.createElement('li'), button = document.createElement('button');
      button.type = 'button'; button.className = 'subtle';
      button.textContent = state.recoveries.length === 1
        ? 'Download original saved data' : 'Download original saved data ' + (index + 1);
      button.dataset.recoveryKey = entry.key ?? 'original';
      const file = downloadableOriginal(entry.raw);
      button.addEventListener('click', () => {
        const blob = new Blob([file.content], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url;
        link.download = 'experimental-earth-recovery-' + (entry.key?.slice(RECOVERY_PREFIX.length) ?? 'original') + (file.wrapped ? '-original-text.json' : '.json');
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
      });
      item.append(button);
      if (file.wrapped) {
        const note = document.createElement('p');
        note.className = 'recovery-file-note';
        note.textContent = 'This download preserves invalid Unicode in a JSON recovery record. Its raw field contains the unchanged original text.';
        item.append(note);
      }
      list.append(item);
    });
  }
  refresh();
  return { refresh };
}

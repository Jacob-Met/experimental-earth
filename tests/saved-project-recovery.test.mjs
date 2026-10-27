import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample } from '../core.js';
import { downloadableOriginal, openSavedProject, SAVED_PROJECT_KEY as active, RECOVERY_PREFIX as prefix } from '../saved-project-recovery.js';

function memory(initial = {}, policy = {}) {
  const data = new Map(Object.entries(initial)), writes = [];
  return {
    data, writes,
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(key) { policy.read?.(key); return data.get(key) ?? null; },
    setItem(key, value) {
      policy.write?.(key, value);
      writes.push([key, value]);
      data.set(key, policy.stored ? policy.stored(key, value) : value);
    },
  };
}
const quota = () => { throw new DOMException('Full', 'QuotaExceededError'); };

test('new and valid saved workspaces keep the normal saving path', () => {
  const empty = memory(), fresh = openSavedProject(() => empty);
  assert.equal(fresh.status().blocked, null);
  assert.deepEqual(fresh.status().recoveries, []);
  assert.equal(fresh.save(fresh.project), true);
  assert.deepEqual(JSON.parse(empty.getItem(active)), makeExample());
  const expected = { ...makeExample(), title: 'Measured courtyard', fieldNotes: 'Unmodified notes — 🌱' };
  const raw = JSON.stringify(expected, null, 2), storage = memory({ [active]: raw });
  const loaded = openSavedProject(() => storage);
  assert.deepEqual(loaded.project, expected);
  assert.equal(storage.getItem(active), raw, 'opening valid data does not rewrite its source');
  assert.equal(storage.writes.length, 0);
  loaded.project.title = 'Measured courtyard, next visit';
  assert.equal(loaded.save(loaded.project), true);
  assert.equal(JSON.parse(storage.getItem(active)).fieldNotes, expected.fieldNotes);
});

test('unreadable and incompatible sources are retained exactly before a replacement is saved', () => {
  for (const raw of ['{"notes":"original — 🌱"\r\n', '', 'null', '{"schema":"future-format/2","notes":"preserve"}']) {
    const storage = memory({ [active]: raw, 'unrelated-setting': 'leave alone' });
    const opened = openSavedProject(() => storage);
    const [recovered] = opened.status().recoveries;
    assert.equal(opened.status().openedUnreadable, true);
    assert.ok(recovered.key.startsWith(prefix));
    assert.equal(recovered.raw, raw);
    assert.equal(storage.getItem(recovered.key), raw);
    assert.equal(storage.getItem(active), raw, 'opening alone must not replace active source');
    assert.equal(opened.save(opened.project), true);
    assert.deepEqual(JSON.parse(storage.getItem(active)), makeExample());
    assert.equal(storage.getItem(recovered.key), raw);
    assert.equal(storage.getItem('unrelated-setting'), 'leave alone');
    assert.equal(storage.writes[0][0], recovered.key, 'custody must precede replacement');
  }
});

test('quota exhaustion keeps the original active source and pauses every attempted save', () => {
  const raw = '{"unfinished":"retain me"';
  const storage = memory({ [active]: raw }, { write: quota });
  const opened = openSavedProject(() => storage);
  assert.equal(opened.status().blocked, 'archive');
  assert.deepEqual(opened.status().recoveries, [{ key: null, raw }]);
  for (const title of ['Example', 'Edited work']) {
    opened.project.title = title;
    assert.equal(opened.save(opened.project), false);
    assert.equal(storage.getItem(active), raw);
  }
  assert.equal(storage.writes.length, 0);
});

test('failed recovery readback cannot authorize replacement', () => {
  const raw = 'source that cannot reopen';
  const storage = memory({ [active]: raw }, { stored: (key, value) => key.startsWith(prefix) ? 'incomplete copy' : value });
  const opened = openSavedProject(() => storage);
  assert.equal(opened.status().blocked, 'archive');
  assert.equal(opened.status().recoveries[0].raw, raw);
  assert.equal(opened.save(opened.project), false);
  assert.equal(storage.getItem(active), raw);
});

test('unavailable storage and denied initial reads never authorize a write', () => {
  const raw = 'original';
  for (const getterFailure of [false, true]) {
    const storage = memory({ [active]: raw }, { read: () => { throw new DOMException('Denied', 'SecurityError'); } });
    const opened = openSavedProject(() => {
      if (getterFailure) throw new DOMException('Denied', 'SecurityError');
      return storage;
    });
    assert.equal(opened.status().blocked, 'read');
    assert.equal(opened.save(opened.project), false);
    assert.equal(storage.data.get(active), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test('recovery survives repeat visits and an already retained source is not duplicated', () => {
  const raw = 'original malformed source', storage = memory({ [active]: raw });
  const opened = openSavedProject(() => storage), copy = opened.status().recoveries[0];
  assert.equal(opened.save(opened.project), true);
  const reopened = openSavedProject(() => storage);
  assert.equal(reopened.status().openedUnreadable, false);
  assert.deepEqual(reopened.status().recoveries, [copy]);
  storage.data.set(active, raw);
  const writes = storage.writes.length;
  const retried = openSavedProject(() => storage);
  assert.equal(retried.status().openedUnreadable, true);
  assert.deepEqual(retried.status().recoveries, [copy]);
  assert.equal(storage.writes.length, writes);
  assert.equal(retried.save(retried.project), true);
  assert.equal(storage.getItem(copy.key), raw);
});

test('separate failed projects retain separate original sources', () => {
  const storage = memory({ [active]: 'first original' });
  const first = openSavedProject(() => storage);
  first.save(first.project);
  storage.data.set(active, 'second original');
  const second = openSavedProject(() => storage);
  assert.deepEqual(second.status().recoveries.map(r => r.raw).sort(), ['first original', 'second original']);
  assert.equal(new Set(second.status().recoveries.map(r => r.key)).size, 2);
  assert.equal(second.save(second.project), true);
  for (const entry of second.status().recoveries) assert.equal(storage.getItem(entry.key), entry.raw);
});

test('a later observed active project is not overwritten by a stale tab', () => {
  const original = JSON.stringify(makeExample()), storage = memory({ [active]: original });
  const opened = openSavedProject(() => storage);
  const later = JSON.stringify({ ...makeExample(), title: 'Other tab, newer field visit' });
  storage.data.set(active, later);
  opened.project.title = 'Old tab edit';
  assert.equal(opened.save(opened.project), false);
  assert.equal(opened.status().blocked, 'changed');
  assert.equal(storage.getItem(active), later);
  assert.equal(opened.save(opened.project), false);
  assert.equal(storage.getItem(active), later);
});

test('a failed normal write preserves active data and can recover when storage becomes writable', () => {
  let full = true;
  const original = JSON.stringify(makeExample());
  const storage = memory({ [active]: original }, { write: () => { if (full) quota(); } });
  const opened = openSavedProject(() => storage);
  opened.project.title = 'Unsaved visit';
  assert.equal(opened.save(opened.project), false);
  assert.equal(opened.status().writeFailed, true);
  assert.equal(storage.getItem(active), original);
  full = false;
  assert.equal(opened.save(opened.project), true);
  assert.equal(opened.status().writeFailed, false);
  assert.equal(JSON.parse(storage.getItem(active)).title, 'Unsaved visit');
});

test('recovery downloads preserve normal text and retain otherwise unencodable original code units', () => {
  for (const raw of ['  original — 🌱\r\n', '\ufefforiginal', '\u0000raw']) {
    assert.deepEqual(downloadableOriginal(raw), { wrapped:false, content:raw });
  }
  for (const raw of ['original \ud800 end', 'original \udc00 end']) {
    const file = downloadableOriginal(raw);
    assert.equal(file.wrapped, true);
    const decoded = JSON.parse(new TextDecoder().decode(new TextEncoder().encode(file.content)));
    assert.equal(decoded.schema, 'experimental-earth-original-text/1');
    assert.equal(decoded.raw, raw);
    const storage = memory({ [active]:raw }), opened = openSavedProject(() => storage);
    assert.equal(opened.status().recoveries[0].raw, raw);
    assert.equal(opened.save(opened.project), true);
    assert.equal(storage.getItem(opened.status().recoveries[0].key), raw);
  }
});

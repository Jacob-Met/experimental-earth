import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnsavedProjectWarning } from '../unsaved-project-warning.js';
function setup() {
  let project = { title: 'Original', observations: [] };
  const handlers = new Set();
  const target = { addEventListener(type, fn) { assert.equal(type, 'beforeunload'); handlers.add(fn); }, removeEventListener(type, fn) { assert.equal(type, 'beforeunload'); handlers.delete(fn); } };
  const warning = createUnsavedProjectWarning({ target, getProject: () => project });
  const unload = () => { const event = { prevented: false, preventDefault() { this.prevented = true; } }; for (const fn of handlers) fn(event); return event; };
  return { warning, handlers, unload, get project() { return project; }, replace(value) { project = value; } };
}
test('untouched opening is exempt; accepted pending input is protected', () => {
  const s = setup(); s.warning.refresh(); assert.equal(s.handlers.size, 0);
  s.project.observations.push({ source: 'Authored', depthMm: 1 }); s.warning.refresh();
  assert.equal(s.handlers.size, 1); assert.equal(s.unload().prevented, true); assert.equal(s.unload().returnValue, true);
});
test('failed save refresh and export-like read do not clear; verified save does', () => {
  const s = setup(); s.project.title = 'Changed'; s.warning.refresh();
  JSON.stringify(s.project); s.warning.refresh(); assert.equal(s.unload().prevented, true);
  s.warning.saved(); assert.equal(s.handlers.size, 0); assert.equal(s.unload().prevented, false);
  s.project.title = 'Further change'; s.warning.refresh(); assert.equal(s.unload().prevented, true);
});
test('live rollback suppresses a stale attached handler without adopting changed input', () => {
  const s = setup(); s.project.title = 'Refused'; s.warning.refresh(); s.project.title = 'Original';
  assert.equal(s.handlers.size, 1); assert.equal(s.unload().prevented, false);
  s.warning.refresh(); assert.equal(s.handlers.size, 0);
});
test('replacement compares contents, and exact return to verified snapshot clears', () => {
  const s = setup(); s.project.title = 'Saved'; s.warning.saved();
  s.replace({ title: 'Replacement', observations: [] }); s.warning.refresh(); assert.equal(s.unload().prevented, true);
  s.replace({ title: 'Saved', observations: [] }); s.warning.refresh(); assert.equal(s.handlers.size, 0);
});

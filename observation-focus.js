// Focus follows the retained reading object, never a coincidentally reused index.
// These handles live only in this browser document; no saved evidence gains IDs.
export function createObservationFocus({ list, getProject, emptyTarget }) {
  const rows = new WeakMap();
  const document = list.ownerDocument;

  function capture() {
    const active = document.activeElement;
    const row = active?.closest('.observation');
    const record = row && list.contains(row) ? rows.get(row) : null;
    if (!record || record.project !== getProject()) return null;
    const field = active.dataset.evidenceField;
    const control = field === 'scenario' || field === 'use' ? field
      : active.matches('button[data-observation-remove]') ? 'remove' : null;
    return control ? { kind: 'observation', ...record, control } : null;
  }

  function restore(handle) {
    const project = getProject();
    if (!handle || handle.project !== project) return false;
    let reading = handle.reading, control = handle.control, removed = false;
    if (!project.observations.includes(reading)) {
      // A missing reading alone never authorizes moving to a different one.
      if (!handle.removed) return false;
      removed = true;
      reading = project.observations[Math.max(0,
        Math.min(handle.index - 1, project.observations.length - 1))];
      control = 'remove';
    }
    const row = reading && [...list.children].find(node => {
      const record = rows.get(node);
      return record?.project === project && record.reading === reading;
    });
    const target = row ? row.querySelector(control === 'remove'
      ? 'button[data-observation-remove]' : '[data-evidence-field="' + control + '"]')
      : removed && project.observations.length === 0 ? emptyTarget : null;
    if (!target || target.disabled || !target.isConnected || target.closest('[inert]')) return false;
    target.focus({ preventScroll: !removed });
    return document.activeElement === target;
  }

  return {
    capture,
    restore,
    register(row, reading, index) {
      const record = { project: getProject(), reading, index, removed: false };
      rows.set(row, record);
      return () => { record.removed = true; };
    },
  };
}

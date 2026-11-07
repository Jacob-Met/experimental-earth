// Protect accepted current input, without changing storage or draft policies.
export function createUnsavedProjectWarning({ target, getProject }) {
  // An untouched opening workspace is exempt; this is not a persistence claim.
  let baseline = JSON.stringify(getProject());
  let listening = false;
  const differs = () => JSON.stringify(getProject()) !== baseline;
  function protect(event) {
    // A caller may have rolled back a refused synchronous edit after refresh.
    if (!differs()) return;
    event.preventDefault();
    event.returnValue = true;
  }
  function refresh() {
    const needed = differs();
    if (needed === listening) return;
    listening = needed;
    target[needed ? 'addEventListener' : 'removeEventListener']('beforeunload', protect);
  }
  return {
    refresh,
    saved() {
      // Call only after the existing save returns verified success.
      baseline = JSON.stringify(getProject());
      refresh();
    },
  };
}

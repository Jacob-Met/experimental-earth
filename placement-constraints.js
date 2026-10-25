/** Declared local decision conditions on maintained per-hypothesis peak changes. */
export function validatePlacementTargets(project, targets = []) {
  if (!Array.isArray(targets) || targets.length > 12 || !Array.from({length:targets.length},(_,i)=>Object.hasOwn(targets,i)).every(Boolean)) throw Error('Choose at most 12 local targets');
  const seen = new Set();
  return targets.map(target => {
    if (!target || !Number.isInteger(target.cellIndex) || target.cellIndex < 0 || target.cellIndex >= project.proposal.length || seen.has(target.cellIndex)) throw Error('Local targets require distinct cells inside the project');
    seen.add(target.cellIndex);
    if (!Number.isFinite(target.maxPeakChangeMm) || Math.abs(target.maxPeakChangeMm) > 1000) throw Error('Local peak-change limits must be between -1000 and 1000 mm');
    if (typeof target.basis !== 'string' || !target.basis.trim() || target.basis.length > 500) throw Error('Each local target needs a declared basis of at most 500 characters');
    return {cellIndex:target.cellIndex,maxPeakChangeMm:target.maxPeakChangeMm,basis:target.basis.trim()};
  });
}

export function assessPlacementTargets(candidates, targets) {
  if (!candidates.length) throw Error('Local targets require retained hypotheses');
  const checks = targets.map(target => {
    const witnesses = candidates.map(candidate => {
      const changeMm = candidate.peakDeltaMm[target.cellIndex];
      if (!Number.isFinite(changeMm)) throw Error('Missing local peak change for a retained hypothesis');
      // Deliberately no feasibility tolerance: a declared upper bound is inclusive.
      return {...(candidate.hypothesis?{hypothesis:structuredClone(candidate.hypothesis)}:{rateMmHr:candidate.rateMmHr}),changeMm,excessMm:changeMm-target.maxPeakChangeMm,meets:changeMm<=target.maxPeakChangeMm};
    });
    return {...target,meets:witnesses.every(w=>w.meets),worstChangeMm:Math.max(...witnesses.map(w=>w.changeMm)),witnesses};
  });
  return {meets:checks.every(check=>check.meets),checks};
}

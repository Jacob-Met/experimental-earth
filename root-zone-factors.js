import {compareRootZone} from './root-zone-study.js';
import {runRootZone, rootZoneAtDay} from './root-zone.js';

export const ROOT_ZONE_FACTOR_SCHEMA = 'experimental-earth-root-zone-factors/1';
export const ROOT_ZONE_FACTOR_CASES = Object.freeze([
  Object.freeze({id:'existing', store:'existing', recharge:'existing', label:'Existing recharge + existing rooted store'}),
  Object.freeze({id:'rechargeOnly', store:'existing', recharge:'proposal', label:'Proposed recharge + existing rooted store'}),
  Object.freeze({id:'storeOnly', store:'proposal', recharge:'existing', label:'Existing recharge + proposed rooted store'}),
  Object.freeze({id:'combined', store:'proposal', recharge:'proposal', label:'Proposed recharge + proposed rooted store'})
]);
export const ROOT_ZONE_FACTOR_METRICS = Object.freeze(['availableMm','suppliedMm','unmetMm','drainageMm','demandLimitedDays']);
export const ROOT_ZONE_FACTOR_MEANING = 'Each crossed case holds the complete rooted-store declaration fixed while changing only the original modeled recharge, or holds recharge fixed while changing the complete store. The store includes initial available water and the depletion fraction, not only capacity. These are conditional numerical cases; the crossed combinations need not be physically realizable. Interaction is an arithmetic difference, not an inferred causal contribution.';

/** Only two maintained rain runs. Crossed cases reuse their original recharge. */
export function compareRootZoneFactors(project, study) {
  const comparison = compareRootZone(project, study);
  const cases = Object.fromEntries(ROOT_ZONE_FACTOR_CASES.map(spec => {
    const source = comparison[spec.recharge];
    const result = spec.store === spec.recharge ? comparison[spec.store] : {
      ...runRootZone(study[spec.store], source.rechargeMm, study.schedule),
      originalCell: structuredClone(source.originalCell),
      originalBudget: structuredClone(source.originalBudget)
    };
    return [spec.id, {...spec, result}];
  }));
  const report = {...comparison, factors:{schema:ROOT_ZONE_FACTOR_SCHEMA, cases, meaning:ROOT_ZONE_FACTOR_MEANING}};
  report.factors.end = rootZoneFactorsAtDay(report, comparison.existing.totalDays);
  return report;
}

/** Recompute every selected time from the exact dry-down, never graph interpolation. */
export function rootZoneFactorsAtDay(report, day) {
  if (report?.factors?.schema !== ROOT_ZONE_FACTOR_SCHEMA) throw Error('Use a computed rooted-store factor comparison');
  const cases = Object.fromEntries(ROOT_ZONE_FACTOR_CASES.map(({id}) => {
    const r = report.factors.cases[id].result, at = rootZoneAtDay(r, day);
    return [id, {...at, capacityMm:r.capacityMm, initialAvailableMm:r.initialAvailableMm,
      rechargeMm:r.rechargeMm, retainedRechargeMm:r.retainedRechargeMm, drainageMm:r.drainageMm,
      balanceErrorMm:r.initialAvailableMm+r.rechargeMm-r.drainageMm-at.suppliedMm-at.availableMm}];
  }));
  const effects = Object.fromEntries(ROOT_ZONE_FACTOR_METRICS.map(key => {
    const baseline=cases.existing[key], rechargeOnly=cases.rechargeOnly[key]-baseline,
      storeOnly=cases.storeOnly[key]-baseline, combined=cases.combined[key]-baseline;
    return [key, {rechargeOnly, storeOnly, combined, interaction:combined-rechargeOnly-storeOnly}];
  }));
  return {day, cases, effects};
}


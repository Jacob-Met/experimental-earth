import {smallestConflict} from './conflict-witness.js';
import {compareInfiltration} from './infiltration-study.js';

/** Explain finite hypothesis/evidence incompatibility, without discarding readings. */
export function explainCalibrationConflict(project, study=project.infiltrationStudy) {
 return explainComparisonConflict(project, study, compareInfiltration(project,study));
}

export function explainComparisonConflict(project, study, comparison) {
 if (comparison.status === 'surface-absent') return {status:comparison.status,rows:[],unsupported:[],conflictingPairs:[],omissions:[],limitation:'The studied surface is absent; no hypotheses were evaluated.'};
 const candidates=comparison.candidates;
 const indices=project.observations.flatMap((o,i)=>o.scenario===study.target&&o.use==='calibration'?[i]:[]);
 const rows=indices.map(index=>({index,supportedRatesMmHr:candidates.filter(c=>c.calibration.errors.find(e=>e.index===index)?.withinBand).map(c=>c.rateMmHr).sort((a,b)=>a-b)}));
 const unsupported=rows.filter(r=>r.supportedRatesMmHr.length===0).map(r=>r.index);
 const conflictingPairs=[];
 // Exclude individually unsupported rows: they already fail without a pair.
 for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++) {
  if(rows[a].supportedRatesMmHr.length&&rows[b].supportedRatesMmHr.length&&!rows[a].supportedRatesMmHr.some(r=>rows[b].supportedRatesMmHr.includes(r)))conflictingPairs.push([rows[a].index,rows[b].index]);
 }
 const omissions=rows.map(row=>({omittedIndex:row.index,compatibleRatesMmHr:rows.length>1?candidates.filter(c=>c.calibration.errors.every(e=>e.index===row.index||e.withinBand)).map(c=>c.rateMmHr).sort((a,b)=>a-b):[]}));
 return {status:comparison.status,rows,unsupported,conflictingPairs,omissions,
  jointConflict:smallestConflict(rows,candidates.map(c=>c.rateMmHr)),
  limitation:'Finite user-chosen hypotheses only. Incompatibility does not identify a faulty sensor or prove any reading wrong. Omission is diagnostic, not evidence removal; held-aside readings do not determine these sets.'};
}

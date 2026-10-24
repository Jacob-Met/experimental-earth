import {explainComparisonConflict} from './evidence-conflict.js';
export function renderEvidenceConflict(project,study,comparison) {
 const result=explainComparisonConflict(project,study,comparison);
 const details=document.createElement('details');details.id='evidence-conflicts';
 const summary=document.createElement('summary');summary.textContent='Which readings conflict with the tested hypotheses?';details.append(summary);
 const add=text=>{const p=document.createElement('p');p.textContent=text;details.append(p);};
 if(!result.rows.length){add('No evaluated calibration readings to diagnose.');return details;}
 if(result.jointConflict.indices)add(`Smallest jointly incompatible subset: readings ${result.jointConflict.indices.map(i=>i+1).join(', ')}. Together these ${result.jointConflict.minimumReadingCount} readings reject all ${result.jointConflict.testedHypotheses} tested rates; no smaller subset does. This identifies a contradiction within the chosen hypotheses, not which measurement is wrong.`);
 else add('At least one tested hypothesis agrees with every calibration band.');
 for(const row of result.rows){const o=project.observations[row.index];add(`Reading ${row.index+1} (${o.source}): compatible candidate rates ${row.supportedRatesMmHr.length?row.supportedRatesMmHr.join(', ')+' mm/h':'none'}.`);}
 if(result.conflictingPairs.length)add('Individually supported readings with no shared candidate: '+result.conflictingPairs.slice(0,20).map(([a,b])=>`${a+1} and ${b+1}`).join('; ')+` (${result.conflictingPairs.length} pairs total; showing at most 20).`);
 else add('No pair of individually supported readings has disjoint candidate sets. This does not imply all readings share a candidate.');
 for(const omission of result.omissions){if(omission.compatibleRatesMmHr.length)add(`If reading ${omission.omittedIndex+1} were left out diagnostically, remaining calibration bands permit ${omission.compatibleRatesMmHr.join(', ')} mm/h. The reading remains stored and used.`);}
 add(result.limitation);return details;
}

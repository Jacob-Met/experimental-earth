import { validateProject, runRain } from './core.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';
import { chooseDecisionQuestion } from './decision-question.js';
import { predictCollectedVolume } from './outlet-evidence.js';
import { outletContext } from './outlet-evidence-contract.js';

const LIMIT = 3000000;
/** Compare declared measurement bands, not probabilities, costs or information gain.
 * Soil candidates come only from the maintained depth-calibration comparison.
 * Existing collection VALUES never tune the choice; their intervals exclude reuse. */
export function compareDecisionObservations(project, { metric = 'exitLiters', depthToleranceMm = 2,
  collectionEnabled = false, volumeToleranceLiters = 20, collectionMinutes = 30,
  study = project.infiltrationStudy ?? DEFAULT_STUDY } = {}) {
  validateProject(project); validateStudy(study);
  if (typeof collectionEnabled !== 'boolean') throw Error('Declare whether a full-boundary collection is an available option');
  if (!Number.isFinite(depthToleranceMm) || depthToleranceMm < 1e-6 || depthToleranceMm > 1000) throw Error('Depth tolerance must be from 0.000001 to 1000 mm');
  if (collectionEnabled && (!Number.isFinite(volumeToleranceLiters) || volumeToleranceLiters < 1e-6 || volumeToleranceLiters > 1e12)) throw Error('Volume tolerance must be from 0.000001 to 1 trillion liters');
  if (collectionEnabled && (!Number.isFinite(collectionMinutes) || collectionMinutes < 1e-6 || collectionMinutes > project.weather.durationMinutes)) throw Error('Collection duration must be at least 0.000001 minute and fit inside this event');
  const cellStepUpperBound = study.ratesMmHr.length * (collectionEnabled ? 5 : 4) * project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellStepUpperBound > LIMIT) throw Error('Measurement comparison exceeds the 3 million cell-step budget');
  const depth = chooseDecisionQuestion(project, { metric, uncertaintyMm: depthToleranceMm, study });
  const options = [];
  if (depth.status === 'question') options.push({ type: 'depth', bandMargin: depth.separationMm / (2 * depthToleranceMm), ...depth });
  const common = { metric, target: study.target, surface: study.surface, depth, cellStepUpperBound };
  if (!['question', 'all-recorded', 'indistinguishable'].includes(depth.status)) return { status: depth.status, ...common, options, volume: { status: 'not-evaluated' }, largestMarginTypes: [] };
  let volume = { status: 'not-enabled' };
  if (collectionEnabled) {
    const record = project.outletEvidence;
    if (record && (record.target !== study.target || record.durationMinutes !== project.weather.durationMinutes || record.contextJson !== outletContext(project, study.target))) {
      volume = { status: 'record-context-conflict' };
    } else {
      const rates = [...depth.lowerRatesMmHr, ...depth.higherRatesMmHr, ...depth.neutralRatesMmHr].sort((a,b)=>a-b);
      const lower = new Set(depth.lowerRatesMmHr), higher = new Set(depth.higherRatesMmHr);
      const pairs = [];
      for (let a=0;a<rates.length;a++) for (let b=a+1;b<rates.length;b++) {
        if ((lower.has(rates[a]) && higher.has(rates[b])) || (higher.has(rates[a]) && lower.has(rates[b]))) pairs.push([a,b]);
      }
      const runs = rates.map(rateMmHr=>runRain(project[study.target], project.width, project.height, project.weather,
        { surfaceInfiltrationOverride: { surface:study.surface, rateMmHr } }));
      let best = null, evaluatedCount = 0, excludedCount = 0;
      for (const snapshot of runs[0].snapshots) {
        const startMinute = snapshot.minute, rawEnd = startMinute + collectionMinutes;
        if (rawEnd > project.weather.durationMinutes + 1e-9) continue;
        const endMinute = Math.min(rawEnd, project.weather.durationMinutes);
        // Do not suggest reusing any part of an already retained collection.
        if ((record?.readings ?? []).some(r=>startMinute < r.endMinute - 1e-9 && endMinute > r.startMinute + 1e-9)) { excludedCount++; continue; }
        evaluatedCount++;
        const predictions = runs.map((run,index)=>({ rateMmHr:rates[index], direction:lower.has(rates[index])?'less':higher.has(rates[index])?'more':'neutral',
          ...predictCollectedVolume(run, {startMinute,endMinute}) }));
        const separationLiters = Math.min(...pairs.map(([a,b])=>Math.abs(predictions[a].volumeLiters-predictions[b].volumeLiters)));
        if (!best || separationLiters > best.separationLiters + 1e-9 * Math.max(1,separationLiters)) best = {startMinute,endMinute,separationLiters,predictions};
      }
      const context = { evaluatedCount, excludedCount, collectionMinutes, toleranceLiters:volumeToleranceLiters, opposingPairCount:pairs.length, stepMinutes:project.weather.stepMinutes };
      volume = !evaluatedCount ? {status:'all-recorded',...context} : !best || best.separationLiters <= 1e-8
        ? {status:'indistinguishable',...context} : {status:'question',...context,...best,bandMargin:best.separationLiters/(2*volumeToleranceLiters)};
      if (volume.status === 'question') options.push({type:'collection',...volume});
    }
  }
  const largest = Math.max(0,...options.map(option=>option.bandMargin));
  const largestMarginTypes = options.filter(option=>Math.abs(option.bandMargin-largest)<=1e-9*Math.max(1,largest)).map(option=>option.type);
  return {status:options.length?'options':'no-distinguishing-option',...common,volume,options,largestMarginTypes};
}

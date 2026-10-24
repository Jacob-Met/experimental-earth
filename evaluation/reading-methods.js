import { runRain, validateProject } from '../core.js';
import { evaluateReadings } from '../infiltration-study.js';
import { DEFAULT_STUDY, validateStudy } from '../study-contract.js';
import { runSubstepped } from './rain-integrator.js';

export const MAX_READING_METHOD_CELL_STEPS = 1_500_000;
const near = (a,b) => Math.abs(a-b) <= 1e-9*Math.max(1,Math.abs(a),Math.abs(b));
const summarize = (results,counts) => {
  const sorted=[...results].sort((a,b)=>
    (a.calibration.rmseMm??0)-(b.calibration.rmseMm??0)||a.rateMmHr-b.rateMmHr);
  const compatible=sorted.filter(c=>c.calibration.compatible===true);
  const survivor=compatible.filter(c=>c.challenge.compatible!==false);
  const best=sorted[0]?.calibration.rmseMm??null;
  const closest=best===null?[]:sorted.filter(c=>near(c.calibration.rmseMm,best))
    .map(c=>c.rateMmHr).sort((a,b)=>a-b);
  let status='ambiguous';
  if(!counts.calibration)status='need-calibration';
  else if(!compatible.length)status='calibration-rejected';
  else if(counts.challenge&&!survivor.length)status='challenged';
  else if(!counts.challenge)status='needs-challenge';
  else if(survivor.length===1)status='one-survivor';
  return {status,orderedRatesMmHr:sorted.map(c=>c.rateMmHr),
    compatibleRatesMmHr:compatible.map(c=>c.rateMmHr),
    survivingRatesMmHr:survivor.map(c=>c.rateMmHr),
    closestCalibrationRatesMmHr:closest,
    candidates:sorted};
};

// Read-only comparison of one original project and *unchanged* evidence,
// independently interpreted under the maintained method and a hypothetical
// conservative half-time-step integrator. Never method-tune on held-aside data.
export function compareReadingMethods(project,study=project.infiltrationStudy??DEFAULT_STUDY,{substeps=2}={}) {
  validateProject(project);
  validateStudy(study);
  if(!Number.isInteger(substeps)||substeps<2||substeps>8)
    throw Error('Choose a bounded integer substep count from 2 to 8');
  const {target,surface,ratesMmHr}=study;
  const original=project.observations.map((reading,index)=>({index,reading:structuredClone(reading)}));
  const calibration=original.filter(x=>x.reading.scenario===target&&x.reading.use==='calibration');
  const challenge=original.filter(x=>x.reading.scenario===target&&x.reading.use==='challenge');
  const counts={calibration:calibration.length,challenge:challenge.length,
    ignored:original.length-calibration.length-challenge.length,
    affectedCells:project[target].filter(c=>c.surface===surface).length};
  const estimatedCellSteps=project.width*project.height*ratesMmHr.length*
    Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)*(1+substeps);
  const base={schema:'experimental-earth-reading-methods/1',study:structuredClone(study),
    counts,estimatedCellSteps,maxCellSteps:MAX_READING_METHOD_CELL_STEPS,
    readings:original,substeps,weather:structuredClone(project.weather)};
  const refuse=status=>({...base,status,incumbent:null,alternative:null,comparison:[]});
  if(estimatedCellSteps>MAX_READING_METHOD_CELL_STEPS)return refuse('work-limit');
  if(!counts.affectedCells)return refuse('surface-absent');
  if(!counts.calibration)return refuse('need-calibration');
  const results={incumbent:[],alternative:[]};
  for(const rateMmHr of ratesMmHr){
    const incumbent=runRain(project[target],project.width,project.height,project.weather,
      {surfaceInfiltrationOverride:{surface,rateMmHr}});
    const alternative=runSubstepped(project[target],project.width,project.height,project.weather,
      {surface,rateMmHr,substeps,captureDepths:true});
    for(const [method,run] of [['incumbent',incumbent],['alternative',alternative]]){
      const scored={
        rateMmHr,calibration:evaluateReadings(run,calibration),
        challenge:evaluateReadings(run,challenge),
        balanceErrorLiters:run.massErrorLiters,
        rainLiters:run.rainLiters,absorbedLiters:run.absorbedLiters,
        exitLiters:run.exitLiters,storedLiters:run.storedLiters
      };
      // Keep original row identities AND sources next to predictions.
      for(const key of ['calibration','challenge'])
        scored[key].errors=scored[key].errors.map(x=>({
          ...x,source:project.observations[x.index].source,
          uncertaintyMm:project.observations[x.index].uncertaintyMm,
          observedDepthMm:project.observations[x.index].depthMm
        }));
      results[method].push(scored);
    }
  }
  const incumbent=summarize(results.incumbent,counts),
        alternative=summarize(results.alternative,counts);
  const comparison=ratesMmHr.map(rateMmHr=>{
    const a=incumbent.candidates.find(c=>c.rateMmHr===rateMmHr);
    const b=alternative.candidates.find(c=>c.rateMmHr===rateMmHr);
    const witness=[...calibration,...challenge].map(({index,reading})=>{
      const role=reading.use;
      const left=a[role].errors.find(e=>e.index===index);
      const right=b[role].errors.find(e=>e.index===index);
      return {index,role,source:reading.source,
        incumbentPredictionMm:left.depthMm,alternativePredictionMm:right.depthMm,
        incumbentWithinBand:left.withinBand,alternativeWithinBand:right.withinBand,
        changedBand:left.withinBand!==right.withinBand,
        signedPredictionDifferenceMm:right.depthMm-left.depthMm};
    });
    return {rateMmHr,calibrationRankChanged:
      incumbent.orderedRatesMmHr.indexOf(rateMmHr)!==alternative.orderedRatesMmHr.indexOf(rateMmHr),
      calibrationAcceptanceChanged:a.calibration.compatible!==b.calibration.compatible,
      challengeAcceptanceChanged:a.challenge.compatible!==b.challenge.compatible,
      witnesses:witness};
  });
  return {...base,status:'compared',incumbent,alternative,comparison};
}

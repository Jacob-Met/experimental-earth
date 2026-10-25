import {runRain} from './core.js';
import {compareDrainingHypotheses,hypothesisLayer} from './draining-layer-evidence.js';
import {selectPondingExposure} from './ponding-exposure-request.js';

/** Receiving evidence keeps the maintained model's default infiltration rates.
 * Support is read once on the original source, before any layout is evaluated.
 * Raw runs are private to this invocation; only copied summaries leave it. */
export function createReceivingPlacementComparison(project,query,metricKeys,fixedSupport=null) {
  const study=query.receivingStudy;
  const evidence=fixedSupport?structuredClone(fixedSupport.evidence):compareDrainingHypotheses(project,study);
  const affected=Object.fromEntries(['existing','proposal'].map(side=>[side,project[side].filter(c=>c.surface===study.surface).length]));
  const context={evidence,affected};
  if(!fixedSupport&&query.subset!=='all') {
    if(evidence.status==='surface-absent')return {...context,status:'surface-absent'};
    if(!evidence.counts.calibration)return {...context,status:'need-calibration'};
    if(query.subset==='surviving'&&!evidence.counts.challenge)return {...context,status:'need-challenge'};
  }
  const ids=fixedSupport?[...fixedSupport.ids]:query.subset==='all'?study.hypotheses.map(h=>h.id):
    query.subset==='calibration'?[...evidence.compatibleIds]:[...evidence.survivingIds];
  if(!ids.length)return {...context,status:'no-compatible-receivers'};
  const hypotheses=study.hypotheses.filter(h=>ids.includes(h.id));
  if(hypotheses.length!==ids.length)throw Error('Every original receiving hypothesis must remain declared');
  const exposureRequest=query.durationGoal?{thresholdMm:query.durationGoal.thresholdMm,cellIndices:query.durationGoal.cellIndices}:null;
  const baseline=new Map();
  const run=(cells,hypothesis)=>runRain(cells,project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,hypothesis)});
  const receiver=result=>Object.fromEntries(['affectedCellCount','initialLiters','retainedLiters','drainedLiters','infiltratedLiters','balanceErrorLiters'].map(key=>[key,result.drainingLayer[key]]));
  const value=(result,key)=>key==='unabsorbedLiters'?result.exitLiters+result.storedLiters:result[key];
  for(const hypothesis of hypotheses) {
    const result=run(project.proposal,hypothesis);
    baseline.set(hypothesis.id,{result,exposure:exposureRequest?selectPondingExposure(result,exposureRequest):null});
  }
  return {...context,status:'compared',ids,
    compare(cells,unchanged=false) {
      return hypotheses.map(hypothesis=>{
        const base=baseline.get(hypothesis.id),current=base.result,proposed=unchanged?current:run(cells,hypothesis);
        return {hypothesis:structuredClone(hypothesis),drainingLayer:{current:receiver(current),proposed:receiver(proposed)},
          ...(exposureRequest?{exposure:{current:structuredClone(base.exposure),proposed:unchanged?structuredClone(base.exposure):selectPondingExposure(proposed,exposureRequest)}}:{}),
          metrics:Object.fromEntries(metricKeys.map(key=>[key,{current:value(current,key),proposed:value(proposed,key),delta:value(proposed,key)-value(current,key)}])),
          peakDeltaMm:proposed.peakDepthMm.map((depth,i)=>depth-current.peakDepthMm[i]),
          massErrorLiters:{current:current.massErrorLiters,proposal:proposed.massErrorLiters}};
      });
    }};
}

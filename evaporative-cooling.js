import {validateProject} from './core.js';
import {compareLocalWaterBudget, MAX_LOCAL_BUDGET_CELL_STEPS} from './local-water-budget.js';
import {validateRootZone, advanceRootZoneDry} from './root-zone.js';
import {validateHeatColumnStudy, heatColumnCurrent} from './heat-column-contract.js';
import {heatDeclarationIdentity} from './surface-heat-evidence-contract.js';
import {advanceHeatColumnWithLoss} from './heat-column-step.js';

export const COOLING_SCHEMA = 'experimental-earth-evaporative-cooling/1';
export const COOLING_FILE_LIMIT = 5 * 1024 * 1024;
export const COOLING_MEANING = 'Whole-event modeled infiltration recharges each declared rooted store before this exposure. Supplied plant transpiration consumes latent energy; only the explicitly declared fraction is taken from the modeled thermal surface. Demand is prescribed independently of temperature. This is a conditional effective-surface model, not inferred crop cooling, soil evaporation, a comfort estimate or field validation.';
const sides = ['existing', 'proposal'];
const finite = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const source = x => typeof x === 'string' && x.trim() && x.length <= 600;
const exact = (x, keys, label) => {
  if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(x,k))) throw Error('Invalid ' + label + ' fields');
};

export function validateCoolingStudy(project, study) {
  validateProject(project);
  exact(study, ['schema','heatColumn','roots','surfaceLatentFraction','latentHeatJkg','latentHeatSource','associationSource','demands'], 'cooling investigation');
  if (study.schema !== COOLING_SCHEMA || !source(study.associationSource) || !source(study.latentHeatSource) || !finite(study.latentHeatJkg, 0, 3e6)) throw Error('Supply the versioned cooling investigation, latent heat and attributed sources');
  validateHeatColumnStudy(study.heatColumn);
  if (!study.heatColumn || !project.heatColumnStudy || !heatColumnCurrent(project, study.heatColumn) ||
      heatDeclarationIdentity(study.heatColumn)!==heatDeclarationIdentity(project.heatColumnStudy)) throw Error('Retain the original current heat exposure, cell and lower layers');
  exact(study.roots,sides,'rooted stores'); exact(study.surfaceLatentFraction,sides,'surface latent fractions');
  for (const side of sides) {
    validateRootZone(study.roots[side]);
    if (!finite(study.surfaceLatentFraction[side],0,1)) throw Error('Declare a surface latent fraction from 0 to 1 for each place');
  }
  if (!Array.isArray(study.demands) || study.demands.length !== study.heatColumn.heatStudy.schedule.length) throw Error('Supply one transpiration demand for each retained heat interval');
  for (const row of study.demands) {
    exact(row,['potentialTranspirationMmPerDay','source'],'transpiration demand');
    if (!finite(row.potentialTranspirationMmPerDay,0,30) || !source(row.source)) throw Error('Each demand needs a source and 0–30 mm/day of potential plant transpiration');
  }
  const cellSteps = 2 * project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellSteps > MAX_LOCAL_BUDGET_CELL_STEPS) throw Error('Recharge exceeds the maintained water-budget work limit');
  return {cellSteps, cellIndex:study.heatColumn.heatStudy.cellIndex};
}

// Split at the constitutive switch, never average a changing latent flux.
// Below the threshold both water and latent loss decline exponentially.
function coupledInterval(surface, lower, root, capacityMm, latentJmm, forcing, demand, initial, seconds) {
  const threshold = (1-root.depletionFraction)*capacityMm, perSecond = demand/86400;
  const fullSeconds = perSecond > 0 ? Math.min(seconds,Math.max(0,initial.availableMm-threshold)/perSecond) : 0;
  const durations = fullSeconds > 0 && fullSeconds < seconds ? [fullSeconds,seconds-fullSeconds] : [seconds];
  let state = {...initial};
  const totals = {inputJm2:0,exchangeOutJm2:0,transferDownJm2:0,surfaceLossJm2:0,suppliedMm:0,potentialMm:0};
  let surfaceMeanC=0,subsurfaceMeanC=0,totalWeight=0;
  for (let i=0;i<durations.length;i++) {
    const dt=durations[i], full = perSecond > 0 && ((i===0 && fullSeconds >= dt) || threshold===0 && state.availableMm>0);
    const limited = !full && threshold>0 && state.availableMm>0 && perSecond>0;
    const rate = limited ? perSecond/threshold : 0;
    const initialFlux = perSecond * (full ? 1 : limited ? Math.min(1,state.availableMm/threshold) : 0) * latentJmm;
    const water = advanceRootZoneDry({availableMm:state.availableMm,capacityMm,depletionFraction:root.depletionFraction,demandMmPerDay:demand,days:dt/86400});
    const heat = advanceHeatColumnWithLoss(surface,lower,forcing,state,dt,{initialWm2:initialFlux,decayPerSecond:rate});
    const weight=seconds===0?1:dt/seconds;
    surfaceMeanC+=weight*heat.surfaceMeanC;subsurfaceMeanC+=weight*heat.subsurfaceMeanC;totalWeight+=weight;
    for (const key of ['inputJm2','exchangeOutJm2','transferDownJm2','surfaceLossJm2']) totals[key]+=heat[key];
    totals.suppliedMm+=water.suppliedMm;totals.potentialMm+=water.potentialMm;
    state={surfaceC:heat.surfaceC,subsurfaceC:heat.subsurfaceC,availableMm:water.availableMm};
  }
  return {...state,...totals,surfaceMeanC:surfaceMeanC/totalWeight,subsurfaceMeanC:subsurfaceMeanC/totalWeight};
}

function initialStore(root, rechargeMm) {
  const {capacityMm,stressThresholdMm}=validateRootZone(root);
  const initialAvailableMm=Math.min(root.initialAvailableMm,capacityMm);
  const retainedRechargeMm=Math.min(rechargeMm,capacityMm-initialAvailableMm);
  return {capacityMm,stressThresholdMm,initialAvailableMm,rechargeMm,retainedRechargeMm,
    drainageMm:rechargeMm-retainedRechargeMm,rechargedMm:initialAvailableMm+retainedRechargeMm};
}

function targetAt(study, side, start, minute) {
  const heat=study.heatColumn, surface=heat.heatStudy[side], lower=heat.lowerLayers[side], root=study.roots[side];
  let state={surfaceC:surface.initialC,subsurfaceC:lower.initialC,availableMm:start.rechargedMm};
  const totals={inputJm2:0,exchangeOutJm2:0,transferDownJm2:0,surfaceLossJm2:0,suppliedMm:0,potentialMm:0};
  let elapsed=0;
  for (let i=0;i<heat.heatStudy.schedule.length;i++) {
    const forcing=heat.heatStudy.schedule[i], used=Math.min(forcing.minutes,Math.max(0,minute-elapsed));
    if (used>0) {
      const step=coupledInterval(surface,lower,root,start.capacityMm,study.latentHeatJkg*study.surfaceLatentFraction[side],forcing,
        study.demands[i].potentialTranspirationMmPerDay,state,used*60);
      for(const key of Object.keys(totals)) totals[key]+=step[key];
      state={surfaceC:step.surfaceC,subsurfaceC:step.subsurfaceC,availableMm:step.availableMm};
    }
    elapsed+=forcing.minutes;if(elapsed>=minute)break;
  }
  const surfaceStoredJm2=surface.capacityJm2K*(state.surfaceC-surface.initialC);
  const subsurfaceStoredJm2=lower.capacityJm2K*(state.subsurfaceC-lower.initialC);
  const totalStoredJm2=surfaceStoredJm2+subsurfaceStoredJm2;
  return {minute,...state,...totals,surfaceStoredJm2,subsurfaceStoredJm2,totalStoredJm2,
    latentJm2:totals.suppliedMm*study.latentHeatJkg,
    unmodeledLatentSupplyJm2:totals.suppliedMm*study.latentHeatJkg-totals.surfaceLossJm2,
    unmetMm:Math.max(0,totals.potentialMm-totals.suppliedMm),
    waterResidualMm:start.rechargedMm-totals.suppliedMm-state.availableMm,
    latentResidualJm2:totals.suppliedMm*study.latentHeatJkg*study.surfaceLatentFraction[side]-totals.surfaceLossJm2,
    energyResidualJm2:totals.inputJm2-totals.surfaceLossJm2-totals.exchangeOutJm2-totalStoredJm2};
}

export function inspectCooling(result, minute) {
  if(result?.schema!=='experimental-earth-cooling-result/1' || !finite(minute,0,result.durationMinutes)) throw Error('Inspect a time inside this calculated cooling exposure');
  const row=Object.fromEntries(sides.map(side=>[side,targetAt(result.study,side,result.initial[side],minute)]));
  return {minute,...row,differenceC:row.proposal.surfaceC-row.existing.surfaceC};
}

export function compareCooling(project,study) {
  const result=prepareCooling(project,study);
  const endpoints=[0];for(const row of study.heatColumn.heatStudy.schedule)endpoints.push(endpoints.at(-1)+row.minutes);
  const times=[...new Set([...endpoints,...Array.from({length:Math.ceil(result.durationMinutes)},(_,i)=>i)])].sort((a,b)=>a-b);
  result.trajectory=times.map(t=>inspectCooling(result,t));
  result.final=result.trajectory.at(-1);
  return result;
}

/** Prepare original recharge once for investigations sharing the same water
 * declaration. Derived thermal variants do not rerun or refit the rain. */
export function prepareCooling(project,study) {
  const {cellIndex,cellSteps}=validateCoolingStudy(project,study), budget=compareLocalWaterBudget(project);
  if(budget.status!=='computed')throw Error('Original rain infiltration was not computed');
  const cellAreaM2=project.weather.cellSizeM**2;
  const initial=Object.fromEntries(sides.map(side=>[side,{...initialStore(study.roots[side],budget[side].cells[cellIndex].absorbedLiters/cellAreaM2),
    originalBudget:structuredClone(budget[side].cells[cellIndex])}]));
  const endpoints=[0];for(const row of study.heatColumn.heatStudy.schedule)endpoints.push(endpoints.at(-1)+row.minutes);
  const durationMinutes=endpoints.at(-1);
  return {schema:'experimental-earth-cooling-result/1',study:structuredClone(study),cellIndex,cellAreaM2,cellSteps,initial,durationMinutes,meaning:COOLING_MEANING};
}

function averageTarget(result,side,fromMinute,minute) {
  const study=result.study,heat=study.heatColumn,surface=heat.heatStudy[side],lower=heat.lowerLayers[side],root=study.roots[side];
  let state=targetAt(study,side,result.initial[side],fromMinute),elapsed=0;
  let surfaceMeanC=0,subsurfaceMeanC=0,totalWeight=0,segments=0;
  for(let i=0;i<heat.heatStudy.schedule.length;i++) {
    const forcing=heat.heatStudy.schedule[i],end=elapsed+forcing.minutes;
    const from=Math.max(fromMinute,elapsed),to=Math.min(minute,end);elapsed=end;
    if(!(to>from))continue;
    const step=coupledInterval(surface,lower,root,result.initial[side].capacityMm,
      study.latentHeatJkg*study.surfaceLatentFraction[side],forcing,study.demands[i].potentialTranspirationMmPerDay,state,(to-from)*60);
    const weight=(to-from)/(minute-fromMinute);
    surfaceMeanC+=weight*step.surfaceMeanC;subsurfaceMeanC+=weight*step.subsurfaceMeanC;totalWeight+=weight;segments++;
    state=step;
  }
  if(!(totalWeight>0)||![surfaceMeanC,subsurfaceMeanC,totalWeight].every(Number.isFinite))throw Error('Cooling averaging window could not be completely evaluated');
  return {fromMinute,minute,durationMinutes:minute-fromMinute,segments,surfaceMeanC:surfaceMeanC/totalWeight,subsurfaceMeanC:subsurfaceMeanC/totalWeight};
}

/** Exact selected-time and direct-window operators from the maintained coupled
 * response. Means weight analytic segment means, never subtract nearly equal
 * cumulative integrals or interpolate the displayed minute samples. */
export function evaluateCoolingTarget(result,side,minutes=[],windows=[]) {
  if(result?.schema!=='experimental-earth-cooling-result/1'||!sides.includes(side))throw Error('Use a computed cooling source and selected place');
  const duration=result.durationMinutes;
  if(!Array.isArray(minutes)||!Array.isArray(windows)||minutes.length+2*windows.length>2000||
    Array.from(minutes).some(t=>!finite(t,0,duration))||Array.from(windows).some(w=>!w||!finite(w.fromMinute,0,duration)||!finite(w.minute,0,duration)||!(w.minute>w.fromMinute)))
    throw Error('Request finite times and nonempty windows within the cooling exposure and 2000-endpoint work limit');
  const endpoints=[0];for(const row of result.study.heatColumn.heatStudy.schedule)endpoints.push(endpoints.at(-1)+row.minutes);
  const times=[...new Set([...endpoints,...minutes,...windows.flatMap(w=>[w.fromMinute,w.minute])])].sort((a,b)=>a-b);
  return {trajectory:times.map(t=>targetAt(result.study,side,result.initial[side],t)),averages:windows.map(w=>averageTarget(result,side,w.fromMinute,w.minute))};
}

export function serializeCooling(project,study) {
  validateCoolingStudy(project,study);
  const text=JSON.stringify({schema:'experimental-earth-cooling-investigation/1',project,study},null,2);
  if(new TextEncoder().encode(text).byteLength>COOLING_FILE_LIMIT)throw Error('Cooling investigation exceeds 5 MiB');
  return text;
}
export function parseCooling(text) {
  if(typeof text!=='string' || new TextEncoder().encode(text).byteLength>COOLING_FILE_LIMIT)throw Error('Cooling investigation must be UTF-8 JSON up to 5 MiB');
  const value=JSON.parse(text);exact(value,['schema','project','study'],'cooling file');
  if(value.schema!=='experimental-earth-cooling-investigation/1')throw Error('Unsupported cooling investigation');
  validateCoolingStudy(value.project,value.study);return value;
}

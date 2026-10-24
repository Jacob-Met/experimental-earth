import { performance } from 'node:perf_hooks';
import { runRain, validateProject, SURFACES } from '../core.js';
import { internalEdgeClosed, internalEdgeCrest } from '../internal-barriers.js';
import { allocateCrestTransfers } from '../crest-transfers.js';
import { INTERVENTION_METRICS } from '../intervention-study.js';

// Research-only comparator: the maintained runRain implementation is untouched.
// Frozen-head donor-capped fluxes are recalculated after each physical substep.
// Only the current fixed-rate, uniform-intensity rainfall family is modeled.
export const MAX_METHOD_CELL_STEPS = 3_000_000;
const KEYS = Object.keys(INTERVENTION_METRICS);
const EPS = 1e-8;
const direction = d => d > EPS ? 1 : d < -EPS ? -1 : 0;

export function runSubstepped(cells, width, height, weather, {substeps = 2, surface, rateMmHr, captureDepths = false} = {}) {
  validateProject({schema:'experimental-earth-site/1',title:'numerical research',
    width,height,existing:cells,proposal:cells,weather,observations:[]});
  if (!Number.isInteger(substeps) || substeps < 1 || substeps > 8) throw Error('Substeps must be an integer from 1 to 8');
  if (typeof captureDepths !== 'boolean') throw Error('Depth capture must be an explicit boolean');
  if (surface !== undefined && (!Object.hasOwn(SURFACES,surface) ||
      typeof rateMmHr !== 'number' || !Number.isFinite(rateMmHr) || rateMmHr < 0 || rateMmHr > 2000)) {
    throw Error('Invalid fixed-rate surface override');
  }
  if (surface === undefined && rateMmHr !== undefined) throw Error('Specify the rate surface');
  const n=width*height, cellArea=weather.cellSizeM**2;
  const water=Array(n).fill(0), peak=Array(n).fill(0), pairs=[], boundaries=[];
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=y*width+x;
    if(x+1<width) pairs.push([i,i+1]);
    if(y+1<height) pairs.push([i,i+width]);
    const count=Number(x===0)+Number(x===width-1)+Number(y===0)+Number(y===height-1);
    if(count) boundaries.push([i,count]);
  }
  let rainLiters=0,absorbedLiters=0,exitLiters=0,minDepthMm=0,internalPeakStorageLiters=0;
  const snapshots=[{minute:0,storedLiters:0,...(captureDepths?{depthsMm:water.slice()}: {})}];
  let actualSubsteps=0;
  for(let start=0;start<weather.durationMinutes-1e-10;start+=weather.stepMinutes) {
    const outerMinutes=Math.min(weather.stepMinutes,weather.durationMinutes-start);
    for(let part=0;part<substeps;part++) {
      const t=start+part*outerMinutes/substeps;
      const next=start+(part+1)*outerMinutes/substeps;
      const hours=(next-t)/60;
      const rainOverlap=Math.max(0,Math.min(next,weather.stormMinutes)-Math.min(t,weather.stormMinutes));
      const rainMm=weather.rainMmHr*rainOverlap/60;
      actualSubsteps++;
      for(let i=0;i<n;i++) {
        water[i]+=rainMm;
        const rate=surface!==undefined && cells[i].surface===surface ? rateMmHr : SURFACES[cells[i].surface].infiltrationMmHr;
        const absorb=Math.min(water[i],rate*hours);
        water[i]-=absorb;
        absorbedLiters+=absorb*cellArea;
        peak[i]=Math.max(peak[i],water[i]);
      }
      rainLiters+=rainMm*cellArea*n;
      const proposedOut=Array(n).fill(0),links=[];
      for(let edgeIndex=0;edgeIndex<pairs.length;edgeIndex++) {
        const [a,b]=pairs[edgeIndex];
        if(internalEdgeClosed(cells,a,b,width)) continue;
        const headA=cells[a].elevationM*1000+water[a],headB=cells[b].elevationM*1000+water[b];
        const delta=headA-headB;
        if(Math.abs(delta)<1e-12) continue;
        const src=delta>0?a:b,dst=delta>0?b:a;
        const crest=internalEdgeCrest(cells,a,b);
        const requested=(crest===null?Math.abs(delta):
          Math.max(0,Math.max(headA,headB)-Math.max(Math.min(headA,headB),crest*1000)))*
          weather.mobilityPerHour*hours;
        if(requested>0) {
          const link={src,dst,requested,edgeIndex};
          if(crest!==null) link.stopDepthMm=Math.max(0,
            Math.max(Math.min(headA,headB),crest*1000)-cells[src].elevationM*1000);
          links.push(link);proposedOut[src]+=requested;
        }
      }
      for(const [i,count] of boundaries) {
        const requested=(water[i]+10)*weather.boundaryExitPerHour*hours*count;
        if(requested>0) {links.push({src:i,dst:-1,requested});proposedOut[i]+=requested;}
      }
      const movement=Array(n).fill(0);
      const crestTransfers=allocateCrestTransfers(water,links);
      let index=0;
      for(const {src,dst,requested} of links) {
        const capped=crestTransfers?.[index] ?? requested*Math.min(1,water[src]/proposedOut[src]);
        index++;
        movement[src]-=capped;
        if(dst>=0) movement[dst]+=capped;
        else exitLiters+=capped*cellArea;
      }
      for(let i=0;i<n;i++) {
        const raw=water[i]+movement[i];
        minDepthMm=Math.min(minDepthMm,raw);
        water[i]=Math.max(0,raw);
        peak[i]=Math.max(peak[i],water[i]);
      }
      internalPeakStorageLiters=Math.max(internalPeakStorageLiters,water.reduce((a,b)=>a+b,0)*cellArea);
    }
    snapshots.push({minute:Math.min(weather.durationMinutes,start+outerMinutes),
      storedLiters:water.reduce((a,b)=>a+b,0)*cellArea,
      ...(captureDepths?{depthsMm:water.slice()}: {})});
  }
  const storedLiters=water.reduce((a,b)=>a+b,0)*cellArea;
  return {rainLiters,absorbedLiters,exitLiters,storedLiters,
    massErrorLiters:rainLiters-absorbedLiters-exitLiters-storedLiters,
    peakPondingLiters:Math.max(...snapshots.map(s=>s.storedLiters)),
    maxDepthMm:Math.max(...peak),finalDepthMm:water,peakDepthMm:peak,
    minDepthMm,internalPeakStorageLiters,actualSubsteps,snapshots};
}

export function compareNumericalMethods(project,{surface='turf',ratesMmHr=[3,9,22],
  stepsMinutes=[5,2.5,1.25,1],substeps=2,referenceSubsteps=4}={}) {
  validateProject(project);
  if(!Object.hasOwn(SURFACES,surface) || !Array.isArray(ratesMmHr) ||
     ratesMmHr.length<1 || ratesMmHr.length>9 ||
     ratesMmHr.some(r=>typeof r!=='number'||!Number.isFinite(r)||r<0||r>2000) ||
     !Array.isArray(stepsMinutes)||stepsMinutes.length<2||stepsMinutes.length>6 ||
     stepsMinutes.some(s=>typeof s!=='number'||!Number.isFinite(s)||s<1||s>30) ||
     new Set(stepsMinutes).size!==stepsMinutes.length ||
     !Number.isInteger(substeps)||substeps<2||substeps>8 ||
     !Number.isInteger(referenceSubsteps)||referenceSubsteps<substeps||referenceSubsteps>8) {
    throw Error('Invalid bounded numerical-method comparison');
  }
  const n=project.width*project.height,duration=project.weather.durationMinutes;
  const cellSteps=2*ratesMmHr.length*n*(
    stepsMinutes.reduce((a,s)=>a+Math.ceil(duration/s)*(1+substeps),0)+
    Math.ceil(duration)*referenceSubsteps);
  const metadata={schema:'experimental-earth-method-comparison/1',surface,ratesMmHr:[...ratesMmHr],
    stepsMinutes:[...stepsMinutes],substeps,reference:{stepMinutes:1,substeps:referenceSubsteps},
    estimatedCellSteps:cellSteps,maxCellSteps:MAX_METHOD_CELL_STEPS};
  if(cellSteps>MAX_METHOD_CELL_STEPS) return {...metadata,status:'work-limit',cases:[]};
  if(!project.existing.some(c=>c.surface===surface)&&!project.proposal.some(c=>c.surface===surface)) {
    return {...metadata,status:'surface-absent',cases:[]};
  }
  const run=(method,target,stepMinutes,parts,rateMmHr)=>{
    const cells=project[target],weather={...project.weather,stepMinutes};
    const start=performance.now();
    const result=method==='incumbent'
      ? runRain(cells,project.width,project.height,weather,{surfaceInfiltrationOverride:{surface,rateMmHr}})
      : runSubstepped(cells,project.width,project.height,weather,{substeps:parts,surface,rateMmHr});
    return {result,elapsedMs:performance.now()-start};
  };
  const paired=(method,stepMinutes,parts,rateMmHr)=>{
    const a=run(method,'existing',stepMinutes,parts,rateMmHr);
    const b=run(method,'proposal',stepMinutes,parts,rateMmHr);
    return {deltas:Object.fromEntries(KEYS.map(key=>[key,b.result[key]-a.result[key]])),
      runtimeMs:a.elapsedMs+b.elapsedMs,
      maxMassErrorLiters:Math.max(Math.abs(a.result.massErrorLiters),Math.abs(b.result.massErrorLiters)),
      minDepthMm:Math.min(a.result.minDepthMm??0,b.result.minDepthMm??0),
      actualCellSteps:n*((a.result.actualSubsteps??a.result.snapshots.length-1)+
        (b.result.actualSubsteps??b.result.snapshots.length-1))};
  };
  const cases=ratesMmHr.map(rateMmHr=>{
    // Same source/forcing/reference for both candidate methods; never a physical truth proxy.
    const reference=paired('substeps',1,referenceSubsteps,rateMmHr);
    const runs=stepsMinutes.map(stepMinutes=>{
      const incumbent=paired('incumbent',stepMinutes,1,rateMmHr);
      const alternative=paired('substeps',stepMinutes,substeps,rateMmHr);
      for(const candidate of [incumbent,alternative]) {
        candidate.deviationFromReference=Object.fromEntries(KEYS.map(key=>[
          key,Math.abs(candidate.deltas[key]-reference.deltas[key])]));
      }
      return {stepMinutes,incumbent,alternative};
    });
    const stability=Object.fromEntries(['incumbent','alternative'].map(method=>[method,
      Object.fromEntries(KEYS.map(key=>{
        const signs=runs.map(r=>direction(r[method].deltas[key]));
        return [key,{signs,changed:signs.some(s=>s!==signs[0])}];
      }))]));
    const counts={closer:0,worse:0,equal:0};
    for(const r of runs) for(const key of KEYS) {
      const a=r.alternative.deviationFromReference[key],b=r.incumbent.deviationFromReference[key];
      counts[a<b-1e-9?'closer':a>b+1e-9?'worse':'equal']++;
    }
    return {rateMmHr,reference,runs,stability,referenceAgreementCounts:counts};
  });
  return {...metadata,status:'compared',cases};
}

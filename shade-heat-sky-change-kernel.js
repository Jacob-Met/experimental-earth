import {sampleProfileBasisGeometry,evaluateProfileOriginalBoundaryCourse} from './shade-heat-profile-basis.js';
import {originalSkyReadingTimes,sameSkyData} from './shade-heat-timed-reading-source.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';

const ZERO=q(0),ONE=q(1),targets=['existing','proposal'],sides=['lower','upper'],stores=['surfaceC','subsurfaceC'];
const channels=targets.flatMap(target=>sides.flatMap(side=>stores.map(store=>[target,side,store])));
const mapState=getter=>Object.fromEntries(targets.map(target=>[target,Object.fromEntries(sides.map(side=>[side,
  Object.fromEntries(stores.map(store=>[store,getter(target,side,store)]))]))]));
const flatten=trace=>trace.originalBoundaries.map((_,t)=>channels.map(([target,side,store])=>trace.states[target][side][t][store]));
const maximum=(a,b)=>cmp(a,b)>=0?a:b,absolute=value=>value[0]<0n?neg(value):value;

// The source and geometry are private to one already admitted complete inquiry.
// Only identical complete original bin sequences can share a numerical course.
// No context or saved numerical result is accepted from a file or worker input.
export function createOriginalSkyChangeBasis(input){
  const source=structuredClone(input.source),geometry=sampleProfileBasisGeometry(source,4);
  const intervals=geometry.sampled.intervals.length,cache=new Map();
  if(intervals<2||intervals>24)throw Error('Retain two to24 complete original intervals');
  const work={geometryExecutions:1,executedBasisCourses:0,reusedCompleteCourses:0,maximumCacheEntries:0,
    combinationStatesScreened:0,patternsScreened:0,executedWitnessCourses:0};
  const evaluate=(transmissions,label)=>evaluateProfileOriginalBoundaryCourse(source,geometry,transmissions,label,
    'Complete original sky-change inquiry refused');
  function binCourse(sequence){
    if(!Array.isArray(sequence)||sequence.length!==intervals||Array.from(sequence).some(v=>!Number.isInteger(v)||v<0||v>3))
      throw Error('Retain one valid original bin for every complete interval');
    const key=sequence.join(''),prior=cache.get(key);
    if(prior){work.reusedCompleteCourses+=4;return prior;}
    const trace=evaluate((target,_row,i)=>sides.map(side=>geometry.transmissions[target][side][sequence[i]].transmission),
      'Complete original bin-sequence reference '+key);
    work.executedBasisCourses+=4;
    const changes=sequence.slice(1).reduce((sum,bin,i)=>sum+Number(bin!==sequence[i]),0);
    // A sequence with two actual changes has one unique boundary pair and is
    // never needed by another candidate. Keep only shared lower-change traces.
    if(changes<=1){cache.set(key,trace);work.maximumCacheEntries=Math.max(work.maximumCacheEntries,cache.size);}
    return trace;
  }
  const zero=binCourse(Array(intervals).fill(0)),originalTimes=zero.originalBoundaries;
  if(!sameSkyData(originalTimes,originalSkyReadingTimes(source)))throw Error('The canonical basis lost the original clock');
  const staticProfiles=[flatten(zero),...Array.from({length:3},(_,bin)=>flatten(binCourse(Array(intervals).fill(bin+1))))];
  const constant=staticProfiles[0].map(row=>row.map(q)),steps=[];
  for(let boundary=1;boundary<intervals;boundary++)steps.push([1,2,3].map(bin=>{
    const trace=binCourse(Array.from({length:intervals},(_,i)=>i>=boundary?bin:0));
    if(!sameSkyData(trace.originalBoundaries,originalTimes))throw Error('A canonical original step changed its clock');
    return flatten(trace);
  }));
  const tails=Array.from({length:intervals+1},(_,boundary)=>originalTimes.map((_,t)=>channels.map((_,c)=>[0,1,2].map(bin=>
    boundary===intervals?ZERO:sub(q(boundary===0?staticProfiles[bin+1][t][c]:steps[boundary-1][bin][t][c]),constant[t][c])))));
  const intervalCoefficients=originalTimes.map((_,t)=>channels.map((_,c)=>Array.from({length:intervals},(_,i)=>
    [0,1,2].map(bin=>sub(tails[i][t][c][bin],tails[i+1][t][c][bin])))));
  function project(splits){
    if(!Array.isArray(splits)||splits.length>2||Array.from(splits).some((v,i)=>!Number.isInteger(v)||v<1||v>=intervals||(i&&v<=splits[i-1])))
      throw Error('Choose an ordered original zero/one/two-change pattern');
    const edges=[0,...splits,intervals];
    return originalTimes.map((_,t)=>channels.map((_,c)=>edges.slice(1).flatMap((end,phase)=>
      [0,1,2].map(bin=>sub(tails[edges[phase]][t][c][bin],tails[end][t][c][bin])))));
  }
  function screenPattern(splits,readingLocations,screenC){
    const coefficients=project(splits),phases=splits.length+1,perTime=originalTimes.map(()=>ZERO),screen=q(screenC);
    if(!Array.isArray(readingLocations)||readingLocations.some(at=>!Number.isInteger(at.originalIndex)
        ||!originalTimes[at.originalIndex]||!stores.includes(at.store)))throw Error('Retain the original observation locations for this receiver');
    let largest=ZERO,screened=0;
    for(let combination=0;combination<4**phases;combination++){
      const bins=Array.from({length:phases},(_,phase)=>Math.floor(combination/4**(phases-phase-1))%4);
      const sequence=Array.from({length:intervals},(_,i)=>bins[splits.filter(boundary=>i>=boundary).length]);
      const trace=binCourse(sequence),raw=flatten(trace);
      if(!sameSkyData(trace.originalBoundaries,originalTimes))throw Error('A complete original combination changed its clock');
      for(const at of readingLocations)if(trace.states.existing.lower[at.originalIndex][at.store]!==trace.states.existing.upper[at.originalIndex][at.store])
        throw Error('An original temperature observation has unresolved existing endpoints; no favorable endpoint is selected');
      for(let t=0;t<originalTimes.length;t++)for(let c=0;c<channels.length;c++){
        let value=constant[t][c];
        for(let phase=0;phase<phases;phase++)if(bins[phase])value=add(value,coefficients[t][c][phase*3+bins[phase]-1]);
        const delta=absolute(sub(value,q(raw[t][c])));largest=maximum(largest,delta);perTime[t]=maximum(perTime[t],delta);screened++;
      }
    }
    if(cmp(largest,screen)>0)throw Error('An original combination exceeds the common-step consistency screen; no partial pattern search is accepted');
    work.combinationStatesScreened+=screened;work.patternsScreened++;
    return {combinations:4**phases,screenedStates:screened,maximumDiscrepancyC:profileFraction(largest),
      originalBoundaryScreens:perTime.map((value,index)=>({index,maximumDiscrepancyC:profileFraction(value)}))};
  }
  function replay(splits,phaseProfiles,screenC){
    const coefficients=project(splits),phases=splits.length+1;
    if(!Array.isArray(phaseProfiles)||phaseProfiles.length!==phases||phaseProfiles.some(profile=>!Array.isArray(profile)
        ||profile.length!==4||profile.some(v=>v[0]<0n)||cmp(profile.reduce(add,ZERO),ONE)))
      throw Error('Retain one normalized exact profile per original epoch');
    const approximateProfiles=phaseProfiles.map(profile=>{
      const lower=profile.map(v=>profileFraction(v).lower),sum=lower.reduce((a,b)=>a+b,0);
      if(!(sum>0)||!Number.isFinite(sum))throw Error('A numerical sky-pattern replay lost positive finite mass');
      return {weights:lower.map(v=>v/sum),preNormalizationMass:sum,massDrift:sum-1};
    });
    const trace=evaluate((target,_row,i)=>sides.map(side=>approximateProfiles[splits.filter(boundary=>i>=boundary).length].weights.reduce((sum,weight,bin)=>
      sum+weight*geometry.transmissions[target][side][bin].transmission,0)),'Original numerical replay of a minimum-change profile');
    work.executedWitnessCourses+=4;
    if(!sameSkyData(trace.originalBoundaries,originalTimes))throw Error('A fixed-profile replay changed its original clock');
    const point=phaseProfiles.flatMap(profile=>profile.slice(1));let largest=ZERO;
    const originalCourse=originalTimes.map((time,t)=>{
      const values=channels.map((_,c)=>coefficients[t][c].reduce((sum,v,i)=>add(sum,mul(v,point[i])),constant[t][c]));
      const get=(target,side,store)=>channels.findIndex(x=>x[0]===target&&x[1]===side&&x[2]===store);
      const originalC=mapState((target,side,store)=>trace.states[target][side][t][store]);
      const additiveC=mapState((target,side,store)=>profileFraction(values[get(target,side,store)]));
      const originalMinusAdditiveC=mapState((target,side,store)=>{
        const delta=sub(q(originalC[target][side][store]),values[get(target,side,store)]);largest=maximum(largest,absolute(delta));return profileFraction(delta);
      });
      return {...time,originalC,additiveC,originalMinusAdditiveC};
    });
    if(cmp(largest,q(screenC))>0)throw Error('A fixed original numerical profile exceeds the common-step consistency screen');
    return {approximateProfiles,originalCourse,maximumReplayResidualC:profileFraction(largest)};
  }
  return {
    originalTimes:structuredClone(originalTimes),
    observationRow(originalIndex,store){
      if(!Number.isInteger(originalIndex)||!originalTimes[originalIndex]||!stores.includes(store))throw Error('Use an original observation time and component');
      const channel=stores.indexOf(store);
      return structuredClone({constant:constant[originalIndex][channel],coefficients:intervalCoefficients[originalIndex][channel]});
    },
    screenPattern,replay,
    numericalBasis(){return structuredClone({channels,originalTimes,staticProfiles,steps});},
    diagnostics(){return structuredClone(geometry.diagnostics);},
    work(){return {...work,actualSkyFaceTests:geometry.sampled.diffuseSky.estimatedFaceTests};},
  };
}

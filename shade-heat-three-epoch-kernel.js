import {sampleProfileBasisGeometry,evaluateProfileOriginalBoundaryCourse} from './shade-heat-profile-basis.js';
import {profileFraction} from './shade-heat-profile-band.js';
import {tripleBins} from './shade-heat-three-epoch-marginals.js';
import {rational as q,add,sub,mul,cmp} from './vendor/chronos/exact-halfplanes.mjs';

const targets=['existing','proposal'],bounds=['lower','upper'],stores=['surfaceC','subsurfaceC'];
const ZERO=q(0),ONE=q(1),abs=x=>x[0]<0n?sub(ZERO,x):x,max=(a,b)=>cmp(a,b)>=0?a:b;
export const mapThreeEpochState=getter=>Object.fromEntries(targets.map(target=>[target,
  Object.fromEntries(bounds.map(bound=>[bound,Object.fromEntries(stores.map(store=>[store,getter(target,bound,store)]))]))]));
const phaseAt=(index,splits)=>index<splits[0]?0:index<splits[1]?1:2;
const mixture=(masses,row)=>row.reduce((sum,v,i)=>add(sum,mul(masses[i],v)),ZERO);

// Internal adapter. The public inquiry admits the complete work before entering.
// All64 original courses execute; ten reference combinations supply the exact
// additive coefficients and every original time/combination screens that model.
export function buildThreeEpochBasis(input,splits){
  if(!Array.isArray(splits)||splits.length!==2||!Object.hasOwn(splits,0)||!Object.hasOwn(splits,1)
      ||!Array.from(splits).every(Number.isInteger)||splits[0]<1||splits[0]>=splits[1])
    throw Error('Two ordered internal original boundaries are required');
  const source=input.source,geometry=sampleProfileBasisGeometry(source,4),triples=[];
  if(splits[1]>=geometry.sampled.intervals.length)throw Error('Two ordered internal original boundaries are required');
  for(let i=0;i<64;i++){
    const bins=tripleBins(i);
    const trace=evaluateProfileOriginalBoundaryCourse(source,geometry,(target,_row,index)=>bounds.map(bound=>
      geometry.transmissions[target][bound][bins[phaseAt(index,splits)]].transmission),
    'Three-epoch original one-bin combination '+bins.join('/'),
    'Complete three-epoch inquiry refused at combination '+bins.join('/'));
    triples.push({bins,trace});
  }
  const originalBoundaries=triples[0].trace.originalBoundaries;
  if(triples.some(v=>JSON.stringify(v.trace.originalBoundaries)!==JSON.stringify(originalBoundaries)))
    throw Error('Original three-epoch courses lost their common interval identities');
  const courseCoefficients=originalBoundaries.map((_,time)=>{
    const reference=mapThreeEpochState((target,bound,store)=>q(triples[0].trace.states[target][bound][time][store]));
    return triples.map(({bins})=>({bins,values:mapThreeEpochState((target,bound,store)=>{
      const zero=reference[target][bound][store];
      return bins.reduce((sum,bin,epoch)=>bin?add(sum,sub(q(triples[bin*[16,4,1][epoch]].trace.states[target][bound][time][store]),zero)):sum,zero);
    })}));
  });
  let maximumCourseDiscrepancyC=ZERO;
  const courseScreens=originalBoundaries.map((time,index)=>{
    let maximumDiscrepancyC=ZERO,nonzeroDiscrepancies=0;
    triples.forEach((triple,i)=>mapThreeEpochState((target,bound,store)=>{
      const delta=sub(courseCoefficients[index][i].values[target][bound][store],q(triple.trace.states[target][bound][index][store]));
      maximumDiscrepancyC=max(maximumDiscrepancyC,abs(delta));if(delta[0])nonzeroDiscrepancies++;
    }));
    maximumCourseDiscrepancyC=max(maximumCourseDiscrepancyC,maximumDiscrepancyC);
    return {index:time.index,maximumDiscrepancyC:profileFraction(maximumDiscrepancyC),nonzeroDiscrepancies};
  });
  return {input,geometry,triples,originalBoundaries,courseCoefficients,courseScreens,maximumCourseDiscrepancyC,
    splitUtcs:splits.map(i=>originalBoundaries[i].utc),executedCourses:256};
}

export function replayThreeEpochWitness(result,id,bases,splits,screenC){
  const phaseProfiles=result.phaseProfiles;
  if(phaseProfiles.length!==3||phaseProfiles.some(phase=>phase.length!==4||phase.some(v=>v[0]<0n)||cmp(phase.reduce(add,ZERO),ONE)))
    throw Error('A fixed normalized exact profile is required for every epoch');
  const approximateProfiles=phaseProfiles.map(phase=>{
    const lower=phase.map(v=>profileFraction(v).lower),sum=lower.reduce((a,b)=>a+b,0);
    if(!(sum>0)||!Number.isFinite(sum))throw Error('Approximate three-epoch replay lost finite positive mass');
    return {weights:lower.map(v=>v/sum),preNormalizationMass:sum,massDrift:sum-1};
  });
  let maximumReplayResidualC=ZERO,exactMarginalEqualities=0;
  const originalReplays=bases.map((basis,sourceIndex)=>{
    const evaluated=evaluateProfileOriginalBoundaryCourse(basis.input.source,basis.geometry,(target,_row,index)=>bounds.map(bound=>
      approximateProfiles[phaseAt(index,splits)].weights.reduce((sum,weight,bin)=>
        sum+weight*basis.geometry.transmissions[target][bound][bin].transmission,0)),
    'Normalized original replay of exact three-epoch witness '+id,'Complete three-epoch witness replay refused at '+id);
    const originalCourse=evaluated.originalBoundaries.map((boundary,time)=>{
      if(JSON.stringify(boundary)!==JSON.stringify(basis.originalBoundaries[time]))throw Error('An original witness clock changed');
      const exactC=mapThreeEpochState((target,bound,store)=>{
        const row=basis.courseCoefficients[time].map(v=>v.values[target][bound][store]);
        const value=mixture(result.masses,row),zero=row[0];
        const marginal=phaseProfiles.reduce((sum,phase,epoch)=>phase.slice(1).reduce((v,mass,j)=>
          add(v,mul(mass,sub(row[(j+1)*[16,4,1][epoch]],zero))),sum),zero);
        if(cmp(value,marginal))throw Error('Exact product-profile marginal identity changed');
        exactMarginalEqualities++;return value;
      });
      const originalC=mapThreeEpochState((target,bound,store)=>evaluated.states[target][bound][time][store]);
      const residual=mapThreeEpochState((target,bound,store)=>{
        const delta=sub(q(originalC[target][bound][store]),exactC[target][bound][store]);
        maximumReplayResidualC=max(maximumReplayResidualC,abs(delta));return profileFraction(delta);
      });
      return {...boundary,originalC,additiveC:mapThreeEpochState((t,b,s)=>profileFraction(exactC[t][b][s])),originalMinusAdditiveC:residual};
    });
    return {sourceIndex,cellIndex:basis.input.query.reading.cellIndex,originalFinalC:evaluated.final,originalCourse};
  });
  if(cmp(maximumReplayResidualC,q(screenC))>0)throw Error('An original witness exceeds the three-epoch consistency screen; no partial inquiry is returned');
  return {phaseProfiles:phaseProfiles.map(phase=>phase.map(profileFraction)),approximateProfiles,originalReplays,
    maximumReplayResidualC:profileFraction(maximumReplayResidualC),exactMarginalEqualities};
}

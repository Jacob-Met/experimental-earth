import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {projectThreeEpochSkyRow,tripleBins} from './shade-heat-three-epoch-marginals.js';
import {solveThreeEpochTargetLinearObjectives,THREE_EPOCH_TARGET_LINEAR_LIMITS} from './shade-heat-exact-linear.js';

export const THREE_EPOCH_TARGET_LIMITS=Object.freeze({targets:50,originalConstraints:51,
  coordinates:10,augmentedConstraints:101,linear:THREE_EPOCH_TARGET_LINEAR_LIMITS});
const ZERO=q(0),ONE=q(1),MINUS_ONE=q(-1);
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const fraction=v=>dense(v,2)&&typeof v[0]==='bigint'&&typeof v[1]==='bigint'&&v[1]>0n
  &&(v[0]<0n?-v[0]:v[0]).toString(2).length<=4096&&v[1].toString(2).length<=4096;
const dot=(a,b)=>a.reduce((sum,v,i)=>add(sum,mul(v,b[i])),ZERO);
const min=(a,b)=>cmp(a,b)<=0?a:b,max=(a,b)=>cmp(a,b)>=0?a:b;

// Algebra-only adapter. The source-owning consumer supplies its unchanged
// original9D matrix and all64 additive target values, never saved calculations.
export function minimizeThreeEpochTargetExcess(model,targetRows,ceilings,options={}){
  const m=model?.rows?.length,k=targetRows?.length;
  if(!model||typeof model!=='object'||Array.isArray(model)||Object.keys(model).length!==2
      ||!Object.hasOwn(model,'rows')||!Object.hasOwn(model,'bounds')
      ||!Number.isInteger(m)||m<3||m>THREE_EPOCH_TARGET_LIMITS.originalConstraints
      ||!dense(model.rows,m)||!model.rows.every(row=>dense(row,9)&&row.every(fraction))
      ||!dense(model.bounds,m)||!model.bounds.every(fraction)
      ||!Number.isInteger(k)||k<1||k>THREE_EPOCH_TARGET_LIMITS.targets||!dense(targetRows,k)
      ||!dense(ceilings,k)||!ceilings.every(fraction))
    throw Error('Retain the complete original nine-coordinate model and one to50 exact original target rows and ceilings');
  const projections=targetRows.map(projectThreeEpochSkyRow);
  if(model.rows.slice(0,3).some((row,epoch)=>row.some((v,j)=>cmp(v,Math.floor(j/3)===epoch?ONE:ZERO)))
      ||model.bounds.slice(0,3).some(v=>cmp(v,ONE)))
    throw Error('Retain all three original normalized-profile simplex constraints in their original order');
  const minimumBasisExcessC=targetRows.map((row,i)=>sub(row.reduce(min),ceilings[i]));
  // Every normalized product profile is a convex combination of these64
  // additive values. Thus max_i min64(f_i-c_i) is a valid lower bound on the
  // true minimum worst excess. The auxiliary nonnegative t adds no restriction.
  const lowerAnchorC=minimumBasisExcessC.reduce(max);
  const rows=model.rows.map(row=>[...row,ZERO]),bounds=model.bounds.slice();
  projections.forEach((p,i)=>{
    rows.push([...p.coefficients,MINUS_ONE]);
    bounds.push(sub(add(ceilings[i],lowerAnchorC),p.constant));
  });
  const objective=[...Array.from({length:9},()=>ZERO),MINUS_ONE];
  const solved=solveThreeEpochTargetLinearObjectives(rows,bounds,[objective],options);
  const common={lowerAnchorC,minimumBasisExcessC,projections,
    linearModel:{rows,bounds,objective,originalConstraintCount:m},
    work:{...solved.work,additiveTargetIdentities:k*64},limits:solved.limits};
  if(solved.status==='incompatible'){
    if(solved.certificate.dual.slice(m).some(v=>v[0]!==0n))
      throw Error('Unbounded auxiliary excess cannot turn a compatible original family into a contradiction');
    return {...common,status:'incompatible-original-model',certificate:solved.certificate,witness:null};
  }
  const proof=solved.results[0];
  if(proof.status!=='optimal')throw Error('The bounded common-profile target margin must have a finite optimum');
  const coordinates=proof.point.slice(0,9);
  const phaseProfiles=[0,3,6].map(start=>{
    const selected=coordinates.slice(start,start+3),phase=[sub(ONE,selected.reduce(add,ZERO)),...selected];
    if(phase.some(v=>v[0]<0n)||cmp(phase.reduce(add,ZERO),ONE))throw Error('A target-margin profile lost exact normalized mass');
    return phase;
  });
  const masses=Array.from({length:64},(_,i)=>tripleBins(i).reduce((p,bin,epoch)=>mul(p,phaseProfiles[epoch][bin]),ONE));
  if(cmp(masses.reduce(add,ZERO),ONE)||model.rows.some((row,i)=>cmp(dot(row,coordinates),model.bounds[i])>0))
    throw Error('The common target profile lost an original constraint or unit mass');
  const targetValuesC=targetRows.map((row,i)=>{
    const value=dot(row,masses),p=projections[i];
    if(cmp(value,add(p.constant,dot(p.coefficients,coordinates))))throw Error('A target lost its exact product-profile identity');
    return value;
  });
  const targetExcessC=targetValuesC.map((value,i)=>sub(value,ceilings[i]));
  const minimumWorstExcessC=sub(lowerAnchorC,proof.value);
  if(cmp(minimumWorstExcessC,add(lowerAnchorC,proof.point[9]))||cmp(targetExcessC.reduce(max),minimumWorstExcessC))
    throw Error('The optimized common target excess does not equal this one fixed profile');
  const activeTargetIndices=targetExcessC.flatMap((value,i)=>cmp(value,minimumWorstExcessC)===0?[i]:[]);
  if(activeTargetIndices.length===0)throw Error('A finite target family must retain an attaining original target');
  return {...common,status:'optimized',targetCompatibility:cmp(minimumWorstExcessC,ZERO)<=0?'compatible':'incompatible',
    minimumWorstExcessC,maximumCommonMarginC:neg(minimumWorstExcessC),targetValuesC,targetExcessC,activeTargetIndices,
    linearCertificate:proof,feasibilityCertificate:solved.certificate,
    witness:{coordinates,phaseProfiles,masses}};
}

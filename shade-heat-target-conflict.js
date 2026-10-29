import {rational as q,add,sub,mul,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {tripleBins} from './shade-heat-three-epoch-marginals.js';
import {prepareThreeEpochTargetProjections,THREE_EPOCH_TARGET_LIMITS} from './shade-heat-target-margin.js';
import {solveThreeEpochTargetLinearObjectives,verifyThreeEpochTargetLinearCertificate} from './shade-heat-exact-linear.js';

export const THREE_EPOCH_TARGET_CONFLICT_LIMITS=Object.freeze({targets:THREE_EPOCH_TARGET_LIMITS.targets,
  originalConstraints:THREE_EPOCH_TARGET_LIMITS.originalConstraints,coordinates:9,
  constraints:THREE_EPOCH_TARGET_LIMITS.augmentedConstraints,feasibilitySolves:52,
  pivots:THREE_EPOCH_TARGET_LIMITS.linear.pivots,
  rationalOperations:THREE_EPOCH_TARGET_LIMITS.linear.rationalOperations});
const ZERO=q(0),ONE=q(1);
const dot=(a,b)=>a.reduce((sum,v,i)=>add(sum,mul(v,b[i])),ZERO);
const exactKeys=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));

// Reuse a freshly computed common-margin witness or dual. The exact hard-target
// matrix is rebuilt here; the candidate certificate must prove that matrix.
// A positive basis minimum handles the t=0 case where an optimal epigraph dual
// can be all zero. No complementarity or target support is merely assumed.
export function prepareThreeEpochTargetConflictSeed(model,targetRows,ceilings,margin){
  const projections=prepareThreeEpochTargetProjections(model,targetRows,ceilings),m=model.rows.length,k=targetRows.length;
  const rows=[...model.rows,...projections.map(p=>p.coefficients)],
    bounds=[...model.bounds,...projections.map((p,i)=>sub(ceilings[i],p.constant))];
  if(margin?.status!=='optimized')throw Error('A fresh optimized original target margin is required for its conflict seed');
  let certificate;
  if(margin.targetCompatibility==='compatible')certificate={status:'feasible',point:margin.witness.coordinates.slice()};
  else if(margin.targetCompatibility==='incompatible'){
    const dual=margin.linearCertificate.dual;
    if(!Array.isArray(dual)||dual.length!==m+k)throw Error('The target-margin dual must keep every original and target row');
    const contradiction=dot(dual,bounds);
    if(contradiction[0]<0n)certificate={status:'incompatible',dual:dual.slice(),contradiction};
    else{
      const index=targetRows.findIndex((row,i)=>row.every(v=>cmp(v,ceilings[i])>0));
      if(index<0)throw Error('The common margin did not supply a strict hard-target contradiction');
      const selected=projections[index],weights=Array.from({length:m+k},()=>ZERO);
      for(let phase=0;phase<3;phase++){
        const minimum=selected.coefficients.slice(3*phase,3*phase+3).reduce((a,b)=>cmp(a,b)<=0?a:b,ZERO);
        weights[phase]=sub(ZERO,minimum);
      }
      weights[m+index]=ONE;certificate={status:'incompatible',dual:weights,contradiction:dot(weights,bounds)};
    }
  }else throw Error('The original target compatibility must be explicit');
  verifyThreeEpochTargetLinearCertificate(rows,bounds,null,certificate);
  return certificate;
}

// All original observations remain mandatory. The returned subgroup is
// inclusion-minimal, not a minimum-cardinality search or a recommended edit.
// Feasibility uses the maintained target solver with nine original coordinates
// and no optimization objectives; its tenth-coordinate allowance is unused.
export function findThreeEpochTargetConflict(model,targetRows,ceilings,options={}){
  const projections=prepareThreeEpochTargetProjections(model,targetRows,ceilings),m=model.rows.length,k=targetRows.length;
  if(!exactKeys(options,['maxPivots','maxRationalOperations','initialCertificate']))throw Error('Unsupported complete target-conflict work allowance');
  const limits={pivots:options.maxPivots??THREE_EPOCH_TARGET_CONFLICT_LIMITS.pivots,
    rationalOperations:options.maxRationalOperations??THREE_EPOCH_TARGET_CONFLICT_LIMITS.rationalOperations};
  for(const key of Object.keys(limits))if(!Number.isSafeInteger(limits[key])||limits[key]<0||limits[key]>THREE_EPOCH_TARGET_CONFLICT_LIMITS[key])
    throw Error('Target-conflict allowances must be bounded nonnegative integers');
  const targetBounds=projections.map((p,i)=>sub(ceilings[i],p.constant));
  const work={feasibilitySolves:0,pivots:0,rationalOperations:0,verifiedCertificates:0,
    additiveTargetIdentities:k*64,maximumConstraints:0,removalWitnesses:0,finalConstraintChecks:0,verifiedInitialCertificates:0};
  const history=[];
  const matrix=indices=>({rows:[...model.rows,...indices.map(i=>projections[i].coefficients)],
    bounds:[...model.bounds,...indices.map(i=>targetBounds[i])]});
  function solve(indices,purpose){
    if(work.feasibilitySolves>=k+2||work.feasibilitySolves>=THREE_EPOCH_TARGET_CONFLICT_LIMITS.feasibilitySolves)
      throw Error('The complete target-conflict solve allowance is exhausted; no partial conflict is returned');
    const linearModel=matrix(indices);
    const solved=solveThreeEpochTargetLinearObjectives(linearModel.rows,linearModel.bounds,[],{
      maxPivots:limits.pivots-work.pivots,maxRationalOperations:limits.rationalOperations-work.rationalOperations});
    work.feasibilitySolves++;work.pivots+=solved.work.pivots;work.rationalOperations+=solved.work.rationalOperations;
    work.verifiedCertificates+=solved.work.verifiedCertificates;work.maximumConstraints=Math.max(work.maximumConstraints,linearModel.rows.length);
    history.push({purpose,targetIndices:indices.slice(),status:solved.status,work:solved.work});
    return {linearModel,certificate:solved.certificate,status:solved.status};
  }
  function witness(point,requiredIndices,removedTargetIndex=null){
    const coordinates=point.slice();
    if(coordinates.length!==9||coordinates.some(v=>v[0]<0n)
        ||model.rows.some((row,i)=>cmp(dot(row,coordinates),model.bounds[i])>0))
      throw Error('A target-conflict witness lost an original constraint');
    const phaseProfiles=[0,3,6].map(start=>{
      const selected=coordinates.slice(start,start+3),phase=[sub(ONE,selected.reduce(add,ZERO)),...selected];
      if(phase.some(v=>v[0]<0n)||cmp(phase.reduce(add,ZERO),ONE))throw Error('A target-conflict witness lost normalized profile mass');
      return phase;
    });
    const masses=Array.from({length:64},(_,i)=>tripleBins(i).reduce((p,bin,epoch)=>mul(p,phaseProfiles[epoch][bin]),ONE));
    if(cmp(masses.reduce(add,ZERO),ONE))throw Error('A target-conflict witness lost exact product mass');
    const targetValuesC=targetRows.map((row,i)=>{
      const value=dot(row,masses);
      if(cmp(value,add(projections[i].constant,dot(projections[i].coefficients,coordinates))))
        throw Error('A target-conflict witness lost an original additive identity');
      return value;
    });
    const targetExcessC=targetValuesC.map((v,i)=>sub(v,ceilings[i]));
    if(requiredIndices.some(i=>cmp(targetExcessC[i],ZERO)>0))throw Error('A final removal witness violates a remaining target ceiling');
    if(removedTargetIndex!==null&&cmp(targetExcessC[removedTargetIndex],ZERO)<=0)
      throw Error('A necessary target removal must strictly violate its removed ceiling');
    work.finalConstraintChecks+=m+requiredIndices.length;
    return {coordinates,phaseProfiles,masses,targetValuesC,targetExcessC,requiredTargetIndices:requiredIndices.slice()};
  }
  const original=solve([],'original-observations');
  const common={projections,targetBounds,originalCertificate:original.certificate,limits};
  if(original.status==='incompatible')return {...common,status:'incompatible-original-model',
    conflict:null,compatibleWitness:null,history,work};
  const all=Array.from({length:k},(_,i)=>i);let complete;
  if(options.initialCertificate!==undefined){
    const certificate=options.initialCertificate,linearModel=matrix(all);
    if(!certificate||!['feasible','incompatible'].includes(certificate.status))throw Error('A complete exact target feasibility or contradiction seed is required');
    verifyThreeEpochTargetLinearCertificate(linearModel.rows,linearModel.bounds,null,certificate);
    complete={status:certificate.status,certificate,linearModel};work.verifiedInitialCertificates++;
    work.maximumConstraints=Math.max(work.maximumConstraints,linearModel.rows.length);
    history.push({purpose:'all-authored-targets',targetIndices:all.slice(),status:certificate.status,source:'verified-fresh-margin-certificate',work:null});
  }else complete=solve(all,'all-authored-targets');
  if(complete.status==='feasible')return {...common,status:'compatible-targets',conflict:null,
    compatibleWitness:witness(complete.certificate.point,all),completeCertificate:complete.certificate,history,work};
  // A nonnegative Farkas certificate remains a contradiction after removing
  // exactly those target rows with zero multipliers. All original rows stay.
  let retained=all.filter(i=>complete.certificate.dual[m+i][0]!==0n);
  if(retained.length===0)throw Error('Compatible original observations require a nonempty target conflict');
  const initialSupport=retained.slice(),excludedByCertificate=all.filter(i=>!retained.includes(i));
  let certificate={...complete.certificate,dual:[...complete.certificate.dual.slice(0,m),...retained.map(i=>complete.certificate.dual[m+i])]};
  let linearModel=matrix(retained);
  verifyThreeEpochTargetLinearCertificate(linearModel.rows,linearModel.bounds,null,certificate);
  const removals=new Map(),deleted=[];
  for(const targetIndex of initialSupport){
    if(!retained.includes(targetIndex))continue;
    const trial=retained.filter(i=>i!==targetIndex),result=solve(trial,'remove-target-'+targetIndex);
    if(result.status==='incompatible'){
      retained=trial;certificate=result.certificate;linearModel=result.linearModel;deleted.push(targetIndex);
    }else removals.set(targetIndex,result.certificate.point);
  }
  if(retained.length===0)throw Error('A target conflict cannot discard all authored ceilings');
  verifyThreeEpochTargetLinearCertificate(linearModel.rows,linearModel.bounds,null,certificate);
  const removalWitnesses=retained.map(targetIndex=>{
    const point=removals.get(targetIndex);
    if(!point)throw Error('Every final conflict member requires its own feasible removal witness');
    const remaining=retained.filter(i=>i!==targetIndex),value=witness(point,remaining,targetIndex),finalModel=matrix(remaining);
    const feasibilityCertificate={status:'feasible',point:value.coordinates};
    verifyThreeEpochTargetLinearCertificate(finalModel.rows,finalModel.bounds,null,feasibilityCertificate);
    work.removalWitnesses++;
    return {removedTargetIndex:targetIndex,...value,feasibilityCertificate};
  });
  return {...common,status:'incompatible-targets',compatibleWitness:null,
    conflict:{targetIndices:retained,initialSupport,excludedByCertificate,deletedByFeasibility:deleted,
      originalConstraintCount:m,linearModel,certificate,removalWitnesses,
      minimality:'inclusion-minimal-with-all-original-observations-mandatory'},
    history,work};
}

import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {findMinimumSkyChanges,verifyMinimumSkyChangeResult,projectOriginalSkyPattern,SKY_CHANGE_PATTERN_LIMITS} from './shade-heat-sky-change-patterns.js';
import {solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate,solveThreeEpochTargetLinearObjectives,verifyThreeEpochTargetLinearCertificate} from './shade-heat-exact-linear.js';

export const SKY_JOINT_REQUIREMENT_LIMITS=Object.freeze({...SKY_CHANGE_PATTERN_LIMITS,requirements:2,augmentedConstraints:53,witnessesPerPattern:3});
const ZERO=q(0),ONE=q(1);
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const fraction=v=>dense(v,2)&&typeof v[0]==='bigint'&&typeof v[1]==='bigint'&&v[1]>0n&&(v[0]<0n?-v[0]:v[0]).toString(2).length<=4096&&v[1].toString(2).length<=4096;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const checked=v=>{if(!fraction(v))throw Error('An exact joint-requirement fraction exceeds its allowance');return v;};
const plus=(a,b)=>checked(add(a,b)),minus=(a,b)=>checked(sub(a,b)),times=(a,b)=>checked(mul(a,b));
const dot=(a,b)=>a.reduce((s,v,i)=>plus(s,times(v,b[i])),ZERO);
const equal=(a,b)=>fraction(a)&&fraction(b)&&cmp(a,b)===0;
const vectors=(a,b)=>dense(a,b.length)&&a.every((v,i)=>equal(v,b[i]));
const integers=(a,b)=>dense(a,b.length)&&a.every((v,i)=>v===b[i]);
function admit(requirements,n){
 if(!dense(requirements,2))throw Error('Declare exactly two complete original-clock consequence requirements');
 for(const target of requirements){
  if(!keys(target,['relation','limit','lower','upper'])||!['at-most','at-least'].includes(target.relation)||!fraction(target.limit))
   throw Error('Declare a whole-interval at-most or at-least requirement with an exact limit');
  for(const row of [target.lower,target.upper])if(!keys(row,['constant','coefficients'])||!fraction(row.constant)||!dense(row.coefficients,n)||!row.coefficients.every(v=>dense(v,3)&&v.every(fraction)))
   throw Error('Retain both exact original interval endpoint rows for each requirement');
 }
}
function project(row,splits){
 const edges=[0,...splits,row.coefficients.length];
 return {constant:row.constant,coefficients:edges.slice(1).flatMap((end,phase)=>[0,1,2].map(bin=>{
  let sum=ZERO;for(let i=edges[phase];i<end;i++)sum=plus(sum,row.coefficients[i][bin]);return sum;
 }))};
}
const projectedTargets=(requirements,splits)=>requirements.map(r=>({relation:r.relation,limit:r.limit,lower:project(r.lower,splits),upper:project(r.upper,splits)}));
const sameRow=(a,b)=>a&&equal(a.constant,b.constant)&&vectors(a.coefficients,b.coefficients);
const sameProjection=(a,b)=>dense(a,b.length)&&a.every((r,i)=>r.relation===b[i].relation&&equal(r.limit,b[i].limit)&&sameRow(r.lower,b[i].lower)&&sameRow(r.upper,b[i].upper));
const pairAt=(target,point)=>({lower:plus(target.lower.constant,dot(target.lower.coefficients,point)),upper:plus(target.upper.constant,dot(target.upper.coefficients,point))});
const meets=(target,pair)=>target.relation==='at-most'?cmp(pair.upper,target.limit)<=0:cmp(pair.lower,target.limit)>=0;
function augmented(model,targets,indices){
 const rows=model.rows.map(r=>r.slice()),bounds=model.bounds.slice();
 for(const index of indices){const target=targets[index],row=target.relation==='at-most'?target.upper:target.lower;
  rows.push(target.relation==='at-most'?row.coefficients.slice():row.coefficients.map(neg));
  bounds.push(target.relation==='at-most'?minus(target.limit,row.constant):minus(row.constant,target.limit));
 }
 if(rows.length>SKY_JOINT_REQUIREMENT_LIMITS.augmentedConstraints)throw Error('The complete augmented original matrix exceeds its allowance');
 return {rows,bounds};
}
function profileFor(model,point,bands,targets){
 const phaseProfiles=Array.from({length:model.phases},(_,phase)=>{
  const rest=point.slice(phase*3,phase*3+3),profile=[minus(ONE,rest.reduce(plus,ZERO)),...rest];
  if(profile.some(v=>v[0]<0n)||cmp(profile.reduce(plus,ZERO),ONE))throw Error('A common requirement witness lost normalized nonnegative mass');
  return profile;
 });
 if(phaseProfiles.some((p,i)=>i&&vectors(p,phaseProfiles[i-1])))throw Error('A joint witness contradicts the complete simpler-class proofs');
 const productMasses=Array.from({length:4**model.phases},(_,index)=>phaseProfiles.reduce((value,p,j)=>times(value,p[Math.floor(index/4**(model.phases-j-1))%4]),ONE));
 if(cmp(productMasses.reduce(plus,ZERO),ONE))throw Error('A common requirement witness lost product unit mass');
 const observedC=model.projected.map(row=>plus(row.constant,dot(row.coefficients,point)));
 if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('A common requirement witness lost an original observation band');
 const targetPairs=targets.map(target=>pairAt(target,point));
 if(targetPairs.some(pair=>cmp(pair.lower,pair.upper)>0))throw Error('A requirement witness contradicts endpoint order');
 return {phaseProfiles,productMasses,observedC,targetPairs,requirementStatuses:targetPairs.map((pair,i)=>meets(targets[i],pair)?'met':'not-met')};
}
const initialWork=analysis=>({solves:analysis.work.solves,orderSolves:0,individualSolves:0,jointSolves:0,objectives:0,pivots:analysis.work.pivots,rationalOperations:analysis.work.rationalOperations,verifiedCertificates:analysis.work.verifiedCertificates});
function collect(work,item,kind){work.solves++;work[kind]++;work.objectives+=item.objectives;work.pivots+=item.pivots;work.rationalOperations+=item.rationalOperations;work.verifiedCertificates+=item.verifiedCertificates;}
function workFor(item,model,objectives,certificates){
 if(!item||item.variables!==model.variables||item.constraints!==model.rows.length||item.objectives!==objectives||item.verifiedCertificates!==certificates
  ||!Number.isInteger(item.pivots)||item.pivots<0||item.pivots>2048||!Number.isInteger(item.rationalOperations)||item.rationalOperations<0||item.rationalOperations>4000000)
  throw Error('A requirement solve lost its exact matrix or bounded work identity');
}
function budget(analysis,work){return {maxPivots:Math.min(2048,analysis.limits.pivots-work.pivots),maxRationalOperations:Math.min(4000000,analysis.limits.rationalOperations-work.rationalOperations)};}

/** Original observations select the complete minimum class before target rows.
 * Each condition covers the entire represented interval at its own target.
 * Individual feasible points are never combined into a joint witness.
 */
export function testMinimumSkyRequirements(observed,bands,requirements,options={}){
 admit(requirements,observed?.[0]?.coefficients?.length);
 const analysis=findMinimumSkyChanges(observed,bands,options),work=initialWork(analysis),cases=[];
 for(const [patternIndex,item]of analysis.cases.entries()){
  if(item.status!=='feasible')continue;
  const model=projectOriginalSkyPattern(observed,bands,item.splits),targets=projectedTargets(requirements,item.splits);
  const objectives=targets.map(t=>t.lower.coefficients.map((v,i)=>minus(v,t.upper.coefficients[i])));
  const order=solveThreeEpochLinearObjectives(model.rows,model.bounds,objectives,budget(analysis,work));collect(work,order.work,'orderSolves');
  if(order.status!=='feasible'||order.results.length!==2||order.results.some(c=>c.status!=='optimal'))throw Error('Every original feasible pattern needs complete endpoint-order proofs');
  const tests=order.results.map((certificate,i)=>({maximumDifference:plus(minus(targets[i].lower.constant,targets[i].upper.constant),certificate.value),certificate}));
  if(tests.some(t=>t.maximumDifference[0]>0n))throw Error('A represented requirement interval is unordered on an original-compatible profile');
  function test(indices,kind){
   const linearModel=augmented(model,targets,indices),solved=solveThreeEpochTargetLinearObjectives(linearModel.rows,linearModel.bounds,[],budget(analysis,work));collect(work,solved.work,kind);
   const witness=solved.status==='feasible'?profileFor(model,solved.certificate.point,bands,targets):null;
   if(witness&&indices.some(i=>witness.requirementStatuses[i]!=='met'))throw Error('A common profile fails one of its declared requirements');
   return {requirementIndices:[...indices],status:solved.status,linearModel,certificate:solved.certificate,witness,work:solved.work};
  }
  const individual=[test([0],'individualSolves'),test([1],'individualSolves')],joint=test([0,1],'jointSolves');
  cases.push({patternIndex,splits:[...item.splits],targetProjection:targets,
   endpointOrder:{feasibilityCertificate:order.certificate,tests,work:order.work},individual,joint});
 }
 const jointPatternIndices=cases.filter(c=>c.joint.status==='feasible').map(c=>c.patternIndex);
 const individual=analysis.status==='incompatible'?null:[0,1].map(requirementIndex=>{
  const patternIndices=cases.filter(c=>c.individual[requirementIndex].status==='feasible').map(c=>c.patternIndex);
  return {requirementIndex,status:patternIndices.length?'compatible':'incompatible',patternIndices};
 });
 const result=structuredClone({status:analysis.status==='incompatible'?'original-incompatible':jointPatternIndices.length?'joint-compatible':'joint-incompatible',
  analysis,requirements,cases,individual,jointPatternIndices,work});
 verifyMinimumSkyRequirements(observed,bands,requirements,result);return result;
}
function verifyWitness(model,bands,targets,actual,certificate){
 const expected=profileFor(model,certificate.point,bands,targets);
 if(!actual||!dense(actual.phaseProfiles,expected.phaseProfiles.length)||!actual.phaseProfiles.every((p,i)=>vectors(p,expected.phaseProfiles[i]))
  ||!vectors(actual.productMasses,expected.productMasses)||!vectors(actual.observedC,expected.observedC)||!dense(actual.targetPairs,2)
  ||!actual.targetPairs.every((p,i)=>p&&equal(p.lower,expected.targetPairs[i].lower)&&equal(p.upper,expected.targetPairs[i].upper))
  ||!integers(actual.requirementStatuses,expected.requirementStatuses))throw Error('A requirement witness lost its common profiles, original bands or paired consequences');
}
function sameRequirements(actual,expected){
 if(!dense(actual,2))return false;
 return actual.every((target,i)=>{const want=expected[i];return target.relation===want.relation&&equal(target.limit,want.limit)&&['lower','upper'].every(side=>
  target[side]&&equal(target[side].constant,want[side].constant)&&dense(target[side].coefficients,want[side].coefficients.length)
   &&target[side].coefficients.every((v,j)=>vectors(v,want[side].coefficients[j])));});
}
export function verifyMinimumSkyRequirements(observed,bands,requirements,result){
 admit(requirements,observed?.[0]?.coefficients?.length);
 if(!result||!sameRequirements(result.requirements,requirements))throw Error('The complete original consequence requirements changed');
 verifyMinimumSkyChangeResult(observed,bands,result.analysis);const analysis=result.analysis,work=initialWork(analysis);
 const original=analysis.cases.flatMap((item,patternIndex)=>item.status==='feasible'?[{item,patternIndex}]:[]);
 if(!dense(result.cases,original.length))throw Error('Every original-compatible minimum pattern must retain its joint result');
 for(const [index,{item,patternIndex}]of original.entries()){
  const actual=result.cases[index],model=projectOriginalSkyPattern(observed,bands,item.splits),targets=projectedTargets(requirements,item.splits);
  if(!actual||actual.patternIndex!==patternIndex||!integers(actual.splits,item.splits)||!sameProjection(actual.targetProjection,targets))throw Error('A requirement case lost its original minimum-pattern identity or target rows');
  const order=actual.endpointOrder;
  if(!order||!dense(order.tests,2)||order.feasibilityCertificate?.status!=='feasible')throw Error('Every target needs an original-polytope endpoint-order proof');
  verifyThreeEpochLinearCertificate(model.rows,model.bounds,null,order.feasibilityCertificate);
  for(const [i,test]of order.tests.entries()){
   const objective=targets[i].lower.coefficients.map((v,j)=>minus(v,targets[i].upper.coefficients[j]));
   if(test?.certificate?.status!=='optimal')throw Error('Endpoint order needs an optimum, not one selected profile');
   verifyThreeEpochLinearCertificate(model.rows,model.bounds,objective,test.certificate);
   const maximum=plus(minus(targets[i].lower.constant,targets[i].upper.constant),test.certificate.value);
   if(!equal(test.maximumDifference,maximum)||maximum[0]>0n)throw Error('A represented interval is not ordered on every original-compatible profile');
  }
  workFor(order.work,model,2,3);collect(work,order.work,'orderSolves');
  function test(actual,indices,kind){
   const matrix=augmented(model,targets,indices);
   if(!actual||!integers(actual.requirementIndices,indices)||!dense(actual.linearModel?.rows,matrix.rows.length)
    ||!actual.linearModel.rows.every((r,i)=>vectors(r,matrix.rows[i]))||!vectors(actual.linearModel.bounds,matrix.bounds))throw Error('A consequence certificate lost its original augmented matrix');
   if(!['feasible','incompatible'].includes(actual.status)||actual.status!==actual.certificate?.status)throw Error('A complete individual or joint feasibility certificate is required');
   verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,null,actual.certificate);
   if(actual.status==='feasible'){
    verifyWitness(model,bands,targets,actual.witness,actual.certificate);
    if(indices.some(i=>actual.witness.requirementStatuses[i]!=='met'))throw Error('The common witness fails a required whole interval');
   }else if(actual.witness!==null)throw Error('An incompatible conjunction cannot carry a witness');
   workFor(actual.work,{variables:model.variables,rows:matrix.rows},0,1);collect(work,actual.work,kind);
  }
  if(!dense(actual.individual,2))throw Error('Retain both complete individual feasibility results');
  test(actual.individual[0],[0],'individualSolves');test(actual.individual[1],[1],'individualSolves');test(actual.joint,[0,1],'jointSolves');
 }
 const jointPatternIndices=result.cases.filter(c=>c.joint.status==='feasible').map(c=>c.patternIndex);
 if(!integers(result.jointPatternIndices,jointPatternIndices)||result.status!==(analysis.status==='incompatible'?'original-incompatible':jointPatternIndices.length?'joint-compatible':'joint-incompatible'))throw Error('The complete joint-compatible pattern set changed');
 if(analysis.status==='incompatible'){if(result.individual!==null)throw Error('An absent original family has no evaluated target memberships');}
 else{
  if(!dense(result.individual,2))throw Error('Retain both global individual results');
  for(const i of [0,1]){
   const indices=result.cases.filter(c=>c.individual[i].status==='feasible').map(c=>c.patternIndex),actual=result.individual[i];
   if(!actual||actual.requirementIndex!==i||actual.status!==(indices.length?'compatible':'incompatible')||!integers(actual.patternIndices,indices))throw Error('Individual feasibility must retain every original minimum-pattern identity');
  }
 }
 if(!result.work||Object.keys(work).some(key=>result.work[key]!==work[key])||work.pivots>analysis.limits.pivots||work.rationalOperations>analysis.limits.rationalOperations)throw Error('Original inference and all new requirement solves must share one cumulative allowance');
 return true;
}

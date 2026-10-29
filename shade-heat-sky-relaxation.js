import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {findMinimumSkyChanges,verifyMinimumSkyChangeResult,projectOriginalSkyPattern,SKY_CHANGE_PATTERN_LIMITS} from './shade-heat-sky-change-patterns.js';
import {solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate,solveThreeEpochTargetLinearObjectives,verifyThreeEpochTargetLinearCertificate} from './shade-heat-exact-linear.js';

export const SKY_RELAXATION_LIMITS=Object.freeze({...SKY_CHANGE_PATTERN_LIMITS,requirements:2,augmentedConstraints:53,augmentedCoordinates:10,witnessesPerPattern:1});
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
function augmented(model,targets){
 const rows=model.rows.map(row=>[...row,ZERO]),bounds=model.bounds.slice();
 for(const target of targets){
  const endpoint=target.relation==='at-most'?target.upper:target.lower;
  rows.push([...(target.relation==='at-most'?endpoint.coefficients:endpoint.coefficients.map(neg)),neg(ONE)]);
  bounds.push(target.relation==='at-most'?minus(target.limit,endpoint.constant):minus(endpoint.constant,target.limit));
 }
 if(rows.length>SKY_RELAXATION_LIMITS.augmentedConstraints||model.variables+1>SKY_RELAXATION_LIMITS.augmentedCoordinates)throw Error('The complete common-relaxation matrix exceeds its allowance');
 return {rows,bounds};
}
function profileFor(model,point,bands,targets,relaxation){
 if(!fraction(relaxation)||relaxation[0]<0n)throw Error('Common relaxation must be a nonnegative exact Celsius amount');
 const phaseProfiles=Array.from({length:model.phases},(_,phase)=>{
  const rest=point.slice(phase*3,phase*3+3),profile=[minus(ONE,rest.reduce(plus,ZERO)),...rest];
  if(profile.some(v=>v[0]<0n)||cmp(profile.reduce(plus,ZERO),ONE))throw Error('An optimal common profile lost normalized nonnegative mass');
  return profile;
 });
 if(phaseProfiles.some((p,i)=>i&&vectors(p,phaseProfiles[i-1])))throw Error('An optimal witness contradicts the complete simpler-class proofs');
 const productMasses=Array.from({length:4**model.phases},(_,index)=>phaseProfiles.reduce((value,p,j)=>times(value,p[Math.floor(index/4**(model.phases-j-1))%4]),ONE));
 if(cmp(productMasses.reduce(plus,ZERO),ONE))throw Error('An optimal common profile lost product unit mass');
 const observedC=model.projected.map(row=>plus(row.constant,dot(row.coefficients,point)));
 if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('An optimal common profile lost an original observation band');
 const targetPairs=targets.map(target=>pairAt(target,point));
 if(targetPairs.some(pair=>cmp(pair.lower,pair.upper)>0))throw Error('An optimal common profile contradicts endpoint order');
 const violations=targetPairs.map((pair,i)=>targets[i].relation==='at-most'?minus(pair.upper,targets[i].limit):minus(targets[i].limit,pair.lower));
 const requiredRelaxation=violations.reduce((a,b)=>cmp(a,b)>=0?a:b,ZERO);
 if(!equal(requiredRelaxation,relaxation))throw Error('The optimum includes unnecessary relaxation for its own common profile');
 const relaxedLimits=targets.map(target=>target.relation==='at-most'?plus(target.limit,relaxation):minus(target.limit,relaxation));
 const requirementStatuses=targetPairs.map((pair,i)=>meets(targets[i],pair)?'met':'not-met');
 const relaxedRequirementStatuses=targetPairs.map((pair,i)=>meets({...targets[i],limit:relaxedLimits[i]},pair)?'met':'not-met');
 if(relaxedRequirementStatuses.some(status=>status!=='met'))throw Error('The optimal common profile fails a relaxed whole-interval requirement');
 return {relaxation,phaseProfiles,productMasses,observedC,targetPairs,violations,requiredRelaxation,relaxedLimits,requirementStatuses,relaxedRequirementStatuses,
  bindingRequirementIndices:violations.flatMap((value,i)=>equal(value,relaxation)?[i]:[])};
}
const initialWork=analysis=>({solves:analysis.work.solves,orderSolves:0,relaxationSolves:0,objectives:0,pivots:analysis.work.pivots,rationalOperations:analysis.work.rationalOperations,verifiedCertificates:analysis.work.verifiedCertificates});
function collect(work,item,kind){work.solves++;work[kind]++;work.objectives+=item.objectives;work.pivots+=item.pivots;work.rationalOperations+=item.rationalOperations;work.verifiedCertificates+=item.verifiedCertificates;}
function workFor(item,model,objectives,certificates){
 if(!item||item.variables!==model.variables||item.constraints!==model.rows.length||item.objectives!==objectives||item.verifiedCertificates!==certificates
  ||!Number.isInteger(item.pivots)||item.pivots<0||item.pivots>2048||!Number.isInteger(item.rationalOperations)||item.rationalOperations<0||item.rationalOperations>4000000)
  throw Error('A relaxation solve lost its exact matrix or bounded work identity');
}
function budget(analysis,work){return {maxPivots:Math.min(2048,analysis.limits.pivots-work.pivots),maxRationalOperations:Math.min(4000000,analysis.limits.rationalOperations-work.rationalOperations)};}

/** Minimize one shared nonnegative relaxation inside the already inferred
 * original minimum class. Distinct original patterns remain separate.
 */
export function minimizeMinimumSkyRelaxation(observed,bands,requirements,options={}){
 admit(requirements,observed?.[0]?.coefficients?.length);
 const analysis=findMinimumSkyChanges(observed,bands,options),work=initialWork(analysis),cases=[];
 for(const [patternIndex,item]of analysis.cases.entries()){
  if(item.status!=='feasible')continue;
  const model=projectOriginalSkyPattern(observed,bands,item.splits),targets=projectedTargets(requirements,item.splits);
  const objectives=targets.map(target=>target.lower.coefficients.map((value,i)=>minus(value,target.upper.coefficients[i])));
  const order=solveThreeEpochLinearObjectives(model.rows,model.bounds,objectives,budget(analysis,work));collect(work,order.work,'orderSolves');
  if(order.status!=='feasible'||order.results.length!==2||order.results.some(certificate=>certificate.status!=='optimal'))throw Error('Every original minimum pattern needs both complete endpoint-order proofs');
  const tests=order.results.map((certificate,i)=>({maximumDifference:plus(minus(targets[i].lower.constant,targets[i].upper.constant),certificate.value),certificate}));
  if(tests.some(test=>test.maximumDifference[0]>0n))throw Error('A represented requirement interval is unordered on an original-compatible profile');
  const matrix=augmented(model,targets),objective=[...Array.from({length:model.variables},()=>ZERO),neg(ONE)];
  const solved=solveThreeEpochTargetLinearObjectives(matrix.rows,matrix.bounds,[objective],budget(analysis,work));collect(work,solved.work,'relaxationSolves');
  if(solved.status!=='feasible'||solved.results.length!==1||solved.results[0].status!=='optimal')throw Error('Every nonempty original pattern needs a finite common-relaxation optimum');
  const certificate=solved.results[0],value=neg(certificate.value);
  if(value[0]<0n||!equal(certificate.point.at(-1),value))throw Error('The common relaxation lost its nonnegative objective coordinate');
  const witness=profileFor(model,certificate.point.slice(0,-1),bands,targets,value);
  cases.push({patternIndex,splits:[...item.splits],targetProjection:targets,
   endpointOrder:{feasibilityCertificate:order.certificate,tests,work:order.work},
   relaxation:{value,linearModel:matrix,feasibilityCertificate:solved.certificate,certificate,witness,work:solved.work}});
 }
 let minimumRelaxation=null;for(const item of cases)if(minimumRelaxation===null||cmp(item.relaxation.value,minimumRelaxation)<0)minimumRelaxation=item.relaxation.value;
 const attainingPatternIndices=minimumRelaxation===null?[]:cases.filter(item=>equal(item.relaxation.value,minimumRelaxation)).map(item=>item.patternIndex);
 const zeroCompatiblePatternIndices=cases.filter(item=>item.relaxation.value[0]===0n).map(item=>item.patternIndex);
 const result=structuredClone({status:analysis.status==='incompatible'?'original-incompatible':'minimum-common-relaxation',analysis,requirements,cases,
  minimumRelaxation,attainingPatternIndices,zeroCompatiblePatternIndices,originalRequirementsCompatible:minimumRelaxation===null?null:minimumRelaxation[0]===0n,work});
 verifyMinimumSkyRelaxation(observed,bands,requirements,result);return result;
}
function verifyWitness(model,bands,targets,actual,certificate,relaxation){
 const expected=profileFor(model,certificate.point.slice(0,-1),bands,targets,relaxation);
 if(!actual||!equal(actual.relaxation,relaxation)||!dense(actual.phaseProfiles,expected.phaseProfiles.length)
  ||!actual.phaseProfiles.every((profile,i)=>vectors(profile,expected.phaseProfiles[i]))||!vectors(actual.productMasses,expected.productMasses)
  ||!vectors(actual.observedC,expected.observedC)||!dense(actual.targetPairs,2)||!actual.targetPairs.every((pair,i)=>pair&&equal(pair.lower,expected.targetPairs[i].lower)&&equal(pair.upper,expected.targetPairs[i].upper))
  ||!vectors(actual.violations,expected.violations)||!equal(actual.requiredRelaxation,expected.requiredRelaxation)||!vectors(actual.relaxedLimits,expected.relaxedLimits)
  ||!integers(actual.requirementStatuses,expected.requirementStatuses)||!integers(actual.relaxedRequirementStatuses,expected.relaxedRequirementStatuses)
  ||!integers(actual.bindingRequirementIndices,expected.bindingRequirementIndices))
  throw Error('The optimal common profile lost its original bands, paired consequences or shared relaxation');
}
function sameRequirements(actual,expected){
 if(!dense(actual,2))return false;
 return actual.every((target,i)=>{const want=expected[i];return target.relation===want.relation&&equal(target.limit,want.limit)&&['lower','upper'].every(side=>
  target[side]&&equal(target[side].constant,want[side].constant)&&dense(target[side].coefficients,want[side].coefficients.length)
   &&target[side].coefficients.every((v,j)=>vectors(v,want[side].coefficients[j])));});
}
/** Certificate checks bind exact mathematical matrices and results.
 * Work counters are checked for arithmetic and ceiling consistency only;
 * the certificates do not independently attest actual runtime operations.
 */
export function verifyMinimumSkyRelaxation(observed,bands,requirements,result){
 admit(requirements,observed?.[0]?.coefficients?.length);
 if(!result||!sameRequirements(result.requirements,requirements))throw Error('The complete original relaxation requirements changed');
 verifyMinimumSkyChangeResult(observed,bands,result.analysis);const analysis=result.analysis,work=initialWork(analysis);
 const original=analysis.cases.flatMap((item,patternIndex)=>item.status==='feasible'?[{item,patternIndex}]:[]);
 if(!dense(result.cases,original.length))throw Error('Every original-compatible minimum pattern must retain its own optimum');
 for(const [index,{item,patternIndex}]of original.entries()){
  const actual=result.cases[index],model=projectOriginalSkyPattern(observed,bands,item.splits),targets=projectedTargets(requirements,item.splits);
  if(!actual||actual.patternIndex!==patternIndex||!integers(actual.splits,item.splits)||!sameProjection(actual.targetProjection,targets))throw Error('A relaxation case lost its original pattern or target projection');
  const order=actual.endpointOrder;
  if(!order||!dense(order.tests,2)||order.feasibilityCertificate?.status!=='feasible')throw Error('Every target needs an original-polytope endpoint-order proof');
  verifyThreeEpochLinearCertificate(model.rows,model.bounds,null,order.feasibilityCertificate);
  for(const [i,test]of order.tests.entries()){
   const objective=targets[i].lower.coefficients.map((value,j)=>minus(value,targets[i].upper.coefficients[j]));
   if(test?.certificate?.status!=='optimal')throw Error('Endpoint order needs an optimum on the original feasible polytope');
   verifyThreeEpochLinearCertificate(model.rows,model.bounds,objective,test.certificate);
   const maximum=plus(minus(targets[i].lower.constant,targets[i].upper.constant),test.certificate.value);
   if(!equal(test.maximumDifference,maximum)||maximum[0]>0n)throw Error('A represented requirement interval is not ordered throughout its original pattern');
  }
  workFor(order.work,model,2,3);collect(work,order.work,'orderSolves');
  const target=actual.relaxation,matrix=augmented(model,targets),objective=[...Array.from({length:model.variables},()=>ZERO),neg(ONE)];
  if(!target||!dense(target.linearModel?.rows,matrix.rows.length)||!target.linearModel.rows.every((row,i)=>vectors(row,matrix.rows[i]))
   ||!vectors(target.linearModel.bounds,matrix.bounds))throw Error('The common relaxation lost its original augmented matrix');
  if(target.feasibilityCertificate?.status!=='feasible'||target.certificate?.status!=='optimal')throw Error('Retain complete feasibility and optimality proofs for each original minimum pattern');
  verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,null,target.feasibilityCertificate);
  verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,objective,target.certificate);
  const value=neg(target.certificate.value);
  if(!equal(target.value,value)||value[0]<0n||!equal(target.certificate.point.at(-1),value))throw Error('The optimum lost the shared nonnegative relaxation coordinate or objective sign');
  verifyWitness(model,bands,targets,target.witness,target.certificate,value);
  workFor(target.work,{variables:model.variables+1,rows:matrix.rows},1,2);collect(work,target.work,'relaxationSolves');
 }
 let minimum=null;for(const item of result.cases)if(minimum===null||cmp(item.relaxation.value,minimum)<0)minimum=item.relaxation.value;
 const attainers=minimum===null?[]:result.cases.filter(item=>equal(item.relaxation.value,minimum)).map(item=>item.patternIndex);
 const zero=result.cases.filter(item=>item.relaxation.value[0]===0n).map(item=>item.patternIndex);
 if(result.status!==(analysis.status==='incompatible'?'original-incompatible':'minimum-common-relaxation')
  ||(minimum===null?result.minimumRelaxation!==null:!equal(result.minimumRelaxation,minimum))
  ||!integers(result.attainingPatternIndices,attainers)||!integers(result.zeroCompatiblePatternIndices,zero)
  ||result.originalRequirementsCompatible!==(minimum===null?null:minimum[0]===0n))
  throw Error('The complete minimum-relaxation value, every tied attainer or exact zero-conjunction status changed');
 if(!result.work||Object.keys(work).some(key=>result.work[key]!==work[key])||work.pivots>analysis.limits.pivots||work.rationalOperations>analysis.limits.rationalOperations)
  throw Error('Original inference and every endpoint-order/relaxation solve must share one cumulative allowance');
 return true;
}

import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {projectOriginalSkyPattern,SKY_CHANGE_PATTERN_LIMITS} from './shade-heat-sky-change-patterns.js';
import {solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate} from './shade-heat-exact-linear.js';

import {minimizeMinimumSkyRelaxation,verifyMinimumSkyRelaxation} from './shade-heat-sky-relaxation.js';
export const SKY_COVERAGE_LIMITS=Object.freeze({...SKY_CHANGE_PATTERN_LIMITS,requirements:2,witnessesPerPattern:3});
const ZERO=q(0),ONE=q(1);
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const fraction=v=>dense(v,2)&&typeof v[0]==='bigint'&&typeof v[1]==='bigint'&&v[1]>0n&&(v[0]<0n?-v[0]:v[0]).toString(2).length<=4096&&v[1].toString(2).length<=4096;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const checked=v=>{if(!fraction(v))throw Error('An exact sky-coverage fraction exceeds its allowance');return v;};
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
function profileForMaximum(model,point,bands,targets,requirementIndex,maximumViolation){
 if(!dense(point,model.variables)||!point.every(fraction)||![0,1].includes(requirementIndex)||!fraction(maximumViolation))throw Error('A residual maximizer needs its original profile coordinates and designated requirement');
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
 if(!equal(violations[requirementIndex],maximumViolation))throw Error('A residual-maximizing profile lost its designated exact objective');
 const requirementStatuses=targetPairs.map((pair,i)=>meets(targets[i],pair)?'met':'not-met');
 return {requirementIndex,maximumViolation,phaseProfiles,productMasses,observedC,targetPairs,violations,requiredRelaxation,requirementStatuses};
}

const initialWork=minimum=>({...minimum.work,coverageSolves:0,coverageObjectives:0});
function collect(work,item,kind){work.solves++;work[kind]++;work.objectives+=item.objectives;work.coverageObjectives+=item.objectives;work.pivots+=item.pivots;work.rationalOperations+=item.rationalOperations;work.verifiedCertificates+=item.verifiedCertificates;}
function workFor(item,model,objectives,certificates){
 if(!item||item.variables!==model.variables||item.constraints!==model.rows.length||item.objectives!==objectives||item.verifiedCertificates!==certificates
  ||!Number.isInteger(item.pivots)||item.pivots<0||item.pivots>2048||!Number.isInteger(item.rationalOperations)||item.rationalOperations<0||item.rationalOperations>4000000)
  throw Error('A relaxation solve lost its exact matrix or bounded work identity');
}
function budget(analysis,work){return {maxPivots:Math.min(2048,analysis.limits.pivots-work.pivots),maxRationalOperations:Math.min(4000000,analysis.limits.rationalOperations-work.rationalOperations)};}

const max=(a,b)=>cmp(a,b)>=0?a:b;
const residualObjective=target=>target.relation==='at-most'?target.upper.coefficients:target.lower.coefficients.map(neg);
const residualConstant=target=>target.relation==='at-most'?minus(target.upper.constant,target.limit):minus(target.limit,target.lower.constant);
function patternSummary(tests){
 const rawMaximumViolation=tests.map(test=>test.maximumViolation).reduce(max),allProfileRelaxation=max(ZERO,rawMaximumViolation);
 return {rawMaximumViolation,allProfileRelaxation,
  rawMaximumRequirementIndices:tests.flatMap((test,i)=>equal(test.maximumViolation,rawMaximumViolation)?[i]:[]),
  bindingRequirementIndices:tests.flatMap((test,i)=>equal(test.maximumViolation,allProfileRelaxation)?[i]:[]),
  floorActive:allProfileRelaxation[0]===0n,floorOnly:rawMaximumViolation[0]<0n};
}
function summary(minimum,cases){
 if(!cases.length)return {status:'original-incompatible',someProfileRelaxation:null,allProfileRelaxation:null,rawMaximumViolation:null,coverageGap:null,
  allProfilesMeetOriginal:null,floorActive:null,floorOnly:null,rawMaximumPairs:[],controllingPairs:[],allProfileAttainingPatternIndices:[],zeroCoverPatternIndices:[]};
 const rawMaximumViolation=cases.map(item=>item.rawMaximumViolation).reduce(max),allProfileRelaxation=max(ZERO,rawMaximumViolation),someProfileRelaxation=minimum.minimumRelaxation;
 const coverageGap=minus(allProfileRelaxation,someProfileRelaxation);
 if(coverageGap[0]<0n)throw Error('Covering every original profile cannot need less than allowing one original profile');
 const pairs=value=>cases.flatMap(item=>item.tests.flatMap((test,requirementIndex)=>equal(test.maximumViolation,value)?[{patternIndex:item.patternIndex,requirementIndex}]:[]));
 return {status:'compared-common-relaxations',someProfileRelaxation,allProfileRelaxation,rawMaximumViolation,coverageGap,
  allProfilesMeetOriginal:allProfileRelaxation[0]===0n,floorActive:allProfileRelaxation[0]===0n,floorOnly:rawMaximumViolation[0]<0n,
  rawMaximumPairs:pairs(rawMaximumViolation),controllingPairs:pairs(allProfileRelaxation),
  allProfileAttainingPatternIndices:cases.filter(item=>equal(item.allProfileRelaxation,allProfileRelaxation)).map(item=>item.patternIndex),
  zeroCoverPatternIndices:cases.filter(item=>item.allProfileRelaxation[0]===0n).map(item=>item.patternIndex)};
}
const samePairs=(a,b)=>dense(a,b.length)&&a.every((row,i)=>keys(row,['patternIndex','requirementIndex'])&&row.patternIndex===b[i].patternIndex&&row.requirementIndex===b[i].requirementIndex);

/** One complete original inference supports both existential and universal
 * questions. Each requirement maximum has its own original-profile witness.
 * Negative signed maxima are retained separately from the nonnegative floor.
 */
export function compareMinimumSkyCoverage(observed,bands,requirements,options={}){
 admit(requirements,observed?.[0]?.coefficients?.length);
 const minimum=minimizeMinimumSkyRelaxation(observed,bands,requirements,options),work=initialWork(minimum),cases=[];
 for(const item of minimum.cases){
  const model=projectOriginalSkyPattern(observed,bands,item.splits),targets=projectedTargets(requirements,item.splits);
  const objectives=targets.map(residualObjective);
  const solved=solveThreeEpochLinearObjectives(model.rows,model.bounds,objectives,budget(minimum.analysis,work));collect(work,solved.work,'coverageSolves');
  if(solved.status!=='feasible'||solved.results.length!==2||solved.results.some(c=>c.status!=='optimal'))throw Error('Every original minimum pattern needs both finite residual maxima');
  const tests=solved.results.map((certificate,requirementIndex)=>{
   const maximumViolation=plus(certificate.value,residualConstant(targets[requirementIndex]));
   return {requirementIndex,maximumViolation,certificate,witness:profileForMaximum(model,certificate.point,bands,targets,requirementIndex,maximumViolation)};
  });
  const bound=patternSummary(tests);
  if(cmp(item.relaxation.value,bound.allProfileRelaxation)>0)throw Error('A pattern universal bound fell below its same-pattern existential optimum');
  for(const test of tests)if(cmp(test.witness.requiredRelaxation,bound.allProfileRelaxation)>0||cmp(test.witness.requiredRelaxation,item.relaxation.value)<0)
   throw Error('A residual witness lost the same-pattern existence and universal bounds');
  cases.push({patternIndex:item.patternIndex,splits:[...item.splits],targetProjection:targets,
   linearModel:{rows:model.rows,bounds:model.bounds},feasibilityCertificate:solved.certificate,tests,...bound,work:solved.work});
 }
 const result=structuredClone({minimum,cases,...summary(minimum,cases),work});
 verifyMinimumSkyCoverage(observed,bands,requirements,result);return result;
}
function verifyWitness(model,bands,targets,actual,certificate,requirementIndex,maximumViolation){
 const expected=profileForMaximum(model,certificate.point,bands,targets,requirementIndex,maximumViolation);
 if(!actual||actual.requirementIndex!==requirementIndex||!equal(actual.maximumViolation,maximumViolation)
  ||!dense(actual.phaseProfiles,expected.phaseProfiles.length)||!actual.phaseProfiles.every((p,i)=>vectors(p,expected.phaseProfiles[i]))
  ||!vectors(actual.productMasses,expected.productMasses)||!vectors(actual.observedC,expected.observedC)
  ||!dense(actual.targetPairs,2)||!actual.targetPairs.every((p,i)=>p&&equal(p.lower,expected.targetPairs[i].lower)&&equal(p.upper,expected.targetPairs[i].upper))
  ||!vectors(actual.violations,expected.violations)||!equal(actual.requiredRelaxation,expected.requiredRelaxation)||!integers(actual.requirementStatuses,expected.requirementStatuses))
  throw Error('A designated residual maximizer lost its common original profile or separate requirement statuses');
}
/** Exact certificates bind the original matrices, signed maxima and witnesses.
 * Recorded work counts are checked arithmetically and against shared ceilings;
 * they are not independent operational attestation.
 */
export function verifyMinimumSkyCoverage(observed,bands,requirements,result){
 admit(requirements,observed?.[0]?.coefficients?.length);
 if(!result||!result.minimum)throw Error('Retain the complete same-source existential inquiry');
 verifyMinimumSkyRelaxation(observed,bands,requirements,result.minimum);const minimum=result.minimum,work=initialWork(minimum);
 if(!dense(result.cases,minimum.cases.length))throw Error('Retain both residual maxima for every compatible original minimum pattern');
 for(const [index,original]of minimum.cases.entries()){
  const item=result.cases[index],model=projectOriginalSkyPattern(observed,bands,original.splits),targets=projectedTargets(requirements,original.splits);
  if(!item||item.patternIndex!==original.patternIndex||!integers(item.splits,original.splits)||!sameProjection(item.targetProjection,targets))
   throw Error('A universal bound lost its same original pattern or requirement projection');
  if(!dense(item.linearModel?.rows,model.rows.length)||!item.linearModel.rows.every((row,i)=>vectors(row,model.rows[i]))||!vectors(item.linearModel.bounds,model.bounds))
   throw Error('Universal residual maxima must use the unchanged original feasible polytope');
  if(item.feasibilityCertificate?.status!=='feasible'||!dense(item.tests,2))throw Error('Both residual maxima need complete original-polytope proofs');
  verifyThreeEpochLinearCertificate(model.rows,model.bounds,null,item.feasibilityCertificate);
  for(const [requirementIndex,test]of item.tests.entries()){
   if(test?.requirementIndex!==requirementIndex||test?.certificate?.status!=='optimal')throw Error('Each signed maximum must retain its designated optimal certificate');
   verifyThreeEpochLinearCertificate(model.rows,model.bounds,residualObjective(targets[requirementIndex]),test.certificate);
   const maximumViolation=plus(test.certificate.value,residualConstant(targets[requirementIndex]));
   if(!equal(test.maximumViolation,maximumViolation))throw Error('A signed residual maximum lost its endpoint, threshold, sign or constant');
   verifyWitness(model,bands,targets,test.witness,test.certificate,requirementIndex,maximumViolation);
  }
  const bound=patternSummary(item.tests);
  if(!equal(item.rawMaximumViolation,bound.rawMaximumViolation)||!equal(item.allProfileRelaxation,bound.allProfileRelaxation)
   ||!integers(item.rawMaximumRequirementIndices,bound.rawMaximumRequirementIndices)||!integers(item.bindingRequirementIndices,bound.bindingRequirementIndices)
   ||item.floorActive!==bound.floorActive||item.floorOnly!==bound.floorOnly)throw Error('A pattern lost its signed maximum, nonnegative floor or exact binding ties');
  if(cmp(original.relaxation.value,bound.allProfileRelaxation)>0)throw Error('The same-pattern existential optimum exceeds its all-profile amount');
  for(const test of item.tests)if(cmp(test.witness.requiredRelaxation,bound.allProfileRelaxation)>0||cmp(test.witness.requiredRelaxation,original.relaxation.value)<0)
   throw Error('A separate residual maximizer lies outside its same-pattern relaxation bounds');
  workFor(item.work,model,2,3);collect(work,item.work,'coverageSolves');
 }
 const expected=summary(minimum,result.cases);
 for(const key of ['someProfileRelaxation','allProfileRelaxation','rawMaximumViolation','coverageGap'])
  if(expected[key]===null?result[key]!==null:!equal(result[key],expected[key]))throw Error('The complete original-family relaxation comparison changed');
 for(const key of ['status','allProfilesMeetOriginal','floorActive','floorOnly'])if(result[key]!==expected[key])throw Error('The universal status or nonnegative-floor meaning changed');
 for(const key of ['rawMaximumPairs','controllingPairs'])if(!samePairs(result[key],expected[key]))throw Error('Retain every exact maximum/binding pattern-requirement pair without inventing floor-only ties');
 for(const key of ['allProfileAttainingPatternIndices','zeroCoverPatternIndices'])if(!integers(result[key],expected[key]))throw Error('Retain every clamped-bound attaining pattern, including exact zero ties');
 if(!result.work||Object.keys(work).some(key=>result.work[key]!==work[key])||work.pivots>minimum.analysis.limits.pivots||work.rationalOperations>minimum.analysis.limits.rationalOperations)
  throw Error('One original inference and all existential, order and universal solves must share one cumulative allowance');
 return true;
}

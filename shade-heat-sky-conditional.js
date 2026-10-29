import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {findMinimumSkyChanges,verifyMinimumSkyChangeResult,projectOriginalSkyPattern,SKY_CHANGE_PATTERN_LIMITS} from './shade-heat-sky-change-patterns.js';
import {solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate,solveThreeEpochTargetLinearObjectives,verifyThreeEpochTargetLinearCertificate} from './shade-heat-exact-linear.js';

export const SKY_CONDITIONAL_LIMITS=Object.freeze({...SKY_CHANGE_PATTERN_LIMITS,requirements:2,conditionalConstraints:53,conditionalObjectivesPerCall:1,witnessesPerPattern:2});
const ZERO=q(0),ONE=q(1);
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const fraction=v=>dense(v,2)&&typeof v[0]==='bigint'&&typeof v[1]==='bigint'&&v[1]>0n&&(v[0]<0n?-v[0]:v[0]).toString(2).length<=4096&&v[1].toString(2).length<=4096;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const checked=v=>{if(!fraction(v))throw Error('A conditioned coefficient exceeds the unchanged exact solver capacity');return v;};
const plus=(a,b)=>checked(add(a,b)),minus=(a,b)=>checked(sub(a,b)),times=(a,b)=>checked(mul(a,b));
const dot=(a,b)=>a.reduce((s,v,i)=>plus(s,times(v,b[i])),ZERO);
const equal=(a,b)=>fraction(a)&&fraction(b)&&cmp(a,b)===0;
const vectors=(a,b)=>dense(a,b.length)&&a.every((v,i)=>equal(v,b[i]));
const integers=(a,b)=>dense(a,b.length)&&a.every((v,i)=>v===b[i]);
function admitPair(pair,n){
 if(!keys(pair,['lower','upper']))throw Error('Retain both complete original consequence endpoint rows');
 for(const row of [pair.lower,pair.upper])if(!keys(row,['constant','coefficients'])||!fraction(row.constant)||!dense(row.coefficients,n)||!row.coefficients.every(v=>dense(v,3)&&v.every(fraction)))
  throw Error('Retain a bounded exact coefficient for every original interval and bin');
}
function admit(requirements,allowance,consequence,n){
 if(!dense(requirements,2)||!fraction(allowance)||allowance[0]<0n)throw Error('Declare two original requirements and one exact nonnegative conditional allowance');
 for(const target of requirements){
  if(!keys(target,['relation','limit','lower','upper'])||!['at-most','at-least'].includes(target.relation)||!fraction(target.limit))throw Error('Declare two complete original whole-interval requirements');
  admitPair({lower:target.lower,upper:target.upper},n);
 }
 admitPair(consequence,n);
 // This inquiry solves new conditioned matrices. Its derived rows must fit the
 // maintained solver, even when the solve-free allowance inspector accepts them.
 return requirements.map(r=>({...r,limit:r.relation==='at-most'?plus(r.limit,allowance):minus(r.limit,allowance)}));
}
function project(row,splits){
 const edges=[0,...splits,row.coefficients.length];
 return {constant:row.constant,coefficients:edges.slice(1).flatMap((end,phase)=>[0,1,2].map(bin=>{
  let sum=ZERO;for(let i=edges[phase];i<end;i++)sum=plus(sum,row.coefficients[i][bin]);return sum;
 }))};
}
const projectPair=(pair,splits)=>({lower:project(pair.lower,splits),upper:project(pair.upper,splits)});
const projectRequirements=(requirements,splits)=>requirements.map(r=>({relation:r.relation,limit:r.limit,...projectPair(r,splits)}));
const sameRow=(a,b)=>a&&equal(a.constant,b.constant)&&vectors(a.coefficients,b.coefficients);
const samePairRows=(a,b)=>a&&sameRow(a.lower,b.lower)&&sameRow(a.upper,b.upper);
const sameProjection=(a,b)=>dense(a,b.length)&&a.every((r,i)=>r.relation===b[i].relation&&equal(r.limit,b[i].limit)&&samePairRows(r,b[i]));
const sameOriginalPair=(a,b)=>a&&['lower','upper'].every(side=>a[side]&&equal(a[side].constant,b[side].constant)&&dense(a[side].coefficients,b[side].coefficients.length)&&a[side].coefficients.every((v,i)=>vectors(v,b[side].coefficients[i])));
const sameRequirements=(a,b)=>dense(a,b.length)&&a.every((r,i)=>r.relation===b[i].relation&&equal(r.limit,b[i].limit)&&sameOriginalPair(r,b[i]));
const pairAt=(target,point)=>({lower:plus(target.lower.constant,dot(target.lower.coefficients,point)),upper:plus(target.upper.constant,dot(target.upper.coefficients,point))});
const meets=(target,pair)=>target.relation==='at-most'?cmp(pair.upper,target.limit)<=0:cmp(pair.lower,target.limit)>=0;
function conditionalMatrix(model,targets){
 const rows=model.rows.map(r=>r.slice()),bounds=model.bounds.slice();
 for(const target of targets){const row=target.relation==='at-most'?target.upper:target.lower;
  rows.push(target.relation==='at-most'?row.coefficients.slice():row.coefficients.map(neg));
  bounds.push(target.relation==='at-most'?minus(target.limit,row.constant):minus(row.constant,target.limit));
 }
 if(rows.length>SKY_CONDITIONAL_LIMITS.conditionalConstraints)throw Error('The complete conditioned matrix exceeds its row capacity');
 return {rows,bounds};
}
function profileFor(model,point,bands,original,selected,consequence,role){
 const phaseProfiles=Array.from({length:model.phases},(_,phase)=>{
  const rest=point.slice(phase*3,phase*3+3),profile=[minus(ONE,rest.reduce(plus,ZERO)),...rest];
  if(profile.some(v=>v[0]<0n)||cmp(profile.reduce(plus,ZERO),ONE))throw Error('A conditional witness lost normalized nonnegative profile mass');
  return profile;
 });
 if(phaseProfiles.some((p,i)=>i&&vectors(p,phaseProfiles[i-1])))throw Error('A conditional witness contradicts the original simpler-class proofs');
 const productMasses=Array.from({length:4**model.phases},(_,index)=>phaseProfiles.reduce((v,p,j)=>times(v,p[Math.floor(index/4**(model.phases-j-1))%4]),ONE));
 if(cmp(productMasses.reduce(plus,ZERO),ONE))throw Error('A conditional witness lost product unit mass');
 const observedC=model.projected.map(row=>plus(row.constant,dot(row.coefficients,point)));
 if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('A conditional witness lost an original observation');
 const requirementPairs=original.map(t=>pairAt(t,point)),consequencePair=pairAt(consequence,point);
 if([...requirementPairs,consequencePair].some(p=>cmp(p.lower,p.upper)>0))throw Error('A conditional witness contradicts certified endpoint order');
 const originalRequirementStatuses=requirementPairs.map((p,i)=>meets(original[i],p)?'met':'not-met'),selectedRequirementStatuses=requirementPairs.map((p,i)=>meets(selected[i],p)?'met':'not-met');
 if(selectedRequirementStatuses.some(s=>s!=='met'))throw Error('One common extreme profile must satisfy both selected requirements');
 const violations=requirementPairs.map((p,i)=>original[i].relation==='at-most'?minus(p.upper,original[i].limit):minus(original[i].limit,p.lower));
 const requiredRelaxation=violations.reduce((a,b)=>cmp(a,b)>=0?a:b,ZERO);
 return {role,phaseProfiles,productMasses,observedC,requirementPairs,originalRequirementStatuses,selectedRequirementStatuses,violations,requiredRelaxation,consequencePair};
}
const initialWork=analysis=>({solves:analysis.work.solves,requirementOrderSolves:0,conditionalOrderSolves:0,lowerSolves:0,upperSolves:0,objectives:0,pivots:analysis.work.pivots,rationalOperations:analysis.work.rationalOperations,verifiedCertificates:analysis.work.verifiedCertificates});
function collect(work,item,kind){work.solves++;work[kind]++;work.objectives+=item.objectives;work.pivots+=item.pivots;work.rationalOperations+=item.rationalOperations;work.verifiedCertificates+=item.verifiedCertificates;}
function budget(analysis,work){return {maxPivots:Math.min(2048,analysis.limits.pivots-work.pivots),maxRationalOperations:Math.min(4000000,analysis.limits.rationalOperations-work.rationalOperations)};}
function workFor(item,model,objectives,certificates){
 const n=model.rows[0].length,m=model.rows.length,negative=model.bounds.filter(v=>v[0]<0n).length;
 if(!item||item.variables!==n||item.constraints!==m||item.objectives!==objectives||item.verifiedCertificates!==certificates
  ||!Number.isInteger(item.pivots)||item.pivots<0||item.pivots>2048||!Number.isInteger(item.rationalOperations)||item.rationalOperations<0||item.rationalOperations>4000000
  ||!['phaseIPivots','artificialRemovalPivots','objectivePivots'].every(k=>Number.isInteger(item[k])&&item[k]>=0)
  ||item.pivots!==item.phaseIPivots+item.artificialRemovalPivots+item.objectivePivots||item.artificialVariables!==negative||item.maximumTableauCells!==m*(n+m+negative+1))
  throw Error('A conditional solve lost its exact matrix or bounded work identity');
}
function summarize(cases,originalStatus){
 const surviving=cases.filter(c=>c.status==='feasible'),conditionalPatternIndices=surviving.map(c=>c.patternIndex),conditionalExcludedPatternIndices=cases.filter(c=>c.status==='incompatible').map(c=>c.patternIndex);
 const sorted=surviving.slice().sort((a,b)=>cmp(a.range.lower,b.range.lower)||cmp(a.range.upper,b.range.upper)||a.patternIndex-b.patternIndex),components=[];
 for(const c of sorted){
  const last=components.at(-1);
  if(!last||cmp(c.range.lower,last.upper)>0)components.push({lower:c.range.lower,upper:c.range.upper,patternIndices:[c.patternIndex]});
  else{last.patternIndices.push(c.patternIndex);if(cmp(c.range.upper,last.upper)>0)last.upper=c.range.upper;}
 }
 for(const component of components){
  component.patternIndices.sort((a,b)=>a-b);
  const members=surviving.filter(c=>component.patternIndices.includes(c.patternIndex));
  component.lowerAttainingPatternIndices=members.filter(c=>cmp(c.range.lower,component.lower)===0).map(c=>c.patternIndex);
  component.upperAttainingPatternIndices=members.filter(c=>cmp(c.range.upper,component.upper)===0).map(c=>c.patternIndex);
 }
 const hull=components.length?{lower:components[0].lower,upper:components.at(-1).upper}:null;
 return {status:originalStatus==='incompatible'?'original-incompatible':surviving.length?'conditional-range':'conditional-empty',
  conditionalPatternIndices,conditionalExcludedPatternIndices,
  hull,lowerAttainingPatternIndices:hull?surviving.filter(c=>cmp(c.range.lower,hull.lower)===0).map(c=>c.patternIndex):[],
  upperAttainingPatternIndices:hull?surviving.filter(c=>cmp(c.range.upper,hull.upper)===0).map(c=>c.patternIndex):[],
  components,gaps:components.slice(1).map((next,i)=>({lower:components[i].upper,upper:next.lower,lowerIncluded:false,upperIncluded:false}))};
}

/** The original minimum class is inferred once. Both fixed-allowance rows are
 * appended to each original-compatible polytope, never separately projected.
 * The maintained augmented solver accepts one objective per call.
 */
export function conditionMinimumSkyConsequence(observed,bands,requirements,allowance,consequence,options={}){
 const selected=admit(requirements,allowance,consequence,observed?.[0]?.coefficients?.length);
 const analysis=findMinimumSkyChanges(observed,bands,options),work=initialWork(analysis),cases=[];
 // Preflight every derived original-pattern row before any conditional solve.
 const prepared=analysis.cases.flatMap((item,patternIndex)=>{
  if(item.status!=='feasible')return [];
  const model=projectOriginalSkyPattern(observed,bands,item.splits),originalTargets=projectRequirements(requirements,item.splits),selectedTargets=projectRequirements(selected,item.splits),target=projectPair(consequence,item.splits);
  return [{item,patternIndex,model,originalTargets,selectedTargets,target,linearModel:conditionalMatrix(model,selectedTargets)}];
 });
 for(const {item,patternIndex,model,originalTargets,selectedTargets,target,linearModel}of prepared){
  const objectives=originalTargets.map(t=>t.lower.coefficients.map((v,i)=>minus(v,t.upper.coefficients[i])));
  const order=solveThreeEpochLinearObjectives(model.rows,model.bounds,objectives,budget(analysis,work));collect(work,order.work,'requirementOrderSolves');
  if(order.status!=='feasible'||order.results.length!==2||order.results.some(c=>c.status!=='optimal'))throw Error('Both original requirements need complete original-polytope endpoint-order proofs');
  const tests=order.results.map((certificate,i)=>({requirementIndex:i,maximumDifference:plus(minus(originalTargets[i].lower.constant,originalTargets[i].upper.constant),certificate.value),certificate}));
  if(tests.some(t=>t.maximumDifference[0]>0n))throw Error('A represented requirement is unordered in the original compatible family');
  const objective=target.lower.coefficients.map((v,i)=>minus(v,target.upper.coefficients[i]));
  const conditional=solveThreeEpochTargetLinearObjectives(linearModel.rows,linearModel.bounds,[objective],budget(analysis,work));collect(work,conditional.work,'conditionalOrderSolves');
  const entry={patternIndex,splits:[...item.splits],originalRequirementProjection:originalTargets,selectedRequirementProjection:selectedTargets,consequenceProjection:target,
   requirementOrder:{feasibilityCertificate:order.certificate,tests,work:order.work},linearModel,status:conditional.status,
   feasibilityCertificate:conditional.certificate,conditionedOrder:null,conditionedOrderWork:conditional.work,lower:null,upper:null,range:null};
  if(conditional.status==='feasible'){
   if(conditional.results.length!==1||conditional.results[0].status!=='optimal')throw Error('The conditioned consequence needs a complete endpoint-order optimum');
   const certificate=conditional.results[0],maximumDifference=plus(minus(target.lower.constant,target.upper.constant),certificate.value);
   if(maximumDifference[0]>0n)throw Error('The consequence interval is unordered on a conditionally compatible profile');
   entry.conditionedOrder={scope:'conditioned-polytope',maximumDifference,certificate};
   for(const role of ['lower','upper']){
    const objective=role==='lower'?target.lower.coefficients.map(neg):target.upper.coefficients.slice();
    const solved=solveThreeEpochTargetLinearObjectives(linearModel.rows,linearModel.bounds,[objective],budget(analysis,work));collect(work,solved.work,role+'Solves');
    if(solved.status!=='feasible'||solved.results.length!==1||solved.results[0].status!=='optimal')throw Error('A bounded conditional extreme lost its complete exact optimum');
    const certificate=solved.results[0],value=role==='lower'?minus(target.lower.constant,certificate.value):plus(target.upper.constant,certificate.value);
    const witness=profileFor(model,certificate.point,bands,originalTargets,selectedTargets,target,role);
    if(cmp(witness.consequencePair[role],value)||cmp(witness.requiredRelaxation,allowance)>0)throw Error('An extreme profile lost its conditional endpoint or allowance');
    entry[role]={value,feasibilityCertificate:solved.certificate,certificate,witness,work:solved.work};
   }
   entry.range={lower:entry.lower.value,upper:entry.upper.value};
   if(cmp(entry.range.lower,entry.range.upper)>0)throw Error('A complete conditional interval cannot be reversed');
  }else if(conditional.status!=='incompatible'||conditional.results.length)throw Error('Retain complete conditional feasibility or incompatibility');
  cases.push(entry);
 }
 const result=structuredClone({analysis,requirements,allowance,selectedRequirements:selected,consequence,cases,...summarize(cases,analysis.status),work});
 verifyMinimumSkyConditionalConsequence(observed,bands,requirements,allowance,consequence,result);return result;
}
function verifyWitness(model,bands,original,selected,target,role,actual,certificate,allowance){
 const expected=profileFor(model,certificate.point,bands,original,selected,target,role);
 if(!actual||actual.role!==role||!dense(actual.phaseProfiles,expected.phaseProfiles.length)||!actual.phaseProfiles.every((p,i)=>vectors(p,expected.phaseProfiles[i]))
  ||!vectors(actual.productMasses,expected.productMasses)||!vectors(actual.observedC,expected.observedC)
  ||!dense(actual.requirementPairs,2)||!actual.requirementPairs.every((p,i)=>p&&equal(p.lower,expected.requirementPairs[i].lower)&&equal(p.upper,expected.requirementPairs[i].upper))
  ||!integers(actual.originalRequirementStatuses,expected.originalRequirementStatuses)||!integers(actual.selectedRequirementStatuses,expected.selectedRequirementStatuses)
  ||!vectors(actual.violations,expected.violations)||!equal(actual.requiredRelaxation,expected.requiredRelaxation)||cmp(expected.requiredRelaxation,allowance)>0
  ||!actual.consequencePair||!equal(actual.consequencePair.lower,expected.consequencePair.lower)||!equal(actual.consequencePair.upper,expected.consequencePair.upper))
  throw Error('A conditional extreme lost its same original profile, requirements or consequence');
}
function sameSummary(actual,expected){
 if(actual.status!==expected.status||!integers(actual.conditionalPatternIndices,expected.conditionalPatternIndices)||!integers(actual.conditionalExcludedPatternIndices,expected.conditionalExcludedPatternIndices)
  ||!integers(actual.lowerAttainingPatternIndices,expected.lowerAttainingPatternIndices)||!integers(actual.upperAttainingPatternIndices,expected.upperAttainingPatternIndices)
  ||(expected.hull===null?actual.hull!==null:!actual.hull||!equal(actual.hull.lower,expected.hull.lower)||!equal(actual.hull.upper,expected.hull.upper))
  ||!dense(actual.components,expected.components.length)||!actual.components.every((c,i)=>{const e=expected.components[i];return c&&equal(c.lower,e.lower)&&equal(c.upper,e.upper)&&integers(c.patternIndices,e.patternIndices)&&integers(c.lowerAttainingPatternIndices,e.lowerAttainingPatternIndices)&&integers(c.upperAttainingPatternIndices,e.upperAttainingPatternIndices);})
  ||!dense(actual.gaps,expected.gaps.length)||!actual.gaps.every((g,i)=>g&&equal(g.lower,expected.gaps[i].lower)&&equal(g.upper,expected.gaps[i].upper)&&g.lowerIncluded===false&&g.upperIncluded===false))
  throw Error('The complete conditional family lost a component, exact tie, gap or original pattern identity');
}
export function verifyMinimumSkyConditionalConsequence(observed,bands,requirements,allowance,consequence,result){
 const selected=admit(requirements,allowance,consequence,observed?.[0]?.coefficients?.length);
 if(!result||!sameRequirements(result.requirements,requirements)||!equal(result.allowance,allowance)||!sameRequirements(result.selectedRequirements,selected)||!sameOriginalPair(result.consequence,consequence))throw Error('The fixed original requirements, exact allowance or conditional consequence changed');
 verifyMinimumSkyChangeResult(observed,bands,result.analysis);const analysis=result.analysis,work=initialWork(analysis);
 const originals=analysis.cases.flatMap((item,patternIndex)=>item.status==='feasible'?[{item,patternIndex}]:[]);
 if(!dense(result.cases,originals.length))throw Error('Every original minimum pattern must retain its conditioned result');
 for(const [index,{item,patternIndex}]of originals.entries()){
  const actual=result.cases[index],model=projectOriginalSkyPattern(observed,bands,item.splits),original=projectRequirements(requirements,item.splits),targets=projectRequirements(selected,item.splits),target=projectPair(consequence,item.splits),matrix=conditionalMatrix(model,targets);
  if(!actual||actual.patternIndex!==patternIndex||!integers(actual.splits,item.splits)||!sameProjection(actual.originalRequirementProjection,original)||!sameProjection(actual.selectedRequirementProjection,targets)||!samePairRows(actual.consequenceProjection,target)
   ||!dense(actual.linearModel?.rows,matrix.rows.length)||!actual.linearModel.rows.every((r,i)=>vectors(r,matrix.rows[i]))||!vectors(actual.linearModel.bounds,matrix.bounds))
   throw Error('A conditional case lost its original pattern, target or both conditioned rows');
  const order=actual.requirementOrder;
  if(!order||!dense(order.tests,2)||order.feasibilityCertificate?.status!=='feasible')throw Error('Retain both original requirement endpoint-order proofs');
  verifyThreeEpochLinearCertificate(model.rows,model.bounds,null,order.feasibilityCertificate);
  for(const [i,test]of order.tests.entries()){
   const objective=original[i].lower.coefficients.map((v,j)=>minus(v,original[i].upper.coefficients[j]));
   if(test?.requirementIndex!==i||test.certificate?.status!=='optimal')throw Error('An original requirement order proof changed');
   verifyThreeEpochLinearCertificate(model.rows,model.bounds,objective,test.certificate);
   const maximum=plus(minus(original[i].lower.constant,original[i].upper.constant),test.certificate.value);
   if(!equal(test.maximumDifference,maximum)||maximum[0]>0n)throw Error('An original requirement interval is unordered');
  }
  workFor(order.work,model,2,3);collect(work,order.work,'requirementOrderSolves');
  if(!['feasible','incompatible'].includes(actual.status)||actual.feasibilityCertificate?.status!==actual.status)throw Error('Every conditioned original pattern needs a complete feasibility or Farkas proof');
  verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,null,actual.feasibilityCertificate);
  workFor(actual.conditionedOrderWork,matrix,1,actual.status==='feasible'?2:1);collect(work,actual.conditionedOrderWork,'conditionalOrderSolves');
  if(actual.status==='incompatible'){
   if(actual.conditionedOrder!==null||actual.lower!==null||actual.upper!==null||actual.range!==null||actual.conditionedOrderWork.objectivePivots!==0)throw Error('An empty conditioned pattern cannot supply a range or profile');
   continue;
  }
  const orderObjective=target.lower.coefficients.map((v,i)=>minus(v,target.upper.coefficients[i])),conditioned=actual.conditionedOrder;
  if(conditioned?.scope!=='conditioned-polytope'||conditioned.certificate?.status!=='optimal')throw Error('The consequence needs an explicit conditioned-polytope endpoint-order proof');
  verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,orderObjective,conditioned.certificate);
  const maximum=plus(minus(target.lower.constant,target.upper.constant),conditioned.certificate.value);
  if(!equal(conditioned.maximumDifference,maximum)||maximum[0]>0n)throw Error('The conditional consequence endpoints are unordered');
  for(const role of ['lower','upper']){
   const entry=actual[role],objective=role==='lower'?target.lower.coefficients.map(neg):target.upper.coefficients.slice();
   if(entry?.feasibilityCertificate?.status!=='feasible'||entry.certificate?.status!=='optimal')throw Error('Retain separate complete conditional lower and upper proofs');
   verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,null,entry.feasibilityCertificate);
   verifyThreeEpochTargetLinearCertificate(matrix.rows,matrix.bounds,objective,entry.certificate);
   const value=role==='lower'?minus(target.lower.constant,entry.certificate.value):plus(target.upper.constant,entry.certificate.value);
   if(!equal(entry.value,value))throw Error('A conditional extreme lost its signed objective or constant');
   verifyWitness(model,bands,original,targets,target,role,entry.witness,entry.certificate,allowance);
   if(!equal(entry.witness.consequencePair[role],value))throw Error('A retained conditional profile does not attain its endpoint');
   workFor(entry.work,matrix,1,2);collect(work,entry.work,role+'Solves');
  }
  if(!actual.range||!equal(actual.range.lower,actual.lower.value)||!equal(actual.range.upper,actual.upper.value)||cmp(actual.range.lower,actual.range.upper)>0)throw Error('A conditional pattern lost its complete closed interval');
 }
 sameSummary(result,summarize(result.cases,analysis.status));
 if(!result.work||Object.keys(work).some(k=>result.work[k]!==work[k])||work.pivots>analysis.limits.pivots||work.rationalOperations>analysis.limits.rationalOperations)throw Error('Original inference and all conditional objectives must share one bounded cumulative allowance');
 return true;
}

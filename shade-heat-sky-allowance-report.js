import {createSkyAllowanceModel,projectSkyAllowance} from './shade-heat-sky-allowance.js';
import {rational as q,sub,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {sameSkyData} from './shade-heat-timed-reading-source.js';

const bindings=new WeakSet(),integer=/^-?\d+$/,positive=/^\d+$/;
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
function ensure(condition,message){if(!condition)throw Error(message);}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function revive(value){
 if(Array.isArray(value)){
  if(value.length===2&&value.every(x=>typeof x==='string')&&integer.test(value[0])&&positive.test(value[1]))return value.map(BigInt);
  return value.map(revive);
 }
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,revive(item)]));
 return value;
}
function exact(value){
 const e=value?.exact;
 ensure(e&&typeof e.numerator==='string'&&typeof e.denominator==='string'&&integer.test(e.numerator)&&positive.test(e.denominator)&&e.numerator.length<=1235&&e.denominator.length<=1234,'A retained replay lost its bounded exact fraction');
 const out=[BigInt(e.numerator),BigInt(e.denominator)];
 ensure(out[1]>0n&&out[0].toString(2).replace('-','').length<=4096&&out[1].toString(2).length<=4096,'A retained replay exceeds its exact fraction capacity');
 return out;
}
function equal(value,want,message){ensure(cmp(value,want)===0,message);}
const meets=(relation,pair,limit)=>relation==='at-most'?cmp(pair.upper,limit)<=0:cmp(pair.lower,limit)>=0;
const status=(relation,pair,limit)=>meets(relation,pair,limit)?'met':'not-met';
function profileVector(shown,expected,message){
 ensure(dense(shown,expected.length),message);
 shown.forEach((v,i)=>equal(exact(v),expected[i],message));
}

/** Bind the complete verified represented family to the retained profile and
 * replay identities. Numerical pairs are reconstructed from original replay
 * endpoints, without performing another thermal calculation.
 */
export function createSkyAllowanceReport(result){
 const {investigation,report:r}=result??{},e=r?.exactEvidence;
 ensure(investigation&&e&&sameSkyData(r.query,investigation.query)&&dense(r.requirements,2)&&dense(investigation.query.requirements,2),'Retain the complete original source and its two unchanged requirements');
 const observed=revive(e.observedIntervalRows),bands=revive(e.bands),requirements=revive(e.requirementIntervalRows),coverage=revive(e.result);
 const model=createSkyAllowanceModel(observed,bands,requirements,coverage);
 ensure(r.coverageStatus===model.status&&r.minimumChanges===model.minimumChanges&&dense(r.alternatives,model.patterns.length),'The allowance view lost the complete original minimum family');
 ensure(dense(r.readings,investigation.readings.length)&&dense(bands,investigation.readings.length),'The allowance view lost original observation identities');
 for(const [i,input]of investigation.readings.entries()){
  const reading=input.query.reading,shown=r.readings[i];
  ensure(shown.recordIndex===undefined||shown.recordIndex===i,'An original reading changed identity');
  ensure(shown.utc===reading.utc&&shown.store===reading.store&&shown.cellIndex===reading.cellIndex,'An original reading changed its target');
  equal(bands[i].lower,sub(q(reading.temperatureC),q(reading.halfWidthC)),'An original observation band changed');
  // Subtracting a negative binary64 half width uses the same exact rational.
  equal(bands[i].upper,sub(q(reading.temperatureC),q(-reading.halfWidthC)),'An original observation band changed');
 }
 const targets=r.requirements.map((target,i)=>{
  const declared=investigation.query.requirements[i];
  ensure(Object.entries(declared).every(([key,value])=>sameSkyData(target[key],value))&&target.requirementIndex===i,'An original requirement changed its declaration or identity');
  ensure(target.relation===requirements[i].relation&&Number.isInteger(target.sourceIndex)&&target.sourceIndex>=0&&Number.isInteger(target.originalIndex)&&target.originalIndex>=0&&r.originalTimes[target.originalIndex]?.utc===target.utc,'A requirement lost its original receiver or clock');
  equal(q(declared.differenceC),requirements[i].limit,'An original requirement threshold changed');
  equal(exact(target.limitC),requirements[i].limit,'A displayed original threshold changed');
  return {requirementIndex:i,relation:target.relation,limit:[...model.requirements[i].limit],sourceIndex:target.sourceIndex,receiverReadingIndex:target.receiverReadingIndex,originalIndex:target.originalIndex,utc:target.utc,store:target.store,source:target.source};
 });
 const patterns=model.patterns.map((pattern,pIndex)=>{
  const alternative=r.alternatives[pIndex],some=coverage.minimum.cases[pIndex],all=coverage.cases[pIndex];
  ensure(alternative.patternIndex===pattern.patternIndex&&sameSkyData(alternative.splitAfterIntervals,pattern.splits)&&dense(alternative.maxima,2),'A retained pattern or role was missing, reordered or reassigned');
  equal(exact(alternative.someProfileRelaxationC),pattern.someProfileRelaxation,'A pattern minimum changed');
  equal(exact(alternative.allProfileRelaxationC),pattern.allProfileRelaxation,'A pattern coverage bound changed');
  const witnesses=[alternative.someProfile,...alternative.maxima.map((m,i)=>{ensure(m.requirementIndex===i,'A maximum role changed identity');equal(exact(m.maximumViolationC),all.tests[i].maximumViolation,'A designated maximum changed');return m.witness;})];
  const numerical=witnesses.map((w,wIndex)=>{
   const retained=pattern.witnesses[wIndex],proof=wIndex===0?some.relaxation.witness:all.tests[wIndex-1].witness;
   ensure(w?.patternIndex===pattern.patternIndex&&w.role===retained.role&&w.requirementIndex===retained.requirementIndex&&dense(w.requirements,2),'A retained profile lost its pattern and role identity');
   ensure(dense(w.phaseProfiles,proof.phaseProfiles.length),'A retained profile lost a chronological phase');
   w.phaseProfiles.forEach((v,i)=>profileVector(v,proof.phaseProfiles[i],'A retained chronological profile changed'));
   profileVector(w.productMasses,proof.productMasses,'A retained profile product changed');
   profileVector(w.observedC,proof.observedC,'A retained profile observation changed');
   equal(exact(w.requiredRelaxationC),retained.requiredRelaxation,'A retained profile allowance changed');
   if(retained.maximumViolation===null)ensure(w.maximumViolationC===null,'An existential profile acquired a maximum role');
   else equal(exact(w.maximumViolationC),retained.maximumViolation,'A maximum profile changed its signed maximum');
   ensure(Array.isArray(w.originalReplays)&&w.originalReplays.length===r.work.uniqueSources,'A retained profile lost an original receiver replay');
   const pairs=targets.map((target,i)=>{
    const replay=w.originalReplays[target.sourceIndex],row=replay?.originalCourse?.[target.originalIndex],stored=w.requirements[i],component=target.store;
    ensure(replay?.sourceIndex===target.sourceIndex&&row?.utc===target.utc&&row.index===target.originalIndex&&stored.requirementIndex===i,'A retained requirement lost its original replay endpoint');
    const represented={lower:sub(exact(row.additiveC.proposal.lower[component]),exact(row.additiveC.existing.upper[component])),upper:sub(exact(row.additiveC.proposal.upper[component]),exact(row.additiveC.existing.lower[component]))};
    const originalPair={lower:sub(q(row.originalC.proposal.lower[component]),q(row.originalC.existing.upper[component])),upper:sub(q(row.originalC.proposal.upper[component]),q(row.originalC.existing.lower[component]))};
    for(const side of ['lower','upper']){
     equal(represented[side],retained.targetPairs[i][side],'A selected exact pair lost its same-profile replay identity');
     equal(exact(stored.representedPairC[side]),represented[side],'A stored represented pair changed');
     equal(exact(stored.originalNumericalPairC[side]),originalPair[side],'A stored numerical pair changed');
    }
    equal(exact(stored.originalLimitC),target.limit,'A retained role changed an original threshold');
    ensure(stored.representedStatus===retained.originalStatuses[i]&&stored.originalNumericalStatus===status(target.relation,originalPair,target.limit),'A retained original status changed');
    return originalPair;
   });
   return {patternIndex:pattern.patternIndex,role:retained.role,requirementIndex:retained.requirementIndex,originalPairs:pairs,originalStatuses:pairs.map((pair,i)=>status(targets[i].relation,pair,targets[i].limit))};
  });
  return {patternIndex:pattern.patternIndex,splits:[...pattern.splits],numerical};
 });
 const binding=freeze({model,requirements:targets,patterns,events:model.events});bindings.add(binding);return binding;
}

/** Reevaluate exact and original-numerical statuses at the same selected amount.
 * The old role-specific relaxed statuses are never reused.
 */
export function inspectSkyAllowanceReport(binding,value){
 if(!bindings.has(binding))throw Error('Bind and verify the complete original report before selecting an allowance');
 const result=projectSkyAllowance(binding.model,value),numerical=binding.patterns.flatMap(pattern=>pattern.numerical.map(w=>{
  const selectedStatuses=w.originalPairs.map((pair,i)=>status(binding.requirements[i].relation,pair,result.relaxedLimits[i]));
  return {patternIndex:w.patternIndex,role:w.role,requirementIndex:w.requirementIndex,originalPairs:w.originalPairs.map(p=>({lower:[...p.lower],upper:[...p.upper]})),originalStatuses:[...w.originalStatuses],selectedStatuses,meetsBoth:selectedStatuses.every(s=>s==='met')};
 }));
 return {result,numerical};
}

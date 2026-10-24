import {planSunBearingCourse,inspectSunBearingCourse,bearingCourseEnvelopes,SUN_BEARING_COURSE_LIMITS} from './solar-bearing-course.js';
import {sweepBearingCourse} from './solar-bearing-course-sweep.js';
import {bearingDomainCovered} from './solar-bearing-geometry.js';
import {compareSunPath,sunPathCellCourse,sunPathUtc,SUN_PATH_MODEL} from './solar-path.js';

export const SUN_BEARING_EVIDENCE_LIMITS=Object.freeze({maxObservations:32,maxSourceLength:600,maxAdditionalWitnesses:1});
export const SUN_BEARING_EVIDENCE_SEMANTICS='The separately supplied records claim mapped-obstruction states at original sampled instants. A common bearing is tested without changing the original declaration. Sufficient regions match every record across the admitted height envelopes; possible-only regions may combine different height realizations and do not establish one physical height explanation. These are conditional model comparisons, not authenticated observations, automated image interpretation, weather inference, orientation accuracy, probability or a physical sunlight proof.';
const ownKeys=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const wrap=x=>((x%360)+360)%360;
const contains=(intervals,x)=>intervals.some(([lo,hi])=>lo<=x&&x<=hi);
const inRegion=(regions,x)=>regions.some(r=>x>=r.from&&x<=r.to&&(x!==r.from||r.includeFrom)&&(x!==r.to||r.includeTo));

export function planSunBearingEvidence(project,declaration,settings,observations){
  const course=planSunBearingCourse(project,declaration,settings);
  if(!Array.isArray(observations)||observations.length<1||observations.length>SUN_BEARING_EVIDENCE_LIMITS.maxObservations)throw Error('Supply1–32 separately sourced original obstruction records.');
  const start=sunPathUtc(course.declaration.startUtc),end=sunPathUtc(course.declaration.endUtc),step=course.declaration.stepMinutes*60000,seen=new Set();
  const records=observations.map(o=>{
    if(!ownKeys(o,['utc','scenario','state','source']))throw Error('Each record must contain only original UTC, scenario, state and source.');
    if(!['existing','proposal'].includes(o.scenario)||!['blocked','no-mapped-blocker'].includes(o.state))throw Error('Record an explicit scenario and mapped-obstruction state.');
    if(typeof o.source!=='string'||!o.source.trim()||o.source.length>SUN_BEARING_EVIDENCE_LIMITS.maxSourceLength)throw Error('Retain a nonblank source for every record, up to600characters.');
    const t=sunPathUtc(o.utc),index=t===end?course.sampleCount-1:(t-start)/step;
    if(t<start||t>end||!Number.isInteger(index)||index<0||index>=course.sampleCount)throw Error('Every record must name an original sampled UTC instant, including the original final endpoint.');
    const utc=new Date(t).toISOString(),key=utc+'|'+o.scenario;
    if(seen.has(key))throw Error('Duplicate original UTC/scenario records are refused; retain one explicit classification per observation.');
    seen.add(key);return {utc,scenario:o.scenario,state:o.state,source:o.source.trim(),sampleIndex:index};
  });
  const n=project.width*project.height,extraRayTests=6*n*(n-1)*course.sampleCount;
  const observationEvents=Math.max(8,8*(n-1)+4)*records.length;
  const estimatedRayTests=course.estimatedRayTests+extraRayTests,estimatedEvents=course.estimatedEvents+observationEvents;
  if(!Number.isSafeInteger(estimatedRayTests)||estimatedRayTests>SUN_BEARING_COURSE_LIMITS.maxRayTests)throw Error('The complete original course and additional recorded-pattern witness exceed the16million ray-check budget. No partial source is admitted.');
  if(!Number.isSafeInteger(estimatedEvents)||estimatedEvents>SUN_BEARING_COURSE_LIMITS.maxEvents)throw Error('The original course and complete observation arrangement exceed the250000event budget.');
  return {...course,observations:records,observationCount:records.length,observationEvents,estimatedRayTests,estimatedEvents};
}

function connected(a,b){return a.to===b.from&&(a.includeTo||b.includeFrom);}
function unionAtoms(atoms){
  const out=[];for(const a of atoms){const previous=out.at(-1);
    if(previous&&connected(previous,a)){previous.to=a.to;previous.includeTo=a.includeTo;}
    else out.push({from:a.from,to:a.to,includeFrom:a.includeFrom,includeTo:a.includeTo});
  }return out;
}

/** Derived-envelope composition only. Public investigations always recompute
 * these original scenario envelopes from source before calling this adapter. */
export function bearingEvidenceRegions(domain,records,{maxEvents=250000}={}){
  if(!Array.isArray(records)||records.length<1||records.length>32)throw Error('Retain1–32 complete recorded states.');
  const empty=()=>({eligible:true,inner:[],outer:[]}),full=()=>({eligible:true,inner:[[...domain]],outer:[[...domain]]});
  const rows=records.map(({state,envelope})=>{
    if(!envelope?.eligible)throw Error('A recorded state has no eligible modeled ground observation in its scenario.');
    if(state==='blocked')return {existing:empty(),proposal:envelope};
    if(state==='no-mapped-blocker')return {existing:envelope,proposal:full()};
    throw Error('Unsupported recorded state.');
  });
  const sweep=sweepBearingCourse(domain,rows,{maxEvents}),count=records.length,profile=[];
  for(const atom of sweep.atoms){
    const matched=[...atom.counts.additional],result=matched[0]===count?'sufficient':matched[1]===count?'possible-only':'excluded';
    const next={from:atom.from,to:atom.to,includeFrom:atom.includeFrom,includeTo:atom.includeTo,matched,result},last=profile.at(-1);
    if(last&&connected(last,next)&&last.matched[0]===matched[0]&&last.matched[1]===matched[1]){last.to=next.to;last.includeTo=next.includeTo;}
    else profile.push(next);
  }
  const regions={sufficient:unionAtoms(profile.filter(p=>p.result==='sufficient')),possible:unionAtoms(profile.filter(p=>p.result!=='excluded')),possibleOnly:unionAtoms(profile.filter(p=>p.result==='possible-only')),excluded:unionAtoms(profile.filter(p=>p.result==='excluded'))};
  return {regions,profile,eventCount:sweep.eventCount,status:!regions.possible.length?'excluded':regions.sufficient.length?'sufficient':'unresolved'};
}

function representable(r){
  if(r.from===r.to)return r.includeFrom&&r.includeTo?r.from:null;
  const middle=r.from+(r.to-r.from)/2;if(middle>r.from&&middle<r.to)return middle;
  return r.includeFrom?r.from:r.includeTo?r.to:null;
}

export function inspectSunBearingEvidence(project,declaration,settings,inputObservations){
  const plan=planSunBearingEvidence(project,declaration,settings,inputObservations);
  const course=inspectSunBearingCourse(project,plan.declaration,plan.settings),normalized=bearingCourseEnvelopes(course.samples,course.domain);
  const derived=plan.observations.map(o=>{
    const envelope=normalized.rows[o.sampleIndex][o.scenario];
    if(!envelope.eligible)throw Error(`The ${o.scenario} record at ${o.utc} is not a modeled ground observation; retain footprint, low-elevation and nighttime limits separately.`);
    return {state:o.state,envelope};
  });
  const arranged=bearingEvidenceRegions(plan.domain,derived,{maxEvents:plan.observationEvents});
  const observations=plan.observations.map((o,i)=>({...o,envelopeStatus:course.samples[o.sampleIndex][o.scenario].status,
    numericalUnknown:normalized.issues.some(v=>v.sampleIndex===o.sampleIndex&&v.target===o.scenario),
    individuallyPossible:o.state==='blocked'?derived[i].envelope.outer.length>0:!bearingDomainCovered(derived[i].envelope.inner,plan.domain)}));
  const witnesses=[],seen=new Set(),disagreements=course.disagreements.map(d=>({...d,reason:'The original complete course has a numerical witness disagreement. '+d.reason}));
  function addWitness(bearing,kind,samples){
    const key=wrap(bearing);if(seen.has(key))return;seen.add(key);
    if(samples.length!==course.sampleCount||samples.some((s,i)=>s.utc!==course.samples[i].utc))throw Error('A recorded-pattern witness lost original timestamps.');
    const results=observations.map((o,i)=>{
      const witness=samples[o.sampleIndex][o.scenario],predicted=witness.status;
      const match=predicted===o.state?true:['blocked','no-mapped-blocker'].includes(predicted)?false:null;
      const envelope=derived[i].envelope;
      if((contains(envelope.inner,bearing)&&predicted!=='blocked')||(!contains(envelope.outer,bearing)&&predicted!=='no-mapped-blocker'))disagreements.push({bearingDeg:key,observationIndex:i,reason:'An original-kernel classification disagrees with a decisive recorded-pattern envelope.'});
      return {utc:o.utc,scenario:o.scenario,state:o.state,source:o.source,predicted,match,witness};
    });
    const matchesAll=results.every(r=>r.match===true),contradictsAny=results.some(r=>r.match===false);
    if(matchesAll&&!inRegion(arranged.regions.possible,bearing))disagreements.push({bearingDeg:key,reason:'A checked original course matches the pattern outside its possible bearing envelope.'});
    if(!matchesAll&&inRegion(arranged.regions.sufficient,bearing))disagreements.push({bearingDeg:key,reason:'A sufficient bearing region did not verify the complete recorded pattern through the original kernel.'});
    witnesses.push({bearingDeg:key,unwrappedBearingDeg:bearing,kind,matchesAll,contradictsAny,observations:results});
  }
  for(const w of course.witnesses)addWitness(w.unwrappedBearingDeg,w.kind,w.samples);
  let additionalWitnessCourses=0;
  if(course.status!=='numerically-unresolved'){
    const widest=(a,b)=>(b.to-b.from)-(a.to-a.from);
    const candidates=[...[...arranged.regions.sufficient].sort(widest),...[...arranged.regions.possible].sort(widest)];
    const chosen=candidates.find(r=>representable(r)!==null&&!seen.has(wrap(representable(r))));
    if(chosen){const bearing=representable(chosen),checked=compareSunPath(project,{...plan.declaration,gridColumnBearingDeg:wrap(bearing)});
      addWitness(bearing,'separately checked recorded-pattern bearing',sunPathCellCourse(checked,plan.settings.cellIndex));additionalWitnessCourses=1;}
  }
  const withheld=course.status==='numerically-unresolved'||disagreements.length>0;
  const reason=withheld?'A separately checked course disagreed with a numerical envelope. Common-bearing regions are withheld; original records and witnesses remain inspectable.':arranged.status==='excluded'?'No bearing in the declared range can match every entered mapped-obstruction record under the qualified envelopes.':arranged.status==='sufficient'?'At least one bearing region sufficiently matches every entered record under the admitted envelopes.':'Possible bearing regions remain, but a sufficient complete-pattern match is not established.';
  return {schema:'experimental-earth-sun-bearing-evidence/1',model:SUN_PATH_MODEL,sourceContext:course.sourceContext,declaration:plan.declaration,settings:plan.settings,domain:plan.domain,
    observationCount:plan.observationCount,estimatedRayTests:plan.estimatedRayTests,estimatedEvents:plan.estimatedEvents,
    status:withheld?'numerically-unresolved':arranged.status,reason,course,observations,regions:withheld?null:arranged.regions,profile:withheld?[]:arranged.profile,
    witnesses,disagreements,eventCount:course.eventCount+arranged.eventCount,observationEventCount:arranged.eventCount,additionalWitnessCourses,
    semantics:SUN_BEARING_EVIDENCE_SEMANTICS,numericQualification:course.numericQualification};
}

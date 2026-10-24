import {planSunBearing,inspectSunBearing,SUN_BEARING_NUMERICS} from './solar-bearing.js';
import {compareSunPath,sunPathCellCourse,sunPathContext,SUN_PATH_MODEL} from './solar-path.js';
import {sweepBearingCourse} from './solar-bearing-course-sweep.js';

export const SUN_BEARING_COURSE_LIMITS=Object.freeze({maxRayTests:16000000,maxEvents:250000,maxAdditionalWitnesses:2});
export const SUN_BEARING_COURSE_SEMANTICS='Counts refer to every original sampled UTC instant at one original ground centre, with one common bearing across the complete course. They are not duration, shaded area, irradiance, probability or annual exposure. Bounds can be conservative and need not be attained; separate extrema need not occur together. The original column-height bounds remain envelopes rather than one newly identified physical height. No mapped blocker does not establish actual sunlight.';
const keys=['existing','proposal','additional','removed'];
const wrap=x=>((x%360)+360)%360;
const exactKeys=(v,ks)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const contains=(ranges,x)=>ranges.some(([lo,hi])=>lo<=x&&x<=hi);

export function planSunBearingCourse(project,input,options){
  if(!exactKeys(options,['cellIndex','halfWidthDeg','basis']))throw Error('Supply only the original cell, bearing half width and its basis.');
  const first=planSunBearing(project,input,{...options,sampleIndex:0});
  const {sampleCount}=first.declaration,n=project.width*project.height;
  const oneCourseRayTests=6*n*(n-1)*sampleCount;
  const estimatedRayTests=first.estimatedRayTests*sampleCount+SUN_BEARING_COURSE_LIMITS.maxAdditionalWitnesses*oneCourseRayTests;
  // Each column supplies at most two lifted intervals in each inner/outer list
  // of both scenarios, each with two endpoints. Unknown normalization is smaller.
  const estimatedEvents=Math.max(8,16*(n-1))*sampleCount;
  if(!Number.isSafeInteger(estimatedRayTests)||estimatedRayTests>SUN_BEARING_COURSE_LIMITS.maxRayTests)throw Error('The complete original course and all reserved witnesses exceed the 16 million ray-check budget. Use a shorter or coarser original course; no timestamps were omitted.');
  if(!Number.isSafeInteger(estimatedEvents)||estimatedEvents>SUN_BEARING_COURSE_LIMITS.maxEvents)throw Error('The complete bearing arrangement exceeds its endpoint-event budget. No partial course is admitted.');
  return {declaration:first.declaration,settings:{cellIndex:first.settings.cellIndex,halfWidthDeg:first.settings.halfWidthDeg,basis:first.settings.basis},domain:first.domain,sampleCount,estimatedRayTests,estimatedEvents};
}

function envelopeConflict(envelope,witness,bearing){
  if(contains(envelope.inner,bearing)&&witness.status!=='blocked')return true;
  if(!contains(envelope.outer,bearing)&&witness.status!=='no-mapped-blocker')return true;
  return false;
}

/** Derived-envelope adapter, not a replay/admission API. The public investigation
 * recomputes every sample from original inputs before calling this function. */
export function bearingCourseEnvelopes(samples,domain){
  if(!Array.isArray(samples)||samples.length<1||samples.length>193)throw Error('Retain the complete original sampled course.');
  const empty=()=>({modeled:0,belowHorizon:0,lowElevation:0,footprint:0,numericalUnknown:0});
  const limits={existing:empty(),proposal:empty(),pairedModeled:0},issues=[];
  const rows=samples.map((sample,index)=>{
    if(!sample||typeof sample.utc!=='string'||!Array.isArray(sample.domain)||sample.domain.length!==2||sample.domain.some((v,i)=>v!==domain[i]))throw Error('Every sample must retain the same original bearing domain and UTC identity.');
    const row={};
    for(const target of ['existing','proposal']){
      const tally=limits[target],envelope=sample[target];
      const absent=()=>({eligible:false,inner:[],outer:[]});
      if(sample.condition==='below-horizon'){tally.belowHorizon++;row[target]=absent();continue;}
      if(sample.condition==='low-elevation'){tally.lowElevation++;row[target]=absent();continue;}
      if(sample.condition!=='modeled'||!envelope)throw Error('An original timestamp has no admitted scenario interpretation.');
      if(envelope.status==='footprint'){tally.footprint++;row[target]=absent();continue;}
      tally.modeled++;
      let unknown=envelope.status==='numerically-unresolved';
      if(!unknown){
        if(!['blocked-throughout','no-mapped-blocker-throughout','not-established'].includes(envelope.status)||!Array.isArray(envelope.inner)||!Array.isArray(envelope.outer))throw Error('An original numerical envelope is unsupported.');
        unknown=(sample.witnesses??[]).some(w=>envelopeConflict(envelope,w[target],w.unwrappedBearingDeg));
      }
      if(unknown){
        tally.numericalUnknown++;issues.push({sampleIndex:index,target,reason:'The numerical envelope is withheld; this original sample contributes an unknown zero-to-one count throughout the domain.'});
        row[target]={eligible:true,inner:[],outer:[[...domain]]};
      }else row[target]={eligible:true,inner:envelope.inner.map(v=>[...v]),outer:envelope.outer.map(v=>[...v])};
    }
    if(row.existing.eligible&&row.proposal.eligible)limits.pairedModeled++;
    return row;
  });
  return {rows,limits,issues};
}

const sameCounts=(a,b)=>keys.every(k=>a[k][0]===b[k][0]&&a[k][1]===b[k][1]);
function coalesce(atoms){
  const result=[];
  for(const atom of atoms){
    const previous=result.at(-1);
    if(previous&&previous.to===atom.from&&(previous.includeTo||atom.includeFrom)&&sameCounts(previous.counts,atom.counts)){previous.to=atom.to;previous.includeTo=atom.includeTo;}
    else result.push({...atom,counts:Object.fromEntries(keys.map(k=>[k,[...atom.counts[k]]]))});
  }
  return result;
}

function checkedCounts(steps,rows){
  const counts=Object.fromEntries(keys.map(k=>[k,0])),bounds=Object.fromEntries(keys.map(k=>[k,[0,0]]));
  const range=(status,eligible)=>!eligible?[0,0]:status==='blocked'?[1,1]:status==='no-mapped-blocker'?[0,0]:[0,1];
  for(let i=0;i<steps.length;i++){
    const e=range(steps[i].existing.status,rows[i].existing.eligible),p=range(steps[i].proposal.status,rows[i].proposal.eligible);
    for(const [target,v]of [['existing',e],['proposal',p]]){counts[target]+=v[0];bounds[target][0]+=v[0];bounds[target][1]+=v[1];}
    if(rows[i].existing.eligible&&rows[i].proposal.eligible){
      const a=[Number(p[0]===1&&e[1]===0),Number(p[1]===1&&e[0]===0)],r=[Number(e[0]===1&&p[1]===0),Number(e[1]===1&&p[0]===0)];
      for(const [target,v]of [['additional',a],['removed',r]]){counts[target]+=v[0];bounds[target][0]+=v[0];bounds[target][1]+=v[1];}
    }
  }
  return {counts,countBounds:bounds};
}

function interior(atom){
  if(atom.from===atom.to)return atom.includeFrom&&atom.includeTo?atom.from:null;
  const middle=atom.from+(atom.to-atom.from)/2;
  return middle>atom.from&&middle<atom.to?middle:null;
}

export function inspectSunBearingCourse(project,input,options){
  const plan=planSunBearingCourse(project,input,options);
  const samples=Array.from({length:plan.sampleCount},(_,sampleIndex)=>inspectSunBearing(project,plan.declaration,{...plan.settings,sampleIndex}));
  const normalized=bearingCourseEnvelopes(samples,plan.domain);
  const sweep=sweepBearingCourse(plan.domain,normalized.rows,{maxEvents:plan.estimatedEvents});
  const profile=coalesce(sweep.atoms),witnesses=[],seen=new Set();let additionalRuns=0;
  function addWitness(bearing,kind,steps){
    const key=wrap(bearing);if(seen.has(key))return;
    if(steps.length!==plan.sampleCount||steps.some((s,i)=>s.utc!==samples[i].utc))throw Error('A checked bearing course lost original timestamps.');
    seen.add(key);const summary=checkedCounts(steps,normalized.rows);
    witnesses.push({bearingDeg:key,unwrappedBearingDeg:bearing,kind,...summary,samples:steps,
      qualification:'These count enclosures come from separately checked original-kernel classifications at this one bearing. Uncertain or grazing ground samples remain zero-to-one contributions; they are not counted as established clear observations.'});
  }
  // These common directions already received every original positive-elevation
  // sample in135, so they require no additional obstruction calculations.
  for(const [bearing,kind]of [[plan.declaration.gridColumnBearingDeg,'original nominal bearing'],[plan.domain[0],'declared lower endpoint'],[plan.domain[1],'declared upper endpoint']]){
    const steps=samples.map(s=>{
      if(s.condition!=='modeled')return {utc:s.utc,existing:{status:s.condition},proposal:{status:s.condition}};
      const w=s.witnesses.find(w=>w.bearingDeg===wrap(bearing));
      if(!w)throw Error('An original common-direction witness is missing.');
      return {utc:s.utc,existing:w.existing,proposal:w.proposal};
    });
    addWitness(bearing,kind,steps);
  }
  // Prefer a wide atom with a strong lower count over a numerical fringe. A real
  // open atom without a representable interior stays in the proof, but is not
  // assigned a fabricated floating-point witness.
  for(const key of ['proposal','existing','additional','removed']){
    if(additionalRuns>=SUN_BEARING_COURSE_LIMITS.maxAdditionalWitnesses)break;
    const candidates=profile.filter(a=>a.counts[key][1]===sweep.extrema[key][1]).sort((a,b)=>b.counts[key][0]-a.counts[key][0]||(b.to-b.from)-(a.to-a.from));
    const atom=candidates.find(a=>interior(a)!==null&&!seen.has(wrap(interior(a))));
    if(!atom)continue;
    const bearing=interior(atom),course=compareSunPath(project,{...plan.declaration,gridColumnBearingDeg:wrap(bearing)});
    additionalRuns++;addWitness(bearing,`${key} upper-count profile inspection`,sunPathCellCourse(course,plan.settings.cellIndex));
  }
  const disagreements=[];
  for(const witness of witnesses){
    const bearing=witness.unwrappedBearingDeg;
    for(let i=0;i<samples.length;i++)for(const target of ['existing','proposal']){
      const envelope=normalized.rows[i][target];
      if(envelope.eligible&&envelopeConflict(envelope,witness.samples[i][target],bearing))disagreements.push({bearingDeg:witness.bearingDeg,sampleIndex:i,target,reason:'A maintained-kernel classification disagrees with the composed numerical envelope.'});
    }
  }
  const status=disagreements.length?'numerically-unresolved':'bounded';
  return {schema:'experimental-earth-sun-bearing-course/1',model:SUN_PATH_MODEL,sourceContext:sunPathContext(project),...plan,
    status,reason:disagreements.length?'A separately checked complete course disagreed with the numerical envelope. Count bounds and profile are withheld; original samples and witnesses remain inspectable.':null,
    limits:normalized.limits,issues:normalized.issues,eventCount:sweep.eventCount,atomCount:sweep.atoms.length,
    extrema:disagreements.length?null:sweep.extrema,profile:disagreements.length?[]:profile,samples,witnesses,disagreements,additionalWitnessCourses:additionalRuns,
    numericQualification:SUN_BEARING_NUMERICS+' The complete endpoint/open-interval sweep composes these supplied envelopes without bridging positive gaps. Rejected sample envelopes contribute conservative unknown counts.',semantics:SUN_BEARING_COURSE_SEMANTICS};
}

import {intersectIntervals} from './clock-offset-intervals.js';
export const CONFLICT_INTERVAL_SCAN_LIMIT=5_000_000;
/** A deterministic deletion witness, not a smallest-cardinality explanation.
 * Consume a freshly computed common-clock report, never an imported verdict. */
export function explainCommonClockConflict(comparison,{phase='all'}={}){
 if(comparison?.status!=='compared'||!['calibration','all'].includes(phase)||!Array.isArray(comparison.candidates)||comparison.candidates.length<1||comparison.candidates.length>9)throw Error('A computed bounded common-clock comparison is required');
 const candidates=comparison.candidates,first=candidates[0].readings;
 if(!Array.isArray(first)||first.length>100)throw Error('Bounded original reading ledger required');
 const selected=first.filter(r=>phase==='all'||r.reading.use==='calibration').map(r=>r.index).sort((a,b)=>a-b);
 if(!selected.length)return{status:'no-assigned-readings',phase,witness:[]};
 const maps=candidates.map(c=>new Map(c.readings.map(r=>[r.index,r])));
 if(new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0)||maps.some(m=>selected.some(i=>!m.has(i))))throw Error('Candidate source-row ledgers disagree');
 // Every intersection of n interval unions has no more components than the
 // sum of their inputs. Sum of prefix costs bounds one pass; at most2n+2
 // passes cover deletion, initial/final and each necessary-row reopening.
 const passCost=maps.reduce((total,map)=>{let prefix=1,cost=0;for(const index of selected){const n=map.get(index).offsetIntervals.length;cost+=prefix+n;prefix+=n;}return total+cost;},0);
 const estimatedIntervalScans=passCost*(2*selected.length+2);
 if(estimatedIntervalScans>CONFLICT_INTERVAL_SCAN_LIMIT)return{status:'work-limit',phase,estimatedIntervalScans,maxIntervalScans:CONFLICT_INTERVAL_SCAN_LIMIT,witness:[]};
 const evaluate=indices=>candidates.map((c,j)=>({rateMmHr:c.rateMmHr,intervals:indices.reduce((bands,index)=>intersectIntervals(bands,maps[j].get(index).offsetIntervals),[[...comparison.declaredDomain]])}));
 const any=rows=>rows.some(r=>r.intervals.length);
 const complete=evaluate(selected);
 if(any(complete))return{status:'compatible',phase,estimatedIntervalScans,support:complete,witness:[]};
 let witness=selected.slice();
 for(const index of selected){const trial=witness.filter(i=>i!==index);if(!any(evaluate(trial)))witness=trial;}
 const rows=witness.map(index=>{
  const reopening=evaluate(witness.filter(i=>i!==index));
  const supported=reopening.find(r=>r.intervals.length);
  if(!supported)throw Error('Conflict witness failed irreducibility check');
  const interval=supported.intervals[0],offset=interval[0]+(interval[1]-interval[0])/2;
  return{index,reading:structuredClone(first.find(r=>r.index===index).reading),
   individual:candidates.map((c,j)=>({rateMmHr:c.rateMmHr,status:maps[j].get(index).status,admittedOffsetDomain:structuredClone(maps[j].get(index).admittedOffsetDomain),intervals:structuredClone(maps[j].get(index).offsetIntervals)})),
   removalReopens:{rateMmHr:supported.rateMmHr,offsetMinutes:offset,interval:[...interval]},removalSupport:reopening};
 });
 const independent=candidates.map((c,j)=>({rateMmHr:c.rateMmHr,everyReadingIndividuallyPossible:selected.every(i=>maps[j].get(i).offsetIntervals.length>0)}));
 const eventOnly=rows.length===1&&rows[0].individual.every(r=>r.status==='outside-modeled-window');
 return{status:'conflict',phase,estimatedIntervalScans,maxIntervalScans:CONFLICT_INTERVAL_SCAN_LIMIT,
  consideredReadingIndices:selected,witnessReadingIndices:witness,witness:rows,independentPossibilities:independent,
  classification:eventOnly?'reading-outside-declared-event-support':rows.length===1?'single-reading-excludes-offered-models':'incompatible-shared-clock-constraints',
  meaning:'Every offered rate has empty shared offset support for this original-source subset. Removing any retained witness reading admits an explicit offered rate and offset for the remaining witness. This deterministic irreducible subset need not have minimum cardinality; excluded readings remain evidence. It does not establish which source, timing assumption, hydraulic parameter or physical model is wrong.'};
}

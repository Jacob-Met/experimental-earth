/** Complete closed-endpoint/open-atom arrangement of supplied bearing envelopes.
 * This helper proves only membership/count composition, not physical geometry.
 */
const MAX_EVENTS=250000,MAX_ROWS=193;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const keys=['existing','proposal','additional','removed'];
export function sweepBearingCourse(domain,rows,{maxEvents=MAX_EVENTS}={}){
 if(!Array.isArray(domain)||domain.length!==2||!domain.every(finite)||domain[0]>domain[1]||domain[1]-domain[0]>360)throw Error('Use a finite ordered bearing domain spanning at most360 degrees.');
 if(!Array.isArray(rows)||rows.length<1||rows.length>MAX_ROWS)throw Error('Retain1–193 original timestamps.');
 if(!Number.isSafeInteger(maxEvents)||maxEvents<0||maxEvents>MAX_EVENTS)throw Error('The event budget must be an integer from0 through250000.');
 const events=[],eligibility=[];let eventCount=0;
 // Count/admit every actual start/end event before sorting or producing atoms.
 for(let row=0;row<rows.length;row++){
  const eligible=[];
  for(const [scenarioIndex,name]of ['existing','proposal'].entries()){
   const source=rows[row]?.[name];
   if(!source||typeof source.eligible!=='boolean'||!Array.isArray(source.inner)||!Array.isArray(source.outer))throw Error('Each scenario needs explicit eligibility and complete inner/outer lists.');
   if(!source.eligible&&(source.inner.length||source.outer.length))throw Error('An ineligible observation must have empty envelope lists.');
   eligible.push(source.eligible);
   for(const [kind,list]of [source.inner,source.outer].entries())for(const interval of list){
    if(!Array.isArray(interval)||interval.length!==2||!interval.every(finite)||interval[0]>interval[1]||interval[0]<domain[0]||interval[1]>domain[1])throw Error('Keep finite closed intervals inside the original bearing domain.');
    eventCount+=2;if(eventCount>maxEvents)throw Error('The complete bearing arrangement exceeds its endpoint-event budget.');
    const slot=2*scenarioIndex+kind;
    events.push({at:interval[0],row,slot,start:true},{at:interval[1],row,slot,start:false});
   }
  }
  eligibility.push(eligible);
 }
 // Two constant-cost sentinels ensure even empty envelopes retain the domain.
 // eventCount counts source interval endpoints only, including duplicates.
 events.push({at:domain[0],row:-1},{at:domain[1],row:-1});events.sort((a,b)=>a.at-b.at);
 const active=Array.from({length:rows.length},()=>[0,0,0,0]),totals=Array(8).fill(0),atoms=[];
 const extrema=Object.fromEntries(keys.map(k=>[k,[Infinity,-Infinity]]));let invalid=0;
 const bad=state=>(state[0]>0&&state[1]===0)||(state[2]>0&&state[3]===0);
 const contribution=row=>{
  const [ei,eo,pi,po]=active[row].map(n=>n>0),[e,p]=eligibility[row],paired=e&&p;
  return [e&&ei,e&&eo,p&&pi,p&&po,paired&&pi&&!eo,paired&&po&&!ei,paired&&ei&&!po,paired&&eo&&!pi].map(Number);
 };
 function apply(event,delta){
  if(event.row<0)return;
  const state=active[event.row],before=contribution(event.row);invalid-=Number(bad(state));state[event.slot]+=delta;
  if(state[event.slot]<0)throw Error('Unbalanced interval endpoint events.');
  invalid+=Number(bad(state));const after=contribution(event.row);
  for(let i=0;i<8;i++)totals[i]+=after[i]-before[i];
 }
 function atom(from,to,closed){
  if(invalid)throw Error('Inner membership must imply outer membership throughout the domain.');
  const counts=Object.fromEntries(keys.map((key,i)=>[key,[totals[2*i],totals[2*i+1]]]));
  for(const key of keys){if(counts[key][0]>counts[key][1])throw Error('Invalid count envelope.');extrema[key][0]=Math.min(extrema[key][0],counts[key][0]);extrema[key][1]=Math.max(extrema[key][1],counts[key][1]);}
  atoms.push({from,to,includeFrom:closed,includeTo:closed,counts});
 }
 for(let begin=0;begin<events.length;){
  let end=begin+1;const at=events[begin].at;while(end<events.length&&events[end].at===at)end++;
  // Only final grouped states enter the profile/extrema. Overlapping/touching
  // intervals have reference counts, so no timestamp is counted twice.
  for(let i=begin;i<end;i++)if(events[i].start)apply(events[i],1);
  atom(at,at,true);
  for(let i=begin;i<end;i++)if(events[i].row>=0&&!events[i].start)apply(events[i],-1);
  if(end<events.length&&at<events[end].at)atom(at,events[end].at,false);
  begin=end;
 }
 return {domain:[...domain],sampleCount:rows.length,eventCount,atoms,extrema};
}

/** Exact smallest witness within a finite hypothesis set, not a sensor diagnosis. */
export function smallestConflict(rows, rates) {
 if(!Array.isArray(rates)||rates.length<2||rates.length>9||new Set(rates).size!==rates.length||rates.some(r=>!Number.isFinite(r)))throw Error('Expected 2–9 distinct finite hypothesis rates');
 if(!Array.isArray(rows)||rows.length>100||new Set(rows.map(r=>r.index)).size!==rows.length)throw Error('Expected at most 100 distinct readings');
 const all=(1<<rates.length)-1;
 const masks=rows.map(row=>{
  if(!Number.isInteger(row.index)||row.index<0||!Array.isArray(row.supportedRatesMmHr)||row.supportedRatesMmHr.some(r=>!rates.includes(r)))throw Error('Invalid reading support');
  return rates.reduce((m,rate,i)=>row.supportedRatesMmHr.includes(rate)?m|(1<<i):m,0);
 });
 const better=(a,b)=>{
  if(!b||a.length!==b.length)return !b||a.length<b.length;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];
  return false;
 };
 let states=new Map([[all,[]]]);
 // Each reading is used once. Retain shortest lexicographically first witness per intersection.
 for(const [i,row] of rows.entries()){
  const next=new Map(states);
  for(const [mask,subset] of states){const m=mask&masks[i],candidate=[...subset,row.index].sort((a,b)=>a-b);if(better(candidate,next.get(m)))next.set(m,candidate);}
  states=next;
 }
 const indices=states.get(0)??null;
 return {indices,minimumReadingCount:indices?.length??null,testedHypotheses:rates.length,searchStates:states.size,
  semantics:'Smallest subset rejecting every tested hypothesis. No reading is removed, no hypothesis outside the finite set is evaluated, and no measurement is identified as wrong.'};
}

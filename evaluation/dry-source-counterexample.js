/** Authored local flow counterexample, not a second site solver.
 * Supply and downhill requests shrink together. Dry-source clipping remains
 * active, so smooth splitting error assumptions need not apply. */
export function drySourceCounterexample(hours){
 if(typeof hours!=='number'||!Number.isFinite(hours)||hours<=0||hours>.01)throw Error('Counterexample hours must be finite, positive and at most 0.01');
 const requests=[(2+hours)*hours,(1+hours)*hours];
 const scale=hours/(requests[0]+requests[1]);
 const simultaneous=requests.map(x=>x*scale);
 const sequence=reverse=>{
  let remaining=hours;const received=[0,0],order=reverse?[1,0,0,1]:[0,1,1,0];
  for(const i of order){
   const difference=[2,1][i]+remaining-received[i];
   const moved=Math.min(remaining,difference*(-Math.expm1(-hours))/2);
   received[i]+=moved;remaining-=moved;
  }
  return {received,remaining,fractions:received.map(x=>x/hours)};
 };
 return {hours,supply:hours,simultaneous:{received:simultaneous,fractions:simultaneous.map(x=>x/hours)},
  forward:sequence(false),reverse:sequence(true),
  meaning:'A prescribed two-destination dry-source allocation control. It isolates order dependence, not the full grid dynamics or physical drainage.'};
}

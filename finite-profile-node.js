// Research only: constant arrival/outlet requests, dry uptake priority,
// finite receiving storage with continuous linear drainage. No graph exactness claim.
export function advanceFinite({waterMm,storedMm,capacityMm,drainagePerHour,arrivalMmHr,uptakeMmHr,outflowMmHr,hours}){
 const values=[waterMm,storedMm,capacityMm,drainagePerHour,arrivalMmHr,uptakeMmHr,outflowMmHr,hours];
 if(!values.every(x=>Number.isFinite(x)&&x>=0)||storedMm>capacityMm)throw Error('Finite nonnegative node declarations required');
 const original=waterMm+storedMm+arrivalMmHr*hours;
 if(!Number.isFinite(original)||!Number.isFinite(drainagePerHour*capacityMm)||!Number.isFinite(uptakeMmHr+outflowMmHr))throw Error('Nonfinite node inventory or rate');
 let time=0,absorbedMm=0,outMm=0,drainedMm=0,events=0;const segments=[];
 while(time<hours){
  if(++events>16)throw Error('Finite node event bound');
  const remaining=hours-time,full=storedMm===capacityMm,d=drainagePerHour,R=arrivalMmHr,I=uptakeMmHr,Q=outflowMmHr;
  let q=waterMm===0?Math.min(I,R):I;if(full)q=Math.min(q,d*capacityMm);
  const out=waterMm===0?Math.min(Q,Math.max(0,R-q)):Q,slope=R-q-out;
  const empty=waterMm>0&&slope<0?waterMm/(-slope):Infinity;
  let fill=Infinity;
  if(storedMm<capacityMm&&q>d*capacityMm){const gap=capacityMm-storedMm,excess=q-d*capacityMm,z=d*gap/excess;fill=(gap/excess)*(z===0?1:Math.log1p(z)/z);}
  const dt=Math.min(remaining,empty,fill);if(!(dt>0)||time+dt===time)throw Error('Unrepresentable finite node event');
  const z=d*dt,phi=z===0?1:-Math.expm1(-z)/z,oneMinusPhi=Math.abs(z)<1e-4?z*(.5+z*(-1/6+z*(1/24+z*(-1/120+z/720)))):1-phi;
  const drain=storedMm*(-Math.expm1(-z))+q*dt*oneMinusPhi;
  const nextStored=dt===fill||(full&&q===d*capacityMm)?capacityMm:storedMm*Math.exp(-z)+q*dt*phi;
  const nextWater=dt===empty?0:waterMm+slope*dt;
  if(![nextStored,nextWater,drain].every(Number.isFinite)||nextStored<0||nextStored>capacityMm||nextWater<0||drain<0)throw Error('Finite node state refusal');
  if(out>0)segments.push({start:time,end:dt===remaining?hours:time+dt,rate:out});
  absorbedMm+=q*dt;outMm+=out*dt;drainedMm+=drain;storedMm=nextStored;waterMm=nextWater;time=dt===remaining?hours:time+dt;
 }
 const balanceMm=original-waterMm-storedMm-outMm-drainedMm;
 if(![absorbedMm,outMm,drainedMm,balanceMm].every(Number.isFinite)||Math.abs(balanceMm)>1e-10*Math.max(1,original))throw Error('Finite node balance refusal');
 return{waterMm,storedMm,absorbedMm,outMm,drainedMm,balanceMm,segments,events};
}

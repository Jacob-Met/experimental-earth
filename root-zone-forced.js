import {advanceRootZoneDry} from './root-zone.js';
/** Constant recharge and transpiration over one explicitly declared interval. */
export function advanceRootZoneForced(params) { return advance(params,false); }
/** The same native water response, with its exact nonnegative supply regimes.
 * A segment supplies q0 exp(-kt) + qInf (1-exp(-kt)) mm/day.
 * Recording is opt-in; the original result contract and water arithmetic remain.
 */
export function advanceRootZoneForcedWithSupply(params) { return advance(params,true); }
function advance({availableMm:S,capacityMm:C,depletionFraction:p,rechargeMmPerDay:r,demandMmPerDay:E,days},record) {
 const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
 if(!finite(C,Number.MIN_VALUE,10000)||!finite(S,0,C)||!finite(p,0,1)||!finite(r,0,48000)||!finite(E,0,30)||!finite(days,0,366))throw Error('Invalid forced root state');
 const initial=S,T=(1-p)*C,rechargeMm=r*days,potentialMm=E*days,segments=[];
 const segment=(duration,initialMmPerDay,equilibriumMmPerDay=0,decayPerDay=0)=>{
  if(!record||!(duration>0))return;
  if(![duration,initialMmPerDay,equilibriumMmPerDay,decayPerDay].every(Number.isFinite))throw Error('Root supply regime is outside the supported finite numeric range');
  segments.push({days:duration,initialMmPerDay,equilibriumMmPerDay,decayPerDay});
 };
 let remaining=days,drainageMm=0,suppliedMm;
 if(days===0){suppliedMm=0;}
 else if(r===0){
  const dry=advanceRootZoneDry({availableMm:S,capacityMm:C,depletionFraction:p,demandMmPerDay:E,days});
  if(record){
   if(E===0)segment(days,0);
   else{
    const fullDays=Math.min(days,Math.max(0,S-T)/E);
    segment(fullDays,E);
    const rest=days-fullDays,atThreshold=Math.max(0,S-E*fullDays);
    segment(rest,T>0?Math.min(E,atThreshold*E/T):0,0,T>0?E/T:0);
   }
  }
  S=dry.availableMm;suppliedMm=dry.suppliedMm;
 } else if(E===0){
  segment(days,0);
  S=Math.min(C,S+rechargeMm);drainageMm=Math.max(0,initial+rechargeMm-C);suppliedMm=0;
 } else if(T===0){
  const fullDays=r>=E?days:Math.min(days,S/(E-r));
  segment(fullDays,E);segment(days-fullDays,r);
  S=Math.max(0,Math.min(C,S+(r-E)*days));
  drainageMm=Math.max(0,initial+(r-E)*days-C);
 } else {
  const k=E/T;
  if(!Number.isFinite(k))throw Error('Root stress rate is outside the supported finite numeric range');
  // At most: exponential region -> full-demand region -> full store, or reverse.
  for(let leg=0;remaining>0&&leg<4;leg++){
   if(S>=C&&r>=E){segment(remaining,E);drainageMm+=(r-E)*remaining;remaining=0;break;}
   if(S>=T&&r>=E){
    const slope=r-E;if(slope===0){segment(remaining,E);remaining=0;break;}
    const t=Math.min(remaining,(C-S)/slope);
    segment(t,E);S=Math.min(C,S+slope*t);remaining-=t;continue;
   }
   if(S>T&&r<E){
    const t=Math.min(remaining,(S-T)/(E-r));
    segment(t,E);S=Math.max(T,S+(r-E)*t);remaining-=t;continue;
   }
   let t=remaining,reach=false;
   if(r>E){
    const v=r-k*S,x=k*(T-S)/v;
    const crossing=(T-S)/v*(Math.abs(x)<Number.EPSILON?1:-Math.log1p(-x)/x);
    if(crossing<=t){t=Math.max(0,crossing);reach=true;}
   }
   segment(t,Math.min(E,k*S),r,k);
   const z=k*t,loss=-Math.expm1(-z);
   // Positive terms prevent cancellation below zero. For large z, use r/k:
   // z may overflow while k remains finite and the equilibrium is well-defined.
   S=z>.5 ? S*Math.exp(-z)+(r/k)*loss :
     S*Math.exp(-z)+r*t*(z===0?1:loss/z);
   remaining-=t;if(reach)S=T;
  }
  if(remaining>0)throw Error('Forced-regime budget exhausted');
 }
 if(suppliedMm===undefined)suppliedMm=Math.max(0,Math.min(potentialMm,initial+rechargeMm-drainageMm-S));
 const unmetMm=Math.max(0,potentialMm-suppliedMm);
 const balanceErrorMm=initial+rechargeMm-drainageMm-suppliedMm-S;
 if(!finite(S,0,C)||![suppliedMm,unmetMm,potentialMm,rechargeMm,drainageMm,balanceErrorMm].every(Number.isFinite)||
  drainageMm<0||Math.abs(balanceErrorMm)>1e-10*Math.max(1,initial,rechargeMm,potentialMm))
  throw Error('Forced root result is outside the supported finite water account');
 const result={availableMm:S,suppliedMm,unmetMm,potentialMm,rechargeMm,drainageMm,balanceErrorMm};
 return record?{...result,supplySegments:segments}:result;
}

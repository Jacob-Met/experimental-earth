import {advanceRootZoneDry} from './root-zone.js';
/** Constant recharge and transpiration over one explicitly declared interval. */
export function advanceRootZoneForced({availableMm:S,capacityMm:C,depletionFraction:p,rechargeMmPerDay:r,demandMmPerDay:E,days}) {
 const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
 if(!finite(C,Number.MIN_VALUE,10000)||!finite(S,0,C)||!finite(p,0,1)||!finite(r,0,48000)||!finite(E,0,30)||!finite(days,0,366))throw Error('Invalid forced root state');
 const initial=S,T=(1-p)*C,rechargeMm=r*days,potentialMm=E*days;
 let remaining=days,drainageMm=0,suppliedMm;
 if(days===0){suppliedMm=0;}
 else if(r===0){
  const dry=advanceRootZoneDry({availableMm:S,capacityMm:C,depletionFraction:p,demandMmPerDay:E,days});
  S=dry.availableMm;suppliedMm=dry.suppliedMm;
 } else if(E===0){
  S=Math.min(C,S+rechargeMm);drainageMm=Math.max(0,initial+rechargeMm-C);suppliedMm=0;
 } else if(T===0){
  S=Math.max(0,Math.min(C,S+(r-E)*days));
  drainageMm=Math.max(0,initial+(r-E)*days-C);
 } else {
  const k=E/T;
  if(!Number.isFinite(k))throw Error('Root stress rate is outside the supported finite numeric range');
  // At most: exponential region -> full-demand region -> full store, or reverse.
  for(let leg=0;remaining>0&&leg<4;leg++){
   if(S>=C&&r>=E){drainageMm+=(r-E)*remaining;remaining=0;break;}
   if(S>=T&&r>=E){
    const slope=r-E;if(slope===0){remaining=0;break;}
    const t=Math.min(remaining,(C-S)/slope);
    S=Math.min(C,S+slope*t);remaining-=t;continue;
   }
   if(S>T&&r<E){
    const t=Math.min(remaining,(S-T)/(E-r));
    S=Math.max(T,S+(r-E)*t);remaining-=t;continue;
   }
   let t=remaining,reach=false;
   if(r>E){
    const v=r-k*S,x=k*(T-S)/v;
    const crossing=(T-S)/v*(Math.abs(x)<Number.EPSILON?1:-Math.log1p(-x)/x);
    if(crossing<=t){t=Math.max(0,crossing);reach=true;}
   }
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
 return {availableMm:S,suppliedMm,unmetMm,potentialMm,rechargeMm,drainageMm,balanceErrorMm};
}

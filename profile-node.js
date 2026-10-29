// Research process contract: constant arrival, uptake and requested outflow rates.
// Uptake has priority at a dry surface. No finite receiving store in this module.
export function advanceNode({waterMm,arrivalMmHr,uptakeMmHr,outflowMmHr,hours}){
 if(![waterMm,arrivalMmHr,uptakeMmHr,outflowMmHr,hours].every(x=>Number.isFinite(x)&&x>=0))throw Error('Nonnegative finite node declarations required');
 const supply=waterMm+arrivalMmHr*hours,loss=uptakeMmHr+outflowMmHr;if(!Number.isFinite(supply)||!Number.isFinite(loss))throw Error('Nonfinite node inventory or rate');
 if(hours===0)return{waterMm,absorbedMm:0,outMm:0,emptyAtHours:null,balanceMm:0};
 const net=arrivalMmHr-loss;
 let wet=hours,emptyAtHours=null;
 if(net<0){const hit=waterMm/(-net);if(waterMm>0&&hit===0)throw Error('Unrepresentable positive empty event');if(hit<=hours){wet=hit;emptyAtHours=hit;}}
 const dry=hours-wet,absorbedMm=uptakeMmHr*wet+Math.min(uptakeMmHr,arrivalMmHr)*dry,outMm=outflowMmHr*wet+Math.min(outflowMmHr,Math.max(0,arrivalMmHr-uptakeMmHr))*dry;
 const end=emptyAtHours===null?waterMm+net*wet:0,balanceMm=supply-absorbedMm-outMm-end;
 if(![absorbedMm,outMm,end,balanceMm].every(Number.isFinite)||end<0||Math.abs(balanceMm)>1e-10*Math.max(1,supply))throw Error('Node balance/refusal');
 const segments=[];if(wet>0&&outflowMmHr>0)segments.push({start:0,end:wet,rate:outflowMmHr});const dryRate=Math.min(outflowMmHr,Math.max(0,arrivalMmHr-uptakeMmHr));if(dry>0&&dryRate>0)segments.push({start:wet,end:hours,rate:dryRate});return{waterMm:end,absorbedMm,outMm,emptyAtHours,balanceMm,segments};
}

// Experimental filled-course producer, outside the maintained consumer.
export const FILLED_Q_POINTS=9, FILLED_Q_UPDATES=48, FILLED_K_BISECTIONS=64;
export const FILLED_Q_EVALUATIONS=FILLED_Q_POINTS+(FILLED_Q_POINTS-1)*(2+FILLED_Q_UPDATES);

export function proposeFilledDrainBandWitnesses(input){
  const fail=(reason,extra={})=>({status:'unresolved',reason,proposals:[],...extra});
  if(!input||typeof input!=='object')return fail('missing-original-filled-source');
  const {rainMmHr:R,infiltrationMmHr:f,stormMinutes,stormEndDepthMm:H,areaM2,readings,drainedReadings}=input;
  const finite=(x,lo,hi)=>typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
  if(!finite(R,Number.MIN_VALUE,250)||!finite(f,Number.MIN_VALUE,2000)||!finite(stormMinutes,Number.MIN_VALUE,720)||
     !finite(H,Number.MIN_VALUE,1000)||!finite(areaM2,Number.MIN_VALUE,5760000)||!Array.isArray(readings)||readings.length<2||
     !Array.isArray(drainedReadings)||!drainedReadings.length||readings.length+drainedReadings.length>128)
    return fail('unsupported-original-filled-source');
  for(const [channel,rows]of [['retained',readings],['drained',drainedReadings]])
    if(rows.some(r=>!r||r.use!=='calibration'||r.channel!==channel||!finite(r.minute,0,720)||
      (channel==='retained'&&r.minute<=stormMinutes)||!finite(r.valueLiters,0,1e12)||!finite(r.uncertaintyLiters,0,1e12)))
      return fail('need-original-calibration-bands');
  if(!drainedReadings.some(r=>r.minute>0))return fail('need-positive-time-original-drainage');
  const rows=[...readings].sort((a,b)=>a.minute-b.minute),T=stormMinutes/60,F=Math.min(R,f),firstHours=rows[0].minute/60;
  if(rows.at(-1).minute<=rows[0].minute)return fail('need-distinct-original-retained-times');
  const freeDepth=(R-F)*T,excess=H-freeDepth,guard=64*Number.EPSILON*Math.max(1,Math.abs(H),Math.abs(freeDepth));
  if(!(excess>guard))return fail('unresolved-interior-filled-surface-excess',{excess,computationalExcessGuard:guard});
  const rainVolume=R*T,qMin=H/(firstHours-T),qMax=Math.min(F,(rainVolume-H)/T);
  if(!(qMin>0&&qMax>=qMin&&qMax<F))return fail('no-full-rate-interval-dry-by-original-retained-time',{qInterval:[qMin,qMax]});
  let qEvaluations=0,modelEvaluations=0,bandIntersections=0;
  const originals=[...drainedReadings,...rows];
  function assess(q,origin){
    qEvaluations++;
    // This explicitly constructed initially-full boundary is never a clipped tf.
    const fillHours=q===qMax?0:(rainVolume-H-q*T)/(F-q);
    const dryHours=q===qMin?firstHours:T+H/q;
    if(!(fillHours>=0&&fillHours<T&&dryHours<=firstHours))return {q,origin,score:Infinity,reason:'unsupported-conditional-phase-times'};
    const kMin=q/10000,emptyRate=fillHours>0?-Math.log1p(-q/F)/fillHours:Infinity,kMax=Math.min(100,emptyRate);
    if(!(kMax>=kMin&&kMin>0))return {q,origin,score:Infinity,reason:'empty-original-parameter-domain'};
    let lower=kMin,upper=kMax,violation=0;
    function predicted(k,row){
      modelEvaluations++;
      const t=row.minute/60;
      if(row.channel==='retained')return q/k*Math.exp(-k*(t-dryHours));
      if(t===0)return 0;
      const fillLoss=(F-q)/k*Math.expm1(k*fillHours);
      if(t<=fillHours)return F*t-(F-q)/k*Math.exp(k*(fillHours-t))*Math.expm1(k*t);
      if(t<=dryHours)return q*t+(F-q)*fillHours-fillLoss;
      return rainVolume+q/k*(-Math.expm1(-k*(t-dryHours)))-fillLoss;
    }
    function root(target,row){
      let lo=kMin,hi=kMax;
      for(let i=0;i<FILLED_K_BISECTIONS;i++){
        const mid=lo+(hi-lo)/2;if(mid===lo||mid===hi)break;
        const value=predicted(mid,row);if(!Number.isFinite(value))return NaN;
        if(value>target)lo=mid;else hi=mid;
      }
      return lo+(hi-lo)/2;
    }
    for(const row of originals){
      bandIntersections++;
      const low=(row.valueLiters-row.uncertaintyLiters)/areaM2,high=(row.valueLiters+row.uncertaintyLiters)/areaM2;
      const maximum=predicted(kMin,row),minimum=predicted(kMax,row);
      if(![minimum,maximum].every(Number.isFinite))return {q,origin,score:Infinity,reason:'nonfinite-conditional-course'};
      const scale=Math.max(1,Math.abs(low),Math.abs(high));
      violation+=Math.max(0,minimum-high,low-maximum)/scale;
      if(maximum>high&&minimum<=high)lower=Math.max(lower,root(high,row));
      if(minimum<low&&maximum>=low)upper=Math.min(upper,root(low,row));
    }
    const score=violation>0?violation+Math.max(0,lower-upper):lower-upper;
    return {q,origin,score,fillHours,dryHours,physicalRateInterval:[kMin,kMax],emptyRate,rateInterval:[lower,upper],violation};
  }
  const points=[];for(let i=0;i<FILLED_Q_POINTS;i++)points.push(assess(i===0?qMin:i===FILLED_Q_POINTS-1?qMax:qMin+(qMax-qMin)*i/(FILLED_Q_POINTS-1),{method:'fixed-full-rate',fraction:i/(FILLED_Q_POINTS-1)}));
  const refinements=[];let best=null;const ratio=(Math.sqrt(5)-1)/2;
  const search=q=>{const p=assess(q,{method:'original-drained-and-retained-q-refinement'});if(Number.isFinite(p.score)&&(!best||p.score<best.score))best=p;return p;};
  if(qMax>qMin)for(let i=0;i<FILLED_Q_POINTS-1;i++){
    let a=points[i].q,b=points[i+1].q,c=search(b-ratio*(b-a)),d=search(a+ratio*(b-a));const bracket=[a,b];
    for(let n=0;n<FILLED_Q_UPDATES;n++){if(c.score<d.score){b=d.q;d=c;c=search(b-ratio*(b-a));}else{a=c.q;c=d;d=search(a+ratio*(b-a));}}
    const p=c.score<d.score?c:d;refinements.push({bracket,finalBracket:[a,b],q:p.q,score:p.score,rateInterval:p.rateInterval});
  }
  if(best)points.push(best);
  const proposals=[],refusals=[];
  for(const point of points){
    if(!Number.isFinite(point.score)||point.violation>0||point.rateInterval[0]>point.rateInterval[1]){refusals.push(point);continue;}
    const [lo,hi]=point.rateInterval,width=hi-lo,inset=Math.min(width/4,64*Number.EPSILON*Math.max(Math.abs(lo),Math.abs(hi)));
    for(const fraction of [0,.5,1]){
      const k=fraction===0?lo+inset:fraction===1?hi-inset:lo+width/2,C=point.q/k;
      const emptyBoundary=k===point.emptyRate,initial=emptyBoundary?0:C-(F-point.q)/k*Math.expm1(k*point.fillHours);
      if(![k,C,initial].every(Number.isFinite)||!(k>0&&k<=100&&C>0&&C<=10000&&initial>=0&&initial<=C)){refusals.push({q:point.q,k,C,initial,reason:'finite-candidate-outside-original-domain'});continue;}
      proposals.push({capacityMm:C,initialStoredMm:initial,drainagePerHour:k,phase:emptyBoundary?'filled-drain-initially-empty-boundary':point.fillHours===0?'filled-drain-initially-full-boundary':'filled-drain-during-storm',fullStoreRateMmHr:point.q,fillMinute:point.fillHours*60,dryMinute:point.dryHours*60,rateInterval:[lo,hi],rateFraction:fraction,endpointInsetPerHour:inset,qOrigin:point.origin});
    }
  }
  const reservation={qEvaluations:FILLED_Q_EVALUATIONS,maximumProposals:(FILLED_Q_POINTS+1)*3,bandIntersections:FILLED_Q_EVALUATIONS*originals.length,modelEvaluations:FILLED_Q_EVALUATIONS*originals.length*(2+2*FILLED_K_BISECTIONS)};
  if(qEvaluations>reservation.qEvaluations||proposals.length>reservation.maximumProposals||modelEvaluations>reservation.modelEvaluations)throw Error('Prototype bounded work reservation exceeded');
  return {status:proposals.length?'proposals':'unresolved',proposals,refusals,points,refinements,qInterval:[qMin,qMax],counts:{qEvaluations,modelEvaluations,bandIntersections},reservation,meaning:'Finite conditional filled-course witnesses from original calibration bands; exact physical forward validation remains required. No exhaustive coverage, parameter identification or original-source replacement.'};
}

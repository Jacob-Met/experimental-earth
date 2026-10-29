export function inferPostDryRetainedReceivers(input){
  if(!input||typeof input!=='object')return {status:'refused',reason:'missing-original-post-dry-input'};
  const {rainMmHr:R,infiltrationMmHr:f,stormMinutes,stormEndDepthMm:H,areaM2,earlier,later}=input;
  if(![R,f,stormMinutes,H,areaM2].every(v=>typeof v==='number'&&Number.isFinite(v))||!(R>0&&R<=250&&f>0&&f<=2000&&stormMinutes>0&&stormMinutes<720&&H>0&&H<=1000&&areaM2>0&&areaM2<=5760000))
    return {status:'refused',reason:'unsupported-post-dry-surface-or-footprint'};
  for(const row of [earlier,later])if(!row||row.use!=='calibration'||row.channel!=='retained'||![row.minute,row.valueLiters].every(v=>typeof v==='number'&&Number.isFinite(v))||row.minute<=stormMinutes||row.minute>720||row.valueLiters<=0||row.valueLiters>1e12)
    return {status:'refused',reason:'need-two-original-positive-retained-calibration-values-after-storm'};
  if(!(later.minute>earlier.minute&&earlier.valueLiters>later.valueLiters))return {status:'refused',reason:'retained-pair-does-not-resolve-positive-decay'};

  return solvePostDryRetainedCourse(input,earlier,later);
}

// Internal model-course arithmetic. The two values may be derived from a drainage
// curve; they are never inserted into the original receiving observations.
function solvePostDryRetainedCourse(input,earlier,later,knownRate){
  const {rainMmHr:R,infiltrationMmHr:f,stormMinutes,stormEndDepthMm:H,areaM2}=input;
  const T=stormMinutes/60,u=earlier.minute/60,v=later.minute/60,F=Math.min(R,f);
  const relativeDrop=(earlier.valueLiters-later.valueLiters)/later.valueLiters;
  const logRatio=relativeDrop<.5?Math.log1p(relativeDrop):Math.log(earlier.valueLiters)-Math.log(later.valueLiters);
  const k=knownRate??logRatio/(v-u),first=earlier.valueLiters/areaM2;
  if(!(k>0&&k<=100&&first>0&&Number.isFinite(first)))return {status:'refused',reason:'unresolved-post-dry-decay-rate'};
  const logAmplitude=Math.log(first)+k*(u-T);
  const lower=H/(k*(u-T)),upper=Math.min(10000,F/k);
  if(!(lower>0&&Number.isFinite(lower)&&Number.isFinite(upper)&&upper>=lower))return {status:'refused',reason:'no-capacity-full-at-storm-end-and-dry-by-first-inventory'};
  const equation=C=>Math.log(C)+H/C-logAmplitude;
  const ranges=[];
  if(lower<=H)ranges.push({branch:'capacity-below-storm-depth',lower,upper:Math.min(H,upper)});
  if(upper>=H)ranges.push({branch:'capacity-above-storm-depth',lower:Math.max(H,lower),upper});
  if(!ranges.length)ranges.push({branch:upper<H?'capacity-below-storm-depth':'capacity-above-storm-depth',lower,upper});
  const roots=[],refusedBranches=[];
  for(const range of ranges){
    let lo=range.lower,hi=range.upper,fl=equation(lo),fh=equation(hi),iterations=0;
    if(lo>hi||![fl,fh].every(Number.isFinite)){refusedBranches.push({...range,reason:'unsupported-root-range'});continue;}
    let C;
    if(fl===0)C=lo;else if(fh===0)C=hi;
    else if((fl>0)===(fh>0)){refusedBranches.push({...range,reason:'no-central-root-in-monotone-capacity-branch'});continue;}
    else{
      for(;iterations<128;iterations++){
        const mid=lo+(hi-lo)/2;if(mid===lo||mid===hi)break;
        const fm=equation(mid);if(!Number.isFinite(fm))return {status:'refused',reason:'nonfinite-post-dry-root-evaluation'};
        if(fm===0){lo=mid;hi=mid;break;}
        if((fm>0)===(fl>0)){lo=mid;fl=fm;}else{hi=mid;fh=fm;}
      }
      C=lo+(hi-lo)/2;
    }
    const residual=equation(C),guard=64*Number.EPSILON*Math.max(1,Math.abs(logAmplitude),Math.abs(Math.log(C)),Math.abs(H/C));
    if(!Number.isFinite(residual)||Math.abs(residual)>guard){refusedBranches.push({...range,reason:'post-dry-central-root-not-numerically-resolved',residual,guard});continue;}
    if(!roots.some(root=>root.capacityMm===C))roots.push({capacityMm:C,drainagePerHour:k,capacityBranch:range.branch,rootIterations:iterations,logResidual:residual,numericalLogGuard:guard});
  }
  const proposals=[],refusedModels=[];
  for(const root of roots){
    const C=root.capacityMm,q=k*C;
    const dryMinute=(T+H/q)*60;
    if(!(q>0&&q<=F&&dryMinute<=earlier.minute)){refusedModels.push({...root,reason:'derived-full-or-dry-regime-not-resolved'});continue;}
    // Separately enumerated physical boundary; forward validation is mandatory.
    proposals.push({...root,initialStoredMm:C,fillMinute:0,dryMinute,fullStoreRateMmHr:q,phase:'post-dry-initially-full-boundary'});
    if(!(q<F)){refusedModels.push({...root,reason:'no-interior-fill-rate-contrast'});continue;}
    // Explicit empty boundary, independent of the central inferred S. Do not
    // clip a negative central estimate into this candidate or erase its refusal.
    const emptyFillHours=-Math.log1p(-q/F)/k;
    if(Number.isFinite(emptyFillHours)&&emptyFillHours>=0&&emptyFillHours<T)
      proposals.push({...root,initialStoredMm:0,fillMinute:emptyFillHours*60,dryMinute,fullStoreRateMmHr:q,phase:'post-dry-initially-empty-boundary'});
    else refusedModels.push({...root,reason:'empty-boundary-not-full-by-storm-end'});
    const tf=(R*T-H-q*T)/(F-q);
    if(!(tf>=0&&tf<T)){refusedModels.push({...root,reason:'no-resolved-full-receiver-by-storm-end'});continue;}
    const z=k*tf,gap=(F-q)*tf*(z===0?1:Math.expm1(z)/z),S=C-gap;
    if(!Number.isFinite(S)||S<0||S>C){refusedModels.push({...root,reason:'post-dry-derived-initial-water-outside-domain'});continue;}
    if(!proposals.some(p=>p.capacityMm===C&&p.initialStoredMm===S&&p.drainagePerHour===k))
      proposals.push({...root,initialStoredMm:S,fillMinute:tf*60,dryMinute,fullStoreRateMmHr:q,phase:'post-dry-filled-during-rain'});
  }
  return {status:proposals.length?'proposals':'unsupported-central-pair',proposals,roots,refusedBranches,refusedModels,drainagePerHour:k,logAmplitude,
    meaning:'Finite central-value proposals for a uniform receiver full at storm end and dry at the surface by the first inventory. Both monotone capacity branches are examined; every proposed model still requires complete original-band forward evaluation. Numerical guards are computational conventions, not measurement uncertainty or certified root enclosures. No unique physical identification is claimed.'};
}

/** Three original cumulative drainage calibration values, all after surface dry.
 * Unequal time spacing is supported. The resulting retained course is a derived
 * model quantity; only the original drainage rows are used for forward evidence.
 */
export function inferPostDryDrainedReceivers(input){
  if(!input||typeof input!=='object')return {status:'refused',reason:'missing-original-post-dry-input'};
  const {rainMmHr:R,infiltrationMmHr:f,stormMinutes,stormEndDepthMm:H,areaM2,earlier,middle,later}=input;
  if(![R,f,stormMinutes,H,areaM2].every(v=>typeof v==='number'&&Number.isFinite(v))||!(R>0&&R<=250&&f>0&&f<=2000&&stormMinutes>0&&stormMinutes<720&&H>0&&H<=1000&&areaM2>0&&areaM2<=5760000))
    return {status:'refused',reason:'unsupported-post-dry-surface-or-footprint'};
  for(const row of [earlier,middle,later])if(!row||row.use!=='calibration'||row.channel!=='drained'||![row.minute,row.valueLiters].every(v=>typeof v==='number'&&Number.isFinite(v))||row.minute<=stormMinutes||row.minute>720||row.valueLiters<0||row.valueLiters>1e12)
    return {status:'refused',reason:'need-three-original-cumulative-drainage-calibration-values-after-storm'};
  if(!(earlier.minute<middle.minute&&middle.minute<later.minute))
    return {status:'refused',reason:'need-three-distinct-ordered-drainage-times'};
  const firstIncrement=middle.valueLiters-earlier.valueLiters,secondIncrement=later.valueLiters-middle.valueLiters;
  if(!(firstIncrement>0&&secondIncrement>0))
    return {status:'refused',reason:'drainage-triplet-does-not-resolve-positive-increments'};
  const firstHours=(middle.minute-earlier.minute)/60,secondHours=(later.minute-middle.minute)/60;
  const observedLogRatio=Math.log(secondIncrement)-Math.log(firstIncrement);
  const zeroRateLogRatio=Math.log(secondHours)-Math.log(firstHours);
  if(!(observedLogRatio<zeroRateLogRatio))
    return {status:observedLogRatio===zeroRateLogRatio?'non-identifying':'refused',reason:'drainage-triplet-does-not-resolve-decreasing-average-rate'};
  const logRatio=k=>k===0?zeroRateLogRatio:-k*firstHours+Math.log(-Math.expm1(-k*secondHours))-Math.log(-Math.expm1(-k*firstHours));
  const atUpper=logRatio(100);
  if(!Number.isFinite(atUpper)||observedLogRatio<atUpper)
    return {status:'refused',reason:'drainage-triplet-rate-outside-maintained-domain'};
  let lo=0,hi=100,drainageRateIterations=0;
  for(;drainageRateIterations<128;drainageRateIterations++){
    const mid=lo+(hi-lo)/2;if(mid===lo||mid===hi)break;
    const value=logRatio(mid);if(!Number.isFinite(value))return {status:'refused',reason:'nonfinite-drainage-rate-root'};
    if(value===observedLogRatio){lo=mid;hi=mid;break;}
    if(value>observedLogRatio)lo=mid;else hi=mid;
  }
  const k=lo+(hi-lo)/2,logResidual=logRatio(k)-observedLogRatio;
  const numericalLogGuard=64*Number.EPSILON*Math.max(1,Math.abs(observedLogRatio),Math.abs(k*firstHours));
  if(!(k>0&&k<=100)||!Number.isFinite(logResidual)||Math.abs(logResidual)>numericalLogGuard)
    return {status:'refused',reason:'post-dry-drainage-rate-not-numerically-resolved',logResidual,numericalLogGuard};
  const firstRetainedLiters=firstIncrement/(-Math.expm1(-k*firstHours));
  const secondRetainedLiters=firstRetainedLiters*Math.exp(-k*firstHours);
  const eventualDrainageLiters=earlier.valueLiters+firstRetainedLiters;
  const derivedInitialStoredMm=eventualDrainageLiters/areaM2-R*stormMinutes/60;
  if(![firstRetainedLiters,secondRetainedLiters,eventualDrainageLiters,derivedInitialStoredMm].every(Number.isFinite)||!(firstRetainedLiters>0&&secondRetainedLiters>0))
    return {status:'refused',reason:'derived-post-dry-course-not-numerically-resolved'};
  const result=solvePostDryRetainedCourse(input,{minute:earlier.minute,valueLiters:firstRetainedLiters},{minute:middle.minute,valueLiters:secondRetainedLiters},k);
  return {...result,drainageCurvePerHour:k,drainageRateIterations,drainageRateLogResidual:logResidual,drainageRateNumericalLogGuard:numericalLogGuard,
    derivedCourse:{firstMinute:earlier.minute,secondMinute:middle.minute,firstRetainedLiters,secondRetainedLiters,eventualDrainageLiters,derivedInitialStoredMm,
      meaning:'Derived model-course values from the three original cumulative drainage centers, not additional observations. Eventual total assumes all rain eventually reaches this isolated receiving footprint and drainage starts at the original event baseline.'},
    meaning:'Finite conditional proposals from three original cumulative drainage calibration centers with unequal spacing allowed. Surface dry by the first drainage reading and a full receiver at storm end are assumptions to challenge through every original forward band. Both capacity branches and their distinct initially-full and initially-empty alternatives remain explicit. Derived retained values are internal model quantities, never original evidence; held values do not enter the inverse. Numerical guards are not certified root or parameter enclosures.'};
}

export const UNFILLED_RECEIVING_RATE_POINTS=9;
export const UNFILLED_RECEIVING_MAXIMUM_PROPOSALS=UNFILLED_RECEIVING_RATE_POINTS*3*2;
export const UNFILLED_DRAIN_RATE_ITERATIONS=48;
export const UNFILLED_DRAIN_RATE_EVALUATIONS=UNFILLED_RECEIVING_RATE_POINTS+(UNFILLED_RECEIVING_RATE_POINTS-1)*(2+UNFILLED_DRAIN_RATE_ITERATIONS);
export const UNFILLED_DRAIN_MAXIMUM_PROPOSALS=(UNFILLED_RECEIVING_RATE_POINTS+1)*3*2;

/** Finite computational witnesses for a receiver that never reaches capacity.
 * Original-band values constrain initial water at fixed rate points. Capacity
 * is deliberately an arbitrary witness above maximum modeled storage, not an
 * estimate: every capacity above that storage has the same admitted course.
 * All proposals still require the original maintained full-grid forward check.
 */
export function proposeUnfilledReceivingBandWitnesses(input){
  if(!input||typeof input!=='object')return {status:'refused',reason:'missing-unfilled-band-source',proposals:[]};
  const {rainMmHr:R,infiltrationMmHr:F,stormMinutes,stormEndDepthMm:H,stormUncertaintyMm,areaM2,readings,drainedReadings=[]}=input;
  const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
  if(!finite(R,Number.MIN_VALUE,250)||!finite(F,Number.MIN_VALUE,2000)||!finite(stormMinutes,Number.MIN_VALUE,720)||
    !finite(H,0,1000)||!finite(stormUncertaintyMm,0,1000)||!finite(areaM2,Number.MIN_VALUE,5760000)||!Array.isArray(readings)||readings.length<2||readings.length>128)
    return {status:'refused',reason:'unsupported-unfilled-band-source',proposals:[]};
  if(readings.some(row=>!row||row.use!=='calibration'||row.channel!=='retained'||!finite(row.minute,stormMinutes,720)||row.minute<=stormMinutes||
    !finite(row.valueLiters,0,1e12)||!finite(row.uncertaintyLiters,0,1e12)))return {status:'refused',reason:'need-original-retained-calibration-bands',proposals:[]};
  if(!Array.isArray(drainedReadings)||drainedReadings.length+readings.length>128||drainedReadings.some(row=>!row||row.use!=='calibration'||row.channel!=='drained'||!finite(row.minute,0,720)||
    !finite(row.valueLiters,0,1e12)||!finite(row.uncertaintyLiters,0,1e12)))return {status:'refused',reason:'need-original-drained-calibration-bands',proposals:[]};
  const rows=[...readings].sort((a,b)=>a.minute-b.minute),first=rows[0],last=rows.at(-1),T=stormMinutes/60,J=Math.min(R,F);
  const {surfaceDepth,dryHours,possible}=unfilledReceivingSurfaceCourse(input);
  if(last.minute<=first.minute)return {status:'unresolved',reason:'need-distinct-retained-times',proposals:[]};
  if(!possible)
    return {status:'unresolved',reason:'original-storm-band-or-times-do-not-admit-unfilled-course',proposals:[],conditionalSurfaceDepthMm:surfaceDepth,conditionalDryMinute:dryHours*60};
  const lower=row=>Math.max(0,row.valueLiters-row.uncertaintyLiters),upper=row=>row.valueLiters+row.uncertaintyLiters;
  if(!(upper(first)>0&&upper(last)>0))return {status:'unresolved',reason:'no-positive-retained-band-rate-start',proposals:[]};
  const dt=(last.minute-first.minute)/60,minimumRate=Math.max(1e-10,lower(first)>0?(Math.log(lower(first))-Math.log(upper(last)))/dt:0),
    maximumRate=Math.min(100,lower(last)>0?(Math.log(upper(first))-Math.log(lower(last)))/dt:100);
  if(!finite(minimumRate,1e-10,100)||!finite(maximumRate,1e-10,100)||minimumRate>maximumRate)
    return {status:'unresolved',reason:'no-positive-retained-band-rate-start',proposals:[]};
  // These are computational starts, not interval endpoints certified by
  // directed rounding. At an exact log-ratio endpoint the transformed S0 band
  // can reverse by a few ulps across JS engines. Move only the two endpoint
  // starts into a nonzero-width interval; never enlarge a measurement band,
  // repair an inverted S0 interval, or claim the unsampled edge is covered.
  const rateWidth=maximumRate-minimumRate,endpointInsetPerHour=Math.min(rateWidth/4,64*Number.EPSILON*Math.max(Math.abs(minimumRate),Math.abs(maximumRate)));
  const proposals=[],refusals=[],ratePoints=[],refinements=[];let bandIntersections=0,rateEvaluations=0;
  function initialBand(k){
    rateEvaluations++;
    // Multiplying storage by exp(kt) isolates the unknown original S0. During
    // rain the intake is J; any subsequent surface ponding supplies F until dry.
    // Overflow is an unresolved computational point, never a repaired root.
    const inputAmplitude=J/k*Math.expm1(k*T)+F/k*Math.exp(k*T)*Math.expm1(k*(dryHours-T));
    let lowerInitial=0,upperInitial=10000;
    for(const row of rows){bandIntersections++;const multiplier=Math.exp(k*row.minute/60)/areaM2;
      lowerInitial=Math.max(lowerInitial,lower(row)*multiplier-inputAmplitude);
      upperInitial=Math.min(upperInitial,upper(row)*multiplier-inputAmplitude);
    }
    // Original cumulative drainage supplies an independent constraint on the
    // same S0. For this conditional never-full course, intake is J during rain
    // and F while the remaining surface water drains into the receiver. The
    // linear inventory solution gives D(t)=S0*(1-exp(-kt))+I(t)-S_input(t).
    // Use the original D band directly; no derived retained reading is created.
    for(const row of drainedReadings){
      bandIntersections++;const t=row.minute/60;
      if(t===0)continue; // D(0)=0 is parameter-independent; final originals bind.
      const rainHours=Math.min(t,T),pondedHours=Math.max(0,Math.min(t,dryHours)-T),initialLoss=-Math.expm1(-k*t),
        inputWater=J*rainHours+F*pondedHours,
        inputStored=J/k*(-Math.expm1(-k*rainHours))*Math.exp(-k*(t-rainHours))+
          (pondedHours?F/k*(-Math.expm1(-k*pondedHours))*Math.exp(-k*(t-T-pondedHours)):0);
      lowerInitial=Math.max(lowerInitial,(lower(row)/areaM2-inputWater+inputStored)/initialLoss);
      upperInitial=Math.min(upperInitial,(upper(row)/areaM2-inputWater+inputStored)/initialLoss);
    }
    return {inputAmplitude,lowerInitial,upperInitial};
  }
  const points=[];
  for(let i=0;i<UNFILLED_RECEIVING_RATE_POINTS;i++){
    const rateFraction=i/(UNFILLED_RECEIVING_RATE_POINTS-1),k=i===0?minimumRate+endpointInsetPerHour:i===UNFILLED_RECEIVING_RATE_POINTS-1?maximumRate-endpointInsetPerHour:minimumRate+rateWidth*rateFraction,
      sampledRateFraction=rateWidth>0?(k-minimumRate)/rateWidth:null;
    points.push({ratePoint:{rateFraction,sampledRateFraction,endpointInsetPerHour:i===0||i===UNFILLED_RECEIVING_RATE_POINTS-1?endpointInsetPerHour:0,drainagePerHour:k},...initialBand(k)});
  }
  if(rateWidth>0&&drainedReadings.some(row=>row.minute>0)){
    // Adapt the estate's retained C1 bounded golden-section experiment to this
    // conditional one-dimensional feasibility problem. Examine every original
    // grid gap with fixed work; keep one extra best computational rate. This is
    // neither a global minimum proof nor an exhaustive feasible-region search.
    let best=null;const ratio=(Math.sqrt(5)-1)/2;
    const assess=k=>{const band=initialBand(k),score=[band.inputAmplitude,band.lowerInitial,band.upperInitial].every(Number.isFinite)?band.lowerInitial-band.upperInitial:Infinity,
      point={k,score,...band};if(Number.isFinite(score)&&(!best||score<best.score))best=point;return point;};
    for(let i=0;i<UNFILLED_RECEIVING_RATE_POINTS-1;i++){
      let a=points[i].ratePoint.drainagePerHour,b=points[i+1].ratePoint.drainagePerHour;
      const originalBracket=[a,b],before=rateEvaluations;let c=assess(b-ratio*(b-a)),d=assess(a+ratio*(b-a));
      for(let iteration=0;iteration<UNFILLED_DRAIN_RATE_ITERATIONS;iteration++){
        if(c.score<d.score){b=d.k;d=c;c=assess(b-ratio*(b-a));}
        else{a=c.k;c=d;d=assess(a+ratio*(b-a));}
      }
      const local=c.score<d.score?c:d;
      refinements.push({originalBracket,finalBracket:[a,b],evaluations:rateEvaluations-before,drainagePerHour:local.k,initialIntervalMm:[local.lowerInitial,local.upperInitial],score:local.score});
    }
    if(best)points.push({...best,ratePoint:{rateFraction:null,sampledRateFraction:(best.k-minimumRate)/rateWidth,endpointInsetPerHour:0,drainagePerHour:best.k,rateMethod:'original-retained-and-drained-band-refinement'}});
  }
  if(rateEvaluations>UNFILLED_DRAIN_RATE_EVALUATIONS)throw Error('Complete unfilled calibration-rate evaluation reservation was exceeded.');
  for(const {ratePoint,inputAmplitude,lowerInitial,upperInitial}of points){
    const k=ratePoint.drainagePerHour;
    ratePoints.push({...ratePoint,initialIntervalMm:[lowerInitial,upperInitial]});
    if(![inputAmplitude,lowerInitial,upperInitial].every(Number.isFinite)||lowerInitial>upperInitial){refusals.push({...ratePoint,reason:'no-finite-nonnegative-initial-band-at-fixed-rate'});continue;}
    for(const initialFraction of [0,.5,1]){
      const initialStoredMm=initialFraction===0?lowerInitial:initialFraction===1?upperInitial:lowerInitial+initialFraction*(upperInitial-lowerInitial),atStorm=initialStoredMm*Math.exp(-k*T)+J/k*(-Math.expm1(-k*T)),
        atDry=atStorm*Math.exp(-k*(dryHours-T))+F/k*(-Math.expm1(-k*(dryHours-T))),maximumStoredMm=Math.max(initialStoredMm,atStorm,atDry);
      // Positive slack supplies a concrete non-full witness. It is neither
      // measurement uncertainty nor a certified error or capacity bound.
      const slack=Math.max(1e-8,1e-9*maximumStoredMm);
      for(const [capacityChoice,capacityMm]of [['near-maximum',maximumStoredMm+slack],['larger-witness',Math.max(2*maximumStoredMm,maximumStoredMm+1)]]){
        const provenance={...ratePoint,initialFraction,capacityChoice,initialIntervalMm:[lowerInitial,upperInitial],maximumModeledStorageMm:maximumStoredMm};
        if(![capacityMm,initialStoredMm,k].every(Number.isFinite)||capacityMm<=0||capacityMm>10000||initialStoredMm<0||initialStoredMm>capacityMm){refusals.push({...provenance,reason:'unfilled-witness-outside-maintained-domain'});continue;}
        proposals.push({capacityMm,initialStoredMm,drainagePerHour:k,phase:'never-filled-finite-witness',dryMinute:dryHours*60,...provenance,
          meaning:'Arbitrary admissible capacity witness above maximum modeled inventory; not an estimated soil capacity or certified lower bound. Original full-grid bands remain authoritative.'});
      }
    }
  }
  return {status:proposals.length?'proposals':'unresolved',proposals,refusals,ratePoints,refinements,rateEvaluations,bandIntersections,minimumRatePerHour:minimumRate,maximumRatePerHour:maximumRate,
    conditionalSurfaceDepthMm:surfaceDepth,conditionalDryMinute:dryHours*60,
    endpointInsetPerHour,
    meaning:'Nine fixed conditional rate points and, when original positive-time drainage calibration exists, one extra rate from48golden-section steps in each of eight fixed gaps. Three initial-band points each have two explicit capacity witnesses. Original retained and cumulative-drained calibration bands constrain the same initial inventory; no derived observations are inserted. For a nonzero-width rate interval, endpoint starts move inward by min(width/4,64machine epsilons times maximum absolute rate); nominal and sampled fractions are recorded. These are computational grid/search conventions, not extra measurement uncertainty, a certified enclosure or global optimality proof. Every original calibration band is retained. This is a finite computational proposal family, not a continuous enclosure, probability distribution or identified parameter set.'};
}

/** Shared admission arithmetic for the unchanged never-filled producer and its
 * complete preflight budget. Impossible source phases still return their refusal. */
export function unfilledReceivingSurfaceCourse(input){
  const {rainMmHr:R,infiltrationMmHr:F,stormMinutes,stormEndDepthMm:H,stormUncertaintyMm,readings}=input;
  const T=stormMinutes/60,J=Math.min(R,F),surfaceDepth=(R-J)*T,dryHours=T+surfaceDepth/F;
  return {surfaceDepth,dryHours,possible:Math.abs(surfaceDepth-H)<=stormUncertaintyMm&&Array.isArray(readings)&&readings.every(row=>row.minute/60>=dryHours)};
}

/** Finite full-store-rate parameterization. All original calibration bands bind;
 * monotone inner solves and bounded outer proposals do not certify completeness. */
export const FILLED_Q_POINTS=9, FILLED_Q_UPDATES=48, FILLED_K_BISECTIONS=64;
export const FILLED_RATE_FRACTIONS=Object.freeze([.25,.5,.75]);
export const FILLED_DRAIN_MAXIMUM_PROPOSALS=FILLED_Q_POINTS+FILLED_RATE_FRACTIONS.length;
export const FILLED_Q_EVALUATIONS=FILLED_Q_POINTS+(FILLED_Q_POINTS-1)*(2+FILLED_Q_UPDATES);

export function prepareFilledDrainBandSource(input){
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
  return {status:'ready',R,H,F,T,areaM2,rows,drainedReadings,firstHours,rainVolume,qMin,qMax};
}

const filledDrainReservation=prepared=>prepared.status==='ready'
  ? {status:'active',qEvaluations:FILLED_Q_EVALUATIONS,maximumProposals:FILLED_DRAIN_MAXIMUM_PROPOSALS,
      bandIntersections:FILLED_Q_EVALUATIONS*(prepared.rows.length+prepared.drainedReadings.length),
      modelEvaluations:FILLED_Q_EVALUATIONS*(prepared.rows.length+prepared.drainedReadings.length)*(2+2*FILLED_K_BISECTIONS)}
  : {status:'inactive',reason:prepared.reason,qEvaluations:0,maximumProposals:0,bandIntersections:0,modelEvaluations:0};
export function reserveFilledDrainBandWork(input){return filledDrainReservation(prepareFilledDrainBandSource(input));}

export function proposeFilledDrainBandWitnesses(input){
  const prepared=prepareFilledDrainBandSource(input),reservation=filledDrainReservation(prepared);
  if(prepared.status!=='ready')return {...prepared,reservation};
  const {H,F,T,areaM2,rows,drainedReadings,firstHours,rainVolume,qMin,qMax}=prepared;
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
      // An original band wholly beyond the physical k domain still binds the
      // intersection at that domain boundary. Skipping that bound produces a
      // discontinuous outer score and can hide a narrow feasible full-rate gap.
      // The separate positive violation forbids treating a clamped bound as a
      // compatible interval; no original band or physical domain is enlarged.
      if(minimum>high)lower=Math.max(lower,kMax);
      else if(maximum>high)lower=Math.max(lower,root(high,row));
      if(maximum<low)upper=Math.min(upper,kMin);
      else if(minimum<low)upper=Math.min(upper,root(low,row));
    }
    const score=lower-upper+violation*(kMax-kMin);
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
    const [lo,hi]=point.rateInterval,width=hi-lo;
    for(const fraction of point.origin.method==='fixed-full-rate'?[.5]:FILLED_RATE_FRACTIONS){
      const k=lo+width*fraction,C=point.q/k;
      const emptyBoundary=k===point.emptyRate,initial=emptyBoundary?0:C-(F-point.q)/k*Math.expm1(k*point.fillHours);
      if(![k,C,initial].every(Number.isFinite)||!(k>0&&k<=100&&C>0&&C<=10000&&initial>=0&&initial<=C)){refusals.push({q:point.q,k,C,initial,reason:'finite-candidate-outside-original-domain'});continue;}
      proposals.push({capacityMm:C,initialStoredMm:initial,drainagePerHour:k,phase:emptyBoundary?'filled-drain-initially-empty-boundary':point.fillHours===0?'filled-drain-initially-full-boundary':'filled-drain-during-storm',fullStoreRateMmHr:point.q,fillMinute:point.fillHours*60,dryMinute:point.dryHours*60,rateInterval:[lo,hi],rateFraction:fraction,endpointInsetPerHour:0,qOrigin:point.origin});
    }
  }
  if(qEvaluations>reservation.qEvaluations||proposals.length>reservation.maximumProposals||modelEvaluations>reservation.modelEvaluations)throw Error('Prototype bounded work reservation exceeded');
  return {status:proposals.length?'proposals':'unresolved',proposals,refusals,points,refinements,qInterval:[qMin,qMax],counts:{qEvaluations,modelEvaluations,bandIntersections},reservation,meaning:'Finite conditional filled-course witnesses from original calibration bands; exact physical forward validation remains required. No exhaustive coverage, parameter identification or original-source replacement.'};
}

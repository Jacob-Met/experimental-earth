const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const refusal=reason=>({status:'refused',reason});
const exprel=x=>x===0?1:Math.expm1(x)/x;

function wetCourse(input){
  if(!input||typeof input!=='object')return refusal('unsupported-positive-wet-course');
  const {rainMmHr:R,infiltrationMmHr:f,stormMinutes,laterMinute,stormEndDepthMm:H,laterDepthMm:L,account}=input;
  if(!finite(R,0,250)||R===0||!finite(f,0,2000)||f===0||!finite(stormMinutes,0,720)||stormMinutes===0||!finite(laterMinute,0,720)||laterMinute<=stormMinutes||!finite(H,0,1000)||H===0||!finite(L,0,1000)||L===0)
    return refusal('unsupported-positive-wet-course');
  if(!account||!finite(account.areaM2,0,5760000)||account.areaM2===0||!['retained','drained'].includes(account.channel)||!finite(account.valueLiters,0,1e12)||account.use!=='calibration'||!finite(account.minute,stormMinutes,laterMinute))
    return refusal('account-outside-proved-wet-full-interval');
  const T=stormMinutes/60,t=laterMinute/60,F=Math.min(R,f),q=(H-L)/(t-T);
  if(!(q>=0&&q<F))return refusal('unsupported-full-receiver-recession');
  return {status:'course',R,F,T,t,H,L,q,account,tf:((R-q)*T-H)/(F-q)};
}
function proposal(course,C,S,k,phase,iterations=0){
  if(!finite(C,0,10000)||C===0||!finite(S,0,C)||!finite(k,0,100))return refusal('derived-parameters-outside-original-domain');
  return {status:'proposal',capacityMm:C,initialStoredMm:S,drainagePerHour:k,
    fillMinute:phase==='initially-full-boundary'?0:course.tf*60,
    fullStoreRateMmHr:course.q,phase,iterations};
}

/** Central proposals from a wet surface recession and one original receiver
 * account. Every proposal must subsequently pass all original forward bands.
 * Neither a supplied initial water amount nor held evidence enters this inverse.
 */
export function inferReceivingAccountCentral(input){
  const course=wetCourse(input);if(course.status!=='course')return course;
  const {F,q,tf,account}=course;
  if(!(tf>=0&&tf<course.T))return refusal('no-resolved-full-receiver-by-storm-end');
  const amount=account.valueLiters/account.areaM2;
  if(account.channel==='retained'){
    const C=amount;if(!(C>0&&C<=10000))return refusal('unsupported-capacity');
    const k=q/C,S=C-(F-q)*tf*exprel(k*tf);
    return proposal(course,C,S,k,'wet-full-central');
  }
  const elapsed=account.minute/60,guard=1e-9*Math.max(1,amount,q*elapsed);
  if(q===0)return amount===0?{status:'non-identifying',reason:'zero-drainage-does-not-identify-initial-water'}:refusal('drainage-contradicts-degenerate-wet-course');
  if(tf===0)return Math.abs(amount-q*elapsed)<=guard?
    {status:'non-identifying',reason:'initially-full-drainage-fixes-only-the-product-kC'}:refusal('drainage-contradicts-degenerate-wet-course');
  const admittedIntake=F*tf+q*(elapsed-tf),targetGap=admittedIntake-amount;
  if(!(targetGap>0&&Number.isFinite(targetGap)))return refusal('drainage-outside-admitted-capacity-and-initial-water');
  // C=q/k; the maximum capacity supplies the lower k endpoint. The final
  // parameter-domain check also requires S>=0. No inferred S is clipped.
  const gap=k=>(F-q)*tf*exprel(k*tf);
  let lo=q/10000,hi=100,iterations=0;
  const low=gap(lo),high=gap(hi);
  if(!Number.isFinite(low)||targetGap<low||targetGap>high)return refusal('drainage-outside-admitted-capacity-and-initial-water');
  if(targetGap===low)hi=lo;
  else if(targetGap===high)lo=hi;
  else for(;iterations<128;iterations++){
    const mid=lo+(hi-lo)/2;if(mid===lo||mid===hi)break;
    const value=gap(mid);
    if(Number.isNaN(value))return refusal('drainage-inverse-not-numerically-resolved');
    if(value===targetGap){lo=mid;hi=mid;break;}
    if(value<targetGap)lo=mid;else hi=mid;
  }
  const k=lo+(hi-lo)/2,resolvedGap=gap(k),C=q/k,S=C-resolvedGap;
  const numericalGuardMm=64*Number.EPSILON*Math.max(1,Math.abs(targetGap),Math.abs(admittedIntake),Math.abs(amount),Math.abs(resolvedGap));
  if(!Number.isFinite(resolvedGap)||Math.abs(resolvedGap-targetGap)>numericalGuardMm)
    return {...refusal('drainage-inverse-not-numerically-resolved'),numericalGuardMm};
  if(!(S>=0&&S<=C))return refusal('drainage-outside-admitted-capacity-and-initial-water');
  return {...proposal(course,C,S,k,'wet-full-central',iterations),numericalGuardMm};
}

/** A separately enumerated initial-full boundary, not a clipped interior root.
 * Its surface intercept is checked only through the original forward bands.
 */
export function proposeInitiallyFullReceivingAccount(input){
  const course=wetCourse(input);if(course.status!=='course')return course;
  if(course.account.channel!=='retained'||!(course.account.valueLiters>0))return refusal('initially-full-proposal-requires-positive-retained-total');
  const C=course.account.valueLiters/course.account.areaM2;
  return proposal(course,C,C,course.q/C,'initially-full-boundary');
}

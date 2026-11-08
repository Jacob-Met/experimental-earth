import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
import {estimateArchivedRainTimingWork,inspectArchivedRainTiming} from './archived-rain-timing.js';
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const v=encode(q);need(v.numerator.length<=650&&v.denominator.length<=650,'Exact peak output exceeds its encoded numeric budget.');return v;};
function prepare(originalText,readingText,criterionText){
 need(typeof criterionText==='string'&&criterionText.length>0&&!criterionText.startsWith('\uFEFF'),'Peak criterion requires nonempty exact UTF-8 without BOM.');
 const bytes=new TextEncoder().encode(criterionText);need(bytes.length<=4096&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===criterionText,'Peak criterion exceeds its byte limit or contains a lone surrogate.');
 const criterion=JSON.parse(criterionText),pending=[criterion];
 while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),'Peak criterion contains a non-finite number.');else if(typeof v==='string')need(v.isWellFormed(),'Peak criterion contains an escaped lone surrogate.');else if(v!==null&&typeof v==='object')for(const child of Object.values(v))pending.push(child);}
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=600;
 need(exact(criterion,['schema','id','metric','operator','valueMm','source'])&&criterion.schema==='experimental-earth-archived-rain-peak-criterion/1'&&criterion.metric==='peak-surface-water-mm'&&criterion.operator==='at-most'&&text(criterion.id)&&text(criterion.source)&&Number.isFinite(criterion.valueMm)&&criterion.valueMm>=0,'Supply one explicit nonnegative peak-water at-most criterion.');
 const target=from(criterion.valueMm),terminal=estimateArchivedRainTimingWork(originalText,readingText);
 const expected={bins:3,maxProfiles:2,maxSegmentsPerProfile:6,maxTotalSegments:12,reservedScalarWork:4096};
 const limits={originalBytes:16384,readingBytes:4096,persistentBits:8192,intermediateBits:16384};
 need(exact(terminal,[...Object.keys(expected),'limits'])&&Object.entries(expected).every(([k,v])=>terminal[k]===v)&&exact(terminal.limits,Object.keys(limits))&&Object.entries(limits).every(([k,v])=>terminal.limits[k]===v),'Parent timing work contract differs.');
 const work={terminal,additionalPreflightWork:512,peakWork:5632,additionalWork:6144,totalWork:10240,limits:{originalBytes:16384,readingBytes:4096,criterionBytes:4096,maxPeakSegments:9,maxPeakKnots:11,maxCombinedSegments:21,maxCombinedKnots:25,maxEncodedRationals:400,numericStringsMaxChars:650,completeSerializedBytesMax:1048576,persistentBits:8192,intermediateBits:16384}};
 need(work.totalWork===terminal.reservedScalarWork+work.additionalPreflightWork+work.peakWork&&work.additionalWork===work.additionalPreflightWork+work.peakWork,'Complete peak work was not reserved.');
 return {criterion,target,work};
}
export function estimateArchivedRainPeakWork(originalText,readingText,criterionText){return prepare(originalText,readingText,criterionText).work;}
function profile(quarter,q,ordering,lo,hi,endpoint){
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20);
 const amounts=quarter==='first'?[q,sub(five,q),five]:[five,q,sub(five,q)];
 const times=quarter==='first'?[zero,from(.25),from(.5),one]:[zero,from(.5),from(.75),one];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[],constant=ordering==='constant-bin';
 need(bins.length===3,'Peak bin reservation differs.');
 const segmentLimit=constant?3:6,knotLimit=constant?4:7;
 function emit(start,end,rate){const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative peak profile duration.');if(cmp(duration,zero)>0n){need(segments.length<segmentLimit,'Peak segment reservation exceeded.');segments.push({start,end,rate,depth:mul(rate,duration)});}}
 for(let i=0;i<3;i++){
  const bin=bins[i],duration=sub(bin.end,bin.start);need(cmp(duration,zero)>0n&&cmp(bin.amount,zero)>=0n&&cmp(bin.amount,mul(cap,duration))<=0n,'Peak bin violates its rate cap.');
  if(constant)emit(bin.start,bin.end,div(bin.amount,duration));
  else{const wet=div(bin.amount,cap);if(i===2){const split=add(bin.start,wet);emit(bin.start,split,cap);emit(split,bin.end,zero);}else{const split=sub(bin.end,wet);emit(bin.start,split,zero);emit(split,bin.end,cap);}}
 }
 need(segments.length>=3&&segments.length<=segmentLimit&&(!constant||segments.length===3),'Peak profile segment count differs.');
 let previous=zero,C=zero,F=zero,W=zero,minS=zero,peak=zero,attaining=zero;
 const knots=[{hour:e(zero),cumulativeRainMm:e(zero),cumulativeInfiltrationMm:e(zero),surfaceWaterMm:e(zero)}];
 for(const s of segments){
  need(cmp(s.start,previous)===0n&&cmp(s.end,s.start)>0n&&cmp(s.rate,zero)>=0n&&cmp(s.rate,cap)<=0n,'Peak profile coverage or rate invariant failed.');
  need(cmp(s.depth,mul(s.rate,sub(s.end,s.start)))===0n,'Peak profile integral mismatch.');
  C=add(C,s.depth);const S=sub(C,mul(six,s.end));minS=minimum(minS,S);W=sub(S,minS);const nextF=sub(C,W);
  need(cmp(W,zero)>=0n&&cmp(nextF,F)>=0n&&cmp(add(nextF,W),C)===0n,'Peak profile reflection or conservation failed.');
  if(cmp(W,peak)>0n){peak=W;attaining=s.end;}
  F=nextF;previous=s.end;need(knots.length<knotLimit,'Peak knot reservation exceeded.');
  knots.push({hour:e(previous),cumulativeRainMm:e(C),cumulativeInfiltrationMm:e(F),surfaceWaterMm:e(W)});
 }
 need(cmp(previous,one)===0n&&cmp(C,from(10))===0n&&knots.length===segments.length+1,'Peak profile does not cover the original event.');
 const totals=[];
 for(const bin of bins){let total=zero;for(const s of segments){const a=maximum(bin.start,s.start),b=minimum(bin.end,s.end);if(cmp(b,a)>0n)total=add(total,mul(s.rate,sub(b,a)));}need(cmp(total,bin.amount)===0n,'Peak profile does not attain its bin total.');totals.push(total);}
 const firstHalf=quarter==='first'?add(totals[0],totals[1]):totals[0],secondHalf=quarter==='first'?totals[2]:add(totals[1],totals[2]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,lo)>=0n&&cmp(q,hi)<=0n,'Peak profile violates original totals or declared band.');
 need(cmp(peak,endpoint)===0n,'Peak profile does not attain the claimed bound.');
 return {ordering,quarterTotalMm:e(q),bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,peakSurfaceWaterMm:e(peak),attainingPeakHour:e(attaining),terminalSurfaceWaterMm:e(W),originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)],withinDeclaredBand:true,rateCapVerified:true};
}
export function inspectArchivedRainPeak(originalText,readingText,criterionText){
 const p=prepare(originalText,readingText,criterionText),terminalReport=inspectArchivedRainTiming(originalText,readingText),reading=terminalReport.declaredReading;
 const z=from(reading.valueMm),u=from(reading.uncertaintyMm),five=from(5),lo=maximum(Q.zero,sub(z,u)),hi=minimum(five,add(z,u)),empty=cmp(lo,hi)>0n,first=reading.quarter==='first';
 let peakBounds=null,lowerWitness=null,upperWitness=null,classification='outside-support';
 if(!empty){
  const lower=maximum(from(4),first?sub(from(5.5),hi):add(from(.5),lo));
  const upper=first?sub(from(7),div(mul(from(3),lo),from(10))):add(from(5.5),div(mul(from(3),hi),from(10)));
  need(cmp(lower,upper)<=0n,'Peak bounds are inverted.');
  lowerWitness=profile(reading.quarter,first?hi:lo,'constant-bin',lo,hi,lower);
  upperWitness=profile(reading.quarter,first?lo:hi,'latest-latest-earliest',lo,hi,upper);
  peakBounds={lowerMm:e(lower),upperMm:e(upper),lowerInclusive:true,upperInclusive:true};
  classification=cmp(upper,p.target)<=0n?'certain-meet':cmp(lower,p.target)>0n?'certain-miss':'ambiguous';
 }
 return {schema:'experimental-earth-archived-rain-peak/1',declaredPeakCriterion:p.criterion,
  scope:{mathematicalDeclaration:true,retrospective:true,peakMetricSeparatelyDeclared:true,physicalAssociationVerified:false,instrumentAccuracyVerified:false,rateCapInferred:false,wholeSitePrediction:false,modelReplayed:false,originalSchedulesExhaustive:false,readingAvailabilityVerified:false,originalHalfHourTotalsAreAssumed:true,continuousTimePeak:true,originalTerminalTargetUnchanged:true},work:p.work,terminalReport,
  assessment:{status:empty?'declared-reading-incompatible':'declared-reading-compatible',quarterIntervalMinutes:first?[0,15]:[30,45],parameters:{valueMm:e(z),uncertaintyMm:e(u),conductivityMmHr:e(from(6)),rateCapMmHr:e(from(20)),peakTargetMm:e(p.target),originalHalfHourTotalsMm:[e(five),e(five)]},compatibleQuarterBand:{lowerMm:e(lo),upperMm:e(hi),empty},peakBounds,classification,lowerWitness,upperWitness},
  meaning:'The separately declared peak criterion and the unchanged original terminal target answer different questions. This is retrospective mathematical analysis of a continuous rate-capped family under hypothetical 5+5 mm totals; the three original schedules are illustrative, not exhaustive. No physical association, instrument precision, record availability, probability, acquisition, chronology or physical action is verified or inferred. No model is replayed and no UI or retained-snapshot peak is changed. Each peak witness has one exact attaining knot, not all ties or the earliest continuous attainment. Constant-rate rainfall segments certify global water peaks through endpoint maxima; infiltration and water need not interpolate linearly between knots. Scalar work excludes parsing, general string validation, serialization and rational bit costs and is not a CPU, memory or wall-time guarantee.'};
}

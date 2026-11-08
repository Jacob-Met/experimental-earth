import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
import {estimateArchivedRainPairedPeakWork,inspectArchivedRainPairedPeak} from './archived-rain-paired-peak.js';
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const v=encode(q);need(v.numerator.length<=650&&v.denominator.length<=650,'Exact ponded duration output exceeds its numeric encoding budget.');return v;};
function sameShape(value,expected){
 if(expected===null||typeof expected!=='object')return value===expected;
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.keys(expected).every(k=>Object.hasOwn(value,k)&&sameShape(value[k],expected[k]));
}
const WORK={"paired":{"firstQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"thirdQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":2048,"pairedPeakWork":8192,"additionalWork":10240,"totalWork":30720,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPairedSegments":12,"maxPairedKnots":14,"maxCombinedSegments":54,"maxCombinedKnots":64,"maxEncodedRationals":1024,"numericStringsMaxChars":650,"completeSerializedBytesMax":2097152,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":4096,"pondedDurationWork":16384,"additionalWork":20480,"totalWork":51200,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPondedProfiles":2,"maxPondedSegments":12,"maxPondedKnots":14,"maxDurationRecords":12,"maxCombinedSegments":66,"maxCombinedKnots":78,"maxEncodedRationals":1536,"numericStringsMaxChars":650,"completeSerializedBytesMax":4194304,"maxReportValues":32768,"persistentBits":8192,"intermediateBits":16384}};
const SCOPE={"mathematicalDeclaration":true,"retrospective":true,"peakMetricSeparatelyDeclared":true,"originalHalfHourTotalsAreAssumed":true,"continuousTimePeak":true,"originalTerminalTargetUnchanged":true,"jointQuarterConstraints":true,"physicalAssociationVerified":false,"instrumentAccuracyVerified":false,"rateCapInferred":false,"wholeSitePrediction":false,"modelReplayed":false,"originalSchedulesExhaustive":false,"readingAvailabilityVerified":false,"statisticalIndependenceAssumed":false,"strictPondedDuration":true,"zeroThresholdOnly":true,"laterHalfAlwaysPondedProved":true};

function prepare(originalText,firstText,thirdText,criterionText){
 const paired=estimateArchivedRainPairedPeakWork(originalText,firstText,thirdText,criterionText);
 need(sameShape(paired,WORK.paired),'Complete parent paired peak work contract differs.');
 // The parent has admitted this exact bounded text before the additional check.
 need(JSON.parse(criterionText).valueMm===0,'Ponded duration requires an explicit zero-depth criterion.');
 const work={...WORK,paired,limits:{...WORK.limits}};
 need(work.totalWork===paired.totalWork+work.additionalWork&&work.additionalWork===work.additionalPreflightWork+work.pondedDurationWork&&work.totalWork===51200,'Complete ponded duration work was not reserved.');
 return work;
}
export function estimateArchivedRainPondedDurationWork(originalText,firstText,thirdText,criterionText){return prepare(originalText,firstText,thirdText,criterionText);}
function band(reading){const z=from(reading.valueMm),u=from(reading.uncertaintyMm),lo=maximum(Q.zero,sub(z,u)),hi=minimum(from(5),add(z,u));return {lo,hi,empty:cmp(lo,hi)>0n};}
const encodedBand=b=>({lowerMm:e(b.lo),upperMm:e(b.hi),empty:b.empty});

function lowerBound(q){
 if(cmp(q,from(1.5))<=0n)return add(from(.5),div(sub(from(3.5),q),from(14)));
 const w=sub(q,from(1.5));
 return add(add(from(.5),div(w,from(14))),minimum(from(.25),add(div(w,from(6)),div(from(1),from(7)))));
}
const upperBound=q=>add(from(.75),minimum(from(.25),div(q,from(6))));
// Reflect inside each segment: endpoint water alone misses a dry tail.
// An isolated zero endpoint does not reduce positive-time measure.
function integrate(segment,index,startWater,endWater){
 const zero=Q.zero,L=sub(segment.end,segment.start),slope=sub(segment.rate,from(6));
 const unreflectedEnd=add(startWater,mul(slope,L));
 need(cmp(endWater,maximum(zero,unreflectedEnd))===0n,'Ponded segment reflection failed.');
 let kind,duration,drain=null;
 if(cmp(startWater,zero)===0n&&cmp(slope,zero)<=0n){kind='dry';duration=zero;}
 else if(cmp(unreflectedEnd,zero)>=0n){kind='wet';duration=L;}
 else{
  need(cmp(startWater,zero)>0n&&cmp(slope,zero)<0n,'Ponded depletion has an invalid initial state.');
  // Only the zero-rain first-quarter tail depletes inside these profiles.
  need(cmp(segment.rate,zero)===0n,'Ponded endpoint depletion has an unexpected rain rate.');
  duration=div(startWater,from(6));drain=add(segment.start,duration);
  need(cmp(drain,segment.start)>0n&&cmp(drain,segment.end)<0n,'Ponded depletion is outside the strict segment interior.');
  need(cmp(add(startWater,mul(slope,duration)),zero)===0n&&cmp(endWater,zero)===0n,'Ponded depletion does not reach zero.');
  kind='drains-to-dry';
 }
 need(cmp(duration,zero)>=0n&&cmp(duration,L)<=0n,'Ponded duration is outside its segment.');
 return {duration,record:{segmentIndex:index,startHour:e(segment.start),endHour:e(segment.end),startWaterMm:e(startWater),endWaterMm:e(endWater),case:kind,drainHour:drain===null?null:e(drain),durationHours:e(duration)}};
}
function profile(q,r,upper,first,third,expectedDuration){
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20),half=from(.5),quarter=from(.25),four=from(4);
 const amounts=[q,sub(five,q),r,sub(five,r)],times=[zero,quarter,half,from(.75),one];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[],limit=upper?5:7;
 function emit(start,end,rate){
  const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative ponded segment duration.');
  if(cmp(duration,zero)>0n){need(segments.length<limit,'Ponded segment reservation exceeded.');segments.push({start,end,rate,depth:mul(rate,duration)});}
 }
 if(upper){
  const split=div(q,cap);emit(zero,split,cap);emit(split,quarter,zero);
  emit(quarter,half,mul(four,sub(five,q)));
 }else if(cmp(q,from(1.5))<=0n){
  emit(zero,quarter,mul(four,q));
  const split=sub(half,div(sub(from(3.5),q),from(14)));emit(quarter,split,six);emit(split,half,cap);
 }else{
  const w=sub(q,from(1.5)),split=sub(quarter,div(w,from(14)));emit(zero,split,six);emit(split,quarter,cap);
  if(cmp(mul(from(7),q),from(15))<=0n){
   const dry=add(quarter,div(w,six)),final=div(five,from(14));
   emit(quarter,dry,zero);emit(dry,final,six);emit(final,half,cap);
  }else emit(quarter,half,mul(four,sub(five,q)));
 }
 emit(half,from(.75),mul(four,r));emit(from(.75),one,mul(four,sub(five,r)));
 need(segments.length>=4&&segments.length<=limit,'Ponded profile segment count differs.');
 let previous=zero,C=zero,F=zero,W=zero,minS=zero,peak=zero,attaining=zero,earlyDuration=zero,laterDuration=zero;
 const states=[{time:zero,C:zero,W:zero}],knots=[{hour:e(zero),cumulativeRainMm:e(zero),cumulativeInfiltrationMm:e(zero),surfaceWaterMm:e(zero)}],durationRecords=[];
 for(let index=0;index<segments.length;index++){
  const s=segments[index],startWater=W;
  need(cmp(s.start,previous)===0n&&cmp(s.end,s.start)>0n&&cmp(s.rate,zero)>=0n&&cmp(s.rate,cap)<=0n,'Ponded coverage or rate invariant failed.');
  need(bins.some(b=>cmp(s.start,b.start)>=0n&&cmp(s.end,b.end)<=0n),'Ponded segment crosses a quarter boundary.');
  need(cmp(s.depth,mul(s.rate,sub(s.end,s.start)))===0n,'Ponded segment integral failed.');
  C=add(C,s.depth);const S=sub(C,mul(six,s.end));minS=minimum(minS,S);W=sub(S,minS);const nextF=sub(C,W);
  need(cmp(W,zero)>=0n&&cmp(nextF,F)>=0n&&cmp(add(nextF,W),C)===0n,'Ponded reflection or conservation failed.');
  const integrated=integrate(s,index,startWater,W);need(durationRecords.length<limit,'Ponded record reservation exceeded.');durationRecords.push(integrated.record);
  if(cmp(s.end,half)<=0n)earlyDuration=add(earlyDuration,integrated.duration);
  else{
   need(cmp(s.start,half)>=0n&&cmp(startWater,zero)>0n&&cmp(W,zero)>0n&&cmp(S,from(.5))>=0n,'Later half is not wholly ponded.');
   laterDuration=add(laterDuration,integrated.duration);
  }
  if(cmp(W,peak)>0n){peak=W;attaining=s.end;}
  F=nextF;previous=s.end;need(knots.length<limit+1,'Ponded knot reservation exceeded.');
  states.push({time:previous,C,W});knots.push({hour:e(previous),cumulativeRainMm:e(C),cumulativeInfiltrationMm:e(F),surfaceWaterMm:e(W)});
 }
 need(cmp(previous,one)===0n&&cmp(C,from(10))===0n&&knots.length===segments.length+1&&durationRecords.length===segments.length,'Ponded profile does not cover the original event.');
 const totals=[];
 for(const b of bins){let total=zero;for(const s of segments){const a=maximum(b.start,s.start),end=minimum(b.end,s.end);if(cmp(end,a)>0n)total=add(total,mul(s.rate,sub(end,a)));}need(cmp(total,b.amount)===0n,'Duration quarter total failed.');totals.push(total);}
 const firstHalf=add(totals[0],totals[1]),secondHalf=add(totals[2],totals[3]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,first.lo)>=0n&&cmp(q,first.hi)<=0n&&cmp(r,third.lo)>=0n&&cmp(r,third.hi)<=0n,'Duration profile violates original totals or declared bands.');
 const expectedD=maximum(zero,sub(from(1.5),q));
 need(cmp(sub(zero,minS),expectedD)===0n,'Ponded profile lost its first-half memory.');
 let pairPeak=zero;
 for(let j=1;j<states.length;j++)for(let i=0;i<j;i++){
  const increment=sub(sub(states[j].C,states[i].C),mul(six,sub(states[j].time,states[i].time)));
  pairPeak=maximum(pairPeak,increment);need(cmp(increment,states[j].W)<=0n,'Duration reflected state misses a prior knot.');
 }
 need(cmp(pairPeak,peak)===0n,'Duration peak does not match all strict knot pairs.');
 const duration=add(earlyDuration,laterDuration);
 need(cmp(laterDuration,half)===0n&&cmp(duration,expectedDuration)===0n&&cmp(duration,half)>=0n&&cmp(duration,one)<=0n,'Ponded witness does not attain its claimed sharp bound.');
 return {ordering:upper?'maximum-ponded-duration':'minimum-ponded-duration',quarterTotalsMm:{first:e(q),third:e(r)},bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,durationRecords,earlyHalfDurationHours:e(earlyDuration),laterHalfDurationHours:e(laterDuration),durationHours:e(duration),terminalSurfaceWaterMm:e(W),peakSurfaceWaterMm:e(peak),attainingPeakHour:e(attaining),originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)],withinDeclaredBands:true,rateCapVerified:true};
}
// General output traversal and serialization are separately bounded, not scalar science work.
function completeOutput(report){
 const pending=[report];let visited=0,rationals=0;
 while(pending.length){
  need(++visited<=32768,'Duration report object/value traversal exceeds its budget.');
  const value=pending.pop();
  if(value!==null&&typeof value==='object'){
   const keys=Object.keys(value);
   if(Object.hasOwn(value,'numerator')||Object.hasOwn(value,'denominator')){
    need(!Array.isArray(value)&&keys.length===2&&Object.hasOwn(value,'numerator')&&Object.hasOwn(value,'denominator'),'Malformed duration rational object.');
    const n=value.numerator,d=value.denominator;
    need(typeof n==='string'&&typeof d==='string'&&n.length<=650&&d.length<=650&&/^(0|-?[1-9][0-9]*)$/.test(n)&&/^[1-9][0-9]*$/.test(d),'Noncanonical duration rational encoding.');
    need(++rationals<=1536,'Duration report exceeds its rational count budget.');
   }
   need(keys.length<=32768-visited-pending.length,'Duration report pending traversal exceeds its budget.');
   for(const key of keys)pending.push(value[key]);
  }else if(typeof value==='number')need(Number.isFinite(value),'Duration report contains a non-finite number.');
 }
 const text=JSON.stringify(report);
 need(text.length<=4194304&&new TextEncoder().encode(text).length<=4194304,'Complete duration report exceeds 4 MiB.');
 return report;
}

export function inspectArchivedRainPondedDuration(originalText,firstText,thirdText,criterionText){
 const work=prepare(originalText,firstText,thirdText,criterionText);
 const pairedReport=inspectArchivedRainPairedPeak(originalText,firstText,thirdText,criterionText);
 const first=band(pairedReport.firstQuarterReport.terminalReport.declaredReading),third=band(pairedReport.thirdQuarterReport.terminalReport.declaredReading),empty=first.empty||third.empty;
 let durationBounds=null,lowerWitness=null,upperWitness=null;
 if(!empty){
  const lowerQ=minimum(maximum(from(1.5),first.lo),first.hi),upperQ=first.hi;
  const lower=lowerBound(lowerQ),upper=upperBound(upperQ);need(cmp(lower,upper)<=0n,'Ponded duration bounds are inverted.');
  lowerWitness=profile(lowerQ,third.lo,false,first,third,lower);upperWitness=profile(upperQ,third.lo,true,first,third,upper);
  durationBounds={lowerHours:e(lower),upperHours:e(upper),lowerInclusive:true,upperInclusive:true};
 }
 return completeOutput({schema:'experimental-earth-archived-rain-ponded-duration/1',metric:'time-strictly-ponded',units:'hour',thresholdMm:e(Q.zero),scope:{...SCOPE},work,pairedReport,
  assessment:{status:empty?'declared-readings-incompatible':'declared-readings-compatible',compatibleQuarterBands:{first:encodedBand(first),third:encodedBand(third)},durationBounds,lowerWitness,upperWitness},
  meaning:'This complete attained range measures time with strictly positive surface water in the fixed fictional dry K6/A0, cap20 and assumed 5+5 mm family. The explicit zero-depth peak criterion and both original terminal questions remain unchanged in the complete paired report; there is no new duration verdict. The third-quarter band affects feasibility and witness rain, but not the duration bounds. The later half is always ponded; the early half requires reflection through wet and dry intervals. Zero-water plateaus count zero, isolated equality endpoints have zero measure, and water may deplete inside a constant-rain segment. Stored endpoint water and infiltration therefore need not interpolate linearly. Endpoint histories certify sharpness; separate fixed-quarter constructions prove every intermediate duration attainable without asserting continuity of the discontinuous duration functional. No arbitrary interior witness or continuous selector is supplied. One peak knot is not earliest attainment or all ties. The original schedules are illustrative, not exhaustive. No acquired water, damage, probability, safety, physical association, rate-cap inference, whole-site prediction, sampled UI result or model replay is established. Scalar work excludes general parsing, strings, traversal, serialization and integer bit costs; it is not a CPU, memory or wall-time guarantee.'});
}

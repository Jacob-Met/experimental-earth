import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
import {estimateArchivedRainPairedPeakWork,inspectArchivedRainPairedPeak} from './archived-rain-paired-peak.js';
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const v=encode(q);need(v.numerator.length<=650&&v.denominator.length<=650,'Exact shallow duration output exceeds its numeric encoding budget.');return v;};
function sameShape(value,expected){
 if(expected===null||typeof expected!=='object')return value===expected;
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.keys(expected).every(k=>Object.hasOwn(value,k)&&sameShape(value[k],expected[k]));
}
const WORK={"paired":{"firstQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"thirdQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":2048,"pairedPeakWork":8192,"additionalWork":10240,"totalWork":30720,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPairedSegments":12,"maxPairedKnots":14,"maxCombinedSegments":54,"maxCombinedKnots":64,"maxEncodedRationals":1024,"numericStringsMaxChars":650,"completeSerializedBytesMax":2097152,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":4096,"shallowDurationWork":16384,"additionalWork":20480,"totalWork":51200,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxShallowProfiles":2,"maxShallowSegments":16,"maxShallowKnots":18,"maxDurationRecords":16,"maxCombinedSegments":70,"maxCombinedKnots":82,"maxEncodedRationals":1536,"numericStringsMaxChars":650,"completeSerializedBytesMax":4194304,"maxReportValues":32768,"persistentBits":8192,"intermediateBits":16384}};
const SCOPE={mathematicalDeclaration:true,retrospective:true,originalHalfHourTotalsAreAssumed:true,originalTerminalTargetUnchanged:true,peakMetricSeparatelyDeclared:true,fixedQuarterTotals:true,strictThresholdDuration:true,fixedQuarterPointwiseLowerProved:true,physicalAssociationVerified:false,instrumentAccuracyVerified:false,rateCapInferred:false,wholeSitePrediction:false,modelReplayed:false,readingAvailabilityVerified:false,statisticalIndependenceAssumed:false};

function prepare(originalText,firstText,thirdText,criterionText){
 const paired=estimateArchivedRainPairedPeakWork(originalText,firstText,thirdText,criterionText);
 need(sameShape(paired,WORK.paired),'Complete parent paired peak work contract differs.');
 // The parent has admitted this exact bounded text before the additional check.
 const H=from(JSON.parse(criterionText).valueMm);
 need(cmp(H,Q.zero)>0n&&cmp(H,div(from(7),from(2)))<=0n,'Shallow duration requires exact 0 < H <= 7/2 mm.');
 const first=band(JSON.parse(firstText)),third=band(JSON.parse(thirdText));
 if(!first.empty&&!third.empty)need(cmp(first.lo,from(4))===0n&&cmp(first.hi,from(4))===0n&&cmp(third.lo,from(2))===0n&&cmp(third.hi,from(2))===0n,'Nonempty shallow duration requires singleton first=4 and third=2 mm bands.');
 const work={...WORK,paired,limits:{...WORK.limits}};
 need(work.totalWork===paired.totalWork+work.additionalWork&&work.additionalWork===work.additionalPreflightWork+work.shallowDurationWork&&work.totalWork===51200,'Complete shallow duration work was not reserved.');
 return work;
}
export function estimateArchivedRainShallowDurationWork(originalText,firstText,thirdText,criterionText){return prepare(originalText,firstText,thirdText,criterionText);}
function band(reading){const z=from(reading.valueMm),u=from(reading.uncertaintyMm),lo=maximum(Q.zero,sub(z,u)),hi=minimum(from(5),add(z,u));return {lo,hi,empty:cmp(lo,hi)>0n};}
const encodedBand=b=>({lowerMm:e(b.lo),upperMm:e(b.hi),empty:b.empty});

function integrate(segment,index,startWater,endWater,H){
 const zero=Q.zero,L=sub(segment.end,segment.start),a=sub(startWater,H),b=sub(endWater,H),slope=sub(segment.rate,from(6));
 const dry=cmp(startWater,zero)===0n&&cmp(endWater,zero)===0n&&cmp(segment.rate,from(6))<=0n;
 need(dry||cmp(sub(endWater,startWater),mul(slope,L))===0n,'Shallow witness water must be affine or identically dry on each segment.');
 let kind,duration=zero,crossing=null;
 if(cmp(a,zero)<=0n&&cmp(b,zero)<=0n)kind='below';
 else if(cmp(a,zero)>=0n&&cmp(b,zero)>=0n){kind='nonnegative';duration=L;}
 else if(cmp(a,zero)<0n){need(cmp(slope,zero)>0n,'Invalid rising slope.');kind='rising-crossing';crossing=add(segment.start,div(sub(zero,a),slope));duration=sub(segment.end,crossing);}
 else{need(cmp(slope,zero)<0n,'Invalid falling slope.');kind='falling-crossing';crossing=add(segment.start,div(a,sub(zero,slope)));duration=sub(crossing,segment.start);}
 if(crossing!==null){need(cmp(crossing,segment.start)>0n&&cmp(crossing,segment.end)<0n,'Crossing outside strict interior.');need(cmp(add(a,mul(slope,sub(crossing,segment.start))),zero)===0n,'Crossing does not attain threshold.');}
 need(cmp(duration,zero)>=0n&&cmp(duration,L)<=0n,'Duration outside segment.');
 return {duration,record:{segmentIndex:index,startHour:e(segment.start),endHour:e(segment.end),startExcessMm:e(a),endExcessMm:e(b),case:kind,crossingHour:crossing===null?null:e(crossing),durationHours:e(duration)}};
}
function profile(H,upper,first,third,expectedDuration){
 const q=from(4),r=from(2);
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20),half=from(.5),quarter=from(.25),four=from(4);
 const amounts=[q,sub(five,q),r,sub(five,r)],times=[zero,quarter,half,from(.75),one];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[],highLower=!upper&&cmp(H,div(from(11),from(10)))>0n,highUpper=upper&&cmp(H,from(2))>0n,lateUpper=highUpper&&cmp(H,div(from(23),from(10)))>0n,limit=highLower||lateUpper?8:6;
 const chosenD=highUpper?minimum(sub(H,from(2)),div(from(3),from(10))):zero;
 function emit(start,end,rate){
  const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative shallow segment duration.');
  if(cmp(duration,zero)>0n){need(segments.length<limit,'Shallow segment reservation exceeded.');segments.push({start,end,rate,depth:mul(rate,duration)});}
 }
 if(highLower){
  const firstSplit=div(one,from(14));emit(zero,firstSplit,six);emit(firstSplit,quarter,cap);
  const secondSplit=div(from(9),from(20)),thirdSplit=div(from(13),from(20)),fourthSplit=div(from(17),from(20));
  emit(quarter,secondSplit,zero);emit(secondSplit,half,cap);
  emit(half,thirdSplit,zero);emit(thirdSplit,from(.75),cap);
  emit(from(.75),fourthSplit,zero);emit(fourthSplit,one,cap);
 }else if(highUpper){
  const dryEnd=div(chosenD,six),pulseEnd=add(dryEnd,div(one,from(5)));
  emit(zero,dryEnd,zero);emit(dryEnd,pulseEnd,cap);emit(pulseEnd,quarter,zero);
  if(lateUpper){
   emit(quarter,div(from(3),from(10)),cap);emit(div(from(3),from(10)),half,zero);
   emit(half,div(from(3),from(5)),cap);emit(div(from(3),from(5)),from(.75),zero);
   emit(from(.75),div(from(9),from(10)),cap);emit(div(from(9),from(10)),one,zero);
  }else{
   emit(quarter,half,from(4));emit(half,from(.75),from(8));emit(from(.75),one,from(12));
  }
 }else{
  const plateau=upper?zero:div(one,from(14)),a=sub(div(one,from(5)),mul(div(from(3),from(10)),plateau));
  const reach=div(H,from(14)),resume=add(reach,plateau),pulseEnd=add(a,plateau);
  emit(zero,reach,cap);emit(reach,resume,six);emit(resume,pulseEnd,cap);emit(pulseEnd,quarter,zero);
  emit(quarter,half,from(4));emit(half,from(.75),from(8));emit(from(.75),one,from(12));
 }
 need(segments.length>=4&&segments.length<=limit,'Shallow profile segment count differs.');
 let previous=zero,C=zero,F=zero,W=zero,minS=zero,peak=zero,attaining=zero,earlyDuration=zero,laterDuration=zero;
 const states=[{time:zero,C:zero,W:zero}],knots=[{hour:e(zero),cumulativeRainMm:e(zero),cumulativeInfiltrationMm:e(zero),surfaceWaterMm:e(zero)}],durationRecords=[];
 for(let index=0;index<segments.length;index++){
  const s=segments[index],startWater=W;
  need(cmp(s.start,previous)===0n&&cmp(s.end,s.start)>0n&&cmp(s.rate,zero)>=0n&&cmp(s.rate,cap)<=0n,'Shallow coverage or rate invariant failed.');
  need(bins.some(b=>cmp(s.start,b.start)>=0n&&cmp(s.end,b.end)<=0n),'Shallow segment crosses a quarter boundary.');
  need(cmp(s.depth,mul(s.rate,sub(s.end,s.start)))===0n,'Shallow segment integral failed.');
  C=add(C,s.depth);const S=sub(C,mul(six,s.end));minS=minimum(minS,S);W=sub(S,minS);const nextF=sub(C,W);
  need(cmp(W,zero)>=0n&&cmp(nextF,F)>=0n&&cmp(add(nextF,W),C)===0n,'Shallow reflection or conservation failed.');
  const integrated=integrate(s,index,startWater,W,H);need(durationRecords.length<limit,'Shallow record reservation exceeded.');durationRecords.push(integrated.record);
  if(cmp(s.end,half)<=0n)earlyDuration=add(earlyDuration,integrated.duration);
  else{
   need(cmp(s.start,half)>=0n&&cmp(startWater,zero)>0n&&cmp(W,zero)>0n&&cmp(S,from(.5))>=0n,'Later half reflection invariant failed.');
   laterDuration=add(laterDuration,integrated.duration);
  }
  if(cmp(W,peak)>0n){peak=W;attaining=s.end;}
  F=nextF;previous=s.end;need(knots.length<limit+1,'Shallow knot reservation exceeded.');
  states.push({time:previous,C,W});knots.push({hour:e(previous),cumulativeRainMm:e(C),cumulativeInfiltrationMm:e(F),surfaceWaterMm:e(W)});
 }
 need(cmp(previous,one)===0n&&cmp(C,from(10))===0n&&knots.length===segments.length+1&&durationRecords.length===segments.length,'Shallow profile does not cover the original event.');
 const totals=[];
 for(const b of bins){let total=zero;for(const s of segments){const a=maximum(b.start,s.start),end=minimum(b.end,s.end);if(cmp(end,a)>0n)total=add(total,mul(s.rate,sub(end,a)));}need(cmp(total,b.amount)===0n,'Duration quarter total failed.');totals.push(total);}
 const firstHalf=add(totals[0],totals[1]),secondHalf=add(totals[2],totals[3]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,first.lo)>=0n&&cmp(q,first.hi)<=0n&&cmp(r,third.lo)>=0n&&cmp(r,third.hi)<=0n,'Duration profile violates original totals or declared bands.');
 const expectedD=chosenD;
 need(cmp(sub(zero,minS),expectedD)===0n,'Shallow profile lost its first-half memory.');
 let pairPeak=zero;
 for(let j=1;j<states.length;j++)for(let i=0;i<j;i++){
  const increment=sub(sub(states[j].C,states[i].C),mul(six,sub(states[j].time,states[i].time)));
  pairPeak=maximum(pairPeak,increment);need(cmp(increment,states[j].W)<=0n,'Duration reflected state misses a prior knot.');
 }
 need(cmp(pairPeak,peak)===0n,'Duration peak does not match all strict knot pairs.');
 const duration=add(earlyDuration,laterDuration);
 need(cmp(duration,expectedDuration)===0n&&cmp(duration,zero)>=0n&&cmp(duration,one)<=0n,'Shallow witness does not attain its claimed sharp bound.');
 return {ordering:upper?'maximum-shallow-duration':'minimum-shallow-duration',quarterTotalsMm:{first:e(q),third:e(r)},bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,durationRecords,earlyHalfDurationHours:e(earlyDuration),laterHalfDurationHours:e(laterDuration),durationHours:e(duration),terminalSurfaceWaterMm:e(W),peakSurfaceWaterMm:e(peak),attainingPeakHour:e(attaining),originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)],withinDeclaredBands:true,rateCapVerified:true};
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

export function inspectArchivedRainShallowDuration(originalText,firstText,thirdText,criterionText){
 const work=prepare(originalText,firstText,thirdText,criterionText);
 const pairedReport=inspectArchivedRainPairedPeak(originalText,firstText,thirdText,criterionText);
 const H=from(JSON.parse(criterionText).valueMm);
 const first=band(pairedReport.firstQuarterReport.terminalReport.declaredReading),third=band(pairedReport.thirdQuarterReport.terminalReport.declaredReading),empty=first.empty||third.empty;
 let durationBounds=null,lowerWitness=null,upperWitness=null;
 if(!empty){
  let correction=Q.zero;
  for(const numerator of [11,13,19])correction=add(correction,maximum(Q.zero,sub(H,div(from(numerator),from(10)))));
  let lower=sub(sub(div(from(13),from(14)),div(H,from(14))),mul(div(from(5),from(21)),correction)),upper=sub(from(1),div(H,from(14)));
  if(cmp(H,from(2))>0n){
   lower=add(mul(div(from(10),from(21)),maximum(Q.zero,sub(div(from(5),from(2)),H))),div(sub(from(4),H),from(14)));
   if(cmp(H,div(from(23),from(10)))<=0n)upper=sub(div(from(4),from(3)),mul(div(from(5),from(21)),H));
   else if(cmp(H,div(from(14),from(5)))<=0n)upper=sub(div(from(629),from(420)),mul(div(from(13),from(42)),H));
   else upper=sub(div(from(303),from(140)),mul(div(from(23),from(42)),H));
  }
  need(cmp(lower,upper)<=0n,'Shallow duration bounds are inverted.');
  lowerWitness=profile(H,false,first,third,lower);upperWitness=profile(H,true,first,third,upper);
  durationBounds={lowerHours:e(lower),upperHours:e(upper),lowerInclusive:true,upperInclusive:true};
 }
 return completeOutput({schema:'experimental-earth-archived-rain-shallow-duration/1',metric:'time-strictly-above-threshold',units:'hour',thresholdMm:e(H),scope:{...SCOPE},work,pairedReport,
  assessment:{status:empty?'declared-readings-incompatible':'declared-readings-compatible',compatibleQuarterBands:{first:encodedBand(first),third:encodedBand(third)},durationBounds,lowerWitness,upperWitness},
  meaning:'Exact attained duration interval for the fixed fictional quarter totals4,1,2,3 mm, dry K6/A0, cap20 and0<H<=7/2. Original peak criterion and terminal target remain in the unchanged paired parent. Equality plateaus count zero. Endpoint profiles certify sharpness. Below11/10 varying a threshold plateau constructs every intermediate duration; above it a finite monotone reflected-water interpolation with threshold-plateau filling proves completeness, not continuity of the duration functional. No field validity, acquired observation, safety, probability, whole-site prediction or model replay is established. No new duration classification is added. Work excludes general parsing, traversal, serialization and integer bit costs.'});
}

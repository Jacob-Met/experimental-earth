import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
import {estimateArchivedRainPairedPeakWork,inspectArchivedRainPairedPeak} from './archived-rain-paired-peak.js';
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const v=encode(q);need(v.numerator.length<=700&&v.denominator.length<=700,'Exact exposure output exceeds its numeric encoding budget.');return v;};
function sameShape(value,expected){
 if(expected===null||typeof expected!=='object')return value===expected;
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.keys(expected).every(k=>Object.hasOwn(value,k)&&sameShape(value[k],expected[k]));
}
const WORK={"paired":{"firstQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"thirdQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":2048,"pairedPeakWork":8192,"additionalWork":10240,"totalWork":30720,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPairedSegments":12,"maxPairedKnots":14,"maxCombinedSegments":54,"maxCombinedKnots":64,"maxEncodedRationals":1024,"numericStringsMaxChars":650,"completeSerializedBytesMax":2097152,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":4096,"exposureWork":16384,"additionalWork":20480,"totalWork":51200,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxExposureProfiles":2,"maxExposureSegments":14,"maxExposureKnots":16,"maxLaterIntegrationRecords":8,"maxCombinedSegments":68,"maxCombinedKnots":80,"maxEncodedRationals":1536,"numericStringsMaxChars":700,"completeSerializedBytesMax":4194304,"persistentBits":8192,"intermediateBits":16384}};
const SCOPE={"mathematicalDeclaration":true,"retrospective":true,"peakMetricSeparatelyDeclared":true,"originalHalfHourTotalsAreAssumed":true,"continuousTimePeak":true,"originalTerminalTargetUnchanged":true,"jointQuarterConstraints":true,"physicalAssociationVerified":false,"instrumentAccuracyVerified":false,"rateCapInferred":false,"wholeSitePrediction":false,"modelReplayed":false,"originalSchedulesExhaustive":false,"readingAvailabilityVerified":false,"statisticalIndependenceAssumed":false,"thresholdDepthTimeIntegral":true,"earlyHalfExposureZeroProved":true};

function prepare(originalText,firstText,thirdText,criterionText){
 const paired=estimateArchivedRainPairedPeakWork(originalText,firstText,thirdText,criterionText);
 need(sameShape(paired,WORK.paired),'Complete paired exposure work contract differs.');
 // Parent admission has checked every criterion field and its bounded raw text.
 const threshold=from(JSON.parse(criterionText).valueMm);
 need(cmp(threshold,from(3.5))>=0n,'Exposure threshold must be at least 3.5 mm.');
 const work={...WORK,paired,limits:{...WORK.limits}};
 need(work.totalWork===paired.totalWork+work.additionalWork&&work.additionalWork===work.additionalPreflightWork+work.exposureWork&&work.totalWork===51200,'Complete exposure work was not reserved.');
 return {threshold,work};
}
export function estimateArchivedRainExposureWork(originalText,firstText,thirdText,criterionText){return prepare(originalText,firstText,thirdText,criterionText).work;}
function band(reading){const z=from(reading.valueMm),u=from(reading.uncertaintyMm),lo=maximum(Q.zero,sub(z,u)),hi=minimum(from(5),add(z,u));return {lo,hi,empty:cmp(lo,hi)>0n};}
const encodedBand=b=>({lowerMm:e(b.lo),upperMm:e(b.hi),empty:b.empty});

// Only later-half segments are integrated: their running minimum is fixed.
function integrate(segment,index,startWater,endWater,H){
 const zero=Q.zero,duration=sub(segment.end,segment.start),a=sub(startWater,H),b=sub(endWater,H),slope=sub(segment.rate,from(6));
 need(cmp(slope,from(14))===0n||cmp(slope,sub(zero,from(6)))===0n,'Later exposure slope differs from the fixed cap model.');
 need(cmp(sub(endWater,startWater),mul(slope,duration))===0n,'Later exposure water is not affine.');
 let kind,area=zero,crossing=null;
 if(cmp(a,zero)<=0n&&cmp(b,zero)<=0n)kind='below';
 else if(cmp(a,zero)>=0n&&cmp(b,zero)>=0n){kind='nonnegative';area=div(mul(duration,add(a,b)),from(2));}
 else if(cmp(a,zero)<0n){
  kind='rising-crossing';need(cmp(slope,from(14))===0n,'Rising exposure crossing has the wrong slope.');
  crossing=add(segment.start,div(sub(zero,a),from(14)));area=div(mul(b,b),from(28));
 }else{
  kind='falling-crossing';need(cmp(slope,sub(zero,from(6)))===0n,'Falling exposure crossing has the wrong slope.');
  crossing=add(segment.start,div(a,from(6)));area=div(mul(a,a),from(12));
 }
 if(crossing!==null){
  need(cmp(crossing,segment.start)>0n&&cmp(crossing,segment.end)<0n,'Exposure crossing is outside its strict segment interior.');
  need(cmp(add(a,mul(slope,sub(crossing,segment.start))),zero)===0n,'Exposure crossing does not attain the threshold.');
  const positiveDuration=kind==='rising-crossing'?sub(segment.end,crossing):sub(crossing,segment.start),height=kind==='rising-crossing'?b:a;
  need(cmp(area,div(mul(positiveDuration,height),from(2)))===0n,'Exposure triangle identity failed.');
 }
 need(cmp(area,zero)>=0n,'Exposure area is negative.');
 return {area,record:{segmentIndex:index,startHour:e(segment.start),endHour:e(segment.end),startExcessMm:e(a),endExcessMm:e(b),case:kind,crossingHour:crossing===null?null:e(crossing),areaMmHours:e(area)}};
}

function profile(q,r,upper,first,third,H){
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20),half=from(.5);
 const amounts=[q,sub(five,q),r,sub(five,r)],times=[zero,from(.25),half,from(.75),one];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[],limit=upper?8:6;
 function emit(start,end,rate){const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative exposure segment duration.');if(cmp(duration,zero)>0n){need(segments.length<limit,'Exposure segment reservation exceeded.');segments.push({start,end,rate,depth:mul(rate,duration)});}}
 for(let i=0;i<4;i++){
  const b=bins[i],duration=sub(b.end,b.start);
  need(cmp(b.amount,zero)>=0n&&cmp(b.amount,mul(cap,duration))<=0n,'Exposure quarter amount violates the cap.');
  if(!upper&&i<2)emit(b.start,b.end,div(b.amount,duration));
  else{
   const wet=div(b.amount,cap),earliest=upper&&i>=2,split=earliest?add(b.start,wet):sub(b.end,wet);
   need(cmp(split,b.start)>=0n&&cmp(split,b.end)<=0n,'Exposure pulse is outside its quarter.');
   emit(b.start,split,earliest?cap:zero);emit(split,b.end,earliest?zero:cap);
  }
 }
 need(segments.length>=4&&segments.length<=limit,'Exposure profile segment count differs.');
 let previous=zero,C=zero,F=zero,W=zero,minS=zero,peak=zero,attaining=zero,exposure=zero;
 let laterMinimum=null;
 const states=[{time:zero,C:zero,W:zero}],knots=[{hour:e(zero),cumulativeRainMm:e(zero),cumulativeInfiltrationMm:e(zero),surfaceWaterMm:e(zero)}],laterIntegration=[];
 for(let index=0;index<segments.length;index++){
  const s=segments[index],startWater=W,beforeMinimum=minS;
  need(cmp(s.start,previous)===0n&&cmp(s.end,s.start)>0n&&cmp(s.rate,zero)>=0n&&cmp(s.rate,cap)<=0n,'Exposure coverage or rate invariant failed.');
  need(cmp(s.depth,mul(s.rate,sub(s.end,s.start)))===0n,'Exposure segment integral failed.');
  C=add(C,s.depth);const S=sub(C,mul(six,s.end));minS=minimum(minS,S);W=sub(S,minS);const nextF=sub(C,W);
  need(cmp(W,zero)>=0n&&cmp(nextF,F)>=0n&&cmp(add(nextF,W),C)===0n,'Exposure reflection or conservation failed.');
  if(cmp(W,peak)>0n){peak=W;attaining=s.end;}
  if(cmp(s.end,half)<=0n)need(cmp(W,from(3.5))<=0n,'Early exposure bound failed.');
  if(cmp(s.start,half)>=0n){
   if(laterMinimum===null)laterMinimum=beforeMinimum;
   need(cmp(beforeMinimum,laterMinimum)===0n&&cmp(minS,laterMinimum)===0n&&cmp(S,zero)>0n,'Later exposure running minimum changed.');
   need(laterIntegration.length<4,'Later exposure record reservation exceeded.');
   const integrated=integrate(s,index,startWater,W,H);exposure=add(exposure,integrated.area);laterIntegration.push(integrated.record);
  }
  F=nextF;previous=s.end;need(knots.length<limit+1,'Exposure knot reservation exceeded.');
  states.push({time:previous,C,W});knots.push({hour:e(previous),cumulativeRainMm:e(C),cumulativeInfiltrationMm:e(F),surfaceWaterMm:e(W)});
 }
 need(cmp(previous,one)===0n&&cmp(C,from(10))===0n&&knots.length===segments.length+1&&laterIntegration.length>=2,'Exposure profile does not cover the original event.');
 const totals=[];
 for(const b of bins){let total=zero;for(const s of segments){const a=maximum(b.start,s.start),end=minimum(b.end,s.end);if(cmp(end,a)>0n)total=add(total,mul(s.rate,sub(end,a)));}need(cmp(total,b.amount)===0n,'Exposure quarter total failed.');totals.push(total);}
 const firstHalf=add(totals[0],totals[1]),secondHalf=add(totals[2],totals[3]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,first.lo)>=0n&&cmp(q,first.hi)<=0n&&cmp(r,third.lo)>=0n&&cmp(r,third.hi)<=0n,'Exposure profile violates original totals or declared bands.');
 const expectedD=upper?sub(from(1.5),div(mul(from(3),q),from(10))):maximum(zero,sub(from(1.5),q));
 need(laterMinimum!==null&&cmp(sub(zero,laterMinimum),expectedD)===0n,'Exposure profile does not attain its first-half minimum.');
 let pairPeak=zero;
 for(let j=1;j<states.length;j++)for(let i=0;i<j;i++){
  const increment=sub(sub(states[j].C,states[i].C),mul(six,sub(states[j].time,states[i].time)));
  pairPeak=maximum(pairPeak,increment);need(cmp(increment,states[j].W)<=0n,'Exposure reflected state misses a prior knot.');
 }
 need(cmp(pairPeak,peak)===0n,'Exposure peak does not match all strict knot pairs.');
 need(cmp(exposure,zero)>=0n&&cmp(exposure,from(1.75))<=0n,'Exposure exceeds its analytic magnitude bound.');
 return {area:exposure,witness:{ordering:upper?'latest-latest-earliest-earliest':'constant-constant-latest-latest',quarterTotalsMm:{first:e(q),third:e(r)},bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,earlyHalfExposureMmHours:e(zero),laterIntegration,exposureMmHours:e(exposure),terminalSurfaceWaterMm:e(W),peakSurfaceWaterMm:e(peak),attainingPeakHour:e(attaining),originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)],withinDeclaredBands:true,rateCapVerified:true}};
}
// General output traversal and serialization are separately bounded, not scalar science work.
function completeOutput(report){
 const pending=[report];let visited=0,rationals=0;
 while(pending.length){
  need(++visited<=32768,'Exposure report object/value traversal exceeds its budget.');
  const value=pending.pop();
  if(value!==null&&typeof value==='object'){
   const keys=Object.keys(value);
   if(Object.hasOwn(value,'numerator')||Object.hasOwn(value,'denominator')){
    need(!Array.isArray(value)&&keys.length===2&&Object.hasOwn(value,'numerator')&&Object.hasOwn(value,'denominator'),'Malformed exposure rational object.');
    const n=value.numerator,d=value.denominator;
    need(typeof n==='string'&&typeof d==='string'&&n.length<=700&&d.length<=700&&/^(0|-?[1-9][0-9]*)$/.test(n)&&/^[1-9][0-9]*$/.test(d),'Noncanonical exposure rational encoding.');
    need(++rationals<=1536,'Exposure report exceeds its rational count budget.');
   }
   need(keys.length<=32768-visited-pending.length,'Exposure report pending traversal exceeds its budget.');
   for(const key of keys)pending.push(value[key]);
  }else if(typeof value==='number')need(Number.isFinite(value),'Exposure report contains a non-finite number.');
 }
 const text=JSON.stringify(report);
 need(text.length<=4194304&&new TextEncoder().encode(text).length<=4194304,'Complete exposure report exceeds 4 MiB.');
 return report;
}
export function inspectArchivedRainExposure(originalText,firstText,thirdText,criterionText){
 const p=prepare(originalText,firstText,thirdText,criterionText);
 const pairedReport=inspectArchivedRainPairedPeak(originalText,firstText,thirdText,criterionText);
 const H=from(pairedReport.declaredPeakCriterion.valueMm);
 need(cmp(H,p.threshold)===0n,'Exposure threshold differs from retained criterion.');
 const first=band(pairedReport.firstQuarterReport.terminalReport.declaredReading),third=band(pairedReport.thirdQuarterReport.terminalReport.declaredReading),empty=first.empty||third.empty;
 let exposureBounds=null,lowerWitness=null,upperWitness=null;
 if(!empty){
  const lower=profile(first.hi,third.lo,false,first,third,H),upper=profile(first.lo,third.hi,true,first,third,H);
  need(cmp(lower.area,upper.area)<=0n,'Exposure bounds are inverted.');
  exposureBounds={lowerMmHours:e(lower.area),upperMmHours:e(upper.area),lowerInclusive:true,upperInclusive:true};lowerWitness=lower.witness;upperWitness=upper.witness;
 }
 const report={schema:'experimental-earth-archived-rain-exposure/1',metric:'integrated-surface-water-excess',units:'mm*hour',thresholdMm:e(H),scope:{...SCOPE},work:p.work,pairedReport,
  assessment:{status:empty?'declared-readings-incompatible':'declared-readings-compatible',compatibleQuarterBands:{first:encodedBand(first),third:encodedBand(third)},exposureBounds,lowerWitness,upperWitness},
  meaning:'This complete attained depth-time excess range uses the retained peak criterion value as threshold H, without adding an exposure verdict or replacing either parent target. It is a retrospective mathematical declaration under the fixed dry K6/A0, cap20 and assumed 5+5 mm totals, not duration, damage, probability, volume or whole-site hazard. The original three schedules are illustrative, not exhaustive. No physical association, instrument accuracy, rate cap or reading availability is inferred. H>=3.5 makes early-half exposure zero; the later fixed running minimum permits exact affine integration. Each full witness certifies one attaining peak knot, not earliest attainment or all ties. Endpoint water and infiltration need not interpolate linearly during early depletion. Existing sampled ponding exposure and its UI remain unchanged. No model is replayed. Scalar work excludes parsing, strings, cloning, serialization and rational bit costs; it is not a runtime guarantee.'};
 return completeOutput(report);
}

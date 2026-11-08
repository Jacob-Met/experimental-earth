import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
import {estimateArchivedRainPeakWork,inspectArchivedRainPeak} from './archived-rain-peak.js';
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const v=encode(q);need(v.numerator.length<=650&&v.denominator.length<=650,'Exact paired peak output exceeds its encoded numeric budget.');return v;};
// Compare the complete fixed parent shape without admitting extra keys.
function sameShape(value,expected){
 if(expected===null||typeof expected!=='object')return value===expected;
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.keys(expected).every(k=>Object.hasOwn(value,k)&&sameShape(value[k],expected[k]));
}
const PARENT_WORK={terminal:{bins:3,maxProfiles:2,maxSegmentsPerProfile:6,maxTotalSegments:12,reservedScalarWork:4096,limits:{originalBytes:16384,readingBytes:4096,persistentBits:8192,intermediateBits:16384}},additionalPreflightWork:512,peakWork:5632,additionalWork:6144,totalWork:10240,limits:{originalBytes:16384,readingBytes:4096,criterionBytes:4096,maxPeakSegments:9,maxPeakKnots:11,maxCombinedSegments:21,maxCombinedKnots:25,maxEncodedRationals:400,numericStringsMaxChars:650,completeSerializedBytesMax:1048576,persistentBits:8192,intermediateBits:16384}};
const LIMITS=Object.freeze({"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPairedSegments":12,"maxPairedKnots":14,"maxCombinedSegments":54,"maxCombinedKnots":64,"maxEncodedRationals":1024,"numericStringsMaxChars":650,"completeSerializedBytesMax":2097152,"persistentBits":8192,"intermediateBits":16384});
function prepare(originalText,firstReadingText,thirdReadingText,criterionText){
 const firstQuarter=estimateArchivedRainPeakWork(originalText,firstReadingText,criterionText);
 const thirdQuarter=estimateArchivedRainPeakWork(originalText,thirdReadingText,criterionText);
 need(sameShape(firstQuarter,PARENT_WORK)&&sameShape(thirdQuarter,PARENT_WORK),'Complete parent peak work contract differs.');
 // Both bounded texts are already admitted by the parent. Roles are explicit;
 // identical user labels do not establish or disprove physical identity.
 need(JSON.parse(firstReadingText).quarter==='first'&&JSON.parse(thirdReadingText).quarter==='third','Supply first and third readings in their explicit role order.');
 const work={firstQuarter,thirdQuarter,additionalPreflightWork:2048,pairedPeakWork:8192,additionalWork:10240,totalWork:30720,limits:LIMITS};
 need(work.totalWork===firstQuarter.totalWork+thirdQuarter.totalWork+work.additionalWork&&work.additionalWork===work.additionalPreflightWork+work.pairedPeakWork,'Complete paired peak work was not reserved.');
 return work;
}
export function estimateArchivedRainPairedPeakWork(originalText,firstReadingText,thirdReadingText,criterionText){return prepare(originalText,firstReadingText,thirdReadingText,criterionText);}

function profile(q,r,ordering,firstBand,thirdBand,endpoint){
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20);
 const amounts=[q,sub(five,q),r,sub(five,r)];
 const times=[zero,from(.25),from(.5),from(.75),one];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[],constant=ordering==='constant-bin';
 need(bins.length===4,'Peak bin reservation differs.');
 const segmentLimit=constant?4:8,knotLimit=constant?5:9;
 function emit(start,end,rate){const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative peak profile duration.');if(cmp(duration,zero)>0n){need(segments.length<segmentLimit,'Peak segment reservation exceeded.');segments.push({start,end,rate,depth:mul(rate,duration)});}}
 for(let i=0;i<4;i++){
  const bin=bins[i],duration=sub(bin.end,bin.start);need(cmp(duration,zero)>0n&&cmp(bin.amount,zero)>=0n&&cmp(bin.amount,mul(cap,duration))<=0n,'Peak bin violates its rate cap.');
  if(constant)emit(bin.start,bin.end,div(bin.amount,duration));
  else{const wet=div(bin.amount,cap);if(i===3){const split=add(bin.start,wet);emit(bin.start,split,cap);emit(split,bin.end,zero);}else{const split=sub(bin.end,wet);emit(bin.start,split,zero);emit(split,bin.end,cap);}}
 }
 need(segments.length>=4&&segments.length<=segmentLimit&&(!constant||segments.length===4),'Peak profile segment count differs.');
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
 const firstHalf=add(totals[0],totals[1]),secondHalf=add(totals[2],totals[3]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,firstBand.lo)>=0n&&cmp(q,firstBand.hi)<=0n&&cmp(r,thirdBand.lo)>=0n&&cmp(r,thirdBand.hi)<=0n,'Peak profile violates original totals or declared band.');
 need(cmp(peak,endpoint)===0n,'Peak profile does not attain the claimed bound.');
 return {ordering,quarterTotalsMm:{first:e(q),third:e(r)},bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,peakSurfaceWaterMm:e(peak),attainingPeakHour:e(attaining),terminalSurfaceWaterMm:e(W),originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)],withinDeclaredBands:true,rateCapVerified:true};
}

const SCOPE=Object.freeze({"mathematicalDeclaration":true,"retrospective":true,"peakMetricSeparatelyDeclared":true,"originalHalfHourTotalsAreAssumed":true,"continuousTimePeak":true,"originalTerminalTargetUnchanged":true,"jointQuarterConstraints":true,"physicalAssociationVerified":false,"instrumentAccuracyVerified":false,"rateCapInferred":false,"wholeSitePrediction":false,"modelReplayed":false,"originalSchedulesExhaustive":false,"readingAvailabilityVerified":false,"statisticalIndependenceAssumed":false});

function band(reading){
 const z=from(reading.valueMm),u=from(reading.uncertaintyMm),lo=maximum(Q.zero,sub(z,u)),hi=minimum(from(5),add(z,u));
 return {z,u,lo,hi,empty:cmp(lo,hi)>0n};
}
const encodedBand=b=>({lowerMm:e(b.lo),upperMm:e(b.hi),empty:b.empty});
export function inspectArchivedRainPairedPeak(originalText,firstReadingText,thirdReadingText,criterionText){
 const work=prepare(originalText,firstReadingText,thirdReadingText,criterionText);
 const firstQuarterReport=inspectArchivedRainPeak(originalText,firstReadingText,criterionText);
 const thirdQuarterReport=inspectArchivedRainPeak(originalText,thirdReadingText,criterionText);
 const first=band(firstQuarterReport.terminalReport.declaredReading),third=band(thirdQuarterReport.terminalReport.declaredReading);
 const declaredPeakCriterion=firstQuarterReport.declaredPeakCriterion,target=from(declaredPeakCriterion.valueMm),empty=first.empty||third.empty;
 let peakBounds=null,lowerWitness=null,upperWitness=null,classification='outside-support';
 if(!empty){
  const lower=maximum(maximum(from(4),sub(from(5.5),first.hi)),maximum(add(from(.5),third.lo),add(sub(from(2),first.hi),third.lo)));
  const upper=add(from(5.5),div(mul(from(3),sub(third.hi,first.lo)),from(10)));
  need(cmp(lower,upper)<=0n,'Paired peak bounds are inverted.');
  lowerWitness=profile(first.hi,third.lo,'constant-bin',first,third,lower);
  upperWitness=profile(first.lo,third.hi,'latest-latest-latest-earliest',first,third,upper);
  peakBounds={lowerMm:e(lower),upperMm:e(upper),lowerInclusive:true,upperInclusive:true};
  classification=cmp(upper,target)<=0n?'certain-meet':cmp(lower,target)>0n?'certain-miss':'ambiguous';
 }
 return {schema:'experimental-earth-archived-rain-paired-peak/1',declaredPeakCriterion,scope:SCOPE,work,firstQuarterReport,thirdQuarterReport,
  assessment:{status:empty?'declared-readings-incompatible':'declared-readings-compatible',quarterIntervalsMinutes:{first:[0,15],third:[30,45]},parameters:{firstValueMm:e(first.z),firstUncertaintyMm:e(first.u),thirdValueMm:e(third.z),thirdUncertaintyMm:e(third.u),conductivityMmHr:e(from(6)),rateCapMmHr:e(from(20)),peakTargetMm:e(target),originalHalfHourTotalsMm:[e(from(5)),e(from(5))]},compatibleQuarterBands:{first:encodedBand(first),third:encodedBand(third)},peakBounds,classification,lowerWitness,upperWitness},
  meaning:'These ordered first- and third-quarter mathematical declarations jointly constrain a continuous rate-capped family under hypothetical half-hour totals. Both complete single-quarter peak and terminal questions remain unchanged. Repeated labels are retained and imply neither physical identity nor statistical independence. The separately declared peak criterion does not replace either original terminal target. No physical association, instrument precision, availability, acquisition, chronology, probability or physical action is verified or inferred. Exact profiles certify one attaining knot, not earliest continuous attainment or all ties; infiltration and surface water need not interpolate linearly between rainfall-segment endpoints. No model or retained-snapshot UI is replayed. Scalar work excludes parsing, general string processing, serialization and rational bit costs; it is not a CPU, memory or wall-time guarantee.'};
}

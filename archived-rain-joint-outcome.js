import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
import {estimateArchivedRainPairedPeakWork,inspectArchivedRainPairedPeak} from './archived-rain-paired-peak.js';
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const value=encode(q);need(value.numerator.length<=650&&value.denominator.length<=650,'Joint outcome numeric encoding exceeds its budget.');return value;};
function sameShape(value,expected){
 if(expected===null||typeof expected!=='object')return value===expected;
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===Object.keys(expected).length&&Object.keys(expected).every(k=>Object.hasOwn(value,k)&&sameShape(value[k],expected[k]));
}
const PARENT_WORK={"firstQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"thirdQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":2048,"pairedPeakWork":8192,"additionalWork":10240,"totalWork":30720,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPairedSegments":12,"maxPairedKnots":14,"maxCombinedSegments":54,"maxCombinedKnots":64,"maxEncodedRationals":1024,"numericStringsMaxChars":650,"completeSerializedBytesMax":2097152,"persistentBits":8192,"intermediateBits":16384}};
const WORK={"paired":{"firstQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"thirdQuarter":{"terminal":{"bins":3,"maxProfiles":2,"maxSegmentsPerProfile":6,"maxTotalSegments":12,"reservedScalarWork":4096,"limits":{"originalBytes":16384,"readingBytes":4096,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":512,"peakWork":5632,"additionalWork":6144,"totalWork":10240,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPeakSegments":9,"maxPeakKnots":11,"maxCombinedSegments":21,"maxCombinedKnots":25,"maxEncodedRationals":400,"numericStringsMaxChars":650,"completeSerializedBytesMax":1048576,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":2048,"pairedPeakWork":8192,"additionalWork":10240,"totalWork":30720,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"maxPairedSegments":12,"maxPairedKnots":14,"maxCombinedSegments":54,"maxCombinedKnots":64,"maxEncodedRationals":1024,"numericStringsMaxChars":650,"completeSerializedBytesMax":2097152,"persistentBits":8192,"intermediateBits":16384}},"additionalPreflightWork":4096,"jointOutcomeWork":32768,"additionalWork":36864,"totalWork":67584,"limits":{"originalBytes":16384,"readingBytes":4096,"criterionBytes":4096,"queryBytes":4096,"maxJointProfiles":5,"maxJointSegments":40,"maxJointKnots":45,"maxCombinedSegments":94,"maxCombinedKnots":109,"maxEncodedRationals":2048,"numericStringsMaxChars":650,"completeSerializedBytesMax":4194304,"persistentBits":8192,"intermediateBits":16384}};
const SCOPE={"mathematicalDeclaration":true,"retrospective":true,"peakMetricSeparatelyDeclared":true,"originalHalfHourTotalsAreAssumed":true,"continuousTimePeak":true,"originalTerminalTargetUnchanged":true,"jointQuarterConstraints":true,"physicalAssociationVerified":false,"instrumentAccuracyVerified":false,"rateCapInferred":false,"wholeSitePrediction":false,"modelReplayed":false,"originalSchedulesExhaustive":false,"readingAvailabilityVerified":false,"statisticalIndependenceAssumed":false,"hypotheticalOutcomeQuery":true,"sameHistoryRequired":true};

function prepare(originalText,firstText,thirdText,criterionText,queryText){
 need(typeof queryText==='string'&&queryText.length>0&&queryText.length<=4096&&!queryText.startsWith('\uFEFF'),'Joint outcome query requires nonempty exact UTF-8 without BOM.');
 const bytes=new TextEncoder().encode(queryText);
 need(bytes.length<=4096&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===queryText,'Joint outcome query exceeds its byte limit or contains a lone surrogate.');
 const query=JSON.parse(queryText),pending=[query];
 while(pending.length){const value=pending.pop();if(typeof value==='number')need(Number.isFinite(value),'Joint outcome query contains a non-finite number.');else if(typeof value==='string')need(value.isWellFormed(),'Joint outcome query contains an escaped lone surrogate.');else if(value!==null&&typeof value==='object')for(const child of Object.values(value))pending.push(child);}
 const keys=['schema','id','terminalMm','peakMm','source'],text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=600;
 need(query!==null&&typeof query==='object'&&!Array.isArray(query)&&Object.keys(query).length===keys.length&&keys.every(k=>Object.hasOwn(query,k))&&query.schema==='experimental-earth-archived-rain-joint-outcome-query/1'&&text(query.id)&&text(query.source)&&Number.isFinite(query.terminalMm)&&query.terminalMm>=0&&Number.isFinite(query.peakMm)&&query.peakMm>=0,'Supply one explicit nonnegative hypothetical terminal/peak outcome query.');
 const terminal=from(query.terminalMm),peak=from(query.peakMm),excess=sub(peak,terminal);
 const paired=estimateArchivedRainPairedPeakWork(originalText,firstText,thirdText,criterionText);
 need(sameShape(paired,PARENT_WORK),'Complete paired work contract differs.');
 const work={...WORK,paired,limits:{...WORK.limits}};
 need(work.totalWork===paired.totalWork+work.additionalWork&&work.additionalWork===work.additionalPreflightWork+work.jointOutcomeWork&&work.totalWork===67584,'Complete joint outcome work was not reserved.');
 return {query,terminal,peak,excess,work};
}
export function estimateArchivedRainJointOutcomeWork(originalText,firstText,thirdText,criterionText,queryText){return prepare(originalText,firstText,thirdText,criterionText,queryText).work;}
function band(reading){const z=from(reading.valueMm),u=from(reading.uncertaintyMm),lo=maximum(Q.zero,sub(z,u)),hi=minimum(from(5),add(z,u));return {lo,hi,empty:cmp(lo,hi)>0n};}
const encodedBand=b=>({lowerMm:e(b.lo),upperMm:e(b.hi),empty:b.empty});

// Construct one common history, then independently check its integrals and reflection.
function profile(terminal,excess,first,third){
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20);
 const q=maximum(first.lo,sub(from(5.5),terminal)),r=maximum(third.lo,div(mul(from(10),excess),from(3)));
 const start=div(sub(terminal,from(4)),six),last= sub(add(from(.75),div(r,cap)),div(excess,six));
 const firstEnd=add(start,div(q,cap)),lastEnd=add(last,div(sub(five,r),cap));
 need(cmp(start,zero)>=0n&&cmp(firstEnd,start)>=0n&&cmp(firstEnd,from(.25))<=0n&&cmp(last,from(.75))>=0n&&cmp(lastEnd,last)>=0n&&cmp(lastEnd,one)<=0n,'Joint witness pulse is outside its quarter.');
 const times=[zero,from(.25),from(.5),from(.75),one],amounts=[q,sub(five,q),r,sub(five,r)];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[];
 for(const b of bins)need(cmp(b.amount,zero)>=0n&&cmp(b.amount,mul(cap,sub(b.end,b.start)))<=0n,'Joint witness bin violates the rate cap.');
 function emit(start,end,rate){
  const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative joint witness duration.');
  if(cmp(duration,zero)>0n){need(segments.length<8,'Joint segment reservation exceeded.');segments.push({start,end,rate,depth:mul(rate,duration)});}
 }
 emit(zero,start,zero);emit(start,firstEnd,cap);emit(firstEnd,times[1],zero);
 emit(times[1],times[2],mul(from(4),amounts[1]));
 emit(times[2],times[3],mul(from(4),amounts[2]));
 emit(times[3],last,zero);emit(last,lastEnd,cap);emit(lastEnd,one,zero);
 need(segments.length>=4&&segments.length<=8,'Joint profile segment count differs.');
 let previous=zero,C=zero,F=zero,W=zero,minS=zero,peak=zero,attaining=zero;
 const knots=[{hour:e(zero),cumulativeRainMm:e(zero),cumulativeInfiltrationMm:e(zero),surfaceWaterMm:e(zero)}];
 for(const s of segments){
  need(cmp(s.start,previous)===0n&&cmp(s.end,s.start)>0n&&cmp(s.rate,zero)>=0n&&cmp(s.rate,cap)<=0n,'Joint profile coverage or rate invariant failed.');
  need(cmp(s.depth,mul(s.rate,sub(s.end,s.start)))===0n,'Joint profile integral mismatch.');
  C=add(C,s.depth);const S=sub(C,mul(six,s.end));minS=minimum(minS,S);W=sub(S,minS);const nextF=sub(C,W);
  need(cmp(W,zero)>=0n&&cmp(nextF,F)>=0n&&cmp(add(nextF,W),C)===0n,'Joint profile reflection or conservation failed.');
  if(cmp(W,peak)>0n){peak=W;attaining=s.end;}
  F=nextF;previous=s.end;need(knots.length<9,'Joint knot reservation exceeded.');
  knots.push({hour:e(previous),cumulativeRainMm:e(C),cumulativeInfiltrationMm:e(F),surfaceWaterMm:e(W)});
 }
 need(cmp(previous,one)===0n&&cmp(C,from(10))===0n&&knots.length===segments.length+1,'Joint profile does not cover the original event.');
 const totals=[];
 for(const b of bins){
  let total=zero;
  for(const s of segments){const a=maximum(b.start,s.start),end=minimum(b.end,s.end);if(cmp(end,a)>0n)total=add(total,mul(s.rate,sub(end,a)));}
  need(cmp(total,b.amount)===0n,'Joint profile does not attain its bin total.');totals.push(total);
 }
 const firstHalf=add(totals[0],totals[1]),secondHalf=add(totals[2],totals[3]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,first.lo)>=0n&&cmp(q,first.hi)<=0n&&cmp(r,third.lo)>=0n&&cmp(r,third.hi)<=0n,'Joint profile violates original totals or a declared band.');
 need(cmp(W,terminal)===0n&&cmp(peak,add(terminal,excess))===0n,'One joint history does not attain both requested outcomes.');
 return {quarterTotalsMm:{first:e(q),third:e(r)},bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,terminalSurfaceWaterMm:e(W),peakSurfaceWaterMm:e(peak),attainingPeakHour:e(attaining),withinDeclaredBands:true,rateCapVerified:true,originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)]};
}
const bounds=(lo,hi)=>({lowerMm:e(lo),upperMm:e(hi),lowerInclusive:true,upperInclusive:true});
export function inspectArchivedRainJointOutcome(originalText,firstText,thirdText,criterionText,queryText){
 const p=prepare(originalText,firstText,thirdText,criterionText,queryText);
 const pairedReport=inspectArchivedRainPairedPeak(originalText,firstText,thirdText,criterionText);
 const first=band(pairedReport.firstQuarterReport.terminalReport.declaredReading),third=band(pairedReport.thirdQuarterReport.terminalReport.declaredReading),empty=first.empty||third.empty;
 let region=null,witness=null,status='outside-support';const violatedConstraints=[];
 if(!empty){
  const A=maximum(from(4),sub(from(5.5),first.hi)),B=sub(from(5.5),div(mul(from(3),first.lo),from(10)));
  const D=maximum(Q.zero,sub(third.lo,from(3.5))),E=div(mul(from(3),third.hi),from(10));
  need(cmp(A,B)<=0n&&cmp(D,E)<=0n,'Joint outcome rectangle is inverted.');
  const corners=[];
  for(const [T,delta] of [[A,D],[B,D],[B,E],[A,E]])if(!corners.some(v=>cmp(v.T,T)===0n&&cmp(v.delta,delta)===0n))corners.push({T,delta});
  need([1,2,4].includes(corners.length),'Joint vertex reservation differs.');
  const vertices=corners.map(({T,delta})=>({terminalMm:e(T),peakMm:e(add(T,delta)),excessMm:e(delta),witness:profile(T,delta,first,third)}));
  region={coordinates:['terminal-surface-water-mm','peak-minus-terminal-mm'],terminalBounds:bounds(A,B),excessBounds:bounds(D,E),geometry:corners.length===1?'point':corners.length===2?'segment':'parallelogram',vertices};
  const checks=[['terminal-below-lower',p.terminal,A,cmp(p.terminal,A)<0n],['terminal-above-upper',p.terminal,B,cmp(p.terminal,B)>0n],['excess-below-lower',p.excess,D,cmp(p.excess,D)<0n],['excess-above-upper',p.excess,E,cmp(p.excess,E)>0n]];
  for(const [constraint,actual,bound,violated] of checks)if(violated)violatedConstraints.push({constraint,actualMm:e(actual),boundMm:e(bound)});
  status=violatedConstraints.length?'infeasible':'feasible';
  if(status==='feasible')witness=profile(p.terminal,p.excess,first,third);
 }
 return {schema:'experimental-earth-archived-rain-joint-outcome/1',declaredJointOutcomeQuery:p.query,scope:{...SCOPE},work:p.work,pairedReport,
  assessment:{status:empty?'declared-readings-incompatible':'declared-readings-compatible',compatibleQuarterBands:{first:encodedBand(first),third:encodedBand(third)},region,query:{terminalMm:e(p.terminal),peakMm:e(p.peak),excessMm:e(p.excess),status,violatedConstraints,witness}},
  meaning:'This hypothetical outcome query asks whether one continuous rain history can attain both terminal and peak water under the fixed dry K6/A0, cap20 model and assumed 5+5 mm totals. It is not an observation or a replacement criterion. Complete separate parent questions remain unchanged; marginal witnesses are not combined. Every reported vertex and feasible query has its own checked common history. The original schedules are illustrative, not exhaustive. No physical association, instrument accuracy, availability, acquisition, probability or physical action is verified. A witness certifies one attaining peak knot, not earliest attainment or all ties; water and infiltration need not interpolate linearly between rainfall endpoints. No model is replayed. Scalar work excludes parsing, string processing, cloning, serialization and rational bit costs and is not a CPU, memory or wall-time guarantee.'};
}

import {Q,need,from,add,sub,mul,div,cmp,encode} from './rainfall-constraint-core.js';
const LIMITS=Object.freeze({originalBytes:16384,readingBytes:4096,persistentBits:8192,intermediateBits:16384});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
const e=q=>{const value=encode(q);need(value.numerator.length<=650&&value.denominator.length<=650,'Exact output exceeds its encoded numeric budget.');return value;};
function parse(text,limit,label){
 need(typeof text==='string'&&text.length>0&&!text.startsWith('\uFEFF'),label+' requires nonempty exact UTF-8 without BOM.');
 const bytes=new TextEncoder().encode(text);need(bytes.length<=limit&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===text,label+' exceeds byte limit or contains a lone surrogate.');
 const value=JSON.parse(text),pending=[value];
 while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),label+' contains a non-finite number.');else if(typeof v==='string')need(v.isWellFormed(),label+' contains an escaped lone surrogate.');else if(v!==null&&typeof v==='object')for(const child of Object.values(v))pending.push(child);}
 return value;
}
function prepare(originalText,readingText){
 const original=parse(originalText,LIMITS.originalBytes,'Original declaration'),reading=parse(readingText,LIMITS.readingBytes,'Archived reading');
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=600;
 need(exact(original,['schema','source','model','target','schedules'])&&original.schema==='experimental-earth-authored-rain-timing/1'&&text(original.source),'Supply the original fixed authored declaration.');
 const model={conductivityMmHr:6,capillaryDriveMm:0,initialCumulativeMm:0,initialSurfaceWaterMm:0,durationHours:1,segmentHours:0.25,declaredRateCapMmHr:20};
 need(exact(original.model,Object.keys(model))&&Object.entries(model).every(([k,v])=>original.model[k]===v),'Only the fixed authored isolated model is admitted.');
 need(exact(original.target,['metric','operator','valueMm'])&&original.target.metric==='terminal-surface-water-mm'&&original.target.operator==='at-most'&&original.target.valueMm===5,'Only the fixed authored target is admitted.');
 const ids=['uniform','earliest','latest'],rates=[[10,10,10,10],[20,0,20,0],[0,20,0,20]];
 need(Array.isArray(original.schedules)&&original.schedules.length===3,'Retain all three original illustrative schedules.');
 original.schedules.forEach((s,i)=>need(exact(s,['id','ratesMmHr'])&&s.id===ids[i]&&Array.isArray(s.ratesMmHr)&&s.ratesMmHr.length===4&&s.ratesMmHr.every((v,j)=>v===rates[i][j]),'Original authored schedules differ.'));
 need(exact(reading,['schema','id','quarter','valueMm','uncertaintyMm','source'])&&reading.schema==='experimental-earth-archived-rain-timing-reading/1'&&text(reading.id)&&text(reading.source)&&['first','third'].includes(reading.quarter),'Supply one declared first- or third-quarter reading.');
 need([reading.valueMm,reading.uncertaintyMm].every(v=>Number.isFinite(v)&&v>=0),'Declared value and uncertainty require finite nonnegative normalized-mm values.');
 const work={bins:3,maxProfiles:2,maxSegmentsPerProfile:6,maxTotalSegments:12,reservedScalarWork:4096,limits:{...LIMITS}};
 need(Number.isSafeInteger(work.reservedScalarWork)&&work.reservedScalarWork===4096,'Complete scalar work was not reserved.');
 return {original,reading,z:from(reading.valueMm),u:from(reading.uncertaintyMm),work};
}
export function estimateArchivedRainTimingWork(originalText,readingText){return prepare(originalText,readingText).work;}

// Three fixed bins, at most two pieces per bin; no sorting or model replay.
function profile(quarter,q,ordering,lo,hi,endpoint){
 const zero=Q.zero,one=from(1),five=from(5),six=from(6),cap=from(20),quarterHour=from(0.25),half=from(0.5),threeQuarters=from(0.75);
 const amounts=quarter==='first'?[q,sub(five,q),five]:[five,q,sub(five,q)];
 const times=quarter==='first'?[zero,quarterHour,half,one]:[zero,half,threeQuarters,one];
 const bins=amounts.map((amount,i)=>({start:times[i],end:times[i+1],amount})),segments=[];
 need(bins.length===3,'Fixed bin reservation differs.');
 function emit(start,end,rate){const duration=sub(end,start);need(cmp(duration,zero)>=0n,'Negative profile duration.');if(cmp(duration,zero)>0n)segments.push({start,end,rate,depth:mul(rate,duration)});}
 for(const bin of bins){
  const duration=sub(bin.end,bin.start),rainDuration=div(bin.amount,cap);
  need(cmp(bin.amount,zero)>=0n&&cmp(rainDuration,duration)<=0n,'Bin amount violates declared rate cap.');
  if(ordering==='earliest'){const split=add(bin.start,rainDuration);emit(bin.start,split,cap);emit(split,bin.end,zero);}
  else{const split=sub(bin.end,rainDuration);emit(bin.start,split,zero);emit(split,bin.end,cap);}
 }
 need(segments.length>=1&&segments.length<=6,'Profile segment reservation exceeded.');
 let previous=zero,C=zero,F=zero,W=zero,minS=zero;
 const knots=[{hour:e(zero),cumulativeRainMm:e(zero),cumulativeInfiltrationMm:e(zero),surfaceWaterMm:e(zero)}];
 for(const segment of segments){
  need(cmp(segment.start,previous)===0n&&cmp(segment.end,segment.start)>0n&&cmp(segment.rate,zero)>=0n&&cmp(segment.rate,cap)<=0n,'Profile coverage or rate invariant failed.');
  need(cmp(segment.depth,mul(segment.rate,sub(segment.end,segment.start)))===0n,'Profile integral mismatch.');
  C=add(C,segment.depth);const S=sub(C,mul(six,segment.end));minS=minimum(minS,S);W=sub(S,minS);const nextF=sub(C,W);
  need(cmp(W,zero)>=0n&&cmp(nextF,F)>=0n&&cmp(add(nextF,W),C)===0n,'Exact profile reflection or conservation failed.');
  F=nextF;previous=segment.end;
  knots.push({hour:e(previous),cumulativeRainMm:e(C),cumulativeInfiltrationMm:e(F),surfaceWaterMm:e(W)});
 }
 need(knots.length<=7&&cmp(previous,one)===0n&&cmp(C,from(10))===0n,'Profile does not cover the complete authored event.');
 // Independently integrate the emitted pieces back over every assumed bin.
 const totals=[];
 for(const bin of bins){let total=zero;for(const segment of segments){const a=maximum(bin.start,segment.start),b=minimum(bin.end,segment.end);if(cmp(b,a)>0n)total=add(total,mul(segment.rate,sub(b,a)));}need(cmp(total,bin.amount)===0n,'Emitted profile does not attain a bin total.');totals.push(total);}
 const firstHalf=quarter==='first'?add(totals[0],totals[1]):totals[0],secondHalf=quarter==='first'?totals[2]:add(totals[1],totals[2]);
 need(cmp(firstHalf,five)===0n&&cmp(secondHalf,five)===0n&&cmp(q,lo)>=0n&&cmp(q,hi)<=0n,'Profile violates original totals or declared band.');
 need(cmp(W,endpoint)===0n,'Profile does not attain the reported terminal bound.');
 return {ordering,quarterTotalMm:e(q),bins:bins.map(b=>({startHour:e(b.start),endHour:e(b.end),depthMm:e(b.amount)})),segments:segments.map(s=>({startHour:e(s.start),endHour:e(s.end),rateMmHr:e(s.rate),depthMm:e(s.depth)})),knots,terminalSurfaceWaterMm:e(W),originalHalfHourTotalsMm:[e(firstHalf),e(secondHalf)],withinDeclaredBand:true,rateCapVerified:true};
}
export function inspectArchivedRainTiming(originalText,readingText){
 const p=prepare(originalText,readingText),five=from(5),four=from(4),elevenHalves=from(5.5),lo=maximum(Q.zero,sub(p.z,p.u)),hi=minimum(five,add(p.z,p.u)),empty=cmp(lo,hi)>0n;
 let terminalBounds=null,lowerWitness=null,upperWitness=null,classification='outside-support';
 if(!empty){
  const first=p.reading.quarter==='first',lower=first?maximum(four,sub(elevenHalves,hi)):four,upper=first?sub(elevenHalves,div(mul(from(3),lo),from(10))):elevenHalves;
  need(cmp(lower,upper)<=0n,'Terminal bounds are inverted.');
  lowerWitness=profile(p.reading.quarter,first?hi:lo,'earliest',lo,hi,lower);
  upperWitness=profile(p.reading.quarter,lo,'latest',lo,hi,upper);
  terminalBounds={lowerMm:e(lower),upperMm:e(upper),lowerInclusive:true,upperInclusive:true};
  classification=cmp(upper,five)<=0n?'certain-meet':cmp(lower,five)>0n?'certain-miss':'ambiguous';
 }
 return {schema:'experimental-earth-archived-rain-timing/1',originalDeclaration:p.original,declaredReading:p.reading,
  scope:{mathematicalDeclaration:true,retrospective:true,physicalAssociationVerified:false,instrumentAccuracyVerified:false,rateCapInferred:false,wholeSitePrediction:false,modelReplayed:false,originalSchedulesExhaustive:false,readingAvailabilityVerified:false,originalHalfHourTotalsAreAssumed:true},work:p.work,
  assessment:{status:empty?'declared-reading-incompatible':'declared-reading-compatible',quarterIntervalMinutes:p.reading.quarter==='first'?[0,15]:[30,45],parameters:{valueMm:e(p.z),uncertaintyMm:e(p.u),conductivityMmHr:e(from(6)),rateCapMmHr:e(from(20)),targetMm:e(five),originalHalfHourTotalsMm:[e(five),e(five)]},compatibleQuarterBand:{lowerMm:e(lo),upperMm:e(hi),empty},terminalBounds,classification,lowerWitness,upperWitness},
  meaning:'Retrospective mathematical reanalysis of fictional declarations. The common 5+5 mm totals of the original illustrative schedules are hypothetical constraints, not observed rainfall evidence. The three schedules are not the exhaustive continuous cap-bounded family. The declared reading does not verify physical association, instrument precision, independence or record availability. No deadline, sensor operation or physical action follows. Exact attaining profiles describe rainfall and endpoint states of the fixed isolated reflected-storage model; water and infiltration need not interpolate linearly across a constant-rain segment with interior depletion. No arbitrary binary64 model is replayed. Scalar work excludes parsing, general string validation, serialization and rational bit costs; it is not a CPU, memory or wall-time guarantee.'};
}

import {validateRainGauge} from './rain-gauge-evidence.js';
import {rainfallHistoryConsistency} from './rain-gauge-history.js';
import {gaugeRational as Q} from './rain-gauge-consistency.js';
import {DEPTH_UNITS} from './observation-units.js';
import {MECHANISM_PROPOSAL_SCHEMA} from './rain-mechanism-proposal.js';

const LIMITS=Object.freeze({originalBytes:4*1024*1024,totalWork:150000,persistentBits:8192,intermediateBits:16384});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const need=(condition,message)=>{if(!condition)throw Error(message);};
// Inspect magnitude without string conversion, before arithmetic or encoding.
function bits(value){
  let x=value<0n?-value:value;
  if(x===0n)return 0;
  if((x>>8192n)!==0n)return 8193;
  let length=1;
  for(let shift=4096;shift>=1;shift/=2){
    const upper=x>>BigInt(shift);
    if(upper!==0n){x=upper;length+=shift;}
  }
  return length;
}
function checked(r){
  need(typeof r.n==='bigint'&&typeof r.d==='bigint'&&r.d>0n,'Invalid exact rational.');
  need(bits(r.n)<=LIMITS.persistentBits&&bits(r.d)<=LIMITS.persistentBits,'Rainfall ledger persistent numerical budget exceeded.');
  return r;
}
function operation(kind,a,b){
  checked(a);checked(b);
  const an=bits(a.n),ad=bits(a.d),bn=bits(b.n),bd=bits(b.d);
  const bound=kind==='mul'?Math.max(an+bn,ad+bd):kind==='div'?Math.max(an+bd,ad+bn):Math.max(an+bd,bn+ad)+1;
  need(Math.max(bound,ad+bd)<=LIMITS.intermediateBits,'Rainfall ledger intermediate numerical budget exceeded.');
  if(kind==='div')need(b.n>0n,'Exact division requires a positive divisor.');
  const result=Q[kind](a,b);
  return kind==='cmp'?result:checked(result);
}
const add=(a,b)=>operation('add',a,b),sub=(a,b)=>operation('sub',a,b),mul=(a,b)=>operation('mul',a,b),div=(a,b)=>operation('div',a,b),cmp=(a,b)=>operation('cmp',a,b);
function from(x){need(Number.isFinite(x)&&x>=0,'Exact input must be finite and nonnegative.');return checked(Q.from(x));}
const encode=r=>Q.encode(checked(r));

function prepare(originalText){
  need(typeof originalText==='string'&&originalText.length>0&&!originalText.startsWith('\uFEFF'),'Supply nonempty original UTF-8 JSON without BOM.');
  const bytes=new TextEncoder().encode(originalText);
  need(bytes.length<=LIMITS.originalBytes&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===originalText,'Original input exceeds 4 MiB or contains a lone surrogate.');
  const originalProposal=JSON.parse(originalText),pending=[originalProposal];
  while(pending.length){const value=pending.pop();if(typeof value==='number')need(Number.isFinite(value),'Original input contains a non-finite number.');else if(value!==null&&typeof value==='object')for(const child of Object.values(value))pending.push(child);}
  need(exact(originalProposal,['schema','source','fronts','goal'])&&originalProposal.schema===MECHANISM_PROPOSAL_SCHEMA&&exact(originalProposal.source,['project','request','gauge','durations','capacities','layers']),'Open original mechanism/proposal inputs, not computed results.');
  const {project,gauge}=originalProposal.source;
  validateRainGauge(project,gauge);
  const entries=gauge.readings.map((reading,index)=>({index,ref:'rain-gauge:'+reading.id,reading}));
  const included=entries.filter(e=>e.reading.use!=='unassigned'),calibration=entries.filter(e=>e.reading.use==='calibration');
  const endpoints=rows=>new Set(rows.flatMap(e=>[e.reading.startMinute,e.reading.endMinute]));
  const calibrationTimes=endpoints(calibration),jointTimes=endpoints(included);
  jointTimes.add(0);jointTimes.add(project.weather.durationMinutes);
  const C=calibration.length,N=included.length,Vc=calibrationTimes.size,Vj=jointTimes.size,Ec=Vc?Vc-1+2*C:0,Ej=Vj-1+2*N;
  const reservedCalibrationRelaxations=Vc*Ec,reservedJointRelaxations=Vj*Ej,mappingWork=2*C*Vc,sortingWork=Vc*Vc+Vj*Vj,verificationWork=8*N+8*Vj+4*Ej+64;
  const totalWork=reservedCalibrationRelaxations+reservedJointRelaxations+mappingWork+sortingWork+verificationWork;
  const work={originalReadingCount:entries.length,calibrationRecordCount:C,jointRecordCount:N,calibrationVertices:Vc,calibrationEdges:Ec,jointVertices:Vj,jointEdges:Ej,reservedCalibrationRelaxations,reservedJointRelaxations,mappingWork,sortingWork,verificationWork,totalWork,limits:{...LIMITS}};
  need(Object.entries(work).filter(([k])=>k!=='limits').every(([,v])=>Number.isSafeInteger(v)&&v>=0)&&totalWork<=LIMITS.totalWork,'Rainfall ledger work budget exceeded.');
  return {originalProposal,project,gauge,included,jointTimes,work,excludedUnassigned:entries.filter(e=>e.reading.use==='unassigned').map(e=>({...e,reason:'unassigned'}))};
}

/** Admission and reservation only: no baseline, graph solve or physical model. */
export function estimateRainfallLedgerWork(originalText){return prepare(originalText).work;}

export function inspectRainfallLedger(originalText){
  const p=prepare(originalText),times=[...p.jointTimes].sort((a,b)=>a-b),at=new Map(times.map((t,i)=>[t,i]));
  const records=p.included.map(e=>{
    const unit=from(DEPTH_UNITS[e.reading.unit]),depth=mul(from(e.reading.depth),unit),uncertainty=mul(from(e.reading.uncertainty),unit),rawLower=sub(depth,uncertainty);
    return {...e,lower:cmp(rawLower,Q.zero)>0n?rawLower:Q.zero,upper:add(depth,uncertainty)};
  });
  const edges=[];
  for(let i=1;i<times.length;i++)edges.push({id:'monotonic:'+i,kind:'monotonic',from:i,to:i-1,weight:Q.zero,recordIndex:null,recordRef:null});
  for(const r of records){
    const a=at.get(r.reading.startMinute),b=at.get(r.reading.endMinute);
    edges.push({id:'upper:'+r.index,kind:'upper',from:a,to:b,weight:r.upper,recordIndex:r.index,recordRef:r.ref});
    edges.push({id:'lower:'+r.index,kind:'lower',from:b,to:a,weight:sub(Q.zero,r.lower),recordIndex:r.index,recordRef:r.ref});
  }
  need(edges.length===p.work.jointEdges,'Reserved graph disagrees with prepared graph.');
  // Unchanged calibration-only authority receives untouched original objects.
  const calibration=rainfallHistoryConsistency(p.project,p.gauge);
  const distance=times.map(()=>Q.zero),previous=times.map(()=>null);
  let changed=-1,relaxations=0;
  for(let pass=0;pass<times.length;pass++){
    changed=-1;
    for(const edge of edges){
      relaxations++;
      const candidate=add(distance[edge.from],edge.weight);
      if(cmp(candidate,distance[edge.to])<0n){distance[edge.to]=candidate;previous[edge.to]=edge;changed=edge.to;}
    }
    if(changed<0)break;
  }
  need(relaxations<=p.work.reservedJointRelaxations,'Joint relaxation reservation exceeded.');
  let history=null,intervalChecks=[],negativeCycle=null;
  if(changed<0){
    const cumulative=distance.map(d=>sub(d,distance[0]));
    need(cmp(cumulative[0],Q.zero)===0n,'History does not start at zero.');
    const knots=[],segments=[],sixty=from(60);
    for(let i=0;i<times.length;i++){
      need(cmp(cumulative[i],Q.zero)>=0n&&(i===0||cmp(cumulative[i],cumulative[i-1])>=0n),'History is not nonnegative and nondecreasing.');
      knots.push({minute:times[i],cumulativeMm:encode(cumulative[i])});
      if(i){
        const increment=sub(cumulative[i],cumulative[i-1]),duration=sub(from(times[i]),from(times[i-1])),rate=div(mul(sixty,increment),duration);
        need(cmp(div(mul(rate,duration),sixty),increment)===0n,'Segment rate fails its exact duration identity.');
        segments.push({startMinute:times[i-1],endMinute:times[i],depthMm:encode(increment),rateMmHr:encode(rate)});
      }
    }
    for(const edge of edges)need(cmp(sub(cumulative[edge.to],cumulative[edge.from]),edge.weight)<=0n,'History violates a source graph edge.');
    intervalChecks=records.map(r=>{
      const total=sub(cumulative[at.get(r.reading.endMinute)],cumulative[at.get(r.reading.startMinute)]);
      need(cmp(total,r.lower)>=0n&&cmp(total,r.upper)<=0n,'History violates an original nominal band.');
      return {index:r.index,ref:r.ref,totalMm:encode(total),withinNominalBand:true};
    });
    history={knots,segments};
  }else{
    let cursor=changed;
    for(let i=0;i<times.length;i++){need(previous[cursor]!==null,'Missing cycle predecessor.');cursor=previous[cursor].from;}
    const start=cursor,backward=[];
    do{
      need(backward.length<times.length&&previous[cursor]!==null,'Cycle extraction exceeds vertex reservation.');
      const edge=previous[cursor];backward.push(edge);cursor=edge.from;
    }while(cursor!==start);
    const forward=backward.reverse(),edgeOrder=new Map(edges.map((e,i)=>[e.id,i]));
    // Rotate to the earliest canonical source edge without changing direction.
    let first=0;
    for(let i=1;i<forward.length;i++)if(edgeOrder.get(forward[i].id)<edgeOrder.get(forward[first].id))first=i;
    const cycle=forward.slice(first).concat(forward.slice(0,first));
    let sum=Q.zero;
    for(let i=0;i<cycle.length;i++){
      const edge=cycle[i];
      need(edges[edgeOrder.get(edge.id)]===edge&&edge.to===cycle[(i+1)%cycle.length].from,'Cycle is not a closed connected source-edge certificate.');
      sum=add(sum,edge.weight);
    }
    need(cmp(sum,Q.zero)<0n,'Cycle weight is not strictly negative.');
    const recordIndices=[...new Set(cycle.filter(e=>e.recordIndex!==null).map(e=>e.recordIndex))].sort((a,b)=>a-b);
    negativeCycle={edges:cycle.map(e=>({id:e.id,kind:e.kind,from:e.from,to:e.to,fromMinute:times[e.from],toMinute:times[e.to],weightMm:encode(e.weight),recordIndex:e.recordIndex,recordRef:e.recordRef})),sumMm:encode(sum),recordIndices,recordRefs:recordIndices.map(i=>'rain-gauge:'+p.gauge.readings[i].id)};
  }
  return {
    schema:'experimental-earth-rainfall-ledger/1',originalProposal:p.originalProposal,
    scope:{interpreted:['source.project','source.gauge'],includedRoles:['calibration','challenge'],excludedUnassigned:p.excludedUnassigned,numericContract:'exact-represented-nominal-bands',physicalInference:false},
    work:p.work,calibration,
    joint:{status:changed<0?'nonnegative-history-compatible':'interval-totals-inconsistent',records:records.map(r=>({index:r.index,ref:r.ref,reading:r.reading,lowerMm:encode(r.lower),upperMm:encode(r.upper)})),vertices:times.length,edgeCount:edges.length,relaxations,history,intervalChecks,negativeCycle},
    meaning:'Only source.project and source.gauge are interpreted; other original proposal context is retained without qualification. Calibration remains the unchanged calibration-only authority. The joint assessment uses exact represented nominal bands, not decimal-intent values or model score tolerances. A compatible history is one mathematical witness, not inferred or unique physical rainfall; no intensity bound or storm cutoff is imposed. It does not restore rejected constant-forcing candidates, verify event/site/clock association, or determine soil, depth or proposal consequences. Inconsistency is not a sensor diagnosis, and its cycle is not claimed minimum or irreducible. Work reservations exclude parsing, general validation and serialization and are not CPU, memory or wall-time guarantees.'
  };
}

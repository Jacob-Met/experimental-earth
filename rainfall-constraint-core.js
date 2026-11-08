// Shared internal exact graph operations; original producers remain unchanged.
import {gaugeRational as Q} from './rain-gauge-consistency.js';
import {DEPTH_UNITS} from './observation-units.js';
const LIMITS=Object.freeze({persistentBits:8192,intermediateBits:16384});
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

export {Q,need,add,sub,mul,div,cmp,from,encode};

export function buildRainfallGraph(included,endpointSet){
  const times=[...endpointSet].sort((a,b)=>a-b),at=new Map(times.map((t,i)=>[t,i]));
  const records=included.map(e=>{
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
  return {times,at,records,edges};
}

export function solveRainfallFeasibility({times,edges}){
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
  return {distance,previous,changed,relaxations};
}

export function verifyRainfallHistory({times,at,records,edges},distance){
  let intervalChecks;
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
    return {history:{knots,segments},intervalChecks,cumulative};
}

export function verifyRainfallCycle({times,edges},{previous,changed},readings){
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
    return {edges:cycle.map(e=>({id:e.id,kind:e.kind,from:e.from,to:e.to,fromMinute:times[e.from],toMinute:times[e.to],weightMm:encode(e.weight),recordIndex:e.recordIndex,recordRef:e.recordRef})),sumMm:encode(sum),recordIndices,recordRefs:recordIndices.map(i=>'rain-gauge:'+readings[i].id)};
}

export const encodeRainfallRecords=records=>records.map(r=>({index:r.index,ref:r.ref,reading:r.reading,lowerMm:encode(r.lower),upperMm:encode(r.upper)}));
export const encodeRainfallEdge=(e,times)=>({id:e.id,kind:e.kind,from:e.from,to:e.to,fromMinute:times[e.from],toMinute:times[e.to],weightMm:encode(e.weight),recordIndex:e.recordIndex,recordRef:e.recordRef});

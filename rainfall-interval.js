import {DEPTH_UNITS} from './observation-units.js';
import {validateRainGauge} from './rain-gauge-evidence.js';
import {rainfallHistoryConsistency} from './rain-gauge-history.js';
import {MECHANISM_PROPOSAL_SCHEMA} from './rain-mechanism-proposal.js';
import {Q,need,add,sub,mul,cmp,from,encode,buildRainfallGraph,solveRainfallFeasibility,verifyRainfallHistory,verifyRainfallCycle,encodeRainfallRecords,encodeRainfallEdge} from './rainfall-constraint-core.js';

const LIMITS=Object.freeze({originalBytes:4194304,queryBytes:4096,totalWork:250000,persistentBits:8192,intermediateBits:16384});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function parse(text,limit,label){
  need(typeof text==='string'&&text.length>0&&!text.startsWith('\uFEFF'),label+' requires nonempty exact UTF-8 without BOM.');
  const bytes=new TextEncoder().encode(text);
  need(bytes.length<=limit&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===text,label+' exceeds byte limit or contains a lone surrogate.');
  const value=JSON.parse(text),pending=[value];
  while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),label+' contains a non-finite number.');else if(v!==null&&typeof v==='object')for(const c of Object.values(v))pending.push(c);}
  return value;
}
function prepare(originalText,queryText){
  const originalProposal=parse(originalText,LIMITS.originalBytes,'Original proposal');
  need(exact(originalProposal,['schema','source','fronts','goal'])&&originalProposal.schema===MECHANISM_PROPOSAL_SCHEMA&&exact(originalProposal.source,['project','request','gauge','durations','capacities','layers']),'Open original mechanism/proposal inputs, not computed results.');
  const {project,gauge}=originalProposal.source;
  validateRainGauge(project,gauge);
  const query=parse(queryText,LIMITS.queryBytes,'Interval query'),text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=600;
  need(exact(query,['schema','eventRef','startMinute','endMinute','source'])&&query.schema==='experimental-earth-rainfall-interval-query/1','Supply one original interval query declaration.');
  need(text(query.eventRef)&&text(query.source)&&query.eventRef===gauge.eventRef,'Query requires original matching eventRef and a declared source.');
  need(Number.isFinite(query.startMinute)&&Number.isFinite(query.endMinute)&&query.startMinute>=0&&query.endMinute>query.startMinute&&query.endMinute<=project.weather.durationMinutes,'Query interval must be positive and within the original event.');
  const entries=gauge.readings.map((reading,index)=>({index,ref:'rain-gauge:'+reading.id,reading})),included=entries.filter(e=>e.reading.use==='calibration');
  const calibrationTimes=new Set(included.flatMap(e=>[e.reading.startMinute,e.reading.endMinute]));
  const times=new Set([...calibrationTimes,0,project.weather.durationMinutes,query.startMinute,query.endMinute]);
  const C=included.length,Vc=calibrationTimes.size,Ec=Vc?Vc-1+2*C:0,V=times.size,E=V-1+2*C;
  const reservedCalibrationRelaxations=Vc*Ec,reservedFeasibilityRelaxations=V*E,reservedShortestPathRelaxations=2*(V-1)*E,mappingWork=2*C*Vc,sortingWork=Vc*Vc+V*V+C*C,certificateWork=32*E+32*V+16*C+64;
  const totalWork=reservedCalibrationRelaxations+reservedFeasibilityRelaxations+reservedShortestPathRelaxations+mappingWork+sortingWork+certificateWork;
  const work={originalReadingCount:entries.length,calibrationRecordCount:C,calibrationVertices:Vc,calibrationEdges:Ec,queryVertices:V,queryEdges:E,reservedCalibrationRelaxations,reservedFeasibilityRelaxations,reservedShortestPathRelaxations,mappingWork,sortingWork,certificateWork,totalWork,limits:{...LIMITS}};
  need(Object.entries(work).filter(([k])=>k!=='limits').every(([,v])=>Number.isSafeInteger(v)&&v>=0)&&totalWork<=LIMITS.totalWork,'Rainfall interval work budget exceeded.');
  return {originalProposal,query,project,gauge,included,times,work,excluded:entries.filter(e=>e.reading.use!=='calibration').map(e=>({...e,reason:e.reading.use}))};
}
export function estimateRainfallIntervalWork(originalText,queryText){return prepare(originalText,queryText).work;}

// Separate source-rooted algorithm: null means unreachable, never numeric Infinity.
function shortest(graph,source){
  const {times,edges}=graph,distance=times.map(()=>null);distance[source]=Q.zero;
  let relaxations=0;
  for(let pass=0;pass<times.length-1;pass++){
    let changed=false;
    for(const e of edges){
      relaxations++;
      if(distance[e.from]===null)continue;
      const candidate=add(distance[e.from],e.weight);
      if(distance[e.to]===null||cmp(candidate,distance[e.to])<0n){distance[e.to]=candidate;changed=true;}
    }
    if(!changed)break;
  }
  need(cmp(distance[source],Q.zero)===0n,'Source shortest distance is not zero.');
  for(const e of edges)if(distance[e.from]!==null)need(distance[e.to]!==null&&cmp(distance[e.to],add(distance[e.from],e.weight))<=0n,'Shortest distances violate reachability or an edge inequality.');
  return {distance,relaxations};
}
function pathCertificate(graph,source,target,distance){
  const {times,edges}=graph,adj=times.map(()=>[]),byId=new Map();
  for(const e of edges){adj[e.from].push(e);byId.set(e.id,e);}
  const seen=times.map(()=>false),previous=times.map(()=>null),queue=[source];seen[source]=true;
  for(let head=0;head<queue.length;head++){
    const u=queue[head];
    for(const e of adj[u])if(!seen[e.to]&&distance[e.to]!==null&&cmp(add(distance[u],e.weight),distance[e.to])===0n){seen[e.to]=true;previous[e.to]=e;queue.push(e.to);}
  }
  need(seen[target],'No tight source path to a reachable target.');
  const backward=[];let cursor=target;
  while(cursor!==source){need(backward.length<times.length-1&&previous[cursor]!==null,'Tight path exceeds simple-path bound.');const e=previous[cursor];backward.push(e);cursor=e.from;}
  const path=backward.reverse();let sum=Q.zero;cursor=source;
  for(const e of path){need(byId.get(e.id)===e&&e.from===cursor,'Path is not source-derived and connected.');sum=add(sum,e.weight);cursor=e.to;}
  need(cursor===target&&cmp(sum,distance[target])===0n,'Path does not certify requested shortest distance.');
  return {edges:path.map(e=>encodeRainfallEdge(e,times)),sumMm:encode(sum)};
}
function attaining(graph,potential,source,distances,a,b,total){
  const rho=graph.times.map(()=>null);let maximum=Q.zero;
  for(let i=0;i<rho.length;i++)if(distances[i]!==null){rho[i]=sub(add(distances[i],potential[source]),potential[i]);need(cmp(rho[i],Q.zero)>=0n,'Reduced source distance is negative.');if(cmp(rho[i],maximum)>0n)maximum=rho[i];}
  const h=potential.map((p,i)=>add(p,rho[i]===null?maximum:rho[i]));
  const verified=verifyRainfallHistory(graph,h);
  need(cmp(sub(verified.cumulative[b],verified.cumulative[a]),total)===0n,'Attaining history does not attain the requested bound.');
  return verified;
}
function directionCertificate(graph,distances,a,b,condition=null){
  const reachableVertices=[],potential=graph.times.map((_,i)=>{if(distances[i]!==null){reachableVertices.push(i);return Q.zero;}return from(1);});
  const zeroGraph={...graph,edges:graph.edges.map(e=>({...e,weight:Q.zero})),records:graph.records.map(r=>({...r,lower:Q.zero,upper:Q.zero}))};
  const verified=verifyRainfallHistory(zeroGraph,potential);
  const calibrationIncrements=graph.records.map(r=>{
    const increment=sub(verified.cumulative[graph.at.get(r.reading.endMinute)],verified.cumulative[graph.at.get(r.reading.startMinute)]);
    need(cmp(increment,Q.zero)===0n,'Direction changes an original calibration interval.');
    return {index:r.index,ref:r.ref,incrementMm:encode(increment)};
  });
  const queryIncrement=sub(verified.cumulative[b],verified.cumulative[a]);
  need(cmp(queryIncrement,from(1))===0n,'Unbounded direction must add one query millimetre.');
  let extra={};
  if(condition){const increment=sub(verified.cumulative[graph.at.get(condition.reading.endMinute)],verified.cumulative[graph.at.get(condition.reading.startMinute)]);need(cmp(increment,Q.zero)===0n,'Direction changes the hypothetical condition.');extra={conditionIncrement:{conditionRef:condition.conditionRef,incrementMm:encode(increment)}};}
  return {history:verified.history,calibrationIncrements,queryIncrementMm:encode(queryIncrement),reachableVertices,...extra};
}
export function boundRainfallInterval(originalText,queryText){
  const p=prepare(originalText,queryText),graph=buildRainfallGraph(p.included,p.times),{times,edges,records,at}=graph;
  need(times.length===p.work.queryVertices&&edges.length===p.work.queryEdges,'Prepared query graph differs from reservation.');
  const calibration=rainfallHistoryConsistency(p.project,p.gauge),feasibility=solveRainfallFeasibility(graph);
  need(feasibility.relaxations<=p.work.reservedFeasibilityRelaxations,'Feasibility relaxation reservation exceeded.');
  const inconsistent=feasibility.changed>=0;
  need(inconsistent===(calibration.status==='interval-totals-inconsistent'),'Query graph and unchanged calibration authority disagree.');
  let status='interval-totals-inconsistent',negativeCycle=null,bounds=null,lowerRelaxations=0,upperRelaxations=0;
  if(inconsistent)negativeCycle=verifyRainfallCycle(graph,feasibility,p.gauge.readings);
  else{
    ({status,bounds,lowerRelaxations,upperRelaxations}=projectInterval(graph,feasibility,p.query,p.work));
  }
  return {schema:'experimental-earth-rainfall-interval/1',originalProposal:p.originalProposal,query:p.query,
    scope:{interpreted:['source.project','source.gauge','query'],includedRoles:['calibration'],excluded:p.excluded,numericContract:'exact-represented-nominal-bands',physicalInference:false},work:p.work,calibration,
    assessment:{status,records:encodeRainfallRecords(records),vertices:times.length,edgeCount:edges.length,relaxations:{feasibility:feasibility.relaxations,lower:lowerRelaxations,upper:upperRelaxations},negativeCycle,bounds},
    meaning:'Exact calibration-only projection onto one declared interval under nonnegative rainfall histories. Challenge and unassigned readings remain held aside and do not constrain bounds. Original event, site and time declarations are unverified. Nominal bands use exact represented values, not decimal-intent values or model epsilon allowances. Attaining histories and recession directions are mathematical certificates, not inferred or unique physical forcing; no intensity bound or storm cutoff is imposed. No rejected finite-family survivor is restored and no soil, depth or proposal conclusion follows. Other original context is retained without qualification. Abstract work reservations exclude parsing, general validation, serialization and bit-operation costs; they are not CPU, heap or wall-time guarantees.'};
}

function projectInterval(graph,feasibility,query,work,condition=null){
  const {at}=graph;let status,bounds,lowerRelaxations=0,upperRelaxations=0;
    const a=at.get(query.startMinute),b=at.get(query.endMinute);
    const lowerPaths=shortest(graph,b),upperPaths=shortest(graph,a);
    lowerRelaxations=lowerPaths.relaxations;upperRelaxations=upperPaths.relaxations;
    need(lowerRelaxations+upperRelaxations<=work.reservedShortestPathRelaxations,'Shortest-path relaxation reservation exceeded.');
    need(lowerPaths.distance[a]!==null,'Monotonic lower path is absent.');
    const lowerTotal=sub(Q.zero,lowerPaths.distance[a]);
    need(cmp(lowerTotal,Q.zero)>=0n,'Lower interval bound is negative.');
    const low=attaining(graph,feasibility.distance,b,lowerPaths.distance,a,b,lowerTotal);
    const lower={status:'attained',totalMm:encode(lowerTotal),path:pathCertificate(graph,b,a,lowerPaths.distance),history:low.history,intervalChecks:low.intervalChecks,...(condition?{conditionCheck:checkCondition(graph,low.cumulative,condition)}:{})};
    let upper;
    if(upperPaths.distance[b]===null){
      status='upper-unbounded';
      upper={status:'unbounded',base:{history:low.history,intervalChecks:low.intervalChecks,queryTotalMm:encode(lowerTotal),...(condition?{conditionCheck:lower.conditionCheck}:{})},direction:directionCertificate(graph,upperPaths.distance,a,b,condition)};
    }else{
      status='bounded-interval';const upperTotal=upperPaths.distance[b];
      need(cmp(upperTotal,lowerTotal)>=0n,'Interval bounds are reversed.');
      const high=attaining(graph,feasibility.distance,a,upperPaths.distance,a,b,upperTotal);
      upper={status:'attained',totalMm:encode(upperTotal),path:pathCertificate(graph,a,b,upperPaths.distance),history:high.history,intervalChecks:high.intervalChecks,...(condition?{conditionCheck:checkCondition(graph,high.cumulative,condition)}:{})};
    }
    bounds={lower,upper};
    return {status,bounds,lowerRelaxations,upperRelaxations};
}

function prepareConditional(originalText,queryText,conditionText){
  const p=prepare(originalText,queryText),condition=parse(conditionText,4096,'Hypothetical reading');
  const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=600;
  need(exact(condition,['schema','eventRef','reading'])&&condition.schema==='experimental-earth-rainfall-condition/1','Supply a separate hypothetical rainfall condition.');
  const r=condition.reading;
  need(text(condition.eventRef)&&condition.eventRef===p.gauge.eventRef&&exact(r,['id','startMinute','endMinute','depth','uncertainty','unit','source'])&&text(r.id)&&text(r.source),'Hypothetical reading requires exact original event association and declared identity/source, without a role.');
  need(Number.isFinite(r.startMinute)&&Number.isFinite(r.endMinute)&&r.startMinute>=0&&r.endMinute>r.startMinute&&r.endMinute<=p.project.weather.durationMinutes,'Hypothetical interval must be positive and within the original event.');
  need(Object.hasOwn(DEPTH_UNITS,r.unit)&&[r.depth,r.uncertainty].every(v=>Number.isFinite(v)&&v>=0&&v*DEPTH_UNITS[r.unit]<=10000),'Hypothetical depth and uncertainty require admitted units and nonnegative values within 10000 mm.');
  p.times.add(r.startMinute);p.times.add(r.endMinute);
  const C=p.work.calibrationRecordCount,V=p.times.size,E=V-1+2*C+2,Vc=p.work.calibrationVertices;
  const reservedFeasibilityRelaxations=V*E,reservedShortestPathRelaxations=2*(V-1)*E,sortingWork=Vc*Vc+V*V+(C+1)*(C+1),certificateWork=32*E+32*V+16*(C+1)+64;
  const totalWork=p.work.reservedCalibrationRelaxations+reservedFeasibilityRelaxations+reservedShortestPathRelaxations+p.work.mappingWork+sortingWork+certificateWork;
  const work={...p.work,conditionRecordCount:1,queryVertices:V,queryEdges:E,reservedFeasibilityRelaxations,reservedShortestPathRelaxations,sortingWork,certificateWork,totalWork,limits:{...LIMITS,conditionBytes:4096}};
  need(Object.entries(work).filter(([k])=>k!=='limits').every(([,v])=>Number.isSafeInteger(v)&&v>=0)&&totalWork<=LIMITS.totalWork,'Conditional rainfall interval work budget exceeded.');
  return {...p,condition,work};
}
export function estimateConditionalRainfallIntervalWork(originalText,queryText,conditionText){return prepareConditional(originalText,queryText,conditionText).work;}
function checkCondition(graph,cumulative,condition){
  const total=sub(cumulative[graph.at.get(condition.reading.endMinute)],cumulative[graph.at.get(condition.reading.startMinute)]);
  need(cmp(total,condition.lower)>=0n&&cmp(total,condition.upper)<=0n,'History violates the hypothetical nominal band.');
  return {conditionRef:condition.conditionRef,totalMm:encode(total),withinHypotheticalBand:true};
}
export function conditionRainfallInterval(originalText,queryText,conditionText){
  const p=prepareConditional(originalText,queryText,conditionText),graph=buildRainfallGraph(p.included,p.times),r=p.condition.reading;
  const unit=from(DEPTH_UNITS[r.unit]),depth=mul(from(r.depth),unit),uncertainty=mul(from(r.uncertainty),unit),rawLower=sub(depth,uncertainty);
  const condition={conditionRef:'rainfall-condition:'+r.id,reading:r,lower:cmp(rawLower,Q.zero)>0n?rawLower:Q.zero,upper:add(depth,uncertainty)};
  need(graph.times.length===p.work.queryVertices&&graph.edges.length+2===p.work.queryEdges,'Prepared conditional graph differs from reservation.');
  const calibration=rainfallHistoryConsistency(p.project,p.gauge),originalInconsistent=calibration.status==='interval-totals-inconsistent';
  if(!originalInconsistent){
    const a=graph.at.get(r.startMinute),b=graph.at.get(r.endMinute);
    graph.edges.push({id:'condition-upper:'+r.id,kind:'condition-upper',from:a,to:b,weight:condition.upper,recordIndex:null,recordRef:null,conditionRef:condition.conditionRef});
    graph.edges.push({id:'condition-lower:'+r.id,kind:'condition-lower',from:b,to:a,weight:sub(Q.zero,condition.lower),recordIndex:null,recordRef:null,conditionRef:condition.conditionRef});
  }
  const feasibility=solveRainfallFeasibility(graph);
  need(feasibility.relaxations<=p.work.reservedFeasibilityRelaxations,'Conditional feasibility relaxation reservation exceeded.');
  let status,negativeCycle=null,bounds=null,lowerRelaxations=0,upperRelaxations=0;
  if(feasibility.changed>=0){
    const cycle=verifyRainfallCycle(graph,feasibility,p.gauge.readings),conditionRefs=[...new Set(cycle.edges.filter(e=>e.conditionRef!==undefined).map(e=>e.conditionRef))];
    need(originalInconsistent?conditionRefs.length===0:conditionRefs.length===1&&conditionRefs[0]===condition.conditionRef,'Contradiction certificate has incorrect condition provenance.');
    negativeCycle={...cycle,conditionRefs};
    status=originalInconsistent?'original-calibration-inconsistent':'condition-inconsistent';
  }else{
    need(!originalInconsistent,'Original-only graph disagrees with calibration contradiction.');
    const projected=projectInterval(graph,feasibility,p.query,p.work,condition);
    ({bounds,lowerRelaxations,upperRelaxations}=projected);
    status=projected.status==='bounded-interval'?'conditionally-bounded-interval':'conditionally-upper-unbounded';
  }
  return {schema:'experimental-earth-conditional-rainfall-interval/1',originalProposal:p.originalProposal,query:p.query,condition:p.condition,
    scope:{interpreted:['source.project','source.gauge','query','condition'],includedRoles:['calibration'],excluded:p.excluded,conditionRole:'counterfactual',numericContract:'exact-represented-nominal-bands',physicalInference:false},work:p.work,calibration,
    assessment:{status,records:encodeRainfallRecords(graph.records),conditionRecord:{conditionRef:condition.conditionRef,reading:r,lowerMm:encode(condition.lower),upperMm:encode(condition.upper)},conditionApplied:!originalInconsistent,vertices:graph.times.length,edgeCount:graph.edges.length,relaxations:{feasibility:feasibility.relaxations,lower:lowerRelaxations,upper:upperRelaxations},negativeCycle,bounds},
    meaning:'Counterfactual conditional possibilities under unchanged original calibration and one separately declared hypothetical reading. The condition is not observed rain, a promoted measurement role or a posterior probability. Original calibration remains separately reported; an incompatible hypothesis is not an original calibration contradiction or sensor diagnosis. Challenge and unassigned readings remain excluded. Nominal bands use exact represented values, not decimal-intent values or model tolerances. Event/site/time declarations are unverified. Histories, paths and directions are mathematical certificates, not inferred physical forcing or restored finite-family survivors; no soil, depth or proposal conclusion follows. Other original context remains unqualified. Abstract work excludes parsing, general validation, serialization and bit-operation costs and is not a CPU, heap or wall-time guarantee.'};
}

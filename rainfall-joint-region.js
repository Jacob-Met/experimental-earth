import {validateRainGauge} from './rain-gauge-evidence.js';
import {rainfallHistoryConsistency} from './rain-gauge-history.js';
import {MECHANISM_PROPOSAL_SCHEMA} from './rain-mechanism-proposal.js';
import {shortestRainfallPaths,rainfallPathCertificate} from './rainfall-interval.js';
import {Q,need,add,sub,mul,cmp,from,encode,buildRainfallGraph,solveRainfallFeasibility,verifyRainfallHistory,verifyRainfallCycle,encodeRainfallRecords} from './rainfall-constraint-core.js';
const LIMITS=Object.freeze({originalBytes:4194304,queryBytes:4096,totalWork:350000,persistentBits:8192,intermediateBits:16384,vertices:6,rays:2});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function parse(text,limit,label){
 need(typeof text==='string'&&text.length>0&&!text.startsWith('\uFEFF'),label+' requires nonempty exact UTF-8 without BOM.');
 const bytes=new TextEncoder().encode(text);
 need(bytes.length<=limit&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===text,label+' exceeds byte limit or contains a lone surrogate.');
 const value=JSON.parse(text),pending=[value];
 while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),label+' contains a non-finite number.');else if(v!==null&&typeof v==='object')for(const child of Object.values(v))pending.push(child);}
 return value;
}
function prepare(originalText,queryText){
 const originalProposal=parse(originalText,LIMITS.originalBytes,'Original proposal');
 need(exact(originalProposal,['schema','source','fronts','goal'])&&originalProposal.schema===MECHANISM_PROPOSAL_SCHEMA&&exact(originalProposal.source,['project','request','gauge','durations','capacities','layers']),'Open original mechanism/proposal inputs, not computed results.');
 const {project,gauge}=originalProposal.source;validateRainGauge(project,gauge);
 const query=parse(queryText,LIMITS.queryBytes,'Joint region query'),text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=600;
 need(exact(query,['schema','eventRef','startMinute','splitMinute','endMinute','source'])&&query.schema==='experimental-earth-rainfall-joint-region-query/1','Supply one original adjacent-interval query.');
 need(text(query.eventRef)&&text(query.source)&&query.eventRef===gauge.eventRef,'Query requires the exact original event reference and a source declaration.');
 const {startMinute:a,splitMinute:b,endMinute:c}=query;
 need([a,b,c].every(Number.isFinite)&&a>=0&&a<b&&b<c&&c<=project.weather.durationMinutes,'Query requires ordered adjacent intervals inside the original horizon.');
 const entries=gauge.readings.map((reading,index)=>({index,ref:'rain-gauge:'+reading.id,reading})),included=entries.filter(e=>e.reading.use==='calibration');
 const calibrationTimes=new Set(included.flatMap(e=>[e.reading.startMinute,e.reading.endMinute])),times=new Set([...calibrationTimes,0,project.weather.durationMinutes,a,b,c]);
 const C=included.length,Vc=calibrationTimes.size,Ec=Vc?Vc-1+2*C:0,V=times.size,E=V-1+2*C;
 const reservedCalibrationRelaxations=Vc*Ec,reservedFeasibilityRelaxations=V*E,reservedShortestPathRelaxations=3*(V-1)*E,mappingWork=2*C*Vc,sortingWork=Vc*Vc+V*V+C*C,certificateWork=128*E+256*V+64*C+4096;
 const totalWork=reservedCalibrationRelaxations+reservedFeasibilityRelaxations+reservedShortestPathRelaxations+mappingWork+sortingWork+certificateWork;
 const work={originalReadingCount:entries.length,calibrationRecordCount:C,calibrationVertices:Vc,calibrationEdges:Ec,queryVertices:V,queryEdges:E,reservedCalibrationRelaxations,reservedFeasibilityRelaxations,reservedShortestPathRelaxations,mappingWork,sortingWork,certificateWork,totalWork,limits:{...LIMITS}};
 need(Object.entries(work).filter(([k])=>k!=='limits').every(([,v])=>Number.isSafeInteger(v)&&v>=0)&&totalWork<=LIMITS.totalWork,'Complete joint-region work exceeds its reservation limit.');
 return {originalProposal,project,gauge,query,included,times,work,excluded:entries.filter(e=>e.reading.use!=='calibration').map(e=>({...e,reason:e.reading.use}))};
}
export function estimateRainfallJointRegionWork(originalText,queryText){return prepare(originalText,queryText).work;}
const signed=(coefficient,value)=>coefficient===0?Q.zero:coefficient===1?value:sub(Q.zero,value);
const evaluate=(coefficients,point)=>add(signed(coefficients[0],point[0]),signed(coefficients[1],point[1]));
function geometry(constraints){
 const finite=constraints.filter(c=>c.rhs!==null),vertices=[];
 for(let i=0;i<finite.length;i++)for(let j=i+1;j<finite.length;j++){
  const u=finite[i],v=finite[j],[a,b]=u.coefficients,[c,d]=v.coefficients,det=a*d-b*c;
  if(det===0)continue;need(det===1||det===-1,'Unexpected joint-region determinant.');
  const point=[signed(det,sub(signed(d,u.rhs),signed(b,v.rhs))),signed(det,sub(signed(a,v.rhs),signed(c,u.rhs)))];
  if(!finite.every(f=>cmp(evaluate(f.coefficients,point),f.rhs)<=0n))continue;
  if(!vertices.some(p=>cmp(p[0],point[0])===0n&&cmp(p[1],point[1])===0n))vertices.push(point);
 }
 // Six facets bound at most six vertices; assert before constructing histories.
 need(vertices.length>=1&&vertices.length<=LIMITS.vertices,'Joint region vertex invariant failed; no partial region is returned.');
 vertices.sort((u,v)=>{const x=cmp(u[0],v[0]);if(x!==0n)return x<0n?-1:1;const y=cmp(u[1],v[1]);return y<0n?-1:y>0n?1:0;});
 const rays=[[from(1),Q.zero],[Q.zero,from(1)]].filter(p=>finite.every(f=>cmp(evaluate(f.coefficients,p),Q.zero)<=0n));
 const origin=vertices[0],vectors=vertices.slice(1).map(p=>[sub(p[0],origin[0]),sub(p[1],origin[1])]).concat(rays);
 let basis=null,dimension=0;
 for(const v of vectors){if(cmp(v[0],Q.zero)===0n&&cmp(v[1],Q.zero)===0n)continue;if(basis===null){basis=v;dimension=1;}else if(cmp(sub(mul(basis[0],v[1]),mul(basis[1],v[0])),Q.zero)!==0n){dimension=2;break;}}
 const classification=dimension===0?'point':dimension===1?(rays.length?'ray':'segment'):(rays.length?'unbounded-region':'bounded-region');
 return {vertices,rays,dimension,classification};
}
// Each vertex examines exactly three labels, never all graph edges.
function extendHistory(graph,potential,paths,anchors,point,homogeneous=false){
 const marked=[Q.zero,point[0],add(point[0],point[1])],offset=graph.times.map(()=>null),reachableVertexUnion=[];
 let maximum=null;
 for(let v=0;v<graph.times.length;v++){
  for(let j=0;j<3;j++)if(paths[j].distance[v]!==null){
   const candidate=sub(add(marked[j],homogeneous?Q.zero:paths[j].distance[v]),potential[v]);
   if(offset[v]===null||cmp(candidate,offset[v])<0n)offset[v]=candidate;
  }
  if(offset[v]!==null){reachableVertexUnion.push(v);if(maximum===null||cmp(offset[v],maximum)>0n)maximum=offset[v];}
 }
 need(maximum!==null,'Marked reachability union is empty.');
 const h=potential.map((p,v)=>add(p,offset[v]===null?maximum:offset[v]));
 for(let j=0;j<3;j++)need(cmp(h[anchors[j]],marked[j])===0n,'Three-anchor extension does not preserve a marked potential.');
 const verified=verifyRainfallHistory(graph,h),[a,b,c]=anchors;
 need(cmp(sub(verified.cumulative[b],verified.cumulative[a]),point[0])===0n&&cmp(sub(verified.cumulative[c],verified.cumulative[b]),point[1])===0n,'History does not attain both requested totals.');
 return {...verified,reachableVertexUnion};
}
export function inspectRainfallJointRegion(originalText,queryText){
 const p=prepare(originalText,queryText),graph=buildRainfallGraph(p.included,p.times),{times,edges,records,at}=graph;
 need(times.length===p.work.queryVertices&&edges.length===p.work.queryEdges,'Prepared joint graph differs from reservation.');
 const markedVertices={start:at.get(p.query.startMinute),split:at.get(p.query.splitMinute),end:at.get(p.query.endMinute)},anchors=Object.values(markedVertices);
 const calibration=rainfallHistoryConsistency(p.project,p.gauge),feasibility=solveRainfallFeasibility(graph);
 need(feasibility.relaxations<=p.work.reservedFeasibilityRelaxations,'Joint feasibility reservation exceeded.');
 const inconsistent=feasibility.changed>=0;
 need(inconsistent===(calibration.status==='interval-totals-inconsistent'),'Original calibration and joint graph disagree.');
 let negativeCycle=null,region=null;
 const shortest={start:0,split:0,end:0};
 if(inconsistent)negativeCycle=verifyRainfallCycle(graph,feasibility,p.gauge.readings);
 else{
  const paths=anchors.map(a=>shortestRainfallPaths(graph,a));
  [shortest.start,shortest.split,shortest.end]=paths.map(p=>p.relaxations);
  need(Object.values(shortest).reduce((a,b)=>a+b,0)<=p.work.reservedShortestPathRelaxations,'Joint shortest-path reservation exceeded.');
  const specs=[['early-lower',[-1,0],1,0],['early-upper',[1,0],0,1],['late-lower',[0,-1],2,1],['late-upper',[0,1],1,2],['whole-lower',[-1,-1],2,0],['whole-upper',[1,1],0,2]];
  const constraints=specs.map(([id,coefficients,s,t])=>({id,coefficients,from:anchors[s],to:anchors[t],rhs:paths[s].distance[anchors[t]],source:s}));
  for(const i of [0,2,4])need(constraints[i].rhs!==null,'A reverse monotonic bound is missing.');
  const inequalities=constraints.map(c=>({id:c.id,coefficients:c.coefficients,from:c.from,to:c.to,status:c.rhs===null?'unbounded':'finite',rhsMm:c.rhs===null?null:encode(c.rhs),path:c.rhs===null?null:rainfallPathCertificate(graph,c.from,c.to,paths[c.source].distance)}));
  const shape=geometry(constraints);
  const vertices=shape.vertices.map(point=>{const h=extendHistory(graph,feasibility.distance,paths,anchors,point);return {xMm:encode(point[0]),yMm:encode(point[1]),history:h.history,intervalChecks:h.intervalChecks};});
  let rays=[];
  if(shape.rays.length){
   const zeroGraph={...graph,edges:edges.map(e=>({...e,weight:Q.zero})),records:records.map(r=>({...r,lower:Q.zero,upper:Q.zero}))},zeroPotential=times.map(()=>Q.zero);
   rays=shape.rays.map(point=>{
    const h=extendHistory(zeroGraph,zeroPotential,paths,anchors,point,true);
    const calibrationIncrements=records.map(r=>{const increment=sub(h.cumulative[at.get(r.reading.endMinute)],h.cumulative[at.get(r.reading.startMinute)]);need(cmp(increment,Q.zero)===0n,'A ray changes original calibration.');return {index:r.index,ref:r.ref,incrementMm:encode(increment)};});
    return {xIncrementMm:encode(point[0]),yIncrementMm:encode(point[1]),history:h.history,calibrationIncrements,reachableVertexUnion:h.reachableVertexUnion};
   });
  }
  region={coordinates:{x:'start-to-split',y:'split-to-end'},inequalities,dimension:shape.dimension,classification:shape.classification,vertices,rays};
 }
 return {schema:'experimental-earth-rainfall-joint-region/1',originalProposal:p.originalProposal,query:p.query,
  scope:{interpreted:['source.project','source.gauge','query'],includedRoles:['calibration'],excluded:p.excluded,numericContract:'exact-represented-nominal-bands',physicalInference:false},work:p.work,calibration,
  assessment:{status:inconsistent?'original-calibration-inconsistent':'joint-region-feasible',records:encodeRainfallRecords(records),vertices:times.length,edgeCount:edges.length,markedVertices,relaxations:{feasibility:feasibility.relaxations,shortest},negativeCycle,region},
  meaning:'Exact joint mathematical possibilities for two adjacent interval totals under original calibration only. Challenge and unassigned readings remain excluded. Six original path inequalities and verified histories/directions certify the region; vertices are lexicographic, not polygon boundary order. Nominal represented values are exact, not decimal-intent or epsilon-expanded bands. These are not actual or unique rainfall, probability, physical forcing, an intensity ceiling, a storm cutoff, acquired measurements or soil/depth/intervention conclusions. No rejected finite family is restored; event/site/time declarations remain unverified and other original context unqualified. Abstract work reservations exclude parsing, general validation, serialization and bit-operation costs; they are not CPU, heap or wall-time guarantees.'};
}

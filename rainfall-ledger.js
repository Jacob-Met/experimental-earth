import {validateRainGauge} from './rain-gauge-evidence.js';
import {rainfallHistoryConsistency} from './rain-gauge-history.js';
import {MECHANISM_PROPOSAL_SCHEMA} from './rain-mechanism-proposal.js';
import {need,buildRainfallGraph,solveRainfallFeasibility,verifyRainfallHistory,verifyRainfallCycle,encode} from './rainfall-constraint-core.js';

const LIMITS=Object.freeze({originalBytes:4*1024*1024,totalWork:150000,persistentBits:8192,intermediateBits:16384});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

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
  const p=prepare(originalText),graph=buildRainfallGraph(p.included,p.jointTimes),{times,records,edges}=graph;
  need(edges.length===p.work.jointEdges,'Reserved graph disagrees with prepared graph.');
  // Unchanged calibration-only authority receives untouched original objects.
  const calibration=rainfallHistoryConsistency(p.project,p.gauge);
  const solution=solveRainfallFeasibility(graph),{changed,relaxations}=solution;
  need(relaxations<=p.work.reservedJointRelaxations,'Joint relaxation reservation exceeded.');
  let history=null,intervalChecks=[],negativeCycle=null;
  if(changed<0){({history,intervalChecks}=verifyRainfallHistory(graph,solution.distance));}
  else negativeCycle=verifyRainfallCycle(graph,solution,p.gauge.readings);
  return {
    schema:'experimental-earth-rainfall-ledger/1',originalProposal:p.originalProposal,
    scope:{interpreted:['source.project','source.gauge'],includedRoles:['calibration','challenge'],excludedUnassigned:p.excludedUnassigned,numericContract:'exact-represented-nominal-bands',physicalInference:false},
    work:p.work,calibration,
    joint:{status:changed<0?'nonnegative-history-compatible':'interval-totals-inconsistent',records:records.map(r=>({index:r.index,ref:r.ref,reading:r.reading,lowerMm:encode(r.lower),upperMm:encode(r.upper)})),vertices:times.length,edgeCount:edges.length,relaxations,history,intervalChecks,negativeCycle},
    meaning:'Only source.project and source.gauge are interpreted; other original proposal context is retained without qualification. Calibration remains the unchanged calibration-only authority. The joint assessment uses exact represented nominal bands, not decimal-intent values or model score tolerances. A compatible history is one mathematical witness, not inferred or unique physical rainfall; no intensity bound or storm cutoff is imposed. It does not restore rejected constant-forcing candidates, verify event/site/clock association, or determine soil, depth or proposal consequences. Inconsistency is not a sensor diagnosis, and its cycle is not claimed minimum or irreducible. Work reservations exclude parsing, general validation and serialization and are not CPU, memory or wall-time guarantees.'
  };
}

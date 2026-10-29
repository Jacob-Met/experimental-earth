import {validateProject,runRain,SURFACES} from './core.js';
import {validateDrainingHypotheses,hypothesisLayer,makeDrainingEvidenceExample} from './draining-layer-evidence.js';
import {evaluateReadings} from './infiltration-study.js';
import {chooseDrainingQuestion} from './draining-question.js';
import {inferReceivingProposal} from './receiving-proposal.js';

export const RECEIVING_ACCOUNT_SCHEMA='experimental-earth-receiving-account/1';
export const RECEIVING_ACCOUNT_CELL_STEP_LIMIT=1000000;
const channels={retained:'retainedLiters',drained:'drainedLiters'};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const basis=v=>typeof v==='string'&&!!v.trim()&&v.length<=600;
const clone=v=>structuredClone(v);
const dense=a=>Array.isArray(a)&&a.length<=128&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean)&&Object.keys(a).length===a.length;
// Same relative floating comparison convention as the maintained water
// evaluator; this is not measurement uncertainty or a certified solver bound.
const guard=(...values)=>1e-9*Math.max(1,...values.map(Math.abs));

export function validateReceivingAccountOriginals(project,account){
  if(!exact(account,['footprintBasis','readings','offers'])||!basis(account.footprintBasis)||!dense(account.readings)||!dense(account.offers))throw Error('Retain the receiver-footprint association and at most 128 original readings and 128 offered measurements.');
  for(const [name,rows]of [['reading',account.readings],['offer',account.offers]]){
    const ids=new Set();
    for(const row of rows){
      const keys=name==='reading'?['id','channel','minute','valueLiters','uncertaintyLiters','use','source']:['id','channel','minute','uncertaintyLiters','basis'];
      if(!exact(row,keys)||typeof row.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(row.id)||ids.has(row.id)||!Object.hasOwn(channels,row.channel)||!finite(row.minute,0,project.weather.durationMinutes)||!finite(row.uncertaintyLiters,0,1e12))throw Error('Each '+name+' needs a distinct ID, receiving-account channel, event minute and nonnegative litre half-width.');
      ids.add(row.id);
      if(name==='reading'&&(!finite(row.valueLiters,0,1e12)||!['calibration','challenge'].includes(row.use)||!basis(row.source)))throw Error('An original receiving reading needs a nonnegative litre value, calibration/challenge role and source.');
      if(name==='offer'&&!basis(row.basis))throw Error('Explain the availability and basis of every offered measurement.');
    }
  }
}

function admit(project,study,account){
  validateProject(project);validateDrainingHypotheses(study);
  validateReceivingAccountOriginals(project,account);
  const cellSteps=project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)*study.hypotheses.length;
  if(cellSteps>RECEIVING_ACCOUNT_CELL_STEP_LIMIT)throw Error('The complete original receiving family exceeds one million cell-steps; no partial comparison was computed.');
  return cellSteps;
}

export function evaluateReceivingAccountRows(run,rows){
  const snapshots=new Map(run.drainingLayer.snapshots.map(row=>[row.minute,row]));
  return rows.map(row=>{
    const snapshot=snapshots.get(row.minute);
    if(!snapshot)throw Error('Receiving-account minutes must be exact retained solver endpoints; no inventory or drainage interpolation is invented.');
    const modeledLiters=snapshot[channels[row.channel]],numericalGuardLiters=guard(modeledLiters,row.valueLiters??0,row.uncertaintyLiters);
    if(!finite(modeledLiters,0,1e12))throw Error('The complete receiving account produced an unsupported amount.');
    return {...clone(row),modeledLiters,numericalGuardLiters,...(Object.hasOwn(row,'valueLiters')?{residualLiters:row.valueLiters-modeledLiters,withinBand:Math.abs(row.valueLiters-modeledLiters)<=row.uncertaintyLiters+numericalGuardLiters}:{})};
  });
}
export function receivingAccountVerdict(surface,rows){
  const count=surface.count+rows.length;
  return {count,compatible:count?(surface.compatible!==false&&rows.every(r=>r.withinBand)):null};
}

export const RECEIVING_ACCOUNT_QUESTION_PAIR_LIMIT=100000;
export function chooseReceivingAccountQuestion(account,courses){
  const supported=courses.filter(c=>c.row.calibration.compatible===true);
  const requiredPairComparisons=account.offers.length*supported.length*(supported.length-1)/2;
  if(requiredPairComparisons>RECEIVING_ACCOUNT_QUESTION_PAIR_LIMIT)return {status:'unsupported',offers:[],best:null,supportIds:supported.map(c=>c.row.hypothesis.id),requiredPairComparisons,pairLimit:RECEIVING_ACCOUNT_QUESTION_PAIR_LIMIT,reason:'The complete offered receiving-question family exceeds 100,000 pair comparisons; no partial ranking was computed.'};
  const recorded=new Set(account.readings.map(r=>r.channel+':'+r.minute));
  const offers=account.offers.map((offer,index)=>{
    const predictions=supported.map(c=>({id:c.row.hypothesis.id,modeledLiters:c.offers[index].modeledLiters,numericalGuardLiters:c.offers[index].numericalGuardLiters}));
    const pairs=[];
    for(let a=0;a<predictions.length;a++)for(let b=a+1;b<predictions.length;b++){
      const first=predictions[a],second=predictions[b],gapLiters=Math.abs(first.modeledLiters-second.modeledLiters),numericalGuardLiters=first.numericalGuardLiters+second.numericalGuardLiters;
      pairs.push({ids:[first.id,second.id],gapLiters,numericalGuardLiters,separated:gapLiters>2*offer.uncertaintyLiters+numericalGuardLiters});
    }
    return {...clone(offer),status:recorded.has(offer.channel+':'+offer.minute)?'already-recorded':'offered',predictions,pairs,separatedCount:pairs.filter(p=>p.separated).length};
  });
  let best=null;for(const offer of offers)if(offer.status==='offered'&&offer.separatedCount>(best?.separatedCount??0))best=offer;
  const questionStatus=supported.length<2?'no-supported-pair':!offers.length?'no-offers':offers.every(o=>o.status==='already-recorded')?'all-recorded':best?'question':'no-separating-offer';
  return {status:questionStatus,offers,best,supportIds:supported.map(c=>c.row.hypothesis.id)};
}

/** Source-bound total receiver inventories, distinct from surface outlet flow.
 * Every listed selected-surface cell contributes; point probes are not totals.
 * Held-aside values only challenge, never select parameters or future offers.
 */
export function inspectReceivingAccounts(project,study,account){
  const cellSteps=admit(project,study,account);
  const affectedCells=project[study.target].flatMap((cell,i)=>cell.surface===study.surface?[i]:[]);
  const areaM2=affectedCells.length*project.weather.cellSizeM**2;
  const context={project:clone(project),study:clone(study),account:clone(account),cellSteps,footprint:{scenario:study.target,surface:study.surface,cellIndices:affectedCells,areaM2,basis:account.footprintBasis},candidates:[]};
  if(!affectedCells.length)return {...context,status:'surface-absent',compatibleIds:[],survivingIds:[],question:{status:'no-supported-pair',offers:[]}};
  const original=project.observations.map((reading,index)=>({reading,index})).filter(r=>r.reading.scenario===study.target);
  const calibration=original.filter(r=>r.reading.use==='calibration'),challenge=original.filter(r=>r.reading.use==='challenge');
  const courses=study.hypotheses.map(hypothesis=>{
    const result=runRain(project[study.target],project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,hypothesis)});
    const surfaceCalibration=evaluateReadings(result,calibration),surfaceChallenge=evaluateReadings(result,challenge),rows=evaluateReceivingAccountRows(result,account.readings);
    const accountCalibration=rows.filter(r=>r.use==='calibration'),accountChallenge=rows.filter(r=>r.use==='challenge');
    const row={hypothesis:clone(hypothesis),surfaceCalibration,surfaceChallenge,accountReadings:rows,
      calibration:receivingAccountVerdict(surfaceCalibration,accountCalibration),challenge:receivingAccountVerdict(surfaceChallenge,accountChallenge)};
    return {result,row,offers:evaluateReceivingAccountRows(result,account.offers)};
  });
  const supported=courses.filter(c=>c.row.calibration.compatible===true),survivors=supported.filter(c=>c.row.challenge.compatible===true);
  const question=chooseReceivingAccountQuestion(account,courses);
  const hasCalibration=calibration.length+account.readings.filter(r=>r.use==='calibration').length>0;
  const hasChallenge=challenge.length+account.readings.filter(r=>r.use==='challenge').length>0;
  const status=!hasCalibration?'need-calibration':!supported.length?'calibration-rejected':!hasChallenge?'needs-challenge':!survivors.length?'challenged':survivors.length===1?'one-survivor':'ambiguous';
  const halfWidthMm=Math.max(0,...calibration.map(({reading})=>reading.uncertaintyMm));
  const surfaceOnlyQuestion=chooseDrainingQuestion(supported.map(c=>({id:c.row.hypothesis.id,result:c.result})),halfWidthMm,original.map(r=>r.reading));
  return {...context,status,candidates:courses.map(c=>c.row),compatibleIds:supported.map(c=>c.row.hypothesis.id),survivingIds:survivors.map(c=>c.row.hypothesis.id),
    surfaceOnlyQuestion,question,
    meaning:'Total water retained below all listed selected-surface cells, or cumulative water drained from those receivers since original event start, in litres. Surface boundary outflow and a point soil probe are different quantities. Exact retained solver endpoints only. Prospective offers contain no observed value. Maximize separated calibration-compatible pairs; ties keep original offer order. Held-aside values never choose the offer. Availability, association and measurement uncertainty are explicit declarations; no acquisition, unique physical identification, automatic adoption or certified error enclosure is claimed.'};
}

export function serializeReceivingAccounts(project,study,account){
  admit(project,study,account);const text=JSON.stringify({schema:RECEIVING_ACCOUNT_SCHEMA,project,study,account},null,2);
  if(new TextEncoder().encode(text).length>2*1024*1024)throw Error('Original receiving-account inputs exceed 2 MiB.');return text;
}
export function parseReceivingAccounts(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>2*1024*1024)throw Error('Choose original receiving-account JSON under 2 MiB.');
  const input=JSON.parse(text);if(!exact(input,['schema','project','study','account'])||input.schema!==RECEIVING_ACCOUNT_SCHEMA)throw Error('Retain only original receiving-account inputs; saved conclusions are not accepted.');
  admit(input.project,input.study,input.account);return input;
}

export function makeReceivingAccountExample(){
  const {project,study}=makeDrainingEvidenceExample();project.title='Authored receiver inventories distinguish equal surface courses';project.weather.stepMinutes=5;
  const first={id:'initial-water',label:'Authored 3 mm initial water',capacityMm:7.3,initialStoredMm:3,drainagePerHour:.63,source:'Authored physical-model control, not field evidence'};
  const run=runRain(project.proposal,project.width,project.height,project.weather,{drainingLayer:hypothesisLayer(study,first)});
  project.observations=[60,180,240].map((minute,index)=>({cellIndex:0,minute,depthMm:run.snapshots.find(s=>s.minute===minute).depthsMm[0],uncertaintyMm:.00001,scenario:'proposal',use:index===2?'challenge':'calibration',source:'Authored maintained-forward-model surface control; not a measured depth'}));
  const inverse=inferReceivingProposal({rainMmHr:project.weather.rainMmHr,infiltrationMmHr:SURFACES.garden.infiltrationMmHr,stormMinutes:60,laterMinute:180,stormEndDepthMm:project.observations[0].depthMm,laterDepthMm:project.observations[1].depthMm});
  if(inverse.status!=='proposal')throw Error('Authored empty-receiver counterexample did not resolve.');
  study.hypotheses=[first,{id:'empty-fit',label:'Empty receiver with the same surface course',capacityMm:inverse.capacityMm,initialStoredMm:0,drainagePerHour:inverse.drainagePerHour,source:'Authored alternate central inverse; equal surface depths do not identify initial water'}];
  const account={footprintBasis:'Authored whole-receiver account across the four selected garden cells (4 square metres). This is not a point-probe or surface-boundary collection.',readings:[],offers:['retained','drained'].map(channel=>({id:channel+'-180',channel,minute:180,uncertaintyLiters:.1,basis:'Hypothetical whole-receiver measurement offered at original minute 180; no actual sensor or acquisition is asserted'}))};
  return {project,study,account};
}

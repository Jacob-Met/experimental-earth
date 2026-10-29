import {runRain,SURFACES} from './core.js';
import {advanceDrainingLayer} from './draining-infiltration.js';
import {hypothesisLayer} from './draining-layer-evidence.js';
import {evaluateReadings} from './infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict,chooseReceivingAccountQuestion} from './receiving-account-evidence.js';
import {inferPostDryDrainedReceivers} from './post-dry-receiving-inverse.js';
import {proposeReceivingAccountLayers,reserveReceivingAccountProposalWork,serializeReceivingAccountProposals,parseReceivingAccountProposals,RECEIVING_ACCOUNT_PROPOSAL_SCHEMA,RECEIVING_ACCOUNT_PROPOSAL_TRIAL_LIMIT,makePostDryDrainageAccountProposalExample} from './receiving-account-proposals.js';
import {fitLinearColumns} from './vendor/worldlaw-linear-fit.mjs';

export const RECEIVING_ACCOUNT_BAND_SCHEMA='experimental-earth-receiving-account-band-search/1';
export const RECEIVING_ACCOUNT_BAND_SEEDS=3;
export const RECEIVING_ACCOUNT_BAND_ITERATIONS=30;
export const RECEIVING_ACCOUNT_BAND_STEP_LIMIT=1000000;
const evaluationsPerSeed=1+7*RECEIVING_ACCOUNT_BAND_ITERATIONS;
// A failed drainage-curve start may spend both bracket endpoints for all three
// fractions before a retained-band start uses the same three-search allowance.
const seedKernelLimit=RECEIVING_ACCOUNT_BAND_SEEDS*(2+56)+2*RECEIVING_ACCOUNT_BAND_SEEDS;
const retainedRatePairLimit=Math.floor(RECEIVING_ACCOUNT_PROPOSAL_TRIAL_LIMIT/6);
const bounds=[[Math.log(1e-10),Math.log(10000)],[0,1],[Math.log(1e-10),Math.log(100)]];
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const clone=value=>structuredClone(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const vector=h=>[Math.log(h.capacityMm),h.initialStoredMm/h.capacityMm,Math.log(h.drainagePerHour)];
function parameters(x){
  if(x.length!==3||x.some((value,i)=>!finite(value)||value<bounds[i][0]||value>bounds[i][1]))throw Error('Band-search trial is outside its declared parameter domain.');
  // The end-point min corrects exp(log(max)) rounding only. Each bounded trial
  // is then evaluated; this does not repair or accept a refused analytic root.
  const capacityMm=Math.min(10000,Math.exp(x[0]));
  return {capacityMm,initialStoredMm:capacityMm*x[1],drainagePerHour:Math.min(100,Math.exp(x[2])),source:'Conditional numerical witness sought from original calibration bands; not an identified physical material'};
}

/** Reserve the central incumbent, every permitted numerical start/trial and
 * full original-grid verification before any inverse or forward calculation. */
export function reserveReceivingAccountBandWork(project,selection,account){
  const central=reserveReceivingAccountProposalWork(project,selection,account);
  const steps=Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  const fullGridCellSteps=project.width*project.height*steps;
  const reducedTrials=RECEIVING_ACCOUNT_BAND_SEEDS*evaluationsPerSeed;
  const originalGridTrials=central.trialCount+1+RECEIVING_ACCOUNT_BAND_SEEDS;
  const reducedCellSteps=reducedTrials*4*steps;
  const totalCellEquivalentSteps=originalGridTrials*fullGridCellSteps+reducedCellSteps+seedKernelLimit;
  if(totalCellEquivalentSteps>RECEIVING_ACCOUNT_BAND_STEP_LIMIT)
    throw Error('The complete original-band search, unchanged central family and full-grid checks exceed one million cell-equivalent steps; no partial search was computed.');
  return {centralTrials:central.trialCount,originalGridTrials,reducedTrials,seedKernelCalls:seedKernelLimit,
    maximumDrainageRateBisections:128,maximumRetainedRatePairs:retainedRatePairLimit,stepsPerCourse:steps,fullGridCellSteps,reducedCellSteps,totalCellEquivalentSteps,limit:RECEIVING_ACCOUNT_BAND_STEP_LIMIT};
}

function residuals(surface,rows,calibration){
  const raw=[...surface.errors.map((error,i)=>-error.residualMm/Math.max(calibration[i].reading.uncertaintyMm,1e-9*Math.max(1,calibration[i].reading.depthMm))),
    ...rows.map(row=>-row.residualLiters/Math.max(row.uncertaintyLiters,row.numericalGuardLiters))];
  if(!raw.every(finite))throw Error('Nonfinite original-band residual; no numerical witness was accepted.');
  const residual=raw.map(value=>value-clamp(value,-.98,.98));
  const score=residual.reduce((sum,value)=>sum+value*value,0);
  if(!finite(score))throw Error('Nonfinite band-search objective.');
  return {raw,residual,score};
}

function scaledReceivingRun(run,scale){
  return {drainingLayer:{snapshots:run.drainingLayer.snapshots.map(row=>({...row,
    retainedLiters:row.retainedLiters*scale,drainedLiters:row.drainedLiters*scale,infiltratedLiters:row.infiltratedLiters*scale}))}};
}

/** A finite local search for witnesses inside the original calibration bands.
 * The central producer remains an unchanged incumbent. Parameter fitting never
 * reads held values. Every returned candidate is independently forwarded on the
 * full original grid before either calibration or challenge is reported. */
export function fitReceivingAccountBands(project,selection,account){
  const reservation=reserveReceivingAccountBandWork(project,selection,account);
  const baseline=proposeReceivingAccountLayers(project,selection,account);
  const source=clone({project,selection,account});
  const w=project.weather,target=selection.target,material=selection.surface;
  const originals=project.observations.map((reading,index)=>({reading,index})).filter(row=>row.reading.scenario===target);
  const calibration=originals.filter(row=>row.reading.use==='calibration');
  const receiverCalibration=account.readings.map((reading,index)=>({reading,index})).filter(row=>row.reading.use==='calibration');
  const calibrationRows=receiverCalibration.map(row=>row.reading);
  const selectedCalibration=calibration.filter(row=>project[target][row.reading.cellIndex].surface===material);
  const fixedCalibration=calibration.filter(row=>project[target][row.reading.cellIndex].surface!==material);
  const counts={reducedTrials:0,originalGridChecks:0,seedKernelCalls:0,seedInverseCalls:0,seedRetainedRatePairs:0};
  const searches=[],frozen=[],refusals=[];
  const context={...source,baseline,reservation,counts,candidates:[],searches,refusals,compatibleIds:[],survivingIds:[],question:{status:'no-supported-pair',offers:[],best:null,supportIds:[]}};
  if(!baseline.footprint.cellIndices.length)return {...context,status:'surface-absent'};
  if(!calibration.length||!calibrationRows.length)return {...context,status:'need-calibration-account'};

  // The admitted model has uniform rain, zero lateral movement/outflow, and a
  // uniform selected receiver. Four identical cells therefore supply the same
  // selected-cell course without running the entire site for every derivative.
  // Other surfaces are parameter-independent and come from one actual full run.
  // This optimization is conditional on admission above, never a new solver.
  let fixedErrors=[];
  if(fixedCalibration.length){
    counts.originalGridChecks++;
    const reference=runRain(project[target],project.width,project.height,w,{drainingLayer:hypothesisLayer(selection,{capacityMm:1,initialStoredMm:0,drainagePerHour:1,source:'Computational reference for parameter-independent unselected cells'})});
    fixedErrors=evaluateReadings(reference,fixedCalibration).errors;
  }
  const reducedCells=Array.from({length:4},()=>({elevationM:0,surface:material,provenance:'Computational uniform receiver reduction; original source remains unchanged'}));
  const reducedReadings=selectedCalibration.map(row=>({index:row.index,reading:{...row.reading,cellIndex:0}}));
  function evaluate(x){
    if(++counts.reducedTrials>reservation.reducedTrials)throw Error('Complete reserved reduced-trial budget was exceeded.');
    const h=parameters(x),run=runRain(reducedCells,2,2,w,{drainingLayer:hypothesisLayer(selection,h)});
    const selectedErrors=evaluateReadings(run,reducedReadings).errors;
    const byIndex=new Map([...fixedErrors,...selectedErrors].map(error=>[error.index,error]));
    const errors=calibration.map(row=>byIndex.get(row.index));
    const surface={count:errors.length,compatible:errors.every(error=>error.withinBand),errors};
    const rows=evaluateReceivingAccountRows(scaledReceivingRun(run,baseline.footprint.cellIndices.length/4),calibrationRows);
    return {x:[...x],hypothesis:h,...residuals(surface,rows,calibration),calibration:receivingAccountVerdict(surface,rows)};
  }

  let seeds=baseline.candidates.filter(row=>row.hypothesis.capacityMm>0&&row.hypothesis.drainagePerHour>0).map(row=>({
    id:'central-'+row.hypothesis.id,x:vector(row.hypothesis),origin:'Calibration-ranked analytic proposal',
    score:residuals(row.surfaceCalibration,row.accountReadings.filter(r=>r.use==='calibration'),calibration).score,
    surfaceRows:[...new Set(row.originalTrials.flatMap(t=>t.surfaceRows))],accountIndices:[...new Set(row.originalTrials.flatMap(t=>t.accountIndices??[t.accountIndex]))],
  })).sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id)).slice(0,RECEIVING_ACCOUNT_BAND_SEEDS);
  const storm=selectedCalibration.find(row=>row.reading.minute===w.stormMinutes);
  const drained=receiverCalibration.filter(row=>row.reading.channel==='drained'&&row.reading.minute>w.stormMinutes)
    .sort((a,b)=>a.reading.minute-b.reading.minute||a.index-b.index).filter((row,i,all)=>i===0||row.reading.minute!==all[i-1].reading.minute);
  function stormKernelStarts(k,kind,accountIndices,calibrationStart){
    const explicit=[];
    if(k>0&&k<=100)for(const fraction of [0,.5,1]){
      const depth=C=>{
        if(++counts.seedKernelCalls>reservation.seedKernelCalls)throw Error('Complete reserved numerical-start kernel budget was exceeded.');
        return advanceDrainingLayer({surfaceMm:0,storedMm:C*fraction,capacityMm:C,
          infiltrationMmHr:SURFACES[material].infiltrationMmHr,drainagePerHour:k,rainMmHr:w.rainMmHr,hours:w.stormMinutes/60}).surfaceMm;
      };
      let lo=1e-10,hi=10000;
      if(!(depth(lo)>=storm.reading.depthMm&&depth(hi)<=storm.reading.depthMm))continue;
      for(let i=0;i<56;i++){const mid=lo+(hi-lo)/2;if(depth(mid)>storm.reading.depthMm)lo=mid;else hi=mid;}
      const C=lo+(hi-lo)/2;
      explicit.push({id:kind+'-'+fraction,x:vector({capacityMm:C,initialStoredMm:C*fraction,drainagePerHour:k}),
        origin:'Separately declared '+fraction+' initial-storage fraction; original storm-center kernel start, not an accepted inverse'+(calibrationStart?'; rate midpoint from original retained-water bands under a conditional dry-recession assumption':''),
        surfaceRows:[storm.index],accountIndices,...(calibrationStart?{calibrationStart:clone(calibrationStart)}:{})});
    }
    return explicit;
  }
  if(storm&&drained.length>=3){
    counts.seedInverseCalls++;
    const curve=inferPostDryDrainedReceivers({rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[material].infiltrationMmHr,
      stormMinutes:w.stormMinutes,stormEndDepthMm:storm.reading.depthMm,areaM2:baseline.footprint.areaM2,
      earlier:drained[0].reading,middle:drained[1].reading,later:drained[2].reading});
    const explicit=stormKernelStarts(curve.drainageCurvePerHour,'storm-kernel',drained.slice(0,3).map(row=>row.index));
    if(explicit.length)seeds=explicit;
    else refusals.push({phase:'numerical-starts',reason:curve.reason??'No original storm-center numerical start was available.'});
  }

  // An impossible center ratio need not make the original measurement bands
  // impossible. This supplies computational starts only when the retained
  // incumbent and existing drainage-curve starts supplied none. Every original
  // band and the actual phase remain binding in the unchanged forward model.
  if(storm&&!seeds.length){
    const retained=receiverCalibration.filter(row=>row.reading.channel==='retained'&&row.reading.minute>w.stormMinutes);
    const groups=new Map();
    for(const row of retained){
      const {minute,valueLiters,uncertaintyLiters}=row.reading,lower=Math.max(0,valueLiters-uncertaintyLiters),upper=valueLiters+uncertaintyLiters;
      const prior=groups.get(minute);
      if(prior){prior.lower=Math.max(prior.lower,lower);prior.upper=Math.min(prior.upper,upper);prior.indices.push(row.index);}
      else groups.set(minute,{minute,lower,upper,indices:[row.index]});
    }
    const course=[...groups.values()].sort((a,b)=>a.minute-b.minute);
    let lowerRate=0,upperRate=100,contradictory=course.some(row=>row.lower>row.upper);
    if(course.length>=2&&course.some(row=>row.upper>0)&&!contradictory){
      for(let a=0;a<course.length;a++)for(let b=a+1;b<course.length;b++){
        if(++counts.seedRetainedRatePairs>reservation.maximumRetainedRatePairs)throw Error('Complete retained-rate starting-pair reservation was exceeded.');
        const first=course[a],last=course[b],hours=(last.minute-first.minute)/60;
        if(first.upper===0){if(last.lower>0)contradictory=true;continue;}
        if(last.upper===0){if(first.lower>0)contradictory=true;continue;}
        if(first.lower>0)lowerRate=Math.max(lowerRate,(Math.log(first.lower)-Math.log(last.upper))/hours);
        if(last.lower>0)upperRate=Math.min(upperRate,(Math.log(first.upper)-Math.log(last.lower))/hours);
      }
      const minimumRatePerHour=Math.max(1e-10,lowerRate),maximumRatePerHour=Math.min(100,upperRate);
      if(!contradictory&&Number.isFinite(minimumRatePerHour)&&Number.isFinite(maximumRatePerHour)&&maximumRatePerHour>=minimumRatePerHour){
        const ratePerHour=minimumRatePerHour+(maximumRatePerHour-minimumRatePerHour)/2;
        const calibrationStart={kind:'conditional-post-dry-retained-band-rate',minimumRatePerHour,maximumRatePerHour,ratePerHour,
          originalAccountIndices:course.flatMap(row=>row.indices),pairChecks:counts.seedRetainedRatePairs,
          meaning:'Computational rate-start interval conditional on a positive dry exponential retained course; not a certified feasible region, inferred measurement, physical exclusion or parameter uncertainty.'};
        seeds=stormKernelStarts(ratePerHour,'retained-band-kernel',calibrationStart.originalAccountIndices,calibrationStart);
      }
    }
    if(course.length>=2&&!seeds.length)refusals.push({phase:'retained-band-numerical-starts',reason:'No positive conditional retained-band rate and original storm-center start resolved. Original bands remain unchanged; no physical exclusion is claimed.'});
  }

  for(const seed of seeds){
    const firstCall=counts.reducedTrials,trace=[];let best,lambda=1e-3,iterations=0;
    try{
      best=evaluate(seed.x);trace.push({iteration:0,score:best.score,accepted:true});
      for(;iterations<RECEIVING_ACCOUNT_BAND_ITERATIONS&&best.calibration.compatible!==true;iterations++){
        const columns=[];
        for(let j=0;j<3;j++){
          const delta=1e-4*Math.max(1,Math.abs(best.x[j])),plus=[...best.x],minus=[...best.x];
          plus[j]=Math.min(bounds[j][1],plus[j]+delta);minus[j]=Math.max(bounds[j][0],minus[j]-delta);
          const p=evaluate(plus),m=evaluate(minus),step=plus[j]-minus[j];
          columns.push(p.residual.map((value,i)=>(value-m.residual[i])/step));
        }
        const augmented=columns.map((column,j)=>[...column,...[0,1,2].map(k=>k===j?Math.sqrt(lambda)*Math.max(1,Math.hypot(...column)):0)]);
        const rhs=[...best.residual.map(value=>-value),0,0,0];
        if(augmented.some(column=>column.length!==rhs.length||!column.every(finite))||!rhs.every(finite))throw Error('Nonfinite bounded QR inputs.');
        const solved=fitLinearColumns(augmented,rhs);
        if(!solved){trace.push({iteration:iterations+1,accepted:false,reason:'Numerical QR refusal'});lambda=Math.min(1e12,lambda*10);continue;}
        const x=best.x.map((value,j)=>clamp(value+clamp(solved.coefficients[j],-1,1),...bounds[j]));
        const trial=evaluate(x),accepted=trial.score<best.score;
        trace.push({iteration:iterations+1,score:trial.score,accepted});
        if(accepted){best=trial;lambda=Math.max(1e-12,lambda*.25);}else lambda=Math.min(1e12,lambda*10);
      }
      const search={seedId:seed.id,origin:seed.origin,...(seed.calibrationStart?{calibrationStart:clone(seed.calibrationStart)}:{}),status:best.calibration.compatible===true?'reduced-band-witness':'iteration-budget-exhausted',
        iterations,modelTrials:counts.reducedTrials-firstCall,score:best.score,maximumNormalizedResidual:Math.max(...best.raw.map(Math.abs)),trace};
      searches.push(search);frozen.push({seed,search,hypothesis:clone(best.hypothesis)});
    }catch(error){
      const refusal={seedId:seed.id,phase:'numerical-fit',reason:String(error.message),modelTrials:counts.reducedTrials-firstCall};
      refusals.push(refusal);searches.push({...refusal,status:'numerical-refusal',trace});
    }
  }
  // All coefficients are frozen before accessing any held-aside values. Re-run
  // each on the original full map; a reduced-course success cannot confer a
  // full-grid success and an iteration limit cannot imply physical exclusion.
  const courses=[];
  for(const [index,fitted]of frozen.entries()){
    counts.originalGridChecks++;
    const h={id:'account-band-'+(index+1),label:'Original-band search '+(index+1),...fitted.hypothesis};
    const run=runRain(project[target],project.width,project.height,w,{drainingLayer:hypothesisLayer(selection,h)});
    const surfaceCalibration=evaluateReadings(run,calibration),surfaceChallenge=evaluateReadings(run,originals.filter(row=>row.reading.use==='challenge'));
    const accountReadings=evaluateReceivingAccountRows(run,account.readings);
    const row={hypothesis:h,search:fitted.search,originalTrials:[{branch:'bounded-original-band-search',surfaceRows:fitted.seed.surfaceRows,
      accountIndices:fitted.seed.accountIndices,accountId:fitted.seed.accountIndices.map(i=>account.readings[i].id).join(' / ')}],
      surfaceCalibration,surfaceChallenge,accountReadings,
      calibration:receivingAccountVerdict(surfaceCalibration,accountReadings.filter(r=>r.use==='calibration')),
      challenge:receivingAccountVerdict(surfaceChallenge,accountReadings.filter(r=>r.use==='challenge'))};
    courses.push({row,offers:evaluateReceivingAccountRows(run,account.offers)});
  }
  const candidates=courses.map(c=>c.row),compatibleIds=candidates.filter(c=>c.calibration.compatible===true).map(c=>c.hypothesis.id);
  const survivingIds=candidates.filter(c=>c.calibration.compatible===true&&c.challenge.compatible===true).map(c=>c.hypothesis.id);
  const hasChallenge=originals.some(row=>row.reading.use==='challenge')||account.readings.some(row=>row.use==='challenge');
  const status=!candidates.length?'no-search-starts':!compatibleIds.length?'no-band-witness':!hasChallenge?'needs-challenge':!survivingIds.length?'challenged':survivingIds.length===1?'one-surviving-proposal':'several-surviving-proposals';
  return {...context,status,candidates,compatibleIds,survivingIds,question:chooseReceivingAccountQuestion(account,courses),
    meaning:'At most three finite local searches from calibration-only starts. Original uncertainty bands are never enlarged or replaced by derived readings. The unchanged central family is retained separately. Four-cell reduction is used only under the original uniform isolated receiver declaration; every final candidate is checked on the complete original map. Held values only challenge frozen candidates. Search failure is unresolved, not proof that no receiver fits; surviving witnesses are not a continuous parameter enclosure, unique identification or automatic adoption.'};
}

export function serializeReceivingAccountBandSearch(project,selection,account){
  const original=JSON.parse(serializeReceivingAccountProposals(project,selection,account));
  return JSON.stringify({...original,schema:RECEIVING_ACCOUNT_BAND_SCHEMA},null,2);
}
export function parseReceivingAccountBandSearch(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>2*1024*1024)throw Error('Choose original band-search JSON under 2 MiB.');
  const raw=JSON.parse(text);
  if(!exact(raw,['schema','project','selection','account'])||raw.schema!==RECEIVING_ACCOUNT_BAND_SCHEMA)throw Error('Only original band-search sources are accepted; saved conclusions are not evidence.');
  const input=parseReceivingAccountProposals(JSON.stringify({...raw,schema:RECEIVING_ACCOUNT_PROPOSAL_SCHEMA}));
  return {...input,schema:RECEIVING_ACCOUNT_BAND_SCHEMA};
}

export function makeNoisyReceivingAccountBandExample(){
  const input=makePostDryDrainageAccountProposalExample();
  input.project.title='Authored receiver measurements with small within-band perturbations';
  input.project.observations[0].depthMm+=.0009;
  input.project.observations[1].depthMm=.0008;
  for(const row of input.project.observations)row.uncertaintyMm=.002;
  input.account.readings.slice(0,3).forEach((row,i)=>{row.valueLiters+=[.01,-.013,.008][i];row.uncertaintyLiters=.02;row.source+='; authored small within-band perturbation, not field evidence';});
  input.account.readings.at(-1).uncertaintyLiters=.02;
  return input;
}

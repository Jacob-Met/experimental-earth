import {canonicalLongwaveHeat,compareLongwaveHeat,minimumLongwaveAttempts} from './longwave-heat.js';
import {validateHeatEvidence,heatDeclarationIdentity,HEAT_ENERGY_EVIDENCE_SCHEMA} from './surface-heat-evidence-contract.js';
import {inspectSurfaceHeat,absorbedSurfaceHeatEnergy} from './surface-heat.js';

export const LONGWAVE_EVIDENCE_SCHEMA='experimental-earth-longwave-evidence/1';
const SETTINGS=[1e-8,1e-10],WORK_LIMIT=100000;
const pick=(value,keys)=>Object.fromEntries(keys.map(key=>[key,value[key]]));
const layerFields=['absorptivity','capacityJm2K','exchangeWm2K','initialC','source'];
const screen=rows=>({count:rows.length,insideAtBoth:rows.length?rows.every(r=>r.bandAtTestedSettings==='inside'):null,
 outsideAtBoth:rows.filter(r=>r.bandAtTestedSettings==='outside').length,
 settingDisagreements:rows.filter(r=>r.bandAtTestedSettings==='disagreement').length,
 linearInsideCount:rows.filter(r=>r.linearWithinBand).length,rows});

export function canonicalLongwaveEvidence(input){
 if(input?.schema!==LONGWAVE_EVIDENCE_SCHEMA||input.hypothesisExchangeBasis!=='excludes-longwave'
   ||typeof input.exchangeBasisSource!=='string'||!input.exchangeBasisSource.trim()||input.exchangeBasisSource.length>600){
  throw Error('Declare and source that every candidate linear coefficient excludes longwave radiation');
 }
 const radiation=canonicalLongwaveHeat(input.radiation);validateHeatEvidence(input.evidence);
 if(!input.evidence)throw Error('Retain original surface-temperature evidence');
 const original=input.evidence,heatStudy=canonicalLongwaveHeat({...radiation,heatStudy:original.heatStudy}).heatStudy;
 if(heatDeclarationIdentity(heatStudy)!==heatDeclarationIdentity(radiation.heatStudy))throw Error('Original readings must belong to the same retained layer exposure and place');
 const evidence={...pick(original,['schema','target','associationSource']),heatStudy,
  hypotheses:original.hypotheses.map(h=>pick(h,['label',...layerFields])),
  readings:original.readings.map(r=>pick(r,['minute','temperatureC','halfWidthC','use','source']))};
 if(original.schema===HEAT_ENERGY_EVIDENCE_SCHEMA){evidence.energyQuantity='absorbed-input';evidence.energyReadings=original.energyReadings.map(r=>pick(r,['fromMinute','toMinute','energyJm2','halfWidthJm2','use','source']));}
 return {schema:LONGWAVE_EVIDENCE_SCHEMA,radiation,evidence,hypothesisExchangeBasis:'excludes-longwave',exchangeBasisSource:input.exchangeBasisSource};
}

function band(values,observed,halfWidth){
 const residuals=values.map(p=>observed-p),inside=residuals.map(r=>Math.abs(r)<=halfWidth);
 return {residuals,bandAtTestedSettings:inside.every(Boolean)?'inside':inside.every(v=>!v)?'outside':'disagreement'};
}

/** Same original finite hypotheses and readings, evaluated at actual reading
 * times. Two settings expose sensitivity, not a rigorous solution enclosure. */
export function compareLongwaveEvidence(input){
 const accepted=canonicalLongwaveEvidence(input),{radiation,evidence}=accepted;
 const roles=['calibration','challenge'].map(role=>({role,samples:evidence.readings.filter(r=>r.use===role).map(r=>r.minute)})).filter(group=>group.samples.length);
 // Even an energy-only inquiry admits the complete conditional trajectory.
 if(!roles.length)roles.push({role:'unobserved',samples:[]});
 const candidates=[],pairs=[];let attempts=0;
 for(let offset=0;offset<evidence.hypotheses.length;offset+=2){
  const hypotheses=evidence.hypotheses.slice(offset,offset+2),investigation=structuredClone(radiation);
  investigation.heatStudy.existing=hypotheses[0];investigation.heatStudy.proposal=hypotheses[1]??hypotheses[0];
  investigation.existing=structuredClone(radiation[evidence.target]);investigation.proposal=structuredClone(radiation[evidence.target]);
  pairs.push({hypotheses,investigation});
 }
 // Includes the duplicate final layer when an odd candidate count is paired.
 const minimumAttempts=pairs.reduce((sum,p)=>sum+roles.length*SETTINGS.length*minimumLongwaveAttempts(p.investigation),0);
 if(minimumAttempts>WORK_LIMIT)throw Error('The complete candidate/settings inquiry exceeds the shared integration work budget before execution');
 for(const {hypotheses,investigation} of pairs){
  const runsByRole=Object.fromEntries(roles.map(({role,samples})=>[role,SETTINGS.map(toleranceC=>{
   if(attempts>=WORK_LIMIT)throw Error('The complete inquiry exhausted its shared integration work budget');
   const r=compareLongwaveHeat(investigation,{sampleMinutes:samples,toleranceC,workLimit:WORK_LIMIT-attempts});attempts+=r.integrationAttempts;return r;
  })]));
  hypotheses.forEach((hypothesis,i)=>{
   const target=i===0?'existing':'proposal';
   // The unchanged exact model must also admit the complete exposure, not just
   // the reading times. Its extrema lie at the original interval endpoints.
   let minute=0;inspectSurfaceHeat(investigation.heatStudy,0);
   for(const row of investigation.heatStudy.schedule){minute+=row.minutes;inspectSurfaceHeat(investigation.heatStudy,minute);}
   const rows=evidence.readings.map((reading,index)=>{
    const predictedC=runsByRole[reading.use].map(r=>r[target].trajectory.find(s=>s.minute===reading.minute).temperatureC);
    const linearPredictionC=inspectSurfaceHeat(investigation.heatStudy,reading.minute)[target].temperatureC;
    const result=band(predictedC,reading.temperatureC,reading.halfWidthC);
    const linearArithmeticGuardC=Number.EPSILON*128*Math.max(1,Math.abs(reading.temperatureC),Math.abs(linearPredictionC));
    return {kind:'temperature',index,reading:{...reading},predictedC,residualC:result.residuals,
     predictionChangeC:Math.abs(predictedC[1]-predictedC[0]),bandAtTestedSettings:result.bandAtTestedSettings,
     linearPredictionC,linearArithmeticGuardC,linearResidualC:reading.temperatureC-linearPredictionC,
     linearWithinBand:Math.abs(reading.temperatureC-linearPredictionC)<=reading.halfWidthC+linearArithmeticGuardC};
   });
   const energies=(evidence.energyReadings??[]).map((reading,index)=>{
    const predictionJm2=absorbedSurfaceHeatEnergy(investigation.heatStudy,target,reading.fromMinute,reading.toMinute);
    const residualJm2=reading.energyJm2-predictionJm2;
    const study=investigation.heatStudy,duration=study.schedule.reduce((sum,row)=>sum+row.minutes,0);
    const boundaryScaleJm2=hypothesis.absorptivity*Math.max(...study.schedule.map(row=>row.incidentWm2))*60*duration*study.schedule.length**2;
    const arithmeticGuardJm2=Number.EPSILON*128*Math.max(1,reading.energyJm2,predictionJm2,boundaryScaleJm2);
    return {kind:'absorbed-input',index,reading:{...reading},predictionJm2,residualJm2,arithmeticGuardJm2,
     bandAtTestedSettings:Math.abs(residualJm2)<=reading.halfWidthJm2+arithmeticGuardJm2?'inside':'outside',
     linearWithinBand:Math.abs(residualJm2)<=reading.halfWidthJm2+arithmeticGuardJm2};
   });
   const all=[...rows,...energies];
   candidates.push({label:hypothesis.label,calibration:screen(all.filter(r=>r.reading.use==='calibration')),
    challenge:screen(all.filter(r=>r.reading.use==='challenge')),rows,energyRows:energies});
  });
 }
 return {schema:LONGWAVE_EVIDENCE_SCHEMA,source:accepted,candidates,work:{attempts,minimumAttempts,limit:WORK_LIMIT,roleCourses:roles.map(r=>r.role)},settings:[...SETTINGS],
  semantics:'Band comparisons at two local integration settings, not a global numerical enclosure or proof of physical adequacy. Original calibration and held-aside roles remain separate; no refit, ranking or parameter adoption. Absorbed input is unchanged by adding outgoing radiation.'};
}
export function serializeLongwaveEvidence(input){return JSON.stringify(canonicalLongwaveEvidence(input),null,2);}
export function reopenLongwaveEvidence(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>300000)throw Error('Original longwave evidence file exceeds 300000 bytes');
 return compareLongwaveEvidence(JSON.parse(text));
}

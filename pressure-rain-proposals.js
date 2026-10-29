import{boundedCenterProposals}from'./bounded-center-proposals.js';
import{validateProject,SURFACES,runPressureHeadRain}from'./core.js';
import{validatePressureHeadStudy,PRESSURE_HEAD_MODEL_SCHEMA}from'./pressure-head-contract.js';
import{evaluateReadings}from'./infiltration-study.js';
export const PRESSURE_PROPOSAL_RUNS=47;
const ITERATIONS=44,MAX_WORK=3000000;
export function proposePressureRain(project,study,request){
 validateProject(project);validatePressureHeadStudy(study,SURFACES);
 if(!request||Array.isArray(request)||Object.keys(request).length!==4||!['minimumMmHr','maximumMmHr','calibrationIndex','basis'].every(k=>Object.hasOwn(request,k))||!Number.isFinite(request.minimumMmHr)||!Number.isFinite(request.maximumMmHr)||request.minimumMmHr<0||request.maximumMmHr>250||request.minimumMmHr>=request.maximumMmHr||typeof request.basis!=='string'||!request.basis.trim()||request.basis.length>600)throw Error('Declare original rainfall bounds0–250mm/h, calibration row and basis.');
 const selected=project.observations[request.calibrationIndex];if(!Number.isInteger(request.calibrationIndex)||!selected||selected.scenario!==study.target||selected.use!=='calibration')throw Error('Select an original calibration depth in the investigated scenario.');
 if(!project[study.target].some(c=>c.surface===study.surface))throw Error('Investigated surface is absent.');
 const one=project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes),reservedCellSteps=one*study.hypotheses.length*(ITERATIONS+3);if(reservedCellSteps>MAX_WORK)throw Error('Complete rainfall proposals exceed the3Mcell-step reservation before any simulation.');
 const original=project.observations.map((reading,index)=>({reading,index})),calibration=original.filter(x=>x.reading.scenario===study.target&&x.reading.use==='calibration'),challenge=original.filter(x=>x.reading.scenario===study.target&&x.reading.use==='challenge'),anchor=[{reading:selected,index:request.calibrationIndex}],candidates=[],profiles=[];
 for(let index=0;index<study.hypotheses.length;index++){
  const hypothesis=study.hypotheses[index],cache=new Map(),tested=[];
  const evaluate=rainMmHr=>{if(cache.has(rainMmHr))return cache.get(rainMmHr);const native=runPressureHeadRain(project[study.target],project.width,project.height,{...project.weather,rainMmHr},{schema:PRESSURE_HEAD_MODEL_SCHEMA,surface:study.surface,...hypothesis}),row={hypothesisIndex:index,rainMmHr,hypothesis:structuredClone(hypothesis),anchor:evaluateReadings(native,anchor),calibration:evaluateReadings(native,calibration),challenge:evaluateReadings(native,challenge),massErrorLiters:native.massErrorLiters};row.compatible=row.calibration.compatible===true;row.surviving=row.compatible&&row.challenge.compatible!==false;candidates.push(row);tested.push(row);cache.set(rainMmHr,row);return row;};
  evaluate(project.weather.rainMmHr);const status=boundedCenterProposals(evaluate,row=>-row.anchor.errors[0].residualMm,request.minimumMmHr,request.maximumMmHr,ITERATIONS);
  profiles.push({hypothesisIndex:index,status,testedCount:tested.length,compatibleCount:tested.filter(x=>x.compatible).length});
 }
 return{candidates,profiles,reservedCellSteps,cellSteps:candidates.length*one,meaning:'Finite calibration-driven rainfall proposals conditional on original storm end and explicit soil hypotheses. Every tested point is retained and checked against all original depth calibration bands using the maintained numerical guard. Held-aside values never guide proposals. No-center-bracket is not absence of feasible rain. No continuous completeness, monotonicity or physical identification is asserted. Original rainfall evidence must also be checked by the receiving comparison.'};
}

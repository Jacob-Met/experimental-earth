import{internalEdgeClosed,internalEdgeCrest}from'./internal-barriers.js';
import{validateProject}from'./core.js';import{validateStudy}from'./study-contract.js';import{evaluateReadings}from'./infiltration-study.js';import{selectPondingExposure,validateExposureRequest}from'./ponding-exposure-request.js';import{INTERVENTION_METRICS}from'./intervention-study.js';import{runProfile}from'./profile-model.js';import{validateDrainingLayer}from'./draining-infiltration.js';import{SURFACES}from'./core.js';
export function createProfileComparison(budget,{model=runProfile,allowFinite=false}={}){
 let signature=null;const existingRuns=new Map();
 function compare(project,{study,subset='all',allowAbsentSurface=false,drainingLayer=null,exposureRequest=null},fixed=null){
  validateProject(project);validateStudy(study);if(drainingLayer!==null){if(!allowFinite)throw Error('Profile model refuses finite receiving layers');validateDrainingLayer(drainingLayer,SURFACES);}if(!['all','calibration','surviving'].includes(subset))throw Error('Unknown profile subset');if(allowAbsentSurface&&subset!=='all')throw Error('Absent-surface filtering refused');
  if(fixed!==null&&(!Array.isArray(fixed)||!fixed.length||fixed.length>study.ratesMmHr.length||new Set(fixed).size!==fixed.length||!Array.from({length:fixed.length},(_,i)=>Object.hasOwn(fixed,i)&&study.ratesMmHr.includes(fixed[i])).every(Boolean)||subset!=='all'))throw Error('Invalid fixed profile support');
  const exposure=validateExposureRequest(project.proposal.length,exposureRequest),key=JSON.stringify([project.existing,project.width,project.height,project.weather,study.surface,drainingLayer]);if(signature!==key){signature=key;existingRuns.clear();}
  const readings=project.observations.map((reading,index)=>({reading,index})),calibration=readings.filter(x=>x.reading.scenario===study.target&&x.reading.use==='calibration'),challenge=readings.filter(x=>x.reading.scenario===study.target&&x.reading.use==='challenge');
  if(subset!=='all'&&!calibration.length)return{status:'need-calibration',candidates:[]};if(subset==='surviving'&&!challenge.length)return{status:'need-challenge',candidates:[]};
  const affected=['existing','proposal'].map(k=>project[k].some(c=>c.surface===study.surface));if(!affected.some(Boolean)&&!allowAbsentSurface)return{status:'surface-absent',candidates:[]};
  // Unsupported geometry admission is independent of calibration rate rejection.
  for(const cells of[project.existing,project.proposal])for(let y=0;y<project.height;y++)for(let x=0;x<project.width;x++){const i=y*project.width+x;for(const j of[x+1<project.width?i+1:null,y+1<project.height?i+project.width:null])if(j!==null&&!internalEdgeClosed(cells,i,j,project.width)&&internalEdgeCrest(cells,i,j)!==null)throw Error('Profile model does not support declared crests');}
  const candidates=[];for(const rateMmHr of fixed??study.ratesMmHr){const options={surfaceInfiltrationOverride:{surface:study.surface,rateMmHr},...(drainingLayer?{drainingLayer}:{})};let existing,proposal;
   const getExisting=()=>{if(!existing){existing=existingRuns.get(rateMmHr);if(!existing){existing=model(project.existing,project.width,project.height,project.weather,options,budget);if(existingRuns.size===9)existingRuns.delete(existingRuns.keys().next().value);existingRuns.set(rateMmHr,existing);}}return existing;};
   const getProposal=()=>proposal??(proposal=model(project.proposal,project.width,project.height,project.weather,options,budget));
   if(subset!=='all'){const source=study.target==='existing'?getExisting():getProposal();if(!project[study.target].some(c=>c.surface===study.surface)||evaluateReadings(source,calibration).compatible!==true)continue;if(subset==='surviving'&&evaluateReadings(source,challenge).compatible===false)continue;}
   existing=getExisting();proposal=getProposal();
   const metrics=Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(k=>[k,{existing:existing[k],proposal:proposal[k],delta:proposal[k]-existing[k]}]));
   if(exposure){budget.used+=2*project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);if(budget.used>budget.limit)throw Error('Profile exposure work bound exceeded');}
   candidates.push({rateMmHr,metrics,peakDeltaMm:proposal.peakDepthMm.map((x,i)=>x-existing.peakDepthMm[i]),massErrorLiters:{existing:existing.massErrorLiters,proposal:proposal.massErrorLiters},...(exposure?{pondingExposure:{existing:selectPondingExposure(existing,exposure),proposal:selectPondingExposure(proposal,exposure)}}:{})});
  }
  return{status:candidates.length?'compared':'no-compatible-rates',candidates};
 }
 compare.fixedRates=(project,options,rates)=>{if(!Array.isArray(rates))throw Error('Explicit fixed profile rates required');return compare(project,options,rates);};return compare;
}

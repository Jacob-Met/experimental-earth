import {validateProject} from './core.js';
import {heatColumnEvidenceCurrent} from './heat-column-evidence-contract.js';
import {evaluateHeatColumnHypothesis} from './heat-column-evidence.js';

export const HEAT_SEARCH_METHOD='bounded-heat-gauss-newton-search/1';
export const HEAT_SEARCH_LIMIT=400;
const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
export function validateHeatSearch(project,query){
 validateProject(project);
 const e=project.heatColumnEvidence;
 if(!e||!heatColumnEvidenceCurrent(project,e))throw Error('Retain current original surface readings and two-store exposure first');
 for(const[key,min,max]of [['capacity',1000,1e7],['conductance',0,1000]]){
  const r=query?.[key];if(!r||!finite(r.minimum,min,max)||!finite(r.maximum,min,max)||r.minimum>=r.maximum)throw Error('Declare ordered '+key+' search bounds within the maintained model');
 }
 if(typeof query.source!=='string'||!query.source.trim()||query.source.length>600)throw Error('Source the offered parameter domain (at most 600 characters)');
 // Every candidate evaluates complete-course extrema and original windows. Reserve
 // the whole finite search before evaluation; refusals never imply rejection.
 const work=HEAT_SEARCH_LIMIT*e.columnStudy.heatStudy.schedule.length*(e.readings.length+e.columnStudy.heatStudy.schedule.length*4+1);
 if(work>2_000_000)throw Error('Complete heat search exceeds the 2000000 course-sample budget');
 return {evidence:e,reservedWork:work};
}
export function searchHeatColumnParameters(project,query,{refine=true}={}){
 const {evidence,reservedWork}=validateHeatSearch(project,query);
 const count=evidence.readings.filter(r=>r.use==='calibration').length;
 if(!count)return {status:'need-calibration',candidates:[],compatibleIds:[],evaluations:0,reservedWork,method:HEAT_SEARCH_METHOD};
 const candidates=[],cache=new Map();
 const capacity=x=>Math.max(query.capacity.minimum,Math.min(query.capacity.maximum,Math.exp(Math.log(query.capacity.minimum)+x*Math.log(query.capacity.maximum/query.capacity.minimum))));
 const conductance=y=>Math.max(query.conductance.minimum,Math.min(query.conductance.maximum,query.conductance.minimum+y*(query.conductance.maximum-query.conductance.minimum)));
 function evaluate(x,y,origin){
  x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));
  const key=x.toPrecision(15)+','+y.toPrecision(15);
  if(cache.has(key))return cache.get(key);
  if(candidates.length>=HEAT_SEARCH_LIMIT)return null;
  const h={label:'Proposal '+(candidates.length+1),capacityJm2K:x===0?query.capacity.minimum:x===1?query.capacity.maximum:capacity(x),conductanceWm2K:conductance(y),source:query.source};
  // Complete-course failures abort transactionally, never become poor-fit scores.
  const result=evaluateHeatColumnHypothesis(evidence,h);
  const objective=Math.max(...result.calibration.rows.map(r=>Math.abs(r.residualC)/Math.max(evidence.readings[r.index].halfWidthC,1e-6)));
  const residuals=result.calibration.rows.map(r=>r.residualC/Math.max(evidence.readings[r.index].halfWidthC,1e-6));
  const loss=residuals.reduce((sum,r)=>sum+r*r,0)/residuals.length;
  const row={loss,residuals,id:candidates.length+1,x,y,origin,hypothesis:h,objective,calibration:result.calibration,challenge:result.challenge,summary:result.summary,final:result.final};
  candidates.push(row);cache.set(key,row);return row;
 }
 for(let x=0;x<=4;x++)for(let y=0;y<=4;y++)evaluate(x/4,y/4,'coarse-grid');
 const seeds=[...candidates].sort((a,b)=>a.objective-b.objective||a.id-b.id).slice(0,3);
 const coarseCompatibleIds=candidates.filter(c=>c.calibration.compatible===true).map(c=>c.id);
 const stops=[];
 if(refine)for(const seed of seeds){
  let best=seed,iterations=0,lambda=1e-4,step=Infinity;const limit=Math.min(HEAT_SEARCH_LIMIT,candidates.length+125);
  while(step>=1e-8&&candidates.length+4<limit&&iterations++<40){
   const h=1e-4, xp=evaluate(best.x+h,best.y,'calibration-search'),xm=evaluate(best.x-h,best.y,'calibration-search');
   const yp=evaluate(best.x,best.y+h,'calibration-search'),ym=evaluate(best.x,best.y-h,'calibration-search');
   if(!xp||!xm||!yp||!ym)break;
   let aa=0,ab=0,bb=0,ar=0,br=0;
   for(let i=0;i<best.residuals.length;i++){
    const a=(xp.residuals[i]-xm.residuals[i])/(xp.x-xm.x),b=(yp.residuals[i]-ym.residuals[i])/(yp.y-ym.y),r=best.residuals[i];
    aa+=a*a;ab+=a*b;bb+=b*b;ar+=a*r;br+=b*r;
   }
   const A=aa+lambda*Math.max(1,aa),B=bb+lambda*Math.max(1,bb),det=A*B-ab*ab;
   if(!(det>0)||!Number.isFinite(det))break;
   const dx=(-B*ar+ab*br)/det,dy=(ab*ar-A*br)/det;
   if(!Number.isFinite(dx)||!Number.isFinite(dy))break;
   let next=best;
   for(let scale=1;scale>=1/128&&candidates.length<limit;scale/=2){
    const c=evaluate(best.x+scale*dx,best.y+scale*dy,'calibration-search');
    if(c&&c.loss<best.loss){next=c;break;}
   }
   if(next===best){lambda*=10;if(lambda>1e10)break;}
   else{step=Math.hypot(next.x-best.x,next.y-best.y);best=next;lambda=Math.max(1e-10,lambda/3);}
  }
  stops.push({seedId:seed.id,bestId:best.id,step:Number.isFinite(step)?step:null,reason:step<1e-8?'local-resolution':candidates.length+4>=limit?'evaluation-budget':'local-stall-or-iteration-budget'});
 }
 const compatibleIds=candidates.filter(c=>c.calibration.compatible===true).map(c=>c.id);
 return {method:HEAT_SEARCH_METHOD,status:compatibleIds.length?'compatible-proposals':'no-compatible-proposal-found',candidates,compatibleIds,coarseCompatibleIds,evaluations:candidates.length,reservedWork,stops,
 semantics:'Bounded local proposals within a declared domain, not a continuous feasible enclosure, unique identification or proof that no explanation exists. Original calibration bands decide compatibility; a 0.000001 C objective scale for zero-width bands is not an uncertainty allowance. Held-aside readings never choose seeds, steps or ranking. Every tested proposal remains inspectable; none is adopted.'};
}
export function serializeHeatSearch(project,query){validateHeatSearch(project,query);return JSON.stringify({method:HEAT_SEARCH_METHOD,project,query},null,2);}
export function parseHeatSearch(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Heat search source file exceeds 6 MiB');
 const v=JSON.parse(text);if(!v||v.method!==HEAT_SEARCH_METHOD||Object.keys(v).sort().join(',')!=='method,project,query')throw Error('Expected original heat search source and method');
 validateHeatSearch(v.project,v.query);return v;
}

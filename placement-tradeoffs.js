import {comparePlacements,PLACEMENT_METRICS,validatePlacementQuery} from './placement-search.js';
function amount(v,label){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12)throw Error(`${label} must be a finite nonnegative amount at most 1e12`);return v;}
export function validatePlacementTradeoffs(project,query,input){
 const admitted=validatePlacementQuery(project,query);
 if(!input||!Array.isArray(input.metrics)||input.metrics.length<1||input.metrics.length>Object.keys(PLACEMENT_METRICS).length||new Set(input.metrics).size!==input.metrics.length||Array.from(input.metrics).some(k=>!Object.hasOwn(PLACEMENT_METRICS,k)))throw Error('Choose distinct supported tradeoff metrics');
 if(typeof input.costUnit!=='string'||!input.costUnit.trim()||input.costUnit.length>40)throw Error('Declare the common cost unit');
 if(!Array.isArray(input.cellCosts)||input.cellCosts.length!==admitted.eligibleCells.length)throw Error('Declare one additive edit cost for every eligible cell');
 const seen=new Set(),cellCosts=Array.from(input.cellCosts).map(row=>{
  if(!row||!admitted.eligibleCells.includes(row.cellIndex)||seen.has(row.cellIndex))throw Error('Costs must name every eligible cell exactly once');seen.add(row.cellIndex);
  if(typeof row.source!=='string'||!row.source.trim()||row.source.length>240)throw Error('Each declared cell cost needs its assumption or source');
  return {cellIndex:row.cellIndex,cost:amount(row.cost,'Cell cost'),source:row.source.trim()};
 }).sort((a,b)=>a.cellIndex-b.cellIndex);
 return {metrics:[...input.metrics],costUnit:input.costUnit.trim(),cellCosts,budget:amount(input.budget,'Budget')};
}
/** Minimize every coordinate; preserve equal alternatives. Exact comparisons avoid tolerance-induced cycles. */
export function paretoIndices(vectors){
 if(!Array.isArray(vectors)||vectors.length>79)throw Error('Expected at most 79 placement vectors');
 const dimensions=vectors[0]?.length??0;
 if(Array.from(vectors).some(row=>!Array.isArray(row)||row.length!==dimensions||!dimensions||Array.from(row).some(v=>typeof v!=='number'||!Number.isFinite(v))))throw Error('Pareto coordinates must be finite matching numeric vectors');
 return vectors.flatMap((row,i)=>vectors.some((other,j)=>j!==i&&other.every((v,k)=>v<=row[k])&&other.some((v,k)=>v<row[k]))?[]:[i]);
}
export function comparePlacementTradeoffs(project,query,input){
 const declaration=validatePlacementTradeoffs(project,query,input),report=comparePlacements(project,query);
 const context={declaration,declarationSignature:JSON.stringify(declaration),semantics:'Finite tradeoffs among target-meeting layouts within the declared additive cost budget. Environmental coordinates are worst additional modeled changes across the same retained source hypotheses; smaller is better. Cost assumptions and modeled values are not field validation or an implementation recommendation.'};
 if(report.status!=='compared')return {...report,tradeoffs:{...context,plans:[],frontier:[]}};
 const costs=new Map(declaration.cellCosts.map(r=>[r.cellIndex,r.cost]));
 const plans=report.plans.map((plan,index)=>{
  const cost=plan.cells.reduce((sum,cell)=>sum+costs.get(cell),0),coordinates=[cost,...declaration.metrics.map(k=>plan.metrics[k].max)];
  if(coordinates.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Every enumerated placement must have finite cost and environmental coordinates');
  return {index,cells:[...plan.cells],cost,coordinates,feasible:plan.meetsAllTargets&&cost<=declaration.budget,rejection:!plan.meetsAllTargets?'declared-targets':cost>declaration.budget?'declared-budget':null};
 });
 const feasible=plans.filter(p=>p.feasible),frontier=paretoIndices(feasible.map(p=>p.coordinates)).map(i=>feasible[i].index);
 return {...report,tradeoffs:{...context,plans,frontier,feasibleCount:feasible.length,rejectedCount:plans.length-feasible.length}};
}

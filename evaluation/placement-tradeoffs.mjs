import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {comparePlacements} from '../placement-search.js';
import {comparePlacementTradeoffs} from '../placement-tradeoffs.js';
const p=makeExample();p.proposal=structuredClone(p.existing);
const eligibleCells=p.proposal.flatMap((c,i)=>c.surface==='sealed'?[i]:[]);assert.ok(eligibleCells.length<=12);
const q={eligibleCells,maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study:{target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]}};
const d={metrics:['unabsorbedLiters','exitLiters','maxDepthMm'],costUnit:'authored units',budget:6,cellCosts:eligibleCells.map(cellIndex=>({cellIndex,cost:1+cellIndex%5,source:'Held-back authored heterogeneous cost course'}))};
const b=comparePlacements(p,q),r=comparePlacementTradeoffs(p,q,d);assert.deepEqual(r.plans,b.plans);
const accepted=r.tradeoffs.plans.filter(x=>x.feasible),oracle=[];
for(const candidate of accepted){let beaten=false;for(const competitor of accepted){const diffs=competitor.coordinates.map((x,k)=>x-candidate.coordinates[k]);if(diffs.filter(x=>x>0).length===0&&diffs.filter(x=>x<0).length>0)beaten=true;}if(!beaten)oracle.push(candidate.index);}
assert.deepEqual(r.tradeoffs.frontier,oracle);
const z=comparePlacementTradeoffs(p,q,{...d,budget:0});assert.deepEqual(z.tradeoffs.frontier.map(i=>z.plans[i].cells),[[]]);
console.log(JSON.stringify({eligibleCells,variantCount:r.variantCount,rates:r.ratesMmHr,scalarBest:b.best,feasible:r.tradeoffs.feasibleCount,frontier:r.tradeoffs.frontier.map(i=>({cells:r.plans[i].cells,vector:r.tradeoffs.plans[i].coordinates})),overBudget:r.tradeoffs.plans.filter(x=>x.rejection==='declared-budget').length,zeroBudgetFrontier:z.tradeoffs.frontier.length},null,2));

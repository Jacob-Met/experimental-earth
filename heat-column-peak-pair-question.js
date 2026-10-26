import {planHeatPeakQuestion,validateHeatPeakQuestion} from './heat-column-peak-question.js';
export const HEAT_PEAK_PAIR_METHOD='inferred-heat-peak-pair-minimax/1';
export const HEAT_PEAK_PAIR_WORK_LIMIT=50_000_000;
export const HEAT_PEAK_PAIR_SLOT_LIMIT=30_000;
const channel=r=>r.channel??'surface';
export function heatPeakPairSupportsDisjoint(a,b){return channel(a)!==channel(b)||a.minute<(b.fromMinute??b.minute)||b.minute<(a.fromMinute??a.minute);}
/** Exhaustive nonadaptive two-band minimax over one complete finite model family.
 * Rectangular permitted observation bands do not assert independent errors.
 */
export function finiteHeatPeakPairQuestion(rows,singleIndex){
 if(!Array.isArray(rows)||rows.length<1||rows.length>482||!Number.isInteger(singleIndex)||singleIndex<0||singleIndex>=rows.length)throw Error('Retain a complete finite query grid and its single-reading optimum');
 const reference=rows[0].predictions,N=reference?.length,Q=rows.length;
 if(!Number.isInteger(N)||N<1||N>800||new Set(reference.map(p=>p.id)).size!==N)throw Error('Retain 1–800 distinct complete model predictions');
 for(const row of rows){if(!Array.isArray(row.predictions)||row.predictions.length!==N||!Number.isFinite(row.minute)||row.fromMinute!==undefined&&(!Number.isFinite(row.fromMinute)||row.fromMinute>=row.minute)||!['surface','lower'].includes(channel(row)))throw Error('Retain complete supported query rows');for(let i=0;i<N;i++){const p=row.predictions[i];if(p.id!==reference[i].id||p.peakC!==reference[i].peakC||![p.lowerC,p.upperC,p.peakC].every(Number.isFinite)||p.lowerC>p.upperC)throw Error('Every query must retain the identical ordered model family and finite bands');}}
 const modelPairCount=N*(N-1)/2,words=Math.ceil(modelPairCount/32),candidatePairSlots=Q*(Q-1)/2;
 const bandOverlapChecks=modelPairCount*Q,maximumWordIntersections=candidatePairSlots*words,reservedPairWork=bandOverlapChecks+maximumWordIntersections;
 if(candidatePairSlots>HEAT_PEAK_PAIR_SLOT_LIMIT||reservedPairWork>HEAT_PEAK_PAIR_WORK_LIMIT)throw Error('Complete two-reading family exceeds 30,000 query-pair slots or 50,000,000 overlap/bitset work; reduce the declared grid, never prune models');
 const work={modelCount:N,queryCount:Q,modelPairCount,candidatePairSlots,bandOverlapChecks,maximumWordIntersections,reservedPairWork,limit:HEAT_PEAK_PAIR_WORK_LIMIT,pairSlotLimit:HEAT_PEAK_PAIR_SLOT_LIMIT};
 const modelPairs=[];for(let a=0;a<N;a++)for(let b=a+1;b<N;b++)modelPairs.push({a,b,spreadC:Math.abs(reference[a].peakC-reference[b].peakC)});
 if(modelPairs.some(p=>!Number.isFinite(p.spreadC)))throw Error('Finite target peak spread required');
 modelPairs.sort((a,b)=>b.spreadC-a.spreadC||a.a-b.a||a.b-b.b);
 const masks=rows.map(row=>{const mask=new Uint32Array(words);for(let k=0;k<modelPairs.length;k++){const pair=modelPairs[k],a=row.predictions[pair.a],b=row.predictions[pair.b];if(Math.max(a.lowerC,b.lowerC)<=Math.min(a.upperC,b.upperC))mask[k>>>5]|=1<<(k&31);}return mask;});
 function objective(a,b){for(let w=0;w<words;w++){const common=masks[a][w]&masks[b][w];if(common){const bit=31-Math.clz32(common&-common),index=w*32+bit;return {worstRemainingC:modelPairs[index].spreadC,witnessPairIndex:index};}}return{worstRemainingC:0,witnessPairIndex:null};}
 const combinations=[];let bestIndex=null,greedyIndex=null;
 for(let a=0;a<Q;a++)for(let b=a+1;b<Q;b++){if(!heatPeakPairSupportsDisjoint(rows[a],rows[b]))continue;const choice={queryIndexes:[a,b],...objective(a,b)},index=combinations.length;combinations.push(choice);if(bestIndex===null||choice.worstRemainingC<combinations[bestIndex].worstRemainingC)bestIndex=index;if((a===singleIndex||b===singleIndex)&&(greedyIndex===null||choice.worstRemainingC<combinations[greedyIndex].worstRemainingC))greedyIndex=index;}
 function describe(index){if(index===null)return null;const c=combinations[index],p=c.witnessPairIndex===null?null:modelPairs[c.witnessPairIndex];return{...c,combinationIndex:index,witness:p?{modelIndexes:[p.a,p.b],modelIds:[reference[p.a].id,reference[p.b].id],peakC:[reference[p.a].peakC,reference[p.b].peakC],possibleObservedBands:c.queryIndexes.map(i=>({channel:channel(rows[i]),minute:rows[i].minute,lowerC:Math.max(rows[i].predictions[p.a].lowerC,rows[i].predictions[p.b].lowerC),upperC:Math.min(rows[i].predictions[p.a].upperC,rows[i].predictions[p.b].upperC)}))}:null};}
 return{work,combinations,best:describe(bestIndex),greedy:describe(greedyIndex),excludedPairSlots:candidatePairSlots-combinations.length};
}
export function planHeatPeakPairQuestion(project,query,settings){
 const single=planHeatPeakQuestion(project,query,settings),{best:singleBest,rows:queryRows,bestByChannel:singleBestByChannel,...base}=single;
 const result={...base,method:HEAT_PEAK_PAIR_METHOD,singleBest,singleBestByChannel,queryRows:queryRows??[],best:null,greedy:null,combinations:[]};
 if(!queryRows?.length)return result;
 const scored=finiteHeatPeakPairQuestion(queryRows,queryRows.indexOf(singleBest));
 const status=!scored.best?'no-feasible-pair':scored.best.worstRemainingC<singleBest.worstRemainingC?'pair-question':'no-additional-peak-reduction';
 return{...result,...scored,status,additionalReductionC:scored.best?Math.max(0,singleBest.worstRemainingC-scored.best.worstRemainingC):0,
 semantics:'Minimizes worst remaining target-peak spread over every compatible inferred model and every admitted nonadaptive two-reading query pair. The same model pair must have overlapping guarded bands at both readings. Permitted two-dimensional bands are rectangular constraints, not independent error probabilities. Same-channel closed supports must be disjoint; separately declared channels may overlap. Repeated readings do not reduce an assumed half-width. Ties retain original query order: surface before lower, earlier within each channel. No extra-reading benefit, no-family and infeasible outcomes are retained. Finite-family results do not guarantee continuous coverage, physical information gain or future acquisition.'};
}
export function serializeHeatPeakPairQuestion(project,query,settings){validateHeatPeakQuestion(project,query,settings);return JSON.stringify({method:HEAT_PEAK_PAIR_METHOD,project,query,settings},null,2);}
export function parseHeatPeakPairQuestion(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Peak-pair original source exceeds 6 MiB');
 const v=JSON.parse(text);if(!v||v.method!==HEAT_PEAK_PAIR_METHOD||Object.keys(v).sort().join(',')!=='method,project,query,settings')throw Error('Expected original peak-pair inputs and method');
 validateHeatPeakQuestion(v.project,v.query,v.settings);return v;
}

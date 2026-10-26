import {validateOriginalMeanHistory,inferMeanPeriodConstraints} from './paired-mean-history.js';
import {projectAffineHistoryResponse} from './paired-trend-response.js';
import {projectContinuousTrendOnset} from './paired-trend-onset.js';
export const UNPARTITIONED_MEAN_SCHEMA='experimental-earth-unpartitioned-means/1';
const choose2=n=>n*(n-1)/2;
/** All between-support partitions, never a selected change time or changed source role. */
export function inferUnpartitionedMeans(input,{maxPairChecks=100000,maxConstraintChecks=200000,maxVertexPairs=250000,maxHullChecks=8000000,maxRootEvaluations=32768}={}){
 validateOriginalMeanHistory(input,{partitioned:false});const source=structuredClone(input);
 for(const [name,n,max]of [['pair',maxPairChecks,100000],['constraint',maxConstraintChecks,200000],['vertex-pair',maxVertexPairs,250000],['hull',maxHullChecks,8000000],['root',maxRootEvaluations,32768]])if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('Declare bounded complete all-gap '+name+' work');
 const ordered=source.pairs.map((p,index)=>({index,start:Date.parse(p.treated.from),end:Date.parse(p.treated.to)})).sort((a,b)=>a.start-b.start||a.end-b.end||a.index-b.index),plans=[];let lastEnd=-Infinity;
 for(let cut=1;cut<ordered.length;cut++){
  lastEnd=Math.max(lastEnd,ordered[cut-1].end);const firstStart=ordered[cut].start;
  if(lastEnd<=firstStart)plans.push({earlierIndices:ordered.slice(0,cut).map(p=>p.index),laterIndices:ordered.slice(cut).map(p=>p.index),gap:{start:new Date(lastEnd).toISOString().replace('.000Z','Z'),end:new Date(firstStart).toISOString().replace('.000Z','Z'),endpointPolicy:'inclusive'}});
 }
 const pairChecks=choose2(source.pairs.length)+plans.reduce((n,p)=>n+choose2(p.earlierIndices.length)+choose2(p.laterIndices.length),0);
 if(pairChecks>maxPairChecks)throw Error('Complete all-gap pair work exceeds declared bound; no partial comparison');
 const work={pairChecks,maxPairChecks,constraintChecks:0,maxConstraintChecks,vertexPairs:0,maxVertexPairs,hullChecks:0,maxHullChecks,rootEvaluations:0,maxRootEvaluations,partitions:plans.length},clipWork={count:0,limit:maxConstraintChecks};
 const unchanged=inferMeanPeriodConstraints(source.pairs.map(p=>({...p,role:'pre'})),'pre',clipWork),partitions=[];
 for(const plan of plans){
  const indices=new Set(plan.earlierIndices),assigned=source.pairs.map((p,i)=>({...p,role:indices.has(i)?'pre':'post'})),earlier=inferMeanPeriodConstraints(assigned,'pre',clipWork),later=inferMeanPeriodConstraints(assigned,'post',clipWork);
  const common={...plan,earlier,later,referenceInstant:plan.gap.start,response:null,onset:null};
  if(!earlier.vertices.length||!later.vertices.length){partitions.push({...common,status:earlier.status==='incompatible'||later.status==='incompatible'?'period-incompatible':'insufficient-operator-support'});continue;}
  const allowance={pairChecks:0,maxPairChecks,constraintChecks:clipWork.count,maxConstraintChecks,vertexPairs:0,maxVertexPairs:maxVertexPairs-work.vertexPairs,hullChecks:0,maxHullChecks:maxHullChecks-work.hullChecks};
  const response={earlier,later,intervention:plan.gap.start,...projectAffineHistoryResponse(earlier,later,plan.gap.start,allowance,clipWork)};
  work.vertexPairs+=allowance.vertexPairs;work.hullChecks+=allowance.hullChecks;
  if(work.rootEvaluations>=maxRootEvaluations)throw Error('Complete all-gap onset work exceeds declared bound; no partial comparison');
  const {response:omitted,...onset}=projectContinuousTrendOnset(response,{maxRootEvaluations:Math.min(512,maxRootEvaluations-work.rootEvaluations)});
  clipWork.count=onset.work.constraintChecks;work.rootEvaluations+=onset.work.rootEvaluations;
  partitions.push({...common,status:'response-compatible',response,onset});
 }
 work.constraintChecks=clipWork.count;
 return{source,model:'at-most-one-change-between-complete-supports',qualification:'All admissible gaps between complete original mean supports are compared. Changes inside observation windows are not covered. Uniform-time remains a declared model, not recovered source weighting. No partition, line or causal change is selected.',unchanged,unchangedSupported:unchanged.status!=='incompatible',unchangedBounded:unchanged.vertices.length>0,partitions,work,status:partitions.some(p=>p.onset?.branches.length)?'continuous-change-supported':partitions.some(p=>p.status==='response-compatible')?'separate-histories-supported':partitions.some(p=>p.status==='insufficient-operator-support')?'unbounded-change-alternatives':unchanged.status!=='incompatible'?'unchanged-supported':'no-supported-history'};
}

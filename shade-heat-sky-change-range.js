import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {findMinimumSkyChanges,verifyMinimumSkyChangeResult,projectOriginalSkyPattern,SKY_CHANGE_PATTERN_LIMITS} from './shade-heat-sky-change-patterns.js';
import {solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate} from './shade-heat-exact-linear.js';
const ZERO=q(0),ONE=q(1);
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const fraction=v=>dense(v,2)&&typeof v[0]==='bigint'&&typeof v[1]==='bigint'&&v[1]>0n&&(v[0]<0n?-v[0]:v[0]).toString(2).length<=4096&&v[1].toString(2).length<=4096;
const keys=(v,names)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const checked=v=>{if(!fraction(v))throw Error('A sky-consequence fraction exceeds its exact allowance');return v;};
const plus=(a,b)=>checked(add(a,b)),minus=(a,b)=>checked(sub(a,b)),times=(a,b)=>checked(mul(a,b));
const dot=(a,b)=>a.reduce((s,v,i)=>plus(s,times(v,b[i])),ZERO);
const equal=(a,b)=>fraction(a)&&fraction(b)&&cmp(a,b)===0;
const vectors=(a,b)=>dense(a,b.length)&&a.every((v,i)=>equal(v,b[i]));
const integers=(a,b)=>dense(a,b.length)&&a.every((v,i)=>v===b[i]);
function admit(targets,n){
 if(!keys(targets,['lower','upper']))throw Error('Retain both original represented consequence endpoints');
 for(const row of Object.values(targets))if(!keys(row,['constant','coefficients'])||!fraction(row.constant)||!dense(row.coefficients,n)||!row.coefficients.every(v=>dense(v,3)&&v.every(fraction)))
  throw Error('Each target endpoint needs one exact constant and three coefficients per original interval');
}
function project(row,splits){
 const edges=[0,...splits,row.coefficients.length];
 return{constant:row.constant,coefficients:edges.slice(1).flatMap((end,p)=>[0,1,2].map(bin=>{let value=ZERO;for(let i=edges[p];i<end;i++)value=plus(value,row.coefficients[i][bin]);return value;}))};
}
function witness(model,point,bands){
 const phaseProfiles=Array.from({length:model.phases},(_,phase)=>{
  const rest=point.slice(phase*3,phase*3+3),profile=[minus(ONE,rest.reduce(plus,ZERO)),...rest];
  if(profile.some(v=>v[0]<0n)||cmp(profile.reduce(plus,ZERO),ONE))throw Error('An extreme profile lost normalized mass');return profile;
 });
 if(phaseProfiles.some((p,i)=>i&&vectors(p,phaseProfiles[i-1])))throw Error('An extreme profile contradicts lower-change incompatibility');
 const productMasses=Array.from({length:4**model.phases},(_,index)=>phaseProfiles.reduce((v,p,i)=>times(v,p[Math.floor(index/4**(model.phases-i-1))%4]),ONE));
 if(cmp(productMasses.reduce(plus,ZERO),ONE))throw Error('Extreme profile products lost unit mass');
 const observedC=model.projected.map(row=>plus(row.constant,dot(row.coefficients,point)));
 if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('An extreme profile lost an original band');
 return{phaseProfiles,productMasses,observedC};
}
function sameWitness(a,b){
 if(!a||!dense(a.phaseProfiles,b.phaseProfiles.length)||!a.phaseProfiles.every((p,i)=>vectors(p,b.phaseProfiles[i]))||!vectors(a.productMasses,b.productMasses)||!vectors(a.observedC,b.observedC))
  throw Error('An extreme witness lost its common profiles, products or original observations');
}
const initial=analysis=>({solves:analysis.work.solves,objectiveSolves:0,objectives:0,pivots:analysis.work.pivots,rationalOperations:analysis.work.rationalOperations,verifiedCertificates:analysis.work.verifiedCertificates});
function accumulate(total,w){total.solves++;total.objectiveSolves++;total.objectives+=3;total.pivots+=w.pivots;total.rationalOperations+=w.rationalOperations;total.verifiedCertificates+=w.verifiedCertificates;}
function hull(ranges){
 if(!ranges.length)return{lower:null,upper:null,lowerPatternIndices:[],upperPatternIndices:[]};
 let lower=ranges[0].lower.value,upper=ranges[0].upper.value;
 for(const row of ranges){if(cmp(row.lower.value,lower)<0)lower=row.lower.value;if(cmp(row.upper.value,upper)>0)upper=row.upper.value;}
 return{lower,upper,lowerPatternIndices:ranges.filter(r=>cmp(r.lower.value,lower)===0).map(r=>r.patternIndex),upperPatternIndices:ranges.filter(r=>cmp(r.upper.value,upper)===0).map(r=>r.patternIndex)};
}
function union(ranges){
 const sorted=ranges.map(r=>({lower:r.lower.value,upper:r.upper.value,patternIndex:r.patternIndex})).sort((a,b)=>cmp(a.lower,b.lower)||cmp(a.upper,b.upper)||a.patternIndex-b.patternIndex);
 const components=[];
 for(const row of sorted){
  const last=components.at(-1);
  if(!last||cmp(row.lower,last.upper)>0)components.push({lower:row.lower,upper:row.upper,patternIndices:[row.patternIndex]});
  else{if(cmp(row.upper,last.upper)>0)last.upper=row.upper;last.patternIndices.push(row.patternIndex);}
 }
 for(const c of components)c.patternIndices.sort((a,b)=>a-b);
 return{components,gaps:components.slice(1).map((c,i)=>({after:components[i].upper,before:c.lower,boundary:'open'}))};
}
function sameUnion(actual,expected){
 if(!dense(actual.components,expected.components.length)||!actual.components.every((c,i)=>equal(c.lower,expected.components[i].lower)&&equal(c.upper,expected.components[i].upper)&&integers(c.patternIndices,expected.components[i].patternIndices))
  ||!dense(actual.gaps,expected.gaps.length)||!actual.gaps.every((g,i)=>equal(g.after,expected.gaps[i].after)&&equal(g.before,expected.gaps[i].before)&&g.boundary==='open'))
  throw Error('A represented interval component, open gap or contributing pattern was changed');
}

// Fresh original coefficient rows. Search, both extrema and the separate
// pointwise endpoint-order proof share one cumulative allowance. No partial
// minimum class or preferred-profile sample can replace this complete union.
export function rangeMinimumSkyChanges(observed,bands,targets,options={}){
 admit(targets,observed?.[0]?.coefficients?.length);
 const analysis=findMinimumSkyChanges(observed,bands,options),work=initial(analysis),ranges=[];
 for(const [patternIndex,item]of analysis.cases.entries())if(item.status==='feasible'){
  const model=projectOriginalSkyPattern(observed,bands,item.splits),lower=project(targets.lower,item.splits),upper=project(targets.upper,item.splits);
  const order=lower.coefficients.map((v,i)=>minus(v,upper.coefficients[i]));
  const objectives=[lower.coefficients.map(neg),upper.coefficients,order];
  const solved=solveThreeEpochLinearObjectives(model.rows,model.bounds,objectives,{
   maxPivots:Math.min(SKY_CHANGE_PATTERN_LIMITS.pivotsPerSolve,analysis.limits.pivots-work.pivots),
   maxRationalOperations:Math.min(SKY_CHANGE_PATTERN_LIMITS.rationalOperationsPerSolve,analysis.limits.rationalOperations-work.rationalOperations)});
  if(solved.status!=='feasible'||solved.results.length!==3||solved.results.some(c=>c.status!=='optimal'))throw Error('Every compatible normalized pattern needs all three bounded optimality proofs');
  accumulate(work,solved.work);
  const maximumDifference=plus(minus(lower.constant,upper.constant),solved.results[2].value);
  if(maximumDifference[0]>0n)throw Error('Represented lower/upper endpoints are not ordered at every compatible profile');
  const endpoints=solved.results.slice(0,2).map((certificate,i)=>({value:i?plus(upper.constant,certificate.value):minus(lower.constant,certificate.value),certificate,witness:witness(model,certificate.point,bands)}));
  if(cmp(endpoints[0].value,endpoints[1].value)>0)throw Error('Represented consequence extrema are reversed');
  ranges.push({patternIndex,splits:[...item.splits],targetProjection:{lower,upper},feasibilityCertificate:solved.certificate,lower:endpoints[0],upper:endpoints[1],
   endpointOrder:{maximumDifference,certificate:solved.results[2]},work:solved.work});
 }
 const result={status:analysis.status,analysis,targetRows:structuredClone(targets),ranges,...hull(ranges),...union(ranges),work};
 verifyMinimumSkyChangeRange(observed,bands,targets,result);return result;
}

// Each original A,b,c primal/dual certificate is checked separately. The
// represented interval union preserves gaps; its hull is not proof that every
// interior value is attained. Component IDs do not give every contributing
// pattern every value in that component. No physical realizability is implied.
export function verifyMinimumSkyChangeRange(observed,bands,targets,result){
 admit(targets,observed?.[0]?.coefficients?.length);
 if(!result||typeof result!=='object')throw Error('A complete sky-consequence result is required');
 verifyMinimumSkyChangeResult(observed,bands,result.analysis);
 if(result.status!==result.analysis.status)throw Error('Minimum-class compatibility was changed');
 for(const side of ['lower','upper']){
  const expected=targets[side],actual=result.targetRows?.[side];
  if(!actual||!equal(actual.constant,expected.constant)||!dense(actual.coefficients,expected.coefficients.length)||!actual.coefficients.every((r,i)=>vectors(r,expected.coefficients[i])))throw Error('Original target interval rows were changed');
 }
 const feasible=result.analysis.cases.map((item,patternIndex)=>({item,patternIndex})).filter(v=>v.item.status==='feasible');
 if(!dense(result.ranges,feasible.length))throw Error('Every compatible minimum pattern needs its complete consequence proofs');
 const work=initial(result.analysis);
 for(const [{item,patternIndex},range]of feasible.map((v,i)=>[v,result.ranges[i]])){
  const model=projectOriginalSkyPattern(observed,bands,item.splits);
  if(!range||range.patternIndex!==patternIndex||!integers(range.splits,item.splits))throw Error('Original pattern order was changed');
  verifyThreeEpochLinearCertificate(model.rows,model.bounds,null,range.feasibilityCertificate);
  if(range.feasibilityCertificate.status!=='feasible')throw Error('A compatible pattern lost its feasibility proof');
  const rows={};
  for(const side of ['lower','upper']){
   const expected=project(targets[side],item.splits),actual=range.targetProjection?.[side],endpoint=range[side];rows[side]=expected;
   if(!actual||!equal(actual.constant,expected.constant)||!vectors(actual.coefficients,expected.coefficients))throw Error('A target projection was changed');
   const objective=side==='lower'?expected.coefficients.map(neg):expected.coefficients;
   if(endpoint?.certificate?.status!=='optimal')throw Error('Each endpoint requires its exact optimality proof');
   verifyThreeEpochLinearCertificate(model.rows,model.bounds,objective,endpoint.certificate);
   const value=side==='lower'?minus(expected.constant,endpoint.certificate.value):plus(expected.constant,endpoint.certificate.value);
   if(!equal(endpoint.value,value))throw Error('An endpoint lost its exact objective constant');
   sameWitness(endpoint.witness,witness(model,endpoint.certificate.point,bands));
  }
  const objective=rows.lower.coefficients.map((v,i)=>minus(v,rows.upper.coefficients[i])),order=range.endpointOrder;
  if(order?.certificate?.status!=='optimal')throw Error('Pointwise endpoint order needs a separate exact optimality proof');
  verifyThreeEpochLinearCertificate(model.rows,model.bounds,objective,order.certificate);
  const maximum=plus(minus(rows.lower.constant,rows.upper.constant),order.certificate.value);
  if(maximum[0]>0n||!equal(order.maximumDifference,maximum))throw Error('Represented endpoints are not ordered everywhere in the original compatible polytope');
  if(cmp(range.lower.value,range.upper.value)>0)throw Error('Pattern consequence extrema are reversed');
  const w=range.work;
  if(!w||!Number.isInteger(w.pivots)||w.pivots<0||w.pivots>2048||!Number.isInteger(w.rationalOperations)||w.rationalOperations<0||w.rationalOperations>4000000
   ||w.variables!==model.variables||w.constraints!==model.rows.length||w.objectives!==3||w.verifiedCertificates!==4)throw Error('A complete bounded three-objective solve is required');
  accumulate(work,w);
 }
 const expected=hull(result.ranges);
 if((expected.lower===null?result.lower!==null:!equal(result.lower,expected.lower))||(expected.upper===null?result.upper!==null:!equal(result.upper,expected.upper))
  ||!integers(result.lowerPatternIndices,expected.lowerPatternIndices)||!integers(result.upperPatternIndices,expected.upperPatternIndices))throw Error('A global extremum or tied attaining pattern was omitted');
 sameUnion(result,union(result.ranges));
 if(!keys(result.work,Object.keys(work))||Object.keys(work).some(k=>result.work[k]!==work[k])||work.pivots>result.analysis.limits.pivots||work.rationalOperations>result.analysis.limits.rationalOperations)
  throw Error('Inference and all consequence proofs must share one cumulative allowance');
 return true;
}

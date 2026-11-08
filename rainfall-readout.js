import {estimateRainfallJointRegionWork,inspectRainfallJointRegion} from './rainfall-joint-region.js';
import {Q,need,from,add,sub,cmp,encode} from './rainfall-constraint-core.js';

const LIMITS=Object.freeze({originalBytes:4194304,queryBytes:4096,totalWork:350000,maxCutpoints:5,maxAtoms:10,persistentBits:8192,intermediateBits:16384});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function prepare(originalText,outcomeQueryText){
 need(typeof outcomeQueryText==='string'&&outcomeQueryText.length>0&&!outcomeQueryText.startsWith('\uFEFF'),'Supply a nonempty exact UTF-8 readout query without BOM.');
 const bytes=new TextEncoder().encode(outcomeQueryText);
 need(bytes.length<=LIMITS.queryBytes&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===outcomeQueryText,'Readout query exceeds its byte limit or contains a lone surrogate.');
 const query=JSON.parse(outcomeQueryText),pending=[query];
 while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),'Readout query contains a non-finite number.');else if(v!==null&&typeof v==='object')for(const child of Object.values(v))pending.push(child);}
 need(exact(query,['schema','eventRef','startMinute','splitMinute','endMinute','uncertaintyMm','thresholdMm','source'])&&query.schema==='experimental-earth-rainfall-readout-query/1','Supply one original rainfall readout query.');
 need([query.uncertaintyMm,query.thresholdMm].every(v=>Number.isFinite(v)&&v>=0),'Readout uncertainty and threshold require finite nonnegative normalized-mm values.');
 const jointQueryText=JSON.stringify({schema:'experimental-earth-rainfall-joint-region-query/1',eventRef:query.eventRef,startMinute:query.startMinute,splitMinute:query.splitMinute,endMinute:query.endMinute,source:query.source});
 const jointRegion=estimateRainfallJointRegionWork(originalText,jointQueryText);
 const additionalPreflightWork=2048,symbolicWork=2048,additionalWork=4096,totalWork=jointRegion.totalWork+additionalWork;
 need([jointRegion.totalWork,additionalPreflightWork,symbolicWork,additionalWork,totalWork].every(v=>Number.isSafeInteger(v)&&v>=0)&&totalWork<=LIMITS.totalWork,'Complete readout work exceeds its reservation limit.');
 return {query,jointQueryText,uncertainty:from(query.uncertaintyMm),threshold:from(query.thresholdMm),work:{jointRegion,additionalPreflightWork,symbolicWork,additionalWork,totalWork,limits:{...LIMITS}}};
}
export function estimateRainfallReadoutWork(originalText,outcomeQueryText){return prepare(originalText,outcomeQueryText).work;}

// This decoder is used only on the fresh internal joint report, never external cached data.
function decode(value){
 need(exact(value,['numerator','denominator'])&&typeof value.numerator==='string'&&typeof value.denominator==='string','Invalid internal exact bound.');
 need(value.numerator.length<=2468&&value.denominator.length<=2467&&/^-?\d+$/.test(value.numerator)&&/^\d+$/.test(value.denominator),'Internal bound exceeds its exact representation budget.');
 const q=add({n:BigInt(value.numerator),d:BigInt(value.denominator)},Q.zero),canonical=encode(q);
 need(canonical.numerator===value.numerator&&canonical.denominator===value.denominator,'Internal bound is not canonical.');
 return q;
}
function boundsFrom(joint){
 const assessment=joint.assessment,slots=assessment.region.inequalities,m=assessment.markedVertices;
 const specs=[['early-lower',[-1,0],m.split,m.start],['early-upper',[1,0],m.start,m.split],['late-lower',[0,-1],m.end,m.split],['late-upper',[0,1],m.split,m.end],['whole-lower',[-1,-1],m.end,m.start],['whole-upper',[1,1],m.start,m.end]];
 need(Array.isArray(slots)&&slots.length===6,'Fresh joint region must retain six bound identities.');
 const rhs=slots.map((s,i)=>{
  const [id,coefficients,a,b]=specs[i];
  need(s.id===id&&Array.isArray(s.coefficients)&&s.coefficients.length===2&&s.coefficients.every((v,j)=>v===coefficients[j])&&s.from===a&&s.to===b,'Fresh joint bound identity mismatch.');
  if(s.status==='unbounded'){need(i%2===1&&s.rhsMm===null&&s.path===null,'Invalid unbounded joint slot.');return null;}
  need(s.status==='finite'&&s.path!==null&&typeof s.path==='object','Invalid finite joint slot.');
  const q=decode(s.rhsMm);need(cmp(q,decode(s.path.sumMm))===0n,'Fresh joint path sum differs from bound.');return q;
 });
 const [Lx,Ux,Ly,Uy,Ls,Us]=[sub(Q.zero,rhs[0]),rhs[1],sub(Q.zero,rhs[2]),rhs[3],sub(Q.zero,rhs[4]),rhs[5]];
 need([Lx,Ly,Ls].every(v=>cmp(v,Q.zero)>=0n)&&(Ux===null||cmp(Lx,Ux)<=0n)&&(Uy===null||cmp(Ly,Uy)<=0n)&&(Us===null||cmp(Ls,Us)<=0n),'Fresh marginal bounds are invalid.');
 return {Lx,Ux,Ly,Uy,Ls,Us};
}

// Evaluate a predicate on an entire symbolic atom; never choose a representative point.
function predicate(atom,relation,k){
 const left=cmp(atom.lower,k);
 if(atom.kind==='point')return relation==='lt'?left<0n:relation==='ge'?left>=0n:left<=0n;
 const right=atom.upper===null?null:cmp(atom.upper,k);
 if(relation==='lt'){
  if(right!==null&&right<=0n)return true;
  if(left>=0n)return false;
 }else if(relation==='ge'){
  if(left>=0n)return true;
  if(right!==null&&right<=0n)return false;
 }else{
  if(right!==null&&right<=0n)return true;
  if(left>=0n)return false;
 }
 throw Error('A readout predicate crosses an open atom; no partial partition is returned.');
}
function classify(joint,u,T){
 const {Lx,Ux,Ly,Uy,Ls,Us}=boundsFrom(joint),rawLower=sub(Lx,u),supportLower=cmp(rawLower,Q.zero)>0n?rawLower:Q.zero,supportUpper=Ux===null?null:add(Ux,u);
 const A=sub(sub(Ls,T),u),B=Us===null?null:add(sub(Us,T),u),cuts=[];
 for(const cut of [Q.zero,supportLower,supportUpper,A,B])if(cut!==null&&cmp(cut,Q.zero)>=0n&&!cuts.some(q=>cmp(q,cut)===0n))cuts.push(cut);
 cuts.sort((a,b)=>{const c=cmp(a,b);return c<0n?-1:c>0n?1:0;});
 need(cuts.length>=1&&cuts.length<=LIMITS.maxCutpoints&&cmp(cuts[0],Q.zero)===0n,'Readout cutpoint invariant failed.');
 const rawAtoms=[];
 for(let i=0;i<cuts.length;i++){
  rawAtoms.push({kind:'point',lower:cuts[i],upper:cuts[i]});
  rawAtoms.push({kind:'open',lower:cuts[i],upper:i+1<cuts.length?cuts[i+1]:null});
 }
 need(rawAtoms.length<=LIMITS.maxAtoms,'Readout atom reservation exceeded.');
 const globalMeet=Uy!==null&&cmp(Uy,T)<=0n,globalMiss=cmp(Ly,T)>0n;
 const atoms=rawAtoms.map(atom=>{
  const supported=predicate(atom,'ge',supportLower)&&(supportUpper===null||predicate(atom,'le',supportUpper));
  let classification='outside-support';
  if(supported){
   const meet=globalMeet||(B!==null&&predicate(atom,'ge',B)),miss=globalMiss||predicate(atom,'lt',A);
   need(!(meet&&miss),'Contradictory threshold predicates on a compatible atom.');
   classification=meet?'certain-meet':miss?'certain-miss':'ambiguous';
  }
  return {kind:atom.kind,lowerMm:encode(atom.lower),upperMm:atom.upper===null?null:encode(atom.upper),lowerInclusive:atom.kind==='point',upperInclusive:atom.kind==='point',classification};
 });
 const classes=new Set(atoms.map(a=>a.classification)),hasCompatibleReadouts=atoms.some(a=>a.classification!=='outside-support'),hasCertainMeet=classes.has('certain-meet'),hasCertainMiss=classes.has('certain-miss'),hasAmbiguous=classes.has('ambiguous');
 const originalBothThresholdClasses=cmp(Ly,T)<=0n&&(Uy===null||cmp(Uy,T)>0n),positiveErrorAmbiguityRequired=cmp(u,Q.zero)>0n&&originalBothThresholdClasses;
 need(hasCompatibleReadouts,'A feasible joint region has no compatible readout.');
 need(!positiveErrorAmbiguityRequired||hasAmbiguous,'Continuous positive-error ambiguity invariant failed.');
 return {cutpoints:cuts.map(encode),atoms,summary:{hasCompatibleReadouts,hasCertainMeet,hasCertainMiss,hasAmbiguous,allCompatibleReadoutsResolve:hasCompatibleReadouts&&!hasAmbiguous,originalBothThresholdClasses,positiveErrorAmbiguityRequired}};
}
export function inspectRainfallReadout(originalText,outcomeQueryText){
 const p=prepare(originalText,outcomeQueryText),jointRegion=inspectRainfallJointRegion(originalText,p.jointQueryText);
 need(jointRegion.schema==='experimental-earth-rainfall-joint-region/1','Unexpected fresh joint report schema.');
 const inconsistent=jointRegion.assessment.status==='original-calibration-inconsistent';
 need(inconsistent||jointRegion.assessment.status==='joint-region-feasible','Unexpected fresh joint assessment status.');
 const partition=inconsistent?{cutpoints:[],atoms:[],summary:null}:classify(jointRegion,p.uncertainty,p.threshold);
 return {schema:'experimental-earth-rainfall-readout/1',query:p.query,
  scope:{readoutDomain:'nonnegative-continuous-real-mm',errorModel:'closed-symmetric-absolute',decision:'late-total-at-most-threshold',physicalInference:false},work:p.work,jointRegion,
  assessment:{status:inconsistent?'original-calibration-inconsistent':'classified-readouts',parameters:{uncertaintyMm:encode(p.uncertainty),thresholdMm:encode(p.threshold)},...partition},
  meaning:'Prospective mathematical readout classifications under original nominal calibration and a declared symmetric error, not probabilities, expected costs, instrument operation, data acquisition or physical intervention consequences. The complete original joint report and its limitations remain authoritative. Readouts range over all nonnegative real normalized-mm values without a rainfall ceiling or binary64-only grid; error and threshold parameters retain their exact represented binary64 values. Some compatible outcome must remain ambiguous with positive error when the convex continuous region contains both threshold classes. This does not mean every outcome is ambiguous and does not extend to disconnected finite candidate families, restricted readout grids or zero error. Additional work reserves scientific preflight and symbolic traversals, excluding parsing, general validation, cloning, serialization and bit costs; it is not a CPU, memory or wall-time guarantee.'};
}

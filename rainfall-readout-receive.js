import {estimateRainfallReadoutWork,inspectRainfallReadout} from './rainfall-readout.js';
import {Q,need,from,add,sub,cmp,encode} from './rainfall-constraint-core.js';
const LIMITS=Object.freeze({originalBytes:4194304,planQueryBytes:4096,readingBytes:4096,totalWork:350000,maxCutpoints:5,maxAtoms:10,maxDecodedRationals:17,persistentBits:8192,intermediateBits:16384});
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const maximum=(a,b)=>cmp(a,b)>=0n?a:b,minimum=(a,b)=>cmp(a,b)<=0n?a:b;
function prepare(originalText,planQueryText,readingText){
 need(typeof readingText==='string'&&readingText.length>0&&!readingText.startsWith('\uFEFF'),'Supply a nonempty exact UTF-8 declared reading without BOM.');
 const bytes=new TextEncoder().encode(readingText);
 need(bytes.length<=LIMITS.readingBytes&&new TextDecoder('utf-8',{fatal:true}).decode(bytes)===readingText,'Declared reading exceeds its byte limit or contains a lone surrogate.');
 const reading=JSON.parse(readingText),pending=[reading];
 while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),'Declared reading contains a non-finite number.');else if(v!==null&&typeof v==='object')for(const child of Object.values(v))pending.push(child);}
 need(exact(reading,['schema','id','eventRef','startMinute','endMinute','valueMm','uncertaintyMm','source'])&&reading.schema==='experimental-earth-rainfall-readout-reading/1','Supply one original declared rainfall readout.');
 const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=600;
 need([reading.id,reading.eventRef,reading.source].every(text),'Declared reading requires bounded nonblank identity, event and source.');
 need([reading.startMinute,reading.endMinute,reading.valueMm,reading.uncertaintyMm].every(v=>Number.isFinite(v)&&v>=0)&&reading.startMinute<reading.endMinute,'Declared reading requires ordered finite times and nonnegative finite normalized-mm value and uncertainty.');
 const planning=estimateRainfallReadoutWork(originalText,planQueryText),query=JSON.parse(planQueryText);
 need(reading.eventRef===query.eventRef&&reading.startMinute===query.startMinute&&reading.endMinute===query.splitMinute,'Declared reading event and interval must match the planned early interval.');
 const additionalPreflightWork=2048,symbolicWork=4096,additionalWork=6144,totalWork=planning.totalWork+additionalWork;
 need([planning.totalWork,additionalPreflightWork,symbolicWork,additionalWork,totalWork].every(v=>Number.isSafeInteger(v)&&v>=0)&&totalWork<=LIMITS.totalWork,'Complete received-readout work exceeds its reservation limit.');
 return {reading,z:from(reading.valueMm),u:from(reading.uncertaintyMm),plannedU:from(query.uncertaintyMm),T:from(query.thresholdMm),work:{planning,additionalPreflightWork,symbolicWork,additionalWork,totalWork,limits:{...LIMITS}}};
}
export function estimateReceivedRainfallReadoutWork(originalText,planQueryText,readingText){return prepare(originalText,planQueryText,readingText).work;}
// Only fresh internal reports reach this decoder. Count all decodes in this module.
function decoder(){let count=0;return value=>{
 need(++count<=LIMITS.maxDecodedRationals,'Received-readout decode reservation exceeded.');
 need(exact(value,['numerator','denominator'])&&typeof value.numerator==='string'&&typeof value.denominator==='string','Invalid fresh exact value.');
 need(value.numerator.length<=2468&&value.denominator.length<=2467&&/^-?\d+$/.test(value.numerator)&&/^\d+$/.test(value.denominator),'Fresh exact value exceeds representation budget.');
 const q=add({n:BigInt(value.numerator),d:BigInt(value.denominator)},Q.zero),canonical=encode(q);
 need(canonical.numerator===value.numerator&&canonical.denominator===value.denominator,'Fresh exact value is not canonical.');return q;
 };}
const sameEncoding=(a,b)=>exact(a,['numerator','denominator'])&&a.numerator===b.numerator&&a.denominator===b.denominator;
function locate(report,z,decode){
 const {cutpoints,atoms}=report.assessment;
 need(Array.isArray(cutpoints)&&cutpoints.length>=1&&cutpoints.length<=LIMITS.maxCutpoints&&Array.isArray(atoms)&&atoms.length===2*cutpoints.length&&atoms.length<=LIMITS.maxAtoms,'Fresh partition exceeds reservation.');
 const cuts=cutpoints.map(decode);need(cmp(cuts[0],Q.zero)===0n,'Fresh partition must start at zero.');
 for(let i=1;i<cuts.length;i++)need(cmp(cuts[i-1],cuts[i])<0n,'Fresh partition cuts must strictly increase.');
 let match=null;
 for(let i=0;i<atoms.length;i++){
  const atom=atoms[i],j=Math.floor(i/2),point=i%2===0,last=j+1===cuts.length;
  need(atom.kind===(point?'point':'open')&&atom.lowerInclusive===point&&atom.upperInclusive===point&&sameEncoding(atom.lowerMm,cutpoints[j])&&(point?sameEncoding(atom.upperMm,cutpoints[j]):last?atom.upperMm===null:sameEncoding(atom.upperMm,cutpoints[j+1])),'Fresh indexed atom identity mismatch.');
  need(['outside-support','certain-meet','certain-miss','ambiguous'].includes(atom.classification),'Unknown fresh atom classification.');
  const left=cmp(z,cuts[j]),inside=point?left===0n:left>0n&&(last||cmp(z,cuts[j+1])<0n);
  if(inside){need(match===null,'Fresh partition matches multiple atoms.');match={index:i,atom};}
 }
 need(match!==null,'Fresh partition does not contain declared value.');return match;
}
function bounds(report,decode){
 const a=report.jointRegion.assessment,m=a.markedVertices,slots=a.region.inequalities;
 const specs=[['early-lower',[-1,0],m.split,m.start],['early-upper',[1,0],m.start,m.split],['late-lower',[0,-1],m.end,m.split],['late-upper',[0,1],m.split,m.end],['whole-lower',[-1,-1],m.end,m.start],['whole-upper',[1,1],m.start,m.end]];
 need(Array.isArray(slots)&&slots.length===6,'Fresh joint report must retain six inequalities.');
 const rhs=slots.map((s,i)=>{const [id,c,f,t]=specs[i];
  need(s.id===id&&Array.isArray(s.coefficients)&&s.coefficients.length===2&&s.coefficients.every((v,j)=>v===c[j])&&s.from===f&&s.to===t,'Fresh joint inequality identity mismatch.');
  if(s.status==='unbounded'){need(i%2===1&&s.rhsMm===null&&s.path===null,'Invalid unbounded fresh inequality.');return null;}
  need(s.status==='finite'&&s.path!==null&&typeof s.path==='object','Invalid finite fresh inequality.');const q=decode(s.rhsMm);need(cmp(q,decode(s.path.sumMm))===0n,'Fresh bound and path sum differ.');return q;
 });
 const [Lx,Ux,Ly,Uy,Ls,Us]=[sub(Q.zero,rhs[0]),rhs[1],sub(Q.zero,rhs[2]),rhs[3],sub(Q.zero,rhs[4]),rhs[5]];
 need([Lx,Ly,Ls].every(v=>cmp(v,Q.zero)>=0n)&&(Ux===null||cmp(Lx,Ux)<=0n)&&(Uy===null||cmp(Ly,Uy)<=0n)&&(Us===null||cmp(Ls,Us)<=0n),'Invalid fresh marginal bounds.');
 return {Lx,Ux,Ly,Uy,Ls,Us,rhs};
}
function verifyPoint(x,y,rhs,homogeneous=false){
 need(cmp(x,Q.zero)>=0n&&cmp(y,Q.zero)>=0n,'Negative joint point.');
 const sum=add(x,y),values=[sub(Q.zero,x),x,sub(Q.zero,y),y,sub(Q.zero,sum),sum];
 for(let i=0;i<6;i++)if(rhs[i]!==null)need(cmp(values[i],homogeneous?Q.zero:rhs[i])<=0n,'Declared slice witness violates joint inequality.');
}
function actualSlice(p,b){
 const bandLower=maximum(Q.zero,sub(p.z,p.u)),bandUpper=add(p.z,p.u),lo=maximum(b.Lx,bandLower),hi=b.Ux===null?bandUpper:minimum(b.Ux,bandUpper),empty=cmp(lo,hi)>0n;
 const earlyIntersection={lowerMm:encode(lo),upperMm:encode(hi),empty};
 if(empty)return {classification:'outside-support',earlyIntersection,lateBounds:null,lowerWitness:null,upperWitness:null,unboundedDirection:null};
 const lower=maximum(b.Ly,sub(b.Ls,hi)),upper=b.Uy===null?(b.Us===null?null:sub(b.Us,lo)):(b.Us===null?b.Uy:minimum(b.Uy,sub(b.Us,lo)));
 need(upper===null||cmp(lower,upper)<=0n,'Compatible slice has inverted late bounds.');
 const witness=y=>{const x=maximum(lo,sub(b.Ls,y));verifyPoint(x,y,b.rhs);
  need(cmp(x,lo)>=0n&&cmp(x,hi)<=0n&&cmp(x,bandLower)>=0n&&cmp(x,bandUpper)<=0n,'Joint witness violates declared early band.');
  return {xMm:encode(x),yMm:encode(y),withinDeclaredBand:true,withinJointRegion:true};};
 const lowerWitness=witness(lower),upperWitness=upper===null?null:witness(upper);let unboundedDirection=null;
 if(upper===null){need(b.Uy===null&&b.Us===null,'Unbounded slice has an upper constraint.');const x=Q.zero,y=from(1);verifyPoint(x,y,b.rhs,true);need(cmp(x,Q.zero)===0n,'Unbounded direction changes declared early total.');unboundedDirection={xIncrementMm:encode(x),yIncrementMm:encode(y),withinHomogeneousRegion:true,preservesDeclaredBand:true};}
 const classification=upper!==null&&cmp(upper,p.T)<=0n?'certain-meet':cmp(lower,p.T)>0n?'certain-miss':'ambiguous';
 return {classification,earlyIntersection,lateBounds:{lowerMm:encode(lower),upperMm:upper===null?null:encode(upper),lowerInclusive:true,upperInclusive:upper!==null},lowerWitness,upperWitness,unboundedDirection};
}
export function inspectReceivedRainfallReadout(originalText,planQueryText,readingText){
 const p=prepare(originalText,planQueryText,readingText),planningReport=inspectRainfallReadout(originalText,planQueryText);
 need(planningReport.schema==='experimental-earth-rainfall-readout/1','Unexpected fresh planning report.');
 const inconsistent=planningReport.assessment.status==='original-calibration-inconsistent';need(inconsistent||planningReport.assessment.status==='classified-readouts','Unexpected fresh planning status.');
 const comparison=cmp(p.u,p.plannedU),uncertaintyComparison=comparison<0n?'less':comparison>0n?'greater':'equal';
 let plannedAtom=null,actual=null,classificationChanged=null,sameErrorClassificationVerified=null;
 if(!inconsistent){const decode=decoder();plannedAtom=locate(planningReport,p.z,decode);actual=actualSlice(p,bounds(planningReport,decode));classificationChanged=actual.classification!==plannedAtom.atom.classification;
  if(comparison===0n){need(!classificationChanged,'Equal-error planned and actual classifications disagree.');sameErrorClassificationVerified=true;}}
 return {schema:'experimental-earth-rainfall-readout-receive/1',declaredReading:p.reading,
  scope:{interpretation:'mathematical-declared-readout',includedRoles:['calibration'],originalRolesUnchanged:true,physicalValidation:false,chronologyValidation:false,physicalInference:false},work:p.work,planningReport,
  assessment:{status:inconsistent?'original-calibration-inconsistent':actual.earlyIntersection.empty?'declared-readout-incompatible':'declared-readout-compatible',parameters:{valueMm:encode(p.z),plannedUncertaintyMm:encode(p.plannedU),actualUncertaintyMm:encode(p.u),thresholdMm:encode(p.T)},plannedAtom,uncertaintyComparison,actual,classificationChanged,sameErrorClassificationVerified},
  meaning:'Mathematical evaluation of one declaration at its own uncertainty, compared with the same value under planned uncertainty. Input syntax, file identity and event/support declarations do not verify instrument precision, acquisition authenticity, independence, timing or physical consequences. Original evidence roles remain unchanged. Endpoint points and the optional homogeneous direction are checked in the exact joint projection; no new full rainfall-history certificate is generated. The complete fresh planning report and its original calibration limitations remain authoritative. This is not a posterior, probability, deadline/readiness/stop action or finite-family inference. Additional work reserves scientific preflight and constant-size symbolic traversals, excluding parsing, general validation, cloning, serialization, string-character and rational-bit costs; it is not a CPU, memory or wall-time guarantee.'};
}

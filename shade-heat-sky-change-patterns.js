import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate} from './shade-heat-exact-linear.js';

const ZERO=q(0),ONE=q(1);
export const SKY_CHANGE_PATTERN_LIMITS=Object.freeze({intervals:24,readings:24,changes:2,
  patterns:277,coordinates:9,constraints:51,pivots:8192,rationalOperations:24000000,
  pivotsPerSolve:2048,rationalOperationsPerSolve:4000000,fractionBits:4096});
const dense=(value,length)=>Array.isArray(value)&&value.length===length
  &&Array.from({length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);
const fraction=value=>dense(value,2)&&typeof value[0]==='bigint'&&typeof value[1]==='bigint'
  &&value[1]>0n&&(value[0]<0n?-value[0]:value[0]).toString(2).length<=4096&&value[1].toString(2).length<=4096;
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const checked=value=>{if(!fraction(value))throw Error('A projected sky-pattern fraction exceeds its exact allowance');return value;};
const plus=(a,b)=>checked(add(a,b));
const minus=(a,b)=>checked(sub(a,b));
const times=(a,b)=>checked(mul(a,b));
const sameFraction=(a,b)=>fraction(a)&&fraction(b)&&cmp(a,b)===0;
const sameFractions=(a,b)=>dense(a,b.length)&&a.every((v,i)=>sameFraction(v,b[i]));
const dot=(a,b)=>a.reduce((sum,v,i)=>plus(sum,times(v,b[i])),ZERO);

export function originalSkyChangePatterns(intervals,maximumChanges=2){
  if(!Number.isInteger(intervals)||intervals<2||intervals>24
      ||!Number.isInteger(maximumChanges)||maximumChanges<0||maximumChanges>2)
    throw Error('Retain two to24 original intervals and declare zero, one or two allowed changes');
  const result=[[]];
  if(maximumChanges>=1)for(let a=1;a<intervals;a++)result.push([a]);
  if(maximumChanges>=2)for(let a=1;a<intervals;a++)for(let b=a+1;b<intervals;b++)result.push([a,b]);
  return result;
}

function admit(observed,bands,maximumChanges){
  if(!Array.isArray(observed)||observed.length<1||observed.length>24||!dense(observed,observed.length)
      ||!dense(bands,observed.length))throw Error('Retain one to24 complete original coefficient rows and bands');
  const intervals=observed[0]?.coefficients?.length;
  const patterns=originalSkyChangePatterns(intervals,maximumChanges);
  for(const row of observed){
    if(!exactKeys(row,['constant','coefficients'])||!fraction(row.constant)||!dense(row.coefficients,intervals)
        ||!row.coefficients.every(v=>dense(v,3)&&v.every(fraction)))
      throw Error('Every original interval needs three bounded exact bin coefficients and one exact constant');
  }
  for(const band of bands)if(!exactKeys(band,['lower','upper'])||!fraction(band.lower)||!fraction(band.upper)
      ||cmp(band.lower,band.upper)>0)throw Error('Every original exact observation band must be ordered');
  return {intervals,patterns};
}

function project(observed,bands,intervals,splits){
  const phases=splits.length+1,edges=[0,...splits,intervals],variables=3*phases;
  const rows=Array.from({length:phases},(_,phase)=>Array.from({length:variables},(_,j)=>Math.floor(j/3)===phase?ONE:ZERO));
  const bounds=Array.from({length:phases},()=>ONE);
  const projected=observed.map((row,i)=>{
    const coefficients=edges.slice(1).flatMap((end,phase)=>[0,1,2].map(bin=>{
      let sum=ZERO;
      for(let interval=edges[phase];interval<end;interval++)sum=plus(sum,row.coefficients[interval][bin]);
      return sum;
    }));
    rows.push(coefficients,coefficients.map(neg));
    bounds.push(minus(bands[i].upper,row.constant),minus(row.constant,bands[i].lower));
    return {constant:row.constant,coefficients};
  });
  return {splits:[...splits],phases,variables,projected,rows,bounds};
}

export function projectOriginalSkyPattern(observed,bands,splits){
  const {intervals,patterns}=admit(observed,bands,2);
  if(!Array.isArray(splits)||!dense(splits,splits.length)
      ||!patterns.some(p=>p.length===splits.length&&p.every((v,i)=>v===splits[i])))
    throw Error('Choose a complete zero/one/two-change pattern on the original internal boundaries');
  return project(observed,bands,intervals,splits);
}

function profileFor(model,certificate,bands){
  const point=certificate.point;
  const phaseProfiles=Array.from({length:model.phases},(_,phase)=>{
    const rest=point.slice(phase*3,phase*3+3),profile=[minus(ONE,rest.reduce(plus,ZERO)),...rest];
    if(profile.some(v=>v[0]<0n)||cmp(profile.reduce(plus,ZERO),ONE))throw Error('A sky-pattern profile lost normalized nonnegative mass');
    return profile;
  });
  const productMasses=Array.from({length:4**model.phases},(_,index)=>phaseProfiles.reduce((value,phase,p)=>
    times(value,phase[Math.floor(index/4**(model.phases-p-1))%4]),ONE));
  if(cmp(productMasses.reduce(plus,ZERO),ONE))throw Error('A sky-pattern product lost unit mass');
  const observedC=model.projected.map(row=>plus(row.constant,dot(row.coefficients,point)));
  if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('A sky-pattern witness lost an original band');
  return {phaseProfiles,productMasses,observedC};
}

const budgetValue=(options,key,ceiling)=>{
  const value=Object.hasOwn(options,key)?options[key]:ceiling;
  if(!Number.isInteger(value)||value<0||value>ceiling)throw Error('A cumulative sky-pattern allowance must be an integer within its declared limit');
  return value;
};

// Original interval coefficients are common to every pattern. Grouping exact
// sums preserves each lower-change class as an exact subset of its refinements.
// This routine never creates or imports thermal data; its consumer must qualify
// the complete numerical basis and every selected witness before publishing.
export function findMinimumSkyChanges(observed,bands,options={}){
  if(!options||typeof options!=='object'||Array.isArray(options)
      ||Object.keys(options).some(key=>!['maximumChanges','maxPivots','maxRationalOperations'].includes(key)))
    throw Error('Unsupported sky-pattern search option');
  const maximumChanges=Object.hasOwn(options,'maximumChanges')?options.maximumChanges:2;
  const {intervals,patterns}=admit(observed,bands,maximumChanges);
  const limits={...SKY_CHANGE_PATTERN_LIMITS,pivots:budgetValue(options,'maxPivots',SKY_CHANGE_PATTERN_LIMITS.pivots),
    rationalOperations:budgetValue(options,'maxRationalOperations',SKY_CHANGE_PATTERN_LIMITS.rationalOperations)};
  const cases=[],work={solves:0,pivots:0,rationalOperations:0,verifiedCertificates:0,feasiblePatterns:0};
  let minimumChanges=null;
  for(let changes=0;changes<=maximumChanges;changes++){
    for(const splits of patterns.filter(p=>p.length===changes)){
      const model=project(observed,bands,intervals,splits);
      const solved=solveThreeEpochLinearObjectives(model.rows,model.bounds,[],{
        maxPivots:Math.min(limits.pivotsPerSolve,limits.pivots-work.pivots),
        maxRationalOperations:Math.min(limits.rationalOperationsPerSolve,limits.rationalOperations-work.rationalOperations)});
      work.solves++;work.pivots+=solved.work.pivots;work.rationalOperations+=solved.work.rationalOperations;
      work.verifiedCertificates+=solved.work.verifiedCertificates;
      const witness=solved.status==='feasible'?profileFor(model,solved.certificate,bands):null;
      if(witness){
        work.feasiblePatterns++;
        // If adjacent profiles are equal, the same exact point would admit a
        // lower-change pattern already proved incompatible in this inquiry.
        if(witness.phaseProfiles.some((phase,i)=>i&&sameFractions(phase,witness.phaseProfiles[i-1])))
          throw Error('A minimum-change witness contradicts its lower-change certificates');
      }
      cases.push({splits:[...splits],status:solved.status,linearModel:{rows:model.rows,bounds:model.bounds},
        certificate:solved.certificate,witness,work:solved.work});
    }
    if(work.feasiblePatterns){minimumChanges=changes;break;}
  }
  const compatiblePatterns=cases.filter(c=>c.status==='feasible').map(c=>[...c.splits]);
  const result={status:minimumChanges===null?'incompatible':'compatible',intervals,maximumChanges,minimumChanges,
    compatiblePatterns,cases,work,limits,totalDeclaredPatterns:patterns.length,
    unexaminedHigherChangePatterns:patterns.length-cases.length};
  verifyMinimumSkyChangeResult(observed,bands,result);
  return result;
}

// Verify completeness as well as each original-matrix certificate. A successful
// prefix or a single preferred pattern cannot stand in for the minimum class.
export function verifyMinimumSkyChangeResult(observed,bands,result){
  if(!result||typeof result!=='object')throw Error('A complete sky-pattern search result is required');
  const {intervals,patterns}=admit(observed,bands,result.maximumChanges),minimum=result.minimumChanges;
  if(minimum!==null&&(!Number.isInteger(minimum)||minimum<0||minimum>result.maximumChanges))throw Error('Invalid minimum change count');
  const expected=patterns.filter(p=>minimum===null||p.length<=minimum);
  if(result.intervals!==intervals||result.totalDeclaredPatterns!==patterns.length
      ||result.unexaminedHigherChangePatterns!==patterns.length-expected.length||!dense(result.cases,expected.length))
    throw Error('Every original pattern through the minimum class must be retained');
  const compatible=[];let pivots=0,operations=0,verified=0;
  for(const [i,splits]of expected.entries()){
    const item=result.cases[i],model=project(observed,bands,intervals,splits);
    if(!item||!dense(item.splits,splits.length)||item.splits.some((v,j)=>v!==splits[j])
        ||!dense(item.linearModel?.rows,model.rows.length)
        ||!item.linearModel.rows.every((row,j)=>sameFractions(row,model.rows[j]))
        ||!sameFractions(item.linearModel.bounds,model.bounds))throw Error('A pattern lost its original coefficient matrix or order');
    verifyThreeEpochLinearCertificate(model.rows,model.bounds,null,item.certificate);
    if(item.status!==item.certificate.status||!['feasible','incompatible'].includes(item.status))throw Error('A pattern must have a complete feasibility result');
    if(item.status==='feasible'){
      if(splits.length!==minimum)throw Error('A lower compatible class was skipped');
      const expectedWitness=profileFor(model,item.certificate,bands),w=item.witness;
      if(!w||!dense(w.phaseProfiles,model.phases)||!w.phaseProfiles.every((p,j)=>sameFractions(p,expectedWitness.phaseProfiles[j]))
          ||!sameFractions(w.productMasses,expectedWitness.productMasses)||!sameFractions(w.observedC,expectedWitness.observedC))
        throw Error('A common sky-pattern witness lost its original exact profiles or observations');
      compatible.push(splits);
    }else if(item.witness!==null)throw Error('An incompatible pattern cannot supply a profile');
    if(!item.work||!Number.isInteger(item.work.pivots)||item.work.pivots<0||item.work.pivots>2048
        ||!Number.isInteger(item.work.rationalOperations)||item.work.rationalOperations<0||item.work.rationalOperations>4000000
        ||item.work.verifiedCertificates!==1||item.work.variables!==model.variables||item.work.constraints!==model.rows.length
        ||item.work.objectives!==0)throw Error('A pattern has invalid bounded solver work');
    pivots+=item.work.pivots;operations+=item.work.rationalOperations;verified+=item.work.verifiedCertificates;
  }
  if(result.status!==(minimum===null?'incompatible':'compatible')||(minimum===null?compatible.length!==0:compatible.length===0)
      ||!dense(result.compatiblePatterns,compatible.length)||!result.compatiblePatterns.every((p,i)=>dense(p,compatible[i].length)&&p.every((v,j)=>v===compatible[i][j])))
    throw Error('The complete minimum compatible pattern set was changed');
  if(!result.limits||Object.keys(SKY_CHANGE_PATTERN_LIMITS).some(key=>!Object.hasOwn(result.limits,key)
      ||(key==='pivots'||key==='rationalOperations'
        ?!Number.isInteger(result.limits[key])||result.limits[key]<0||result.limits[key]>SKY_CHANGE_PATTERN_LIMITS[key]
        :result.limits[key]!==SKY_CHANGE_PATTERN_LIMITS[key])))throw Error('A cumulative sky-pattern limit was changed');
  if(!result.work||result.work.solves!==expected.length||result.work.pivots!==pivots||result.work.rationalOperations!==operations
      ||result.work.verifiedCertificates!==verified||result.work.feasiblePatterns!==compatible.length
      ||pivots>result.limits.pivots||operations>result.limits.rationalOperations)throw Error('Cumulative sky-pattern work was lost');
  return true;
}

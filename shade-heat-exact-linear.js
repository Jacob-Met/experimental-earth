import {rational as q,add,sub,mul,div,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';

// Bounded exact max c*x with A*x <= b and x >= 0. No tolerances, perturbations
// or partial objective lists. The legacy six-coordinate and separately bounded
// three-epoch nine-coordinate entries share this same maintained algorithm. This does not replace any existing intersection API.
// Bland's smallest-variable entering/leaving rules prevent basis cycling:
// https://doi.org/10.1287/moor.2.2.103 . A finite work cap can still refuse.
export const SKY_LINEAR_LIMITS=Object.freeze({variables:6,constraints:50,objectives:100,
  pivots:2048,rationalOperations:4000000,rationalBits:4096});
export const THREE_EPOCH_LINEAR_LIMITS=Object.freeze({...SKY_LINEAR_LIMITS,variables:9,constraints:51});
export const THREE_EPOCH_TARGET_LINEAR_LIMITS=Object.freeze({...SKY_LINEAR_LIMITS,variables:10,constraints:101,objectives:1});
const ZERO=q(0),ONE=q(1),MINUS_ONE=q(-1);
const dense=(value,length)=>Array.isArray(value)&&value.length===length
  &&Array.from({length},(_,i)=>Object.hasOwn(value,i)).every(Boolean);
const fraction=value=>dense(value,2)&&typeof value[0]==='bigint'&&typeof value[1]==='bigint'
  &&value[1]>0n&&(value[0]<0n?-value[0]:value[0]).toString(2).length<=4096&&value[1].toString(2).length<=4096;
const exactKeys=(value,allowed)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).every(key=>allowed.includes(key));

function admit(rows,bounds,objectives,limits=SKY_LINEAR_LIMITS){
  const m=rows?.length,n=rows?.[0]?.length,k=objectives?.length;
  if(!Number.isInteger(m)||m<1||m>limits.constraints||!dense(rows,m)
      ||!Number.isInteger(n)||n<1||n>limits.variables||!dense(bounds,m)
      ||!Number.isInteger(k)||k<0||k>limits.objectives||!dense(objectives,k)
      ||!Array.from(rows).every(row=>dense(row,n)&&Array.from(row).every(fraction))
      ||!Array.from(bounds).every(fraction)
      ||!Array.from(objectives).every(row=>dense(row,n)&&Array.from(row).every(fraction)))
    throw Error('Supply complete bounded exact constraint rows, right-hand sides and the entire objective list');
  return {m,n,k};
}

function arithmetic(options,work,bound=SKY_LINEAR_LIMITS){
  if(!exactKeys(options,['maxPivots','maxRationalOperations']))throw Error('Unsupported exact linear work allowance');
  const limits={pivots:options.maxPivots??bound.pivots,
    rationalOperations:options.maxRationalOperations??bound.rationalOperations};
  for(const key of Object.keys(limits))if(!Number.isSafeInteger(limits[key])||limits[key]<0||limits[key]>bound[key])
    throw Error('Exact linear work allowances must be bounded nonnegative integers');
  const count=fn=>(...args)=>{if(++work.rationalOperations>limits.rationalOperations)
    throw Error('Exact linear arithmetic allowance exhausted; no partial inquiry is returned');return fn(...args);};
  return {add:count(add),sub:count(sub),mul:count(mul),div:count(div),neg:count(neg),cmp:count(cmp),limits};
}

function dot(a,b,M){
  if(a.length!==b.length)throw Error('Exact linear certificate dimensions differ');
  let total=ZERO;
  for(let i=0;i<a.length;i++)if(a[i][0]&&b[i][0])total=M.add(total,M.mul(a[i],b[i]));
  return total;
}
const plainArithmetic={add,sub,mul,div,neg,cmp};
function verifyPoint(rows,bounds,point,M){
  if(!dense(point,rows[0].length)||!point.every(fraction)||point.some(x=>x[0]<0n))throw Error('Invalid exact primal point');
  if(rows.some((row,i)=>M.cmp(dot(row,point,M),bounds[i])>0))throw Error('Exact primal point violates an original inequality');
}

// This checks original A,b,c identities, never tableau feasibility or reduced
// costs. Public callers can independently verify a serialized-and-restored
// certificate; the bounded original-row matrix is always required again.
function verify(rows,bounds,objective,certificate,M){
  const m=rows.length,n=rows[0].length;
  if(!certificate||typeof certificate!=='object')throw Error('An exact linear certificate is required');
  if(certificate.status==='incompatible'){
    const y=certificate.dual;
    if(!dense(y,m)||!y.every(fraction)||y.some(x=>x[0]<0n))throw Error('Invalid exact Farkas multipliers');
    for(let j=0;j<n;j++)if(dot(y,rows.map(row=>row[j]),M)[0]<0n)throw Error('Farkas column inequality failed');
    const contradiction=dot(y,bounds,M);
    if(contradiction[0]>=0n||!fraction(certificate.contradiction)||M.cmp(contradiction,certificate.contradiction))throw Error('No strict exact Farkas contradiction');
    return true;
  }
  verifyPoint(rows,bounds,certificate.point,M);
  if(certificate.status==='feasible')return true;
  if(!dense(objective,n)||!objective.every(fraction))throw Error('The original objective is required for this certificate');
  if(certificate.status==='optimal'){
    const y=certificate.dual;
    if(!dense(y,m)||!y.every(fraction)||y.some(x=>x[0]<0n)||!fraction(certificate.value))throw Error('Invalid exact optimality multipliers');
    for(let j=0;j<n;j++)if(M.cmp(dot(y,rows.map(row=>row[j]),M),objective[j])<0)throw Error('Exact dual column inequality failed');
    const primal=dot(objective,certificate.point,M),dual=dot(bounds,y,M);
    if(M.cmp(primal,certificate.value)||M.cmp(dual,certificate.value))throw Error('Exact primal and dual objective equality failed');
    return true;
  }
  if(certificate.status==='unbounded'){
    const ray=certificate.ray;
    if(!dense(ray,n)||!ray.every(fraction)||ray.some(x=>x[0]<0n))throw Error('Invalid nonnegative unbounded ray');
    if(rows.some(row=>dot(row,ray,M)[0]>0n))throw Error('Unbounded ray violates an original inequality');
    const gain=dot(objective,ray,M);
    if(gain[0]<=0n||!fraction(certificate.gain)||M.cmp(gain,certificate.gain))throw Error('Unbounded ray lacks positive exact gain');
    return true;
  }
  throw Error('Unsupported exact linear certificate');
}

export function verifyRationalLinearCertificate(rows,bounds,objective,certificate){
  admit(rows,bounds,objective===null?[]:[objective]);
  return verify(rows,bounds,objective,certificate,plainArithmetic);
}

function solveObjectives(originalRows,originalBounds,originalObjectives,options,bound){
  const {m,n,k}=admit(originalRows,originalBounds,originalObjectives,bound);
  const work={variables:n,constraints:m,objectives:k,pivots:0,phaseIPivots:0,artificialRemovalPivots:0,
    objectivePivots:0,rationalOperations:0,verifiedCertificates:0};
  const M=arithmetic(options,work,bound),normalize=value=>M.add(value,ZERO);
  const A=originalRows.map(row=>row.map(normalize)),b=originalBounds.map(normalize),objectives=originalObjectives.map(row=>row.map(normalize));
  const negatives=b.map((value,index)=>value[0]<0n?index:-1).filter(index=>index>=0),real=n+m,width=real+negatives.length;
  work.artificialVariables=negatives.length;work.maximumTableauCells=m*(width+1);
  const table={rows:A.map((row,i)=>{
    const sign=b[i][0]<0n?MINUS_ONE:ONE,line=Array.from({length:width},()=>ZERO);
    for(let j=0;j<n;j++)line[j]=M.mul(sign,row[j]);line[n+i]=sign;
    if(b[i][0]<0n)line[real+negatives.indexOf(i)]=ONE;
    return line;
  }),rhs:b.map(value=>value[0]<0n?M.neg(value):value),basis:b.map((value,i)=>value[0]<0n?real+negatives.indexOf(i):n+i)};
  function pivot(t,leaving,entering,phase){
    if(++work.pivots>M.limits.pivots)throw Error('Exact linear pivot allowance exhausted; no partial inquiry is returned');
    work[phase]++;const divisor=t.rows[leaving][entering];if(!divisor[0])throw Error('Zero exact pivot');
    const row=t.rows[leaving].map(value=>M.div(value,divisor)),right=M.div(t.rhs[leaving],divisor);
    for(let i=0;i<m;i++)if(i!==leaving){const factor=t.rows[i][entering];if(factor[0]){
      t.rows[i]=t.rows[i].map((value,j)=>M.sub(value,M.mul(factor,row[j])));t.rhs[i]=M.sub(t.rhs[i],M.mul(factor,right));
    }}
    t.rows[leaving]=row;t.rhs[leaving]=right;t.basis[leaving]=entering;
    if(t.rhs.some(value=>value[0]<0n))throw Error('Exact pivot lost primal feasibility');
  }
  function optimize(t,cost,phase){
    while(true){
      const baseCost=t.basis.map(index=>cost[index]);let entering=-1;
      for(let j=0;j<cost.length;j++){
        const reduced=M.sub(cost[j],dot(baseCost,t.rows.map(row=>row[j]),M));
        if(reduced[0]>0n){entering=j;break;}
      }
      const value=dot(baseCost,t.rhs,M);
      if(entering<0)return {status:'optimal',value,baseCost};
      let leaving=-1,ratio=null;
      for(let i=0;i<m;i++)if(t.rows[i][entering][0]>0n){
        const next=M.div(t.rhs[i],t.rows[i][entering]),order=ratio===null?-1:M.cmp(next,ratio);
        if(leaving<0||order<0||(order===0&&t.basis[i]<t.basis[leaving])){leaving=i;ratio=next;}
      }
      if(leaving<0)return {status:'unbounded',entering,value,baseCost};
      pivot(t,leaving,entering,phase);
    }
  }
  const point=t=>{
    const x=Array.from({length:n},()=>ZERO);t.basis.forEach((index,i)=>{if(index<n)x[index]=t.rhs[i];});return x;
  };
  const dual=(t,baseCost)=>Array.from({length:m},(_,i)=>dot(baseCost,t.rows.map(row=>row[n+i]),M));
  if(negatives.length){
    const phaseOneCost=Array.from({length:width},(_,index)=>index>=real?MINUS_ONE:ZERO);
    const first=optimize(table,phaseOneCost,'phaseIPivots');
    if(first.status!=='optimal'||first.value[0]>0n)throw Error('Invalid bounded Phase I result');
    if(first.value[0]<0n){
      const certificate={status:'incompatible',dual:dual(table,first.baseCost),contradiction:first.value};
      verify(A,b,null,certificate,M);work.verifiedCertificates++;
      return structuredClone({status:'incompatible',certificate,results:[],work,limits:M.limits});
    }
    for(let i=0;i<m;i++)if(table.basis[i]>=real){
      if(table.rhs[i][0])throw Error('Positive artificial variable after exact feasibility');
      const entering=table.rows[i].findIndex((value,j)=>j<real&&value[0]&&!table.basis.includes(j));
      // Original slack columns form a full-rank identity before the invertible
      // row operations. An artificial basic row always has a real pivot column.
      if(entering<0)throw Error('Original slack rank lost during artificial removal');
      pivot(table,i,entering,'artificialRemovalPivots');
    }
  }
  table.rows=table.rows.map(row=>row.slice(0,real));
  const feasibility={status:'feasible',point:point(table)};verify(A,b,null,feasibility,M);work.verifiedCertificates++;
  const results=[];
  for(const objective of objectives){
    const t={rows:table.rows.map(row=>row.slice()),rhs:table.rhs.slice(),basis:table.basis.slice()};
    const cost=[...objective,...Array.from({length:m},()=>ZERO)],solution=optimize(t,cost,'objectivePivots');
    let certificate;
    if(solution.status==='optimal')certificate={status:'optimal',point:point(t),value:solution.value,dual:dual(t,solution.baseCost)};
    else{
      const ray=Array.from({length:n},()=>ZERO);if(solution.entering<n)ray[solution.entering]=ONE;
      t.basis.forEach((index,i)=>{if(index<n)ray[index]=M.neg(t.rows[i][solution.entering]);});
      certificate={status:'unbounded',point:point(t),ray,gain:dot(objective,ray,M)};
    }
    verify(A,b,objective,certificate,M);work.verifiedCertificates++;results.push(certificate);
  }
  return structuredClone({status:'feasible',certificate:feasibility,results,work,limits:M.limits});
}

// Separate admission keeps every existing six-coordinate API limit unchanged.
export function solveRationalLinearObjectives(rows,bounds,objectives,options={}){
  return solveObjectives(rows,bounds,objectives,options,SKY_LINEAR_LIMITS);
}
export function solveThreeEpochLinearObjectives(rows,bounds,objectives,options={}){
  return solveObjectives(rows,bounds,objectives,options,THREE_EPOCH_LINEAR_LIMITS);
}
export function verifyThreeEpochLinearCertificate(rows,bounds,objective,certificate){
  admit(rows,bounds,objective===null?[]:[objective],THREE_EPOCH_LINEAR_LIMITS);
  return verify(rows,bounds,objective,certificate,plainArithmetic);
}

// One shared-profile epigraph coordinate; earlier6/9-coordinate entries retain their admission.
export function solveThreeEpochTargetLinearObjectives(rows,bounds,objectives,options={}){
  return solveObjectives(rows,bounds,objectives,options,THREE_EPOCH_TARGET_LINEAR_LIMITS);
}
export function verifyThreeEpochTargetLinearCertificate(rows,bounds,objective,certificate){
  admit(rows,bounds,objective===null?[]:[objective],THREE_EPOCH_TARGET_LINEAR_LIMITS);
  return verify(rows,bounds,objective,certificate,plainArithmetic);
}

import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {solveRationalLinearObjectives} from './shade-heat-exact-linear.js';

const ZERO=q(0),ONE=q(1);
const dense=(value,n)=>Array.isArray(value)&&value.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(value,i)).every(Boolean);
const fraction=value=>dense(value,2)&&typeof value[0]==='bigint'&&typeof value[1]==='bigint'&&value[1]>0n
  &&(value[0]<0n?-value[0]:value[0]).toString(2).length<=4096&&value[1].toString(2).length<=4096;
const dot=(a,b)=>a.reduce((sum,value,index)=>add(sum,mul(value,b[index])),ZERO);

// E0 and L0 are the exact complements of three nonnegative weights each.
// Every supplied16-pair row must satisfy the represented additive identity.
export function projectAdditiveSkyRow(row){
  if(!dense(row,16)||!Array.from(row).every(fraction))throw Error('A complete bounded exact sixteen-pair row is required');
  const constant=add(row[0],ZERO),coefficients=[4,8,12,1,2,3].map(index=>sub(row[index],constant));
  for(let early=0;early<4;early++)for(let late=0;late<4;late++){
    const expected=add(constant,add(early?coefficients[early-1]:ZERO,late?coefficients[late+2]:ZERO));
    if(cmp(expected,row[early*4+late]))throw Error('Sky marginal projection requires every exact additive pair identity');
  }
  return {constant,coefficients};
}

export function solveMarginalSkyObjectives(observed,readings,objectiveRows,options={}){
  if(!Array.isArray(observed)||observed.length<1||observed.length>24||!dense(observed,observed.length)
      ||!dense(readings,observed.length)||!readings.every(r=>r&&typeof r==='object'&&!Array.isArray(r)
        &&Object.keys(r).length===2&&Object.hasOwn(r,'temperatureC')&&Object.hasOwn(r,'halfWidthC')
        &&Number.isFinite(r.temperatureC)&&Number.isFinite(r.halfWidthC)&&r.halfWidthC>=0)
      ||!Array.isArray(objectiveRows)||objectiveRows.length>100||!dense(objectiveRows,objectiveRows.length))
    throw Error('Retain one to24 complete original bands and at most100 complete objective rows');
  const projected=observed.map(projectAdditiveSkyRow),objectives=objectiveRows.map(projectAdditiveSkyRow);
  const bands=readings.map(r=>({lower:sub(q(r.temperatureC),q(r.halfWidthC)),upper:add(q(r.temperatureC),q(r.halfWidthC))}));
  const rows=[[ONE,ONE,ONE,ZERO,ZERO,ZERO],[ZERO,ZERO,ZERO,ONE,ONE,ONE]],bounds=[ONE,ONE];
  projected.forEach((p,i)=>{
    rows.push(p.coefficients.slice(),p.coefficients.map(neg));
    bounds.push(sub(bands[i].upper,p.constant),sub(p.constant,bands[i].lower));
  });
  const solved=solveRationalLinearObjectives(rows,bounds,objectives.map(p=>p.coefficients),options);
  if(solved.status==='incompatible')return {...solved,bands,linearModel:{rows,bounds},results:[]};
  const results=solved.results.map((proof,index)=>{
    if(proof.status!=='optimal')throw Error('A compact pair of sky simplices cannot have an unbounded finite objective');
    const phaseProfiles=[0,3].map(start=>{
      const selected=proof.point.slice(start,start+3),phase=[sub(ONE,selected.reduce(add,ZERO)),...selected];
      if(phase.some(x=>x[0]<0n)||cmp(phase.reduce(add,ZERO),ONE))throw Error('Exact marginal mass was lost');return phase;
    });
    const masses=Array.from({length:16},(_,i)=>mul(phaseProfiles[0][Math.floor(i/4)],phaseProfiles[1][i%4]));
    const observedC=observed.map(row=>dot(row,masses));
    if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('Original observation band lost under exact marginals');
    const value=add(objectives[index].constant,proof.value);
    if(cmp(value,dot(objectiveRows[index],masses)))throw Error('Exact marginal objective identity lost');
    return {value,phaseProfiles,masses,observedC,linearCertificate:proof,objective:objectives[index]};
  });
  return {status:'feasible',certificate:solved.certificate,bands,linearModel:{rows,bounds},results,
    work:{...solved.work,additivePairIdentities:16*(observed.length+objectiveRows.length)},limits:solved.limits};
}

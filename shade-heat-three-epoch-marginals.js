import {rational as q,add,sub,mul,neg,cmp} from './vendor/chronos/exact-halfplanes.mjs';
import {solveThreeEpochLinearObjectives} from './shade-heat-exact-linear.js';

const ZERO=q(0),ONE=q(1);
const dense=(v,n)=>Array.isArray(v)&&v.length===n&&Array.from({length:n},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
const fraction=v=>dense(v,2)&&typeof v[0]==='bigint'&&typeof v[1]==='bigint'&&v[1]>0n
  &&(v[0]<0n?-v[0]:v[0]).toString(2).length<=4096&&v[1].toString(2).length<=4096;
const dot=(a,b)=>a.reduce((sum,v,i)=>add(sum,mul(v,b[i])),ZERO);
export const tripleBins=index=>[Math.floor(index/16),Math.floor(index/4)%4,index%4];

// Three bin-zero masses are exact complements of nine nonnegative coordinates.
// Every complete64-combination row must obey the represented additive identity.
export function projectThreeEpochSkyRow(row){
  if(!dense(row,64)||!row.every(fraction))throw Error('A complete bounded exact64-combination row is required');
  const constant=add(row[0],ZERO),coefficients=[16,32,48,4,8,12,1,2,3].map(i=>sub(row[i],constant));
  for(let i=0;i<64;i++){
    const value=tripleBins(i).reduce((sum,bin,epoch)=>add(sum,bin?coefficients[3*epoch+bin-1]:ZERO),constant);
    if(cmp(value,row[i]))throw Error('Every exact three-epoch additive identity must hold');
  }
  return {constant,coefficients};
}

export function solveThreeEpochSkyObjectives(observed,readings,objectiveRows,options={}){
  if(!Array.isArray(observed)||observed.length<1||observed.length>24||!dense(observed,observed.length)
      ||!dense(readings,observed.length)||!readings.every(r=>r&&typeof r==='object'&&!Array.isArray(r)
        &&Object.keys(r).length===2&&Object.hasOwn(r,'temperatureC')&&Object.hasOwn(r,'halfWidthC')
        &&Number.isFinite(r.temperatureC)&&Number.isFinite(r.halfWidthC)&&r.halfWidthC>=0)
      ||!Array.isArray(objectiveRows)||objectiveRows.length>100||!dense(objectiveRows,objectiveRows.length))
    throw Error('Retain one to24 original bands and at most100 complete objective rows');
  const projected=observed.map(projectThreeEpochSkyRow),objectives=objectiveRows.map(projectThreeEpochSkyRow);
  const bands=readings.map(r=>({lower:sub(q(r.temperatureC),q(r.halfWidthC)),upper:add(q(r.temperatureC),q(r.halfWidthC))}));
  const rows=Array.from({length:3},(_,epoch)=>Array.from({length:9},(_,j)=>Math.floor(j/3)===epoch?ONE:ZERO));
  const bounds=[ONE,ONE,ONE];
  projected.forEach((p,i)=>{
    rows.push(p.coefficients.slice(),p.coefficients.map(neg));
    bounds.push(sub(bands[i].upper,p.constant),sub(p.constant,bands[i].lower));
  });
  const solved=solveThreeEpochLinearObjectives(rows,bounds,objectives.map(p=>p.coefficients),options);
  if(solved.status==='incompatible')return {...solved,bands,linearModel:{rows,bounds},results:[]};
  const results=solved.results.map((proof,index)=>{
    if(proof.status!=='optimal')throw Error('Three compact sky simplices cannot have an unbounded finite objective');
    const phaseProfiles=[0,3,6].map(start=>{
      const selected=proof.point.slice(start,start+3),phase=[sub(ONE,selected.reduce(add,ZERO)),...selected];
      if(phase.some(x=>x[0]<0n)||cmp(phase.reduce(add,ZERO),ONE))throw Error('Exact three-epoch mass was lost');
      return phase;
    });
    const masses=Array.from({length:64},(_,i)=>tripleBins(i).reduce((p,bin,epoch)=>mul(p,phaseProfiles[epoch][bin]),ONE));
    if(cmp(masses.reduce(add,ZERO),ONE))throw Error('Exact product profile lost unit mass');
    const observedC=observed.map(row=>dot(row,masses));
    if(observedC.some((v,i)=>cmp(v,bands[i].lower)<0||cmp(v,bands[i].upper)>0))throw Error('An original band was lost under three exact profiles');
    const value=add(objectives[index].constant,proof.value);
    if(cmp(value,dot(objectiveRows[index],masses)))throw Error('Exact three-epoch objective identity was lost');
    return {value,phaseProfiles,masses,observedC,linearCertificate:proof,objective:objectives[index]};
  });
  return {status:'feasible',certificate:solved.certificate,bands,linearModel:{rows,bounds},results,
    work:{...solved.work,additiveTripleIdentities:64*(observed.length+objectiveRows.length)},limits:solved.limits};
}

// Embedded one-change references use the identical exact64-row coefficients.
// Reference0 joins middle+late; reference1 joins early+middle. No original
// observation or coefficient is re-fitted, and no external time is searched.
export function embeddedTwoEpochRows(rows,reference){
  if(reference!==0&&reference!==1)throw Error('Choose one of the two declared original boundaries');
  return rows.map(row=>{
    projectThreeEpochSkyRow(row);
    return Array.from({length:16},(_,i)=>{
      const a=Math.floor(i/4),b=i%4;
      return row[reference===0?16*a+5*b:20*a+b];
    });
  });
}

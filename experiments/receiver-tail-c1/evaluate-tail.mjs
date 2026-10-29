import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {advanceDrainingLayer} from '../../draining-infiltration.js';

const root=new URL('./',import.meta.url);
const output=process.argv[2] ? new URL('file://'+process.argv[2].replace(/\/$/,'')+'/') : new URL('./rerun-output/',root);
fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(new URL('drainage.csv',root),'utf8');
const rows=source.trim().split(/\r?\n/).slice(1).map(line=>line.split(',').map(Number));
assert.equal(rows.length,2184); assert.ok(rows.every(([t,q])=>Number.isFinite(t)&&Number.isFinite(q)));
const end=64410, median=a=>{const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const plateau=rows.filter(([t])=>t>=.9*end&&t<=end);
const training=rows.filter(([t])=>t>end&&t<=end+570).map(([t,q])=>[t-end,q]);
const held=rows.filter(([t])=>t>end+570&&t<=end+1140).map(([t,q])=>[t-end,q]);
assert.equal(training.length,19); assert.equal(held.length,19);
let kernelChecks=0,maxKernelError=0;
const linear=(q0,k,tau)=>q0*Math.exp(-k*tau/3600);
function scalar(objective,lo,hi,step){
  const n=Math.ceil((hi-lo)/step),xs=Array.from({length:n+1},(_,i)=>lo+(hi-lo)*i/n),ys=xs.map(objective);
  let best={parameter:xs[0],sse:ys[0]};
  const take=(x,y)=>{if(y<best.sse)best={parameter:x,sse:y};};
  xs.forEach((x,i)=>take(x,ys[i]));
  for(let i=1;i<n;i++)if(ys[i]<=ys[i-1]&&ys[i]<=ys[i+1]){
    let a=xs[i-1],b=xs[i+1]; const ratio=(Math.sqrt(5)-1)/2;
    let c=b-ratio*(b-a),d=a+ratio*(b-a),fc=objective(c),fd=objective(d);
    for(let j=0;j<60;j++){if(fc<fd){b=d;d=c;fd=fc;c=b-ratio*(b-a);fc=objective(c);}else{a=c;c=d;fc=fd;d=a+ratio*(b-a);fd=objective(d);}}
    take(c,fc);take(d,fd);
  }
  return best;
}
function fit(plateau,training){
  const q0=median(plateau.map(x=>x[1]));
  if(!(q0>0)||training.some(([t,q])=>!(t>0)||q<0))return {status:'unresolved',reason:'A positive plateau and nonnegative original training rates are required.'};
  const kMin=q0/10000;
  if(kMin>100)return {status:'unresolved',reason:'The maintained reservoir cannot carry the observed positive plateau inside its storage/rate domain.'};
  const error=predict=>training.reduce((s,[t,q])=>s+(predict(t)-q)**2,0);
  const exp=scalar(k=>error(t=>linear(q0,k,t)),kMin,100,.25);
  let delayed={sse:Infinity};
  for(let lag=0;lag<=570;lag++){
    const fit=scalar(k=>error(t=>linear(q0,k,Math.max(0,t-lag))),kMin,100,.25);
    if(fit.sse<delayed.sse)delayed={sse:fit.sse,k:fit.parameter,lag};
  }
  const vf=scalar(lag=>error(t=>t<=lag?q0:q0*(lag/t)**1.5),0,570,1);
  const models=[
    {id:'maintained-linear',q0,k:exp.parameter,trainingSse:exp.sse},
    {id:'delayed-linear',q0,k:delayed.k,lagSeconds:delayed.lag,trainingSse:delayed.sse},
    {id:'viscous-tail',q0,lagSeconds:vf.parameter,exponent:1.5,trainingSse:vf.sse},
  ];
  return {status:'resolved-search',q0,plateauRows:plateau.length,trainingRows:training.length,kMinimumFromCapacity:kMin,models};
}
function predict(m,t){
  if(m.id==='viscous-tail')return t<=m.lagSeconds?m.q0:m.q0*(m.lagSeconds/t)**1.5;
  return linear(m.q0,m.k,Math.max(0,t-(m.lagSeconds??0)));
}
function score(m,rs){
  const predictions=rs.map(([t])=>predict(m,t));
  const errors=rs.map(([,q],i)=>predictions[i]-q);
  const integrate=vs=>rs.slice(1).reduce((sum,[t],i)=>sum+(t-rs[i][0])*(vs[i]+vs[i+1])/7200,0);
  return {rows:rs.length,rmseMmHr:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/rs.length),maxAbsoluteMmHr:Math.max(...errors.map(Math.abs)),sampledIntervalSeconds:[rs[0][0],rs.at(-1)[0]],derivedTrapezoidObservedMm:integrate(rs.map(x=>x[1])),derivedTrapezoidPredictedMm:integrate(predictions),predictions};
}
const fitted=fit(plateau,training);assert.equal(fitted.status,'resolved-search');
// Freeze every coefficient before the held-rate scoring function is invoked.
const frozen=JSON.stringify(fitted,null,2)+'\n';fs.writeFileSync(new URL('frozen-models.json',output),frozen);
const modelSha=crypto.createHash('sha256').update(frozen).digest('hex');
for(const m of fitted.models.filter(x=>x.id!=='viscous-tail'))for(const [t] of [...training,...held]){
  const hours=Math.max(0,t-(m.lagSeconds??0))/3600,S=m.q0/m.k;
  const result=advanceDrainingLayer({surfaceMm:0,storedMm:S,capacityMm:10000,infiltrationMmHr:0,drainagePerHour:m.k,rainMmHr:0,hours});
  const error=Math.abs(result.storedMm*m.k-predict(m,t));
  assert.ok(error<1e-10);assert.ok(Math.abs(result.receiverBalanceErrorMm)<1e-9);
  kernelChecks++;maxKernelError=Math.max(maxKernelError,error);
}
const wrong=held.map(([t,q])=>[t,q+10]);
const repeated=fit(plateau,training);assert.deepEqual(repeated,fitted);
assert.equal(fit(plateau.map(([t])=>[t,0]),training.map(([t])=>[t,0])).status,'unresolved');
const results=fitted.models.map(m=>({model:m,calibration:score(m,training),held:score(m,held),wrongHeld:score(m,wrong)}));
assert.ok(results.every(r=>r.wrongHeld.rmseMmHr>r.held.rmseMmHr));
const receipt={schema:'hamon-earth-c1-drainage-law-result/1',utc:new Date().toISOString(),protocolSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('frozen-protocol.json',root))).digest('hex'),sourceCsvSha256:crypto.createHash('sha256').update(source).digest('hex'),frozenModelSha256:modelSha,methodClarifications:['The positive observed plateau requires k>=q0/10000 for the maintained finite-storage domain; k=0 cannot emit positive drainage.','Scalar search uses a deterministic grid plus60 golden-section refinements around each local sampled minimum; no certified global optimality claim.','The delayed comparator is an empirical delay before the identical maintained dry decay, not a mass-conserving full-event transport model.','The maintained dry kernel is checked for all returned model predictions, not all intermediate objective trials.'],kernel:{checks:kernelChecks,maxErrorMmHr:maxKernelError},negativeControls:{wrongHeldDoesNotChangeFits:true,wrongHeldScoresWorse:true,zeroPlateauRefuses:true},results,originalCalibration:training,originalHeld:held};
fs.writeFileSync(new URL('result.json',output),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({q0:fitted.q0,modelSha,kernel:receipt.kernel,results:results.map(({model,calibration,held})=>({model,calibrationRmse:calibration.rmseMmHr,heldRmse:held.rmseMmHr,heldObservedMm:held.derivedTrapezoidObservedMm,heldPredictedMm:held.derivedTrapezoidPredictedMm}))},null,2));

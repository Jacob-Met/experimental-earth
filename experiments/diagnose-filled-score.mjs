import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),testSource=readFileSync(new URL('../tests/receiving-filled-drain.test.mjs',import.meta.url),'utf8');
const body=testSource.slice(testSource.indexOf('function ode('),testSource.indexOf("group('independently integrated"));
const ode=new Function('assert',body+'return ode;')(assert);
const c={R:31,C:14,k:.9,S0:11.2,T:70,u:240,v:420},times=[0,5,20,c.T,c.T+5,c.u,c.v],b=ode(c,times,2000);
const input={rainMmHr:c.R,infiltrationMmHr:24,stormMinutes:c.T,stormEndDepthMm:b.result.get(c.T).surface,stormUncertaintyMm:.005,areaM2:4,
readings:[c.u,c.v].map(minute=>({minute,valueLiters:b.result.get(minute).stored*4,uncertaintyLiters:.02,channel:'retained',use:'calibration'})),
drainedReadings:[0,5,20,c.T+5,c.u,c.v].map(minute=>({minute,valueLiters:b.result.get(minute).drained*4,uncertaintyLiters:.02,channel:'drained',use:'calibration'}))};
const frozen=JSON.parse(readFileSync(new URL('./filled-native-first-failure.json',import.meta.url))).files.find(f=>f.path==='post-dry-receiving-inverse.js').content;
async function inspect(text){
 const token='  const points=[];for(let i=0;i<FILLED_Q_POINTS;i++)';assert.equal(text.split(token).length,2);
 const diagnostic=text.replace(token,"  if(input.diagnosticQ!==undefined)return assess(input.diagnosticQ,{method:'diagnostic-only'});\n"+token);
 const module=await import('data:text/javascript;base64,'+Buffer.from(diagnostic).toString('base64'));
 const known=module.proposeFilledDrainBandWitnesses({...input,diagnosticQ:c.C*c.k}),around=[];
 for(const q of [12.379,12.38,12.380084723,12.381,12.59,12.599,12.6,12.601,12.61]){const v=module.proposeFilledDrainBandWitnesses({...input,diagnosticQ:q});around.push({q,score:v.score,rateInterval:v.rateInterval,violation:v.violation});}
 const result=module.proposeFilledDrainBandWitnesses(input);return {knownPhysicalFullRateUsedOnlyForDiagnostic:known,around,actualProducer:{proposals:result.proposals.length,best:result.points.at(-1)},originalInput:input};
}
const result={schema:'experimental-earth-filled-feasibility-score-diagnostic/1',before:await inspect(frozen),after:await inspect(readFileSync(new URL('../post-dry-receiving-inverse.js',import.meta.url),'utf8'))};
writeFileSync(new URL('./filled-score-diagnostic.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
for(const [label,r]of Object.entries(result).filter(([k])=>['before','after'].includes(k)))console.log(JSON.stringify({label,known:r.knownPhysicalFullRateUsedOnlyForDiagnostic,around:r.around,actual:r.actualProducer}));

import {PAIRED_MEAN_SCHEMA} from '../paired-mean-history.js';
export function meanFixture(){
 const x={schema:PAIRED_MEAN_SCHEMA,quantity:'Temperature',unit:'C',treatedPlace:'Surface',comparisonPlace:'Air',association:'Authored independent channels',boundary:'2026-01-06T00:00:00Z',boundaryBasis:'Authored descriptive split, not an intervention observation',comparisonOperator:{kind:'uniform-time-mean',basis:'Explicit uniform-time affine comparison; source weights remain unknown'},pairs:[]};
 for(const [i,[from,to]]of [[0,1],[2,4],[6,7],[8,10]].entries()){
  const role=i<2?'pre':'post',mid=(from+to)/2,gap=i<2?2+mid/2:-1+mid*1.25,p={role};
  for(const name of ['treated','comparison'])p[name]={from:new Date(Date.parse('2026-01-01T00:00:00Z')+from*86400000).toISOString().replace('.000Z','Z'),to:new Date(Date.parse('2026-01-01T00:00:00Z')+to*86400000).toISOString().replace('.000Z','Z'),value:20+(name==='treated'?gap:0),halfWidth:0,bandSource:'Authored exact comparison, not sensor error',source:'Authored integral control '+i,sourceAggregation:{kind:'reported-interval-mean',weighting:'unknown',basis:'Original temporal weights not supplied'},unit:'C',place:x[name+'Place']};
  x.pairs.push(p);
 }
 return x;
}
export function meanOracleInputs(){let seed=378;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};return Array.from({length:30},(_,i)=>{const x=meanFixture();for(const p of x.pairs){p.treated.value=20+(random()%33-16)/4;p.treated.halfWidth=(random()%7)/4;p.comparison.halfWidth=(random()%3)/8;}return x;});}

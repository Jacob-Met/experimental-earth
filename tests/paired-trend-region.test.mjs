import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {inferPairedTrendRegion,TREND_REGION_SCHEMA} from '../paired-trend-region.js';
import {comparePairedTrends,TREND_SCHEMA} from '../paired-trends.js';
import {changeExample} from '../measured-change.js';
export function inquiry(bands=[[0,0],[1,1]],later=[2,2]){
 const base=changeExample();const series={schema:'experimental-earth-paired-series/1',quantity:base.quantity,unit:base.unit,treatedPlace:base.treatedPlace,comparisonPlace:base.comparisonPlace,association:base.association,parallelChange:'Authored linear comparison assumption',intervention:'2026-06-20T00:00:00Z',pairs:[]};
 for(const [i,[lower,upper]]of [...bands,later].entries()){
  const post=i===bands.length,time=`2026-06-${String(post?21:i+1).padStart(2,'0')}T00:00:00Z`;
  series.pairs.push({role:post?'post':'pre',time,treated:{lower,upper,source:'Authored software control',unit:series.unit,place:series.treatedPlace,time},comparison:{lower:0,upper:0,source:'Authored comparison control',unit:series.unit,place:series.comparisonPlace,time}});
 }
 return {schema:TREND_REGION_SCHEMA,series,basis:'Continue one linear relation; authored control, not causal evidence'};
}
const exact=x=>`${x.exact.numerator}/${x.exact.denominator}`;
test('infers omitted slope without a candidate list; retains exact point/segment support',()=>{
 const x=inquiry([[0,0],[1.5,1.5]],[30,30]);const r=inferPairedTrendRegion(x);
 assert.equal(r.status,'boundary');assert.equal(r.vertices.length,1);assert.equal(exact(r.slope.lower),'3/2');assert.equal(exact(r.post[0].contrast.lower),'0/1');
 assert.deepEqual(comparePairedTrends({schema:TREND_SCHEMA,series:x.series,slopes:[0,1,2],basis:x.basis}).compatibleSlopes,[]);
 const segment=inferPairedTrendRegion(inquiry([[0,0],[0,2]],[0,0]));assert.equal(segment.vertices.length,2);assert.equal(segment.status,'boundary');
});
test('joint support is narrower than a box of independent baseline/slope extremes',()=>{
 const r=inferPairedTrendRegion(inquiry([[0,2],[0,2]],[0,0]));
 assert.equal(r.baseline.lower.lower,0);assert.equal(r.baseline.upper.upper,2);assert.equal(r.slope.lower.lower,-2);assert.equal(r.slope.upper.upper,2);
 assert.equal(r.post[0].predictedGap.lower.lower,-38);assert.equal(r.post[0].predictedGap.upper.upper,40); // independent box is [-40,42]
});
test('nonlinear original history rejects; later values never constrain inferred history',()=>{
 const bad=inferPairedTrendRegion(inquiry([[0,0],[1,1],[0,0]]));assert.equal(bad.status,'incompatible');assert.deepEqual(bad.post,[]);
 const x=inquiry([[0,2],[1,3],[2,4]]),r=inferPairedTrendRegion(x);x.series.pairs.at(-1).treated.lower=100;x.series.pairs.at(-1).treated.upper=100;
 const changed=inferPairedTrendRegion(x);assert.deepEqual(changed.vertices,r.vertices);assert.deepEqual(changed.slope,r.slope);assert.notDeepEqual(changed.post,r.post);
});
test('complete work refusal, source integrity, unsorted original pairs and replay',()=>{
 const x=inquiry([[0,2],[1,3],[2,4]]),before=structuredClone(x);const r=inferPairedTrendRegion(x);assert.deepEqual(x,before);assert.deepEqual(inferPairedTrendRegion(JSON.parse(JSON.stringify(x))),r);
 assert.throws(()=>inferPairedTrendRegion(x,{maxPairChecks:2}),/Complete/);assert.throws(()=>inferPairedTrendRegion(x,{maxConstraintChecks:1}),/capacity/);
 for(const mutate of [v=>v.extra=1,v=>v.basis='',v=>v.series.pairs[1].time=v.series.pairs[0].time,v=>v.series.pairs[0].treated.source='']){const v=structuredClone(x);mutate(v);assert.throws(()=>inferPairedTrendRegion(v));}
 const sorted=r.vertices.map(v=>[exact(v.baseline),exact(v.slope)]).sort();x.series.pairs.reverse();assert.deepEqual(inferPairedTrendRegion(x).vertices.map(v=>[exact(v.baseline),exact(v.slope)]).sort(),sorted);
});
test('independent Python Fraction enumeration of all constraint-line intersections',()=>{
 let seed=719;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed;};const inputs=[];
 for(let k=0;k<80;k++){const bands=Array.from({length:2+rand()%5},()=>{const lower=(rand()%21-10)/2;return [lower,lower+(rand()%9)/2];});inputs.push(inquiry(bands,[-1.25,2.5]));}
 const py=process.env.EARTH_FRACTION_ORACLE ? {status:0,stdout:readFileSync(process.env.EARTH_FRACTION_ORACLE,'utf8')} : spawnSync('python3',['-c',`
import sys,json,itertools
from fractions import Fraction as F
from datetime import datetime
out=[]
for x in json.load(sys.stdin):
 ps=x['series']['pairs'];origin=datetime.fromisoformat(ps[0]['time']); constraints=[]
 for p in ps[:-1]:
  t=F(int((datetime.fromisoformat(p['time'])-origin).total_seconds()),86400)
  lo=F(p['treated']['lower'])-F(p['comparison']['upper']);hi=F(p['treated']['upper'])-F(p['comparison']['lower'])
  constraints.extend([(F(1),t,hi),(F(-1),-t,-lo)])
 vertices=set()
 for (a,b,c),(d,e,f) in itertools.combinations(constraints,2):
  det=a*e-b*d
  if not det:continue
  v=((c*e-b*f)/det,(a*f-c*d)/det)
  if all(aa*v[0]+bb*v[1]<=cc for aa,bb,cc in constraints):vertices.add(v)
 def s(v):return str(v.numerator)+'/'+str(v.denominator)
 if not vertices:out.append(None);continue
 t=F(int((datetime.fromisoformat(ps[-1]['time'])-origin).total_seconds()),86400)
 predicted=[a+b*t for a,b in vertices]
 out.append({'vertices':sorted([[s(a),s(b)] for a,b in vertices]),'lo':s(F(-1.25)-max(predicted)),'hi':s(F(2.5)-min(predicted))})
print(json.dumps(out))
`],{input:JSON.stringify(inputs),encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);const expected=JSON.parse(py.stdout);
 inputs.forEach((x,i)=>{const r=inferPairedTrendRegion(x),e=expected[i];if(e===null){assert.equal(r.status,'incompatible');return;}assert.deepEqual(r.vertices.map(v=>[exact(v.baseline),exact(v.slope)]).sort(),e.vertices);assert.equal(exact(r.post[0].contrast.lower),e.lo);assert.equal(exact(r.post[0].contrast.upper),e.hi);});
});
test('complete 64-pair source admits steep second-spaced histories without guessed slope bounds',()=>{
 const x=inquiry(),template=x.series.pairs[0],origin=Date.parse('2026-06-01T00:00:00Z');
 x.series.intervention='2026-06-01T00:01:02Z';x.series.pairs=[];
 for(let i=0;i<64;i++){
  const time=new Date(origin+i*1000).toISOString().replace('.000Z','Z'),p=structuredClone(template);p.time=time;p.role=i<62?'pre':'post';
  // There must be no observation exactly at the declared intervention instant.
  if(i===62)continue;
  p.treated.time=time;p.comparison.time=time;p.treated.lower=p.treated.upper=i*1e10;x.series.pairs.push(p);
 }
 // Add another earlier instant to exercise the full 63-pre +1-post admission.
 const first=structuredClone(x.series.pairs[0]);first.time='2026-05-31T23:59:59Z';first.treated.time=first.comparison.time=first.time;first.treated.lower=first.treated.upper=-1e10;x.series.pairs.unshift(first);
 const r=inferPairedTrendRegion(x);assert.equal(x.series.pairs.length,64);assert.equal(r.work.pairChecks,1953);assert.equal(r.slope.lower.lower,864e12);assert.equal(r.vertices.length,1);assert.equal(exact(r.post[0].contrast.lower),'0/1');
});

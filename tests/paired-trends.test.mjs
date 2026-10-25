import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {comparePairedTrends} from '../paired-trends.js';import {trendFixture} from './paired-trends-fixture.mjs';
test('complete offered family preserves rejected slopes and ambiguous post directions',()=>{let r=comparePairedTrends(trendFixture());assert.deepEqual(r.compatibleSlopes,[2]);assert.ok(r.candidates.filter(c=>c.slope!==2).every(c=>c.post.length===0));const c=r.candidates.find(c=>c.slope===2);assert.equal(c.post[0].direction,'includes-zero');assert.ok(c.post[0].contrast.lower.lower<-.19&&c.post[0].contrast.upper.upper>.19);r=comparePairedTrends(trendFixture(true));assert.deepEqual(r.candidates.map(c=>c.post[0].direction),['positive','includes-zero','negative']);});
test('post values never select slopes; complete budget and malformed inputs refuse',()=>{const x=trendFixture(true),a=comparePairedTrends(x),old=structuredClone(x);x.series.pairs[2].treated.lower=100;x.series.pairs[2].treated.upper=110;const b=comparePairedTrends(x);assert.deepEqual(a.compatibleSlopes,b.compatibleSlopes);assert.deepEqual(a.candidates.map(c=>c.baseline),b.candidates.map(c=>c.baseline));assert.deepEqual(comparePairedTrends(old).source,old);assert.throws(()=>comparePairedTrends(old,{maxPairChecks:8}),/Complete family/);assert.equal(comparePairedTrends(old,{maxPairChecks:9}).work.pairChecks,9);for(const mutate of [x=>x.slopes=[1,2],x=>x.slopes=[0,0],x=>x.slopes=[0,Infinity],x=>x.slopes=[0,1e13],x=>x.basis='',x=>x.verdict='saved']){const v=trendFixture();mutate(v);assert.throws(()=>comparePairedTrends(v));}});
test('exact cancellation differs from floating contact without changing original bands',()=>{const x=trendFixture(true);x.slopes=[0,1];x.series.pairs[1].comparison.lower=11;x.series.pairs[1].comparison.upper=11;x.series.pairs[1].treated.upper=20-Number.EPSILON*16;const r=comparePairedTrends(x);assert.equal(r.candidates[0].status,'incompatible');assert.deepEqual(r.source,x);});
test('independent Python Fraction oracle checks original binary64 source/time arithmetic and outward projections',()=>{
 const inputs=[];for(let n=0;n<60;n++){const x=trendFixture(n%2===0);x.slopes=[-1.25,0,1.75];x.series.pairs.forEach((p,i)=>{p.treated.lower=((n*7+i*3)%31)/10;p.treated.upper=p.treated.lower+(n%5)/7;p.comparison.lower=((n*11+i*5)%23)/10;p.comparison.upper=p.comparison.lower+((n+2)%5)/9;const t=new Date(Date.parse(p.time)+(13+n)*1000).toISOString().replace('.000Z','Z');p.time=p.treated.time=p.comparison.time=t;});inputs.push(x);}
 const results=inputs.map(x=>comparePairedTrends(x));const oracle=String.raw`import sys,json
from fractions import Fraction as F
from datetime import datetime
payload=json.load(open(sys.argv[1]))
def instant(t): return datetime.fromisoformat(t.replace('Z','+00:00'))
def actual(r): return F(int(r['exact']['numerator']),int(r['exact']['denominator']))
def check(r,expected):
 assert actual(r)==expected,(r,expected)
 assert F(r['lower'])<=expected<=F(r['upper'])
for x,r in zip(payload['inputs'],payload['results']):
 pairs=x['series']['pairs'];pre=[(i,p) for i,p in enumerate(pairs) if p['role']=='pre'];post=[(i,p) for i,p in enumerate(pairs) if p['role']=='post'];origin=min(instant(p['time'])for _,p in pre)
 for slope,c in zip(x['slopes'],r['candidates']):
  shifted=[]
  for p in pairs:
   seconds=int((instant(p['time'])-origin).total_seconds());shift=F(slope)*F(seconds,86400)
   shifted.append((F(p['treated']['lower'])-F(p['comparison']['upper'])-shift,F(p['treated']['upper'])-F(p['comparison']['lower'])-shift))
  low=max(shifted[i][0]for i,_ in pre);high=min(shifted[i][1]for i,_ in pre)
  assert c['status']==('incompatible'if low>high else 'boundary'if low==high else 'compatible')
  check(c['baseline']['lower'],low);check(c['baseline']['upper'],high)
  if low>high: assert c['post']==[]
  else:
   for (i,p),out in zip(post,c['post']):
    check(out['contrast']['lower'],shifted[i][0]-high);check(out['contrast']['upper'],shifted[i][1]-low)
print('60 original-source courses /180 complete candidates match Fraction oracle')`;
 const directory=mkdtempSync(join(tmpdir(),'earth-trend-oracle-')),path=join(directory,'source.json');writeFileSync(path,JSON.stringify({inputs,results}));const run=spawnSync('python3',['-c',oracle,path],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:10000});rmSync(directory,{recursive:true,force:true});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/180 complete candidates/);
});

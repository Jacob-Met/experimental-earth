import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {inferPairedTrendOnset} from '../paired-trend-onset.js';
import {inferPairedTrendResponse} from '../paired-trend-response.js';
import {shiftFixture} from './paired-trend-shift-fixture.mjs';
import {onsetFixture,onsetOracleInputs} from './paired-trend-onset-fixture.mjs';
const value=x=>Number(x.exact.numerator)/Number(x.exact.denominator),exact=x=>x.exact.numerator+'/'+x.exact.denominator;
const rows=x=>x.response.inquiry.series.pairs;
function uncertain(){const x=onsetFixture();for(const p of rows(x)){p.treated.lower-=.1;p.treated.upper+=.1;}return x;}
test('continuous onset is inferred over the complete original gap without offered times',()=>{
 const x=onsetFixture(),r=inferPairedTrendOnset(x);
 assert.equal(r.status,'change-compatible');assert.equal(r.unchangedSupported,false);assert.equal(r.branches.length,1);assert.equal(r.branches[0].slopeChangeDirection,'positive');
 assert.equal(value(r.branches[0].offsetAfterLastEarlierDays.lower),.5);assert.equal(value(r.branches[0].offsetAfterLastEarlierDays.upper),.5);
 const u=inferPairedTrendOnset(uncertain());assert(Math.abs(value(u.branches[0].offsetAfterLastEarlierDays.lower)-.3)<1e-14);assert(Math.abs(value(u.branches[0].offsetAfterLastEarlierDays.upper)-.7)<1e-14);
});
test('closed endpoints, negative and tiny nonzero slopes retain exact onset semantics',()=>{
 for(const [later,expected]of [[[1,2],0],[[0,1],1]]){
  const x=onsetFixture();for(let k=0;k<2;k++)rows(x)[k+2].treated.lower=rows(x)[k+2].treated.upper=later[k];
  const r=inferPairedTrendOnset(x);assert.equal(value(r.branches[0].offsetAfterLastEarlierDays.lower),expected);assert.equal(value(r.branches[0].offsetAfterLastEarlierDays.upper),expected);
 }
 const x=uncertain(),positive=inferPairedTrendOnset(x);for(const p of rows(x)){const a=p.treated.lower;p.treated.lower=-p.treated.upper;p.treated.upper=-a;}
 const negative=inferPairedTrendOnset(x);assert.equal(negative.branches[0].slopeChangeDirection,'negative');assert.deepEqual(negative.branches[0].offsetAfterLastEarlierDays,positive.branches[0].offsetAfterLastEarlierDays);
 const tiny=onsetFixture();for(const p of rows(tiny)){p.treated.lower*=2**-30;p.treated.upper*=2**-30;}
 const t=inferPairedTrendOnset(tiny);assert.equal(t.unchangedSupported,false);assert.equal(value(t.branches[0].offsetAfterLastEarlierDays.lower),.5);
});
test('unchanged history, both directions, incompatible continuity and unavailable histories are separate',()=>{
 const x=onsetFixture();for(const p of rows(x))p.treated.lower=p.treated.upper=0;
 const same=inferPairedTrendOnset(x);assert.equal(same.status,'unchanged-only');assert.equal(same.unchangedSupported,true);assert.deepEqual(same.branches,[]);
 for(const p of rows(x)){p.treated.lower=-1;p.treated.upper=1;}
 const both=inferPairedTrendOnset(x);assert.equal(both.branches.length,2);assert.equal(both.unchangedSupported,true);
 for(const b of both.branches){assert.equal(value(b.offsetAfterLastEarlierDays.lower),0);assert.equal(value(b.offsetAfterLastEarlierDays.upper),1);}
 const no=onsetFixture();no.response.inquiry=shiftFixture(1).inquiry;const r=inferPairedTrendOnset(no);assert.equal(r.status,'continuous-change-incompatible');assert.equal(r.unchangedSupported,false);assert.deepEqual(r.branches,[]);
 const short=onsetFixture();rows(short).pop();assert.equal(inferPairedTrendOnset(short).status,'response-unavailable');
});
test('original regions stay unchanged and changing reference instant does not select an onset',()=>{
 const x=uncertain(),copy=structuredClone(x),r=inferPairedTrendOnset(x);assert.deepEqual(x,copy);assert.deepEqual(r.response,inferPairedTrendResponse(x.response));
 x.response.inquiry.series.intervention='2026-01-02T06:00:00Z';const changed=inferPairedTrendOnset(x);
 assert.deepEqual(changed.branches[0].offsetAfterLastEarlierDays,r.branches[0].offsetAfterLastEarlierDays);assert.deepEqual(changed.response.earlier.vertices,r.response.earlier.vertices);
});
test('complete shared work and projection bounds refuse rather than return partial onset intervals',()=>{
 const x=uncertain();for(const options of [{maxRootEvaluations:1},{maxRootEvaluations:0},{maxRootEvaluations:513},{maxConstraintChecks:1},{maxHullChecks:1}])assert.throws(()=>inferPairedTrendOnset(x,options));
 const response=inferPairedTrendResponse(x.response);assert.throws(()=>inferPairedTrendOnset(x,{maxConstraintChecks:response.work.constraintChecks}));
 assert.throws(()=>inferPairedTrendOnset({...x,model:'intervention-cause'}));assert.throws(()=>inferPairedTrendOnset({...x,selectedOnset:'2026-01-02T12:00:00Z'}));
 const many=onsetFixture(),template=rows(many)[0];many.response.inquiry.series.pairs=[];many.response.inquiry.series.intervention='2026-02-01T12:00:00Z';
 for(let i=0;i<64;i++){const p=structuredClone(template),time=new Date(Date.parse('2026-01-01T00:00:00Z')+i*86400000).toISOString().replace('.000Z','Z'),center=i<32?0:i-31.5;p.time=p.treated.time=p.comparison.time=time;p.role=i<32?'pre':'post';p.treated.lower=center-.125;p.treated.upper=center+.125;rows(many).push(p);}
 const r=inferPairedTrendOnset(many);assert.equal(r.status,'change-compatible');assert(r.work.rootEvaluations<=512);assert(r.work.constraintChecks>=r.work.responseConstraintChecks);assert(r.work.constraintChecks<=200000);
});
test('independent original 4D constraints reproduce every signed onset interval',()=>{
 const cases=onsetOracleInputs();let oracle;
 if(process.env.EARTH_ONSET_ORACLE)oracle=JSON.parse(readFileSync(process.env.EARTH_ONSET_ORACLE,'utf8'));
 else{const p=spawnSync('python3',['tests/paired-trend-onset-oracle.py'],{input:JSON.stringify(cases),encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(p.status,0,p.stderr);oracle=JSON.parse(p.stdout);}
 for(const [i,x]of cases.entries()){
  const r=inferPairedTrendOnset(x);assert.equal(r.unchangedSupported,oracle[i].unchanged);
  assert.deepEqual(r.branches.map(b=>({direction:b.slopeChangeDirection,bounds:[exact(b.offsetAfterLastEarlierDays.lower),exact(b.offsetAfterLastEarlierDays.upper)]})),oracle[i].parts);
 }
});

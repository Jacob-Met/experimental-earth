import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inferPairedMeanHistory} from '../paired-mean-history.js';
import {receiveNoaaPairedMeans,NOAA_PAIRED_MEAN_SCHEMA} from '../noaa-paired-means.js';
import {meanFixture} from './paired-mean-fixture.mjs';
import {inferPairedTrendResponse as revisedResponse} from '../paired-trend-response.js';
import {inferPairedTrendOnset as revisedOnset} from '../paired-trend-onset.js';
import {onsetOracleInputs} from './paired-trend-onset-fixture.mjs';
const value=x=>Number(x.exact.numerator)/Number(x.exact.denominator);
test('unequal original mean supports constrain the affine integral and retain their actual gap',()=>{
 const x=meanFixture(),copy=structuredClone(x),r=inferPairedMeanHistory(x);assert.deepEqual(x,copy);
 assert.equal(r.status,'response-compatible');assert.equal(value(r.jump.lower),.75);assert.equal(value(r.slopeChange.lower),.75);
 assert.equal(r.onset.gap.start,'2026-01-05T00:00:00Z');assert.equal(r.onset.gap.end,'2026-01-07T00:00:00Z');
 assert.equal(value(r.onset.branches[0].offsetAfterLastEarlierDays.lower),0);
 assert.equal(r.earlier.observations[0].support.to,x.pairs[0].treated.to);assert.equal(value(r.earlier.observations[0].meanTimeCoefficientDays),.5);
 assert.equal(r.source.pairs[0].treated.sourceAggregation.weighting,'unknown');assert(!('time' in r.source.pairs[0]));
});
test('operator, support and original source admission refuses guessed or crossing observations',()=>{
 for(const edit of [x=>delete x.comparisonOperator,x=>x.comparisonOperator.kind='sample-weighted',x=>x.comparisonOperator.basis='',x=>x.pairs[0].comparison.to='2026-01-02T00:00:01Z',x=>x.pairs[1].treated.to=x.pairs[1].comparison.to='2026-01-07T00:00:00Z',x=>x.pairs[0].treated.sourceAggregation.weighting='assumed',x=>x.pairs[0].treated.time=x.pairs[0].treated.to]){const x=meanFixture();edit(x);assert.throws(()=>inferPairedMeanHistory(x));}
 const x=meanFixture();for(const name of ['treated','comparison']){x.pairs[1][name].from='2026-01-01T06:00:00Z';x.pairs[1][name].to='2026-01-01T18:00:00Z';x.pairs[1][name].value=x.pairs[0][name].value;}
 assert.equal(inferPairedMeanHistory(x).status,'earlier-operator-unbounded');x.pairs[1].treated.value++;assert.equal(inferPairedMeanHistory(x).status,'earlier-incompatible');
 const short=meanFixture();short.pairs.pop();assert.equal(inferPairedMeanHistory(short).status,'insufficient-later-operator-support');
});
test('half-second first moments remain exact and complete work refuses partial results',()=>{
 const x=meanFixture();for(const name of ['treated','comparison'])x.pairs[0][name].to='2026-01-01T00:00:01Z';const r=inferPairedMeanHistory(x);
 assert.deepEqual(r.earlier.observations[0].meanTimeCoefficientDays.exact,{numerator:'1',denominator:'172800'});
 for(const options of [{maxPairChecks:1},{maxConstraintChecks:1},{maxVertexPairs:0},{maxHullChecks:0},{maxRootEvaluations:0}])assert.throws(()=>inferPairedMeanHistory(x,options));
 assert.throws(()=>inferPairedMeanHistory(x,{maxConstraintChecks:r.work.constraintChecks}));
});
test('complete 64-mean course stays bounded without selecting a representative observation',()=>{
 const x=meanFixture(),template=x.pairs[0];x.pairs=[];x.boundary='2026-02-02T00:00:00Z';
 for(let i=0;i<64;i++){const p=structuredClone(template);p.role=i<32?'pre':'post';for(const name of ['treated','comparison']){p[name].from=new Date(Date.parse('2026-01-01T00:00:00Z')+i*86400000).toISOString().replace('.000Z','Z');p[name].to=new Date(Date.parse(p[name].from)+43200000).toISOString().replace('.000Z','Z');p[name].value=20+(name==='treated'?(i<32?1+(i+.25)/4:4+(i+.25)/2):0);p[name].halfWidth=.125;}x.pairs.push(p);}
 const r=inferPairedMeanHistory(x);assert.equal(r.status,'response-compatible');assert.equal(r.work.pairChecks,992);assert.equal(r.earlier.observations.length,32);assert.equal(r.later.observations.length,32);assert(r.onset.work.constraintChecks<=200000);assert(r.onset.work.rootEvaluations<=512);assert(value(r.jump.lower)<=11&&value(r.jump.upper)>=11);
});
export function noaaRecipe(rawText){return{schema:NOAA_PAIRED_MEAN_SCHEMA,source:{sourceUrl:'https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-AZ_Tucson_11_W.txt',sha256:'247bd26d2cdc1af26c933af2ced818d00dfbe629e4d1cdfae9a5a81b1b9547ac',rawText},selection:{firstLine:1,count:4,correctionType:'C'},channels:{treated:'SUR_TEMP',comparison:'T_HR_AVG'},boundary:'2025-01-01T17:00:00Z',boundaryBasis:'Authored descriptive split, not a recorded intervention',association:'Original same-station infrared surface minus air channels',comparisonOperator:{kind:'uniform-time-mean',basis:'Explicit conditional affine uniform-time comparison; actual sensor weights unknown'},bands:{treated:{halfWidth:0,source:'Exact printed-value comparison, not measurement uncertainty'},comparison:{halfWidth:0,source:'Exact printed-value comparison, not measurement uncertainty'}}};}
test('actual original NOAA means replay without inventing point readings or sensor weights',async()=>{
 const raw=readFileSync('examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt','utf8'),x=noaaRecipe(raw),copy=structuredClone(x),r=await receiveNoaaPairedMeans(x);assert.deepEqual(x,copy);
 assert(Math.abs(value(r.report.jump.lower)-2.15)<1e-12);assert(Math.abs(value(r.report.slopeChange.lower)/24-3.3)<1e-12);
 assert.equal(r.report.onset.gap.start,r.report.onset.gap.end);assert.equal(r.report.onset.status,'continuous-change-incompatible');assert.equal(r.input.pairs[0].treated.sourceAggregation.weighting,'unknown');assert.equal(r.input.pairs[0].treated.from,'2025-01-01T15:00:00Z');
 for(const edit of [x=>x.source.sha256='0'.repeat(64),x=>x.boundary='2025-01-01T17:30:00Z',x=>x.selection.correctionType='R',x=>x.selection.count=64]){const bad=structuredClone(x);edit(bad);await assert.rejects(receiveNoaaPairedMeans(bad));}
 const pending=receiveNoaaPairedMeans(x);x.boundary='2025-01-01T17:30:00Z';assert.equal((await pending).recipe.boundary,copy.boundary);
});
test('shared projection extraction preserves every original point response and onset field',async()=>{
 if(!process.env.EARTH_POINT_BASELINE)return;
 const {inferPairedTrendResponse}=await import(process.env.EARTH_POINT_BASELINE+'/paired-trend-response.js'),{inferPairedTrendOnset}=await import(process.env.EARTH_POINT_BASELINE+'/paired-trend-onset.js');
 for(const x of onsetOracleInputs()){assert.deepEqual(revisedResponse(x.response),inferPairedTrendResponse(x.response));assert.deepEqual(revisedOnset(x),inferPairedTrendOnset(x));}
});

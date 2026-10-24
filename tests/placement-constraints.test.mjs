import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {comparePlacements,adoptPlacement} from '../placement-search.js';
import {validatePlacementTargets,assessPlacementTargets} from '../placement-constraints.js';
const target={cellIndex:10,maxPeakChangeMm:-1,basis:'Authored C2 reduction objective; not field evidence'};
function fixture(){const p=makeExample();p.proposal=structuredClone(p.existing);return p;}
function query(p,targets=[]){return {eligibleCells:p.existing.flatMap((c,i)=>c.surface==='sealed'?[i]:[]),maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study:{target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]},targets};}
test('courtyard local target changes admissible choice without changing original simulations or scores',()=>{
 const p=fixture(),before=structuredClone(p),plain=comparePlacements(p,query(p)),r=comparePlacements(p,query(p,[target]));
 assert.deepEqual(plain.best[0],[27,36]);assert.ok(r.qualifyingCount>0&&r.qualifyingCount<r.variantCount);assert.deepEqual(r.best,[[18,36]]);assert.equal(r.qualifyingCount,12);
 assert.equal(r.plans.find(x=>x.cells.join(',')==='27,36').localTargets.meets,false);
 assert.equal(r.plans.find(x=>x.cells.join(',')==='18,19').localTargets.meets,true);
 assert.ok(Math.abs(r.plans.find(x=>x.cells.join(',')==='27,36').localTargets.checks[0].worstChangeMm+.08173370018158721)<1e-10);
 assert.deepEqual(r.plans.map(x=>[x.cells,x.score,x.candidates]),plain.plans.map(x=>[x.cells,x.score,x.candidates]));assert.deepEqual(p,before);
 assert.equal(r.plans.find(x=>!x.cells.length).localTargets.meets,false);
 assert.throws(()=>adoptPlacement(p,r.query,[27,36],r.sourceSignature),/does not meet/);
 const adopted=adoptPlacement(p,r.query,r.best[0],r.sourceSignature);assert.notDeepEqual(adopted.proposal,p.proposal);assert.deepEqual(adopted.existing,p.existing);
});
test('all retained rates and all targets must meet inclusive exact bounds, not their average',()=>{
 const candidates=[{rateMmHr:1,peakDeltaMm:[-3,0]},{rateMmHr:4,peakDeltaMm:[1,-2]}];
 const r=assessPlacementTargets(candidates,[{cellIndex:0,maxPeakChangeMm:0,basis:'no increase'},{cellIndex:1,maxPeakChangeMm:0,basis:'inclusive'}]);
 assert.equal(r.meets,false);assert.equal(r.checks[1].meets,true);assert.equal(r.checks[0].witnesses[1].excessMm,1);
 assert.equal(assessPlacementTargets([{rateMmHr:1,peakDeltaMm:[Number.EPSILON]}],[{cellIndex:0,maxPeakChangeMm:0}]).meets,false);
 assert.throws(()=>assessPlacementTargets([],[]),/retained/);assert.throws(()=>assessPlacementTargets([{peakDeltaMm:[]}],[target]),/Missing/);
});
test('impossible target has no winner or adoption fallback; no targets preserves ordinary choices',()=>{
 const p=fixture(),r=comparePlacements(p,query(p,[{...target,maxPeakChangeMm:-1000}]));assert.equal(r.qualifyingCount,0);assert.deepEqual(r.best,[]);assert.equal(r.plans.length,79);
 assert.throws(()=>adoptPlacement(p,r.query,[],r.sourceSignature),/does not meet/);
 const zero=comparePlacements(p,query(p,[{...target,maxPeakChangeMm:0}]));assert.equal(zero.plans.find(x=>!x.cells.length).localTargets.meets,true);
 p.weather.rainMmHr=0;const dry=comparePlacements(p,query(p,[target]));assert.equal(dry.qualifyingCount,0);
});
test('invalid declarations reject before calculation and source edits refuse adoption',()=>{
 const p=fixture();for(const targets of [null,Array(1),[target,target],[{...target,cellIndex:48}],[{...target,maxPeakChangeMm:NaN}],[{...target,maxPeakChangeMm:1001}],[{...target,basis:' '}],[{...target,basis:'x'.repeat(501)}]])assert.throws(()=>validatePlacementTargets(p,targets));
 const q=query(p,[target]),r=comparePlacements(p,q);p.weather.rainMmHr+=1;assert.throws(()=>adoptPlacement(p,q,r.best[0],r.sourceSignature),/changed/);
 assert.deepEqual(validatePlacementTargets(p,[{...target,basis:' trimmed '}])[0].basis,'trimmed');
});

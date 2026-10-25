import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {planInfiltrationReadings} from '../complementary-infiltration.js';
import {planComplementaryDepths,validateDepthAvailability} from '../complementary-depth-plan.js';
const scope=(extra={})=>({cellIndices:[0,1],startMinute:5,endMinute:10,basis:'Declared software acquisition scope',...extra});
const runs=[{snapshots:[{minute:0,depthsMm:[0,0,0]},{minute:5,depthsMm:[0,0,0]},{minute:10,depthsMm:[0,0,0]}]},{snapshots:[{minute:0,depthsMm:[0,0,0]},{minute:5,depthsMm:[10,10,10]},{minute:10,depthsMm:[10,10,10]}]}];
test('scope is applied before equivalent-pattern compression and preserves original coordinates',()=>{
 const before=JSON.stringify(runs),r=planComplementaryDepths(runs,{uncertaintyMm:1,strategy:'exact-pair',availability:scope({cellIndices:[2],startMinute:10})});
 assert.deepEqual(r.questions.map(q=>[q.cellIndex,q.minute]),[[2,10]]);assert.equal(r.unavailableCount,5);assert.equal(r.offeredCount,1);assert.equal(r.evaluatedCount,1);assert.equal(JSON.stringify(runs),before);
 const full=planComplementaryDepths(runs,{uncertaintyMm:1});assert.equal(full.questions[0].cellIndex,0);assert.equal(Object.hasOwn(full,'availability'),false);
});
test('unavailable, recorded, and signal-free offered points remain distinct',()=>{
 const opts={uncertaintyMm:1,strategy:'exact-pair'};
 const empty=planComplementaryDepths(runs,{...opts,availability:scope({cellIndices:[]})});assert.equal(empty.status,'unavailable');assert.equal(empty.offeredCount,0);assert.equal(empty.unavailableCount,6);
 const between=planComplementaryDepths(runs,{...opts,availability:scope({startMinute:6,endMinute:9})});assert.equal(between.status,'unavailable');
 const recorded=planComplementaryDepths(runs,{...opts,availability:scope({cellIndices:[2],startMinute:10}),recorded:[{cellIndex:2,minute:10}]});assert.equal(recorded.status,'all-recorded');assert.equal(recorded.excludedCount,1);assert.equal(recorded.unavailableCount,5);
 const quiet=planComplementaryDepths([runs[0],runs[0]],{...opts,availability:scope()});assert.equal(quiet.status,'indistinguishable');assert.equal(quiet.evaluatedCount,4);
});
test('scope admission rejects sparse, duplicated, unknown and out-of-event declarations',()=>{
 for(const s of [null,[],scope({cellIndices:[,1]}),scope({cellIndices:[0,0]}),scope({cellIndices:[3]}),scope({startMinute:11}),scope({endMinute:11}),scope({basis:' '}),{...scope(),extra:true}])assert.throws(()=>validateDepthAvailability(s,3,10));
 const p=makeExample();p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[0,3]};assert.throws(()=>planInfiltrationReadings(p,{uncertaintyMm:1,availability:scope({endMinute:241})}),/original event/);
});
test('original courtyard responds to actual offered cells/window without altering model or evidence',()=>{
 const p=makeExample();p.weather.rainMmHr=24;p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[0,1,3,6,9,15,22,40,60]};p.observations=[{cellIndex:0,minute:0,depthMm:0,uncertaintyMm:0,source:'Authored original initial control',scenario:'existing',use:'calibration'}];
 const before=JSON.stringify(p),options={uncertaintyMm:2,strategy:'exact-pair'},firstRows=scope({cellIndices:Array.from({length:24},(_,i)=>i),startMinute:0,endMinute:240});
 const all=planInfiltrationReadings(p,options),cells=planInfiltrationReadings(p,{...options,availability:firstRows}),window=planInfiltrationReadings(p,{...options,availability:{...firstRows,startMinute:40,endMinute:80}});
 assert.equal(all.separatedPairCount,34);assert.deepEqual(all.questions.map(q=>[q.cellIndex,q.minute]),[[45,40],[10,120]]);
 assert.equal(cells.separatedPairCount,34);assert.deepEqual(cells.questions.map(q=>[q.cellIndex,q.minute]),[[13,50],[10,120]]);
 assert.equal(window.separatedPairCount,32);assert.deepEqual(window.questions.map(q=>[q.cellIndex,q.minute]),[[13,50],[2,80]]);assert.equal(window.offeredCount,216);assert.equal(window.unavailableCount,2088);assert.equal(window.exact.evaluatedPlans,1275);assert.deepEqual(window.ratesMmHr,all.ratesMmHr);assert.equal(JSON.stringify(p),before);
});

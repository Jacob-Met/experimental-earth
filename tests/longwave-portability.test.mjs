import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeLongwaveHeat,parseLongwaveHeat,LONGWAVE_FILE_MAX_BYTES} from '../longwave-portability.js';
import {compareLongwaveHeat,canonicalLongwaveHeat} from '../longwave-heat.js';
import {longwavePortabilityFixture} from './longwave-portability-fixture.mjs';
const bytes=x=>new TextEncoder().encode(x).byteLength;

test('a complete multibyte original exceeding the old reader limit reopens exactly',()=>{
 const input=longwavePortabilityFixture({multibyte:true}),before=JSON.stringify(input),text=serializeLongwaveHeat(input);
 assert.ok(bytes(text)>120000);assert.ok(bytes(text)<LONGWAVE_FILE_MAX_BYTES);
 assert.deepEqual(parseLongwaveHeat(text),canonicalLongwaveHeat(input));
 assert.deepEqual(compareLongwaveHeat(parseLongwaveHeat(text)),compareLongwaveHeat(input));
 assert.equal(JSON.stringify(input),before);
});
test('JSON escaping and maximal admitted strings fit the derived complete canonical envelope',()=>{
 const input=longwavePortabilityFixture({escaped:true}),text=serializeLongwaveHeat(input);
 assert.ok(bytes(text)>256*1024,'256 KiB would not cover every admitted original');
 assert.ok(bytes(text)<LONGWAVE_FILE_MAX_BYTES);assert.deepEqual(parseLongwaveHeat(text),canonicalLongwaveHeat(input));
 // Empty-source shape counts only fixed keys, labels, indentation and quotes.
 const skeleton=canonicalLongwaveHeat(input);skeleton.heatStudy.contextJson='';
 for(const t of ['existing','proposal']){skeleton[t].source='';skeleton.heatStudy[t].source='';}
 for(const row of skeleton.heatStudy.schedule)row.source='';for(const row of skeleton.radiationSchedule)row.source='';
 const fixedBytes=bytes(JSON.stringify(skeleton,null,2));
 const conservative=46400*6+fixedBytes+107*32;
 assert.ok(conservative<LONGWAVE_FILE_MAX_BYTES,`canonical bound ${conservative}`);
});
test('raw UTF-8 bound applies before parse; malformed or unsupported original cannot become accepted',()=>{
 const valid=serializeLongwaveHeat(longwavePortabilityFixture());
 assert.throws(()=>parseLongwaveHeat(valid+' '.repeat(LONGWAVE_FILE_MAX_BYTES)),/320 KiB/);
 assert.throws(()=>parseLongwaveHeat('場'.repeat(LONGWAVE_FILE_MAX_BYTES/2)),/320 KiB/);
 assert.throws(()=>parseLongwaveHeat('{bad'));assert.throws(()=>parseLongwaveHeat('{}'));
 const invalid=longwavePortabilityFixture();invalid.existing.emissivity=2;assert.throws(()=>serializeLongwaveHeat(invalid));
});
test('original-only portability strips derived values without changing authoritative declared data',()=>{
 const x=longwavePortabilityFixture(),expected=canonicalLongwaveHeat(x);x.result={temperatureC:999};x.heatStudy.existing.computedC=999;
 assert.deepEqual(parseLongwaveHeat(serializeLongwaveHeat(x)),expected);
});

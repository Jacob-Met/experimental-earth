import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceHeatColumnWithBottom} from '../heat-column-step.js';

// Frozen before candidate receiving by the independent Decimal matrix oracle.
// These are authored mathematical controls, not measured environmental evidence.
const reference=JSON.parse(readFileSync(new URL('./fixtures/bottom-heat-reference.json',import.meta.url),'utf8'));
for(const c of reference.cases)test('independent bottom reference: '+c.name,()=>{
 const p=c.input;
 const actual=advanceHeatColumnWithBottom(
  {capacityJm2K:p.c1,exchangeWm2K:p.h,absorptivity:1},
  {capacityJm2K:p.c2,conductanceWm2K:p.g},
  {incidentWm2:p.q,reservoirC:p.ambient},
  {surfaceC:p.surface,subsurfaceC:p.lower},p.seconds,
  {conductanceWm2K:p.b,reservoirC:p.deep});
 for(const [key,text]of Object.entries(c.expected)){
  const name=key==='bottomExchangeOutJm2'?'bottomOutJm2':key;
  const expected=Number(text),error=Math.abs(actual[name]-expected);
  const tolerance=key.endsWith('ResidualJm2')
   ?2e-6+1e-12*(Math.abs(actual.inputJm2)+Math.abs(actual.bottomOutJm2)+Math.abs(actual.totalStoredJm2))
   :key.endsWith('C')?1e-9:2e-8+5e-12*Math.max(1,Math.abs(expected));
  assert.ok(Number.isFinite(error)&&error<=tolerance,
   c.name+' '+key+': actual '+actual[name]+', reference '+expected+', error '+error+', tolerance '+tolerance);
 }
});

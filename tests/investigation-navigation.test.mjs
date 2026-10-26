import test from 'node:test';
import assert from 'node:assert/strict';
import {filterInvestigations} from '../investigation-navigation.js';

const entries = Object.freeze([
  Object.freeze({id:'heat',title:'How does a surface warm up and cool down?',description:'Compare two uniform layers. Heat capacity and absorption are explicit declarations.',topic:'TEMPERATURE'}),
  Object.freeze({id:'rain',title:'Where does rain from this area end up?',description:'Follow water through the existing site and the proposed garden.',topic:'RAINFALL'}),
  Object.freeze({id:'roots',title:'Water retained for roots',description:'Compare soil water and declared transpiration demand.',topic:'SOIL'}),
  Object.freeze({id:'cafe',title:'Café courtyard observations',description:'Original temperature records: a+b and [reading].',topic:'EVIDENCE'})
]);
test('question and original introduction combine for literal multiword search',()=>{
  assert.deepEqual(filterInvestigations(entries,' surface CAPACITY ').map(e=>e.id),['heat']);
  assert.deepEqual(filterInvestigations(entries,'water garden').map(e=>e.id),['rain']);
  assert.deepEqual(filterInvestigations(entries,'soil demand').map(e=>e.id),['roots']);
});
test('an empty search keeps every existing investigation in its original order',()=>{
  const result=filterInvestigations(entries,' \n ');
  assert.deepEqual(result,entries);
  assert.notEqual(result,entries);
  assert.equal(result[0],entries[0]);
});
test('accents and topic labels are searchable without modifying source titles',()=>{
  assert.deepEqual(filterInvestigations(entries,'CAFE temperature').map(e=>e.id),['cafe']);
  assert.deepEqual(filterInvestigations(entries,'rainfall').map(e=>e.id),['rain']);
  assert.equal(entries[3].title,'Café courtyard observations');
});
test('query punctuation is literal and unmatched questions stay empty',()=>{
  assert.deepEqual(filterInvestigations(entries,'a+b [reading]').map(e=>e.id),['cafe']);
  for(const query of ['.*','<script>','absent question'])assert.deepEqual(filterInvestigations(entries,query),[]);
});
test('separate workbenches with the same question remain independently reachable',()=>{
  const repeated=[{id:'first',title:'Compare water'},{id:'second',title:'Compare water'}];
  assert.deepEqual(filterInvestigations(repeated,'water').map(e=>e.id),['first','second']);
});

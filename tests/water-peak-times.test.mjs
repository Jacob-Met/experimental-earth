import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {compare, makeExample, validateProject} from '../core.js';
import {retainedWaterPeaks, createWaterHistoryValues} from '../water-history-values.js';

const paired = (minutes, a, b) => ({
  existing: {snapshots: minutes.map((minute,i) => ({minute,storedLiters:a[i]}))},
  proposal: {snapshots: minutes.map((minute,i) => ({minute,storedLiters:b[i]}))},
});
function oracle(comparison) {
  const answer = {};
  for (const [name,key] of [['existing','existing'],['proposed','proposal']]) {
    const rows=comparison[key].snapshots, liters=Math.max(...rows.map(row=>row.storedLiters));
    const indices=rows.map((row,i)=>row.storedLiters===liters?i:-1).filter(i=>i>=0);
    answer[name]={liters,indices,minutes:indices.map(i=>rows[i].minute)};
  }
  return answer;
}

test('Different scenario maxima and every exact tie retain their original paired indices',()=>{
  const input=paired([0,2,4,5.5],[1,8,3,8],[7,2,7,0]),before=structuredClone(input);
  const result=retainedWaterPeaks(input);
  assert.deepEqual(result,{existing:{liters:8,indices:[1,3],minutes:[2,5.5]},proposed:{liters:7,indices:[0,2],minutes:[0,4]}});
  assert.deepEqual(input,before);
  input.existing.snapshots[1].storedLiters=999;
  assert.deepEqual(result.existing,{liters:8,indices:[1,3],minutes:[2,5.5]});
  assert.throws(()=>result.existing.indices.push(0),TypeError);
  assert.throws(()=>{result.proposed.liters=0;},TypeError);
});

test('Dry and zero peaks keep every tie, including all 721 retained endpoints',()=>{
  for(const n of [1,49,721]){
    const times=Array.from({length:n},(_,i)=>i===n-1&&n>1?i+.25:i);
    const zeros=Array(n).fill(0),result=retainedWaterPeaks(paired(times,zeros,zeros));
    for(const peak of Object.values(result)){
      assert.equal(peak.liters,0);assert.deepEqual(peak.minutes,times);
      assert.deepEqual(peak.indices,Array.from({length:n},(_,i)=>i));
    }
  }
});

test('Peak comparisons keep native number equality and signed-zero Math.max semantics',()=>{
  const a=[-0,0,Number.MIN_VALUE,Number.MIN_VALUE],b=[-0,-0,-0,-0];
  const result=retainedWaterPeaks(paired([0,1,2,3],a,b));
  assert.deepEqual(result.existing.indices,[2,3]);assert.equal(result.existing.liters,Number.MIN_VALUE);
  assert.ok(Object.is(result.proposed.liters,-0));assert.deepEqual(result.proposed.indices,[0,1,2,3]);
  assert.ok(Object.is(retainedWaterPeaks(paired([0,1],[-0,0],[0,-0])).existing.liters,0));
});

test('Invalid or unpaired retained courses refuse before a peak is invented',()=>{
  for(const bad of [null,{},paired([],[],[]),paired([0,0],[1,2],[3,4]),
    paired([1,0],[1,2],[3,4]),paired([0],[NaN],[0]),paired([0],[-1],[0])])
    assert.throws(()=>retainedWaterPeaks(bad));
  const mismatch=paired([0,2],[1,2],[3,4]);mismatch.proposal.snapshots[1].minute=3;
  assert.throws(()=>retainedWaterPeaks(mismatch));
});

test('Unchanged model ordinary, tradeoff, zero-water, dry and fractional courses match direct original maxima',()=>{
  const ordinary=makeExample();
  const tradeoff=JSON.parse(readFileSync(new URL('./fixtures/water-history-tradeoff.json',import.meta.url),'utf8'));
  const zero=makeExample();zero.weather.rainMmHr=18;
  zero.proposal=zero.proposal.map(cell=>({...cell,surface:'garden'}));
  const dry=makeExample();dry.weather.rainMmHr=0;
  const fractional=makeExample();Object.assign(fractional.weather,{durationMinutes:5.5,stormMinutes:2.5,stepMinutes:2});
  for(const [name,input] of Object.entries({ordinary,tradeoff,zero,dry,fractional})){
    const project=validateProject(input),before=JSON.stringify(project),comparison=compare(project);
    const result=retainedWaterPeaks(comparison);
    assert.deepEqual(result,oracle(comparison),name);
    assert.equal(result.existing.liters,comparison.existing.peakPondingLiters);
    assert.equal(result.proposed.liters,comparison.proposal.peakPondingLiters);
    assert.equal(JSON.stringify(project),before);
    if(name==='zero'){assert.equal(result.proposed.liters,0);assert.equal(result.proposed.indices.length,49);}
    if(name==='dry'){assert.equal(result.existing.indices.length,49);assert.equal(result.proposed.indices.length,49);}
    if(name==='fractional')assert.equal(comparison.existing.snapshots.at(-1).minute,5.5);
  }
});

// A controlled view contract, not a browser layout or native keyboard claim.
class Element {
  constructor(document){this.ownerDocument=document;this.children=[];this.events=new Map();this.dataset={};this.value='';this.disabled=false;this.textContent='';this.attributes={};}
  set innerHTML(value){this.html=value;this.nodes=new Map([...value.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(this.ownerDocument)]));}
  querySelector(selector){return this.nodes.get(selector.slice(1));}
  setAttribute(name,value){this.attributes[name]=value;}
  append(child){this.children.push(child);}
  replaceChildren(...children){this.children=children;}
  addEventListener(name,fn){this.events.set(name,fn);}
  emit(name){this.events.get(name)?.();}
}
function view(){
  const document={createElement:()=>new Element(document)},host=new Element(document);
  const api=createWaterHistoryValues(host),section=host.children[0];
  return{api,section,get:name=>section.querySelector('#water-history-'+name)};
}
test('Peak navigation only selects the original paired row and pending source blocks synthetic actions',()=>{
  const {api,get,section}=view();
  assert.equal(get('existing-peak-read').disabled,true);
  const comparison=paired([0,2,4,5.5],[1,8,3,8],[7,2,7,0]),before=JSON.stringify(comparison);
  api.update(comparison,'Original <project>');api.setAvailable(true);
  assert.equal(get('source').textContent,'Completed comparison: Original <project>');
  assert.equal(get('existing-peak').textContent,'8 L · 2 tied retained peak times');
  assert.deepEqual(get('existing-peak-time').children.map(x=>x.value),['1','3']);
  get('existing-peak-time').value='1';get('existing-peak-read').emit('click');
  assert.equal(get('minute').textContent,'2 min');assert.equal(get('existing').textContent,'8');
  assert.equal(get('proposed').textContent,'2');assert.equal(get('change').textContent,'-6');
  get('proposed-peak-time').value='2';get('proposed-peak-read').emit('click');
  assert.equal(get('minute').textContent,'4 min');assert.equal(get('change').textContent,'+4');
  api.setAvailable(false);assert.equal(section.dataset.state,'unavailable');
  for(const name of ['existing','proposed']){
    assert.equal(get(name+'-peak-read').disabled,true);assert.equal(get(name+'-peak-time').disabled,true);
  }
  get('existing-peak-time').value='3';get('existing-peak-read').emit('click');
  assert.equal(get('minute').textContent,'4 min');assert.equal(JSON.stringify(comparison),before);
});

test('Replacing a completed source retires old ties while preserving exact paired-minute selection',()=>{
  const {api,get}=view();api.update(paired([0,2,4],[0,9,9],[8,1,8]),'old');api.setAvailable(true);
  get('existing-peak-time').value='1';get('existing-peak-read').emit('click');
  api.setAvailable(false);
  const next=paired([0,2,5.5],[0,0,0],[0,2,4]);api.update(next,'new');
  assert.equal(get('existing-peak-read').disabled,true);assert.equal(get('minute').textContent,'2 min');
  assert.deepEqual(get('existing-peak-time').children.map(x=>x.value),['0','1','2']);
  assert.equal(get('existing-peak-time').value,'0');
  assert.deepEqual(get('proposed-peak-time').children.map(x=>x.value),['2']);
  api.setAvailable(true);get('proposed-peak-read').emit('click');
  assert.equal(get('minute').textContent,'5.5 min');assert.equal(get('change').textContent,'+4');
  assert.equal(get('source').textContent,'Completed comparison: new');
});

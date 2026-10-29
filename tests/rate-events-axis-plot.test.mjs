import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync(new URL('../rate-events-page.js',import.meta.url),'utf8');
const begin=src.indexOf('function pointPlot(');
const end=src.indexOf('\nfunction render(',begin);
assert.ok(begin>=0&&end>begin,'test exercises maintained page plot');
function makeNode(tag){
  return {tag,attrs:{},children:[],textContent:'',
    setAttribute(name,value){this.attrs[name]=String(value);},
    append(child){this.children.push(child);}
  };
}
function renderPlot(maxTime){
  const parent=makeNode('parent');
  const document={createElementNS(ns,tag){
    assert.equal(ns,'http://www.w3.org/2000/svg');
    return makeNode(tag);
  }};
  const context={document};
  vm.runInNewContext(src.slice(begin,end)+'\nthis.exposed=pointPlot;',context);
  const sample=(minute,sourceLine)=>({
    minute,sourceLine,
    raw:{minute:String(minute),runoff_mm_hr:'2'},
    runoff:{kind:'observed',value:2}
  });
  context.exposed(parent,{
    left:{samples:[sample(0,1),sample(maxTime/2,2)]},
    right:{samples:[sample(maxTime,3)]}
  });
  return parent.children[0];
}
for(const maxTime of [20,120,1440]){
  test(`original rate chart ends at last admitted sample time ${maxTime} min`,()=>{
    const svg=renderPlot(maxTime);
    const dots=svg.children.filter(n=>n.tag==='circle');
    const ticks=svg.children.filter(n=>n.tag==='text');
    assert.equal(dots.length,3);
    const endDot=dots.find(n=>Number(n.attrs.cx)===600);
    assert.ok(endDot,'actual maximum-time sample must map to x600');
    const maxTick=ticks.find(n=>n.textContent===`${maxTime} min`);
    assert.ok(maxTick,'final source-minute tick must exist');
    assert.equal(Number(maxTick.attrs.x),Number(endDot.attrs.cx),'maximum-time tick must align with maximum-time sample');
    assert.equal(maxTick.attrs['text-anchor'],'end','right tick must be right-anchored inside SVG');
    assert.equal(Number(ticks.find(n=>n.textContent==='0 min').attrs.x),40);
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the production file/archive event handlers in an isolated DOM.
// Original source validation, SHA and fixed-width parsing have separate native
// tests; this challenges admission ordering and retention on real handler code.
function harness() {
  const elements=new Map();
  const elem=id=>{
    if(!elements.has(id))elements.set(id,{
      value:'',textContent:'',disabled:false,files:[],dataset:{},children:[],handlers:{},
      replaceChildren(...nodes){this.children=nodes;},
      addEventListener(name,fn){this.handlers[name]=fn;},
      append(...nodes){this.children.push(...nodes);},focus(){},click(){}
    });
    return elements.get(id);
  };
  let archive='fail';
  const mocks={
    renderHeatDeclarationEnvelope:()=>({}),
    mountSoilEvidence:()=>({retire(){}}),
    mountHourlyCourseProposals:()=>({reset(){},async refresh(){},selectionChanged(){}}),
    receiveHourlyBytes:async(bytes,{sourceUrl})=>{
      const text=new TextDecoder().decode(bytes);
      if(text==='bad')throw Error('invalid source bytes');
      return {sourceUrl,sha256:'sha-'+text,byteLength:bytes.length,
        rows:Array.from({length:9},()=>({raw:{WBANNO:'1',LONGITUDE:'-1',LATITUDE:'1'},intervalStartUtc:'2025-01-01T00:00:00Z'}))};
    },
    parseHourlyText:()=>({}),compareHourlyInvestigation:async()=>({}),
    parseHourlyRecipe:()=>({}),serializeHourlyRecipe:()=>'',checkProjectFileBytes:()=>{}
  };
  const context=vm.createContext({
    ...mocks,document:{
      getElementById:elem,querySelectorAll:()=>[],
      createElement:tag=>({tag,children:[],append(...items){this.children.push(...items)},dataset:{}})
    },
    fetch:async()=>({ok:archive!=='fail',arrayBuffer:async()=>Buffer.from(archive==='bad'?'bad':'archived')}),
    window:{},Blob,URL,TextDecoder,TextEncoder,Uint8Array,structuredClone,setTimeout,clearTimeout,console
  });
  const fullSource=readFileSync(new URL('../noaa-hourly-page.js',import.meta.url),'utf8');
  vm.runInContext(fullSource.replace(/^import .*?;\s*$/gm,''),context,{filename:'noaa-hourly-page.js'});
  const sourceUrl='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-ORIGINAL.txt';
  elem('source-url').value=sourceUrl;
  const select=(str,buffer=async()=>Buffer.from(str))=>{
    const target={files:[{size:str.length,arrayBuffer:buffer}],value:'picked'};
    return elem('source-file').handlers.change({target});
  };
  const state=()=>({
    sha:vm.runInContext('original?.sha256',context),
    accepted:vm.runInContext('accepted?.schema',context),
    report:elem('results').children.slice(),exportDisabled:elem('download').disabled,
    identity:elem('source-identity').textContent
  });
  const retainReport=()=>{
    vm.runInContext("accepted={schema:'saved-investigation'}",context);
    elem('download').disabled=false;
    elem('results').children=['Original result'];
  };
  return {elem,select,state,retainReport,
    setArchive:mode=>{archive=mode},archive:()=>elem('archive-example').onclick(),
    urlChanged:()=>elem('source-url').handlers.input()};
}

test('rejected file and unavailable or invalid archive keep the source and report',async()=>{
  const h=harness();await h.select('first');h.retainReport();
  const before=h.state();assert.equal(before.sha,'sha-first');
  await h.select('bad');assert.deepEqual(h.state(),before);
  assert.match(h.elem('source-status').textContent,/previous investigation preserved/i);
  h.setArchive('fail');await h.archive();assert.deepEqual(h.state(),before);
  h.setArchive('bad');await h.archive();assert.deepEqual(h.state(),before);
});

test('accepted candidate atomically replaces original and invalidates old report',async()=>{
  const h=harness();await h.select('first');h.retainReport();
  await h.select('second');
  assert.equal(h.state().sha,'sha-second');
  assert.equal(h.state().accepted,undefined);
  assert.equal(h.state().exportDisabled,true);
  assert.deepEqual(h.state().report,[]);
  h.setArchive('ok');await h.archive();
  assert.equal(h.state().sha,'sha-archived');
  assert.match(h.elem('source-url').value,/2025-AZ_Tucson_11_W.txt$/);
});

test('later selections and URL edits supersede in-flight file reads',async()=>{
  const h=harness();await h.select('initial');
  let resolveOld;
  const old=new Promise(resolve=>{resolveOld=()=>resolve(Buffer.from('old'))});
  const pending=h.select('old',()=>old);
  await h.select('latest');resolveOld();await pending;
  assert.equal(h.state().sha,'sha-latest');
  let resolveStale;
  const stale=new Promise(resolve=>{resolveStale=()=>resolve(Buffer.from('stale'))});
  const inFlight=h.select('stale',()=>stale);
  h.elem('source-url').value='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2024/CRNH0203-2024-CHANGE.txt';
  h.urlChanged();resolveStale();await inFlight;
  assert.equal(h.state().sha,undefined);
});

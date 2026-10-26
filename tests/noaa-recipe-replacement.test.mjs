import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exact production receipt-file handler executes against a lightweight DOM.
// Parsing and numerical evaluation are mocked here; their native contracts are
// covered separately. This tests the asynchronous UI admission boundary.
function harness(){
 const elements=new Map();
 const el=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,
   files:[],dataset:{},children:[],handlers:{},replaceChildren(...xs){this.children=xs},
   addEventListener(k,f){this.handlers[k]=f},append(...xs){this.children.push(...xs)},click(){}});
  return elements.get(id);
 };
 const sourceUrl='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2025/CRNH0203-2025-EXAMPLE.txt';
 const row={raw:{WBANNO:'53131',LONGITUDE:'-111.17',LATITUDE:'32.24',SUR_TEMP:'11.2',
  SUR_TEMP_TYPE:'C',SUR_TEMP_FLAG:'0',SOLARAD:'121',SOLARAD_FLAG:'0',T_HR_AVG:'11.2'},
  intervalStartUtc:'2025-01-01T15:00:00Z',intervalEndUtc:'2025-01-01T16:00:00Z',
  rawLine:'original fixed-width source'};
 let slowResume=null;
 const inputFor=text=>({schema:'experimental-earth-noaa-input/1',
  rawText:text,sha256:'sha-'+text,sourceUrl,
  selection:{firstLine:1,count:1,correctionType:'C',initialState:{
   surfaceC:20,lowerC:20,assumption:'Explicit authored starting point'}},
  surface:{capacityJm2K:20000,exchangeWm2K:10,absorptivity:0.8,source:'Authored'},
  hypotheses:[{label:'example',capacityJm2K:60000,conductanceWm2K:20,source:'Authored'}],
  band:{halfWidthC:.5,source:'Authored'},calibrationCount:0,associationSource:'Declared'});
 const report=()=>({report:{status:'needs-challenge',counts:{calibration:0,challenge:1},candidates:[]},
  course:{rows:[row]},project:{heatColumnEvidence:{readings:[]}}});
 const mocks={
  renderHeatDeclarationEnvelope:()=>({}),
  mountSoilEvidence:()=>({retire(){}}),
  mountHourlyCourseProposals:()=>({reset(){},async refresh(){},selectionChanged(){}}),
  receiveHourlyBytes:async()=>{},
  parseHourlyText:(text,{sourceUrl})=>({rawText:text,sourceUrl,byteLength:text.length,rows:[row]}),
  checkProjectFileBytes:size=>{if(size>100)throw Error('oversized saved file')},
  parseHourlyRecipe:text=>{if(text==='bad')throw Error('malformed saved JSON');return inputFor(text)},
  compareHourlyInvestigation:async input=>{
   if(input.rawText==='mismatch')throw Error('Source SHA mismatch');
   if(input.rawText==='slow')await new Promise(resolve=>{slowResume=resolve});
   return report();
  },
  serializeHourlyRecipe:()=>''
 };
 const context=vm.createContext({...mocks,document:{
  getElementById:el,querySelectorAll:()=>[],
  createElement:tag=>({tag,textContent:'',className:'',children:[],
   append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs}})},
  window:{},fetch:async()=>({ok:false}),Blob,URL,TextDecoder,TextEncoder,Uint8Array,
  structuredClone,setTimeout,clearTimeout,console});
 const original=readFileSync(new URL('../noaa-hourly-page.js',import.meta.url),'utf8');
 vm.runInContext(original.replace(/^import .*?;\s*$/gm,''),context,{filename:'noaa-hourly-page.js'});
 el('source-url').value=sourceUrl;
 function seed(){
  vm.runInContext("original={sourceUrl:'prior',sha256:'prior-sha',byteLength:10,rows:[{raw:{WBANNO:'1',LONGITUDE:'1',LATITUDE:'1'},intervalStartUtc:'2025-01-01T00:00:00Z'}]};accepted={schema:'old-saved-report'}",context);
  el('results').children=['Old original result'];el('download').disabled=false;
  el('result-status').textContent='Old accepted finding';el('result-status').dataset.state='accepted';
 }
 function choose(str,size=str.length,fn=async()=>Buffer.from(str)){
  const target={files:[{size,arrayBuffer:fn}],value:'file-selected'};
  return el('recipe-file').handlers.change({target});
 }
 const state=()=>({original:vm.runInContext('original?.sha256',context),
  accepted:vm.runInContext('accepted?.schema',context),
  report:el('results').children.slice(),disabled:el('download').disabled,
  summary:el('result-status').textContent,summaryState:el('result-status').dataset.state});
 return {el,seed,choose,state,resume:()=>slowResume?.(),getSlow:()=>slowResume,
  changeUrl:()=>el('source-url').handlers.input()};
}

test('malformed, mismatched and over-limit recipes never erase the live investigation',async()=>{
 const h=harness();h.seed();const before=h.state();
 await h.choose('bad');assert.deepEqual(h.state(),before);
 assert.match(h.el('recipe-status').textContent,/previous work preserved/i);
 await h.choose('mismatch');assert.deepEqual(h.state(),before);
 await h.choose('valid',101);assert.deepEqual(h.state(),before);
 assert.match(h.el('recipe-status').textContent,/oversized saved file/);
});

test('validated saved receipt becomes the accepted recomputed original comparison',async()=>{
 const h=harness();h.seed();await h.choose('valid');
 assert.equal(h.state().original,'sha-valid');
 assert.equal(h.state().accepted,'experimental-earth-noaa-input/1');
 assert.equal(h.state().disabled,false);
 assert.notDeepEqual(h.state().report,['Old original result']);
 assert.match(h.el('recipe-status').textContent,/predictions recomputed/i);
});

test('later receipt and source changes supersede older still-running comparisons',async()=>{
 const h=harness();h.seed();
 const old=h.choose('slow');
 // Its producer resolves only after the new valid receipt supersedes it.
 while(!h.getSlow())await Promise.resolve();
 await h.choose('valid');h.resume();await old;
 assert.equal(h.state().original,'sha-valid');
 const stale=h.choose('slow');
 while(!h.getSlow())await Promise.resolve();
 h.el('source-url').value='https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/2024/CRNH0203-2024-NEW.txt';
 h.changeUrl();h.resume();await stale;
 assert.equal(h.state().original,undefined);
});

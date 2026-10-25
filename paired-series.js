import {validateChange} from './measured-change.js';
const HEADER=['quantity','unit','treatedPlace','comparisonPlace','association','parallelChange'];
const gap=pair=>({lower:pair.treated.lower-pair.comparison.upper,upper:pair.treated.upper-pair.comparison.lower});
function change(source,before,after){return {schema:'experimental-earth-measured-change/1',...Object.fromEntries(HEADER.map(k=>[k,source[k]])),before:before.time,after:after.time,treatedBefore:before.treated,treatedAfter:after.treated,comparisonBefore:before.comparison,comparisonAfter:after.comparison};}
export function comparePairedSeries(source){
 if(source?.schema!=='experimental-earth-paired-series/1'||!Array.isArray(source.pairs)||source.pairs.length>64)throw Error('Supply at most64 original pairs');
 if(Object.keys(source).some(k=>!['schema','intervention',...HEADER,'pairs'].includes(k)))throw Error('Unknown series field');
 if(typeof source.intervention!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(source.intervention)||!Number.isFinite(Date.parse(source.intervention))||new Date(source.intervention).toISOString().replace('.000Z','Z')!==source.intervention)throw Error('Declare a valid exact UTC intervention instant');
 const pre=[],post=[],seen=new Set();
 for(const [index,p]of source.pairs.entries()){
  if(!p||Object.keys(p).some(k=>!['time','role','treated','comparison'].includes(k))||!['pre','post'].includes(p.role)||seen.has(p.time))throw Error('Each pair needs one distinct time and explicit pre/post role');seen.add(p.time);
  if(p.role==='pre'&&!(Date.parse(p.time)<Date.parse(source.intervention))||p.role==='post'&&!(Date.parse(p.time)>Date.parse(source.intervention)))throw Error('Pair time must be strictly on its declared side of intervention');
  (p.role==='pre'?pre:post).push({index,...p});
 }
 if(pre.length<2||post.length<1)throw Error('Supply at least two pre pairs and one post pair');
 // Reuse the maintained original-source unit/place/time/bounds validator.
 for(const p of pre)validateChange(change(source,p,post[0]));
 for(const p of post)validateChange(change(source,pre[0],p));
 const original=structuredClone(source),preGaps=pre.map(p=>({index:p.index,...gap(p)}));
 const lowerWitness=preGaps.reduce((a,b)=>a.lower>=b.lower?a:b),upperWitness=preGaps.reduce((a,b)=>a.upper<=b.upper?a:b);
 const lower=lowerWitness.lower,upper=upperWitness.upper;
 const magnitude=Math.max(1,...pre.flatMap(p=>[p.treated.lower,p.treated.upper,p.comparison.lower,p.comparison.upper].map(Math.abs)));
 const numericalGuard=64*Number.EPSILON*magnitude;
 const status=lower>upper+numericalGuard?'incompatible':lower>upper?'numerical-contact':upper-lower<=numericalGuard?'boundary':'compatible';
 const postContrasts=['compatible','boundary'].includes(status)?post.map(p=>{const g=gap(p);return {index:p.index,time:p.time,gap:g,contrast:{lower:g.lower-upper,upper:g.upper-lower}};}):[];
 return {source:original,status,preGaps,commonGap:{lower,upper},witnesses:{lower:lowerWitness.index,upper:upperWitness.index},numericalGuard,postContrasts};
}

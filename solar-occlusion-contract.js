import {canonicalEvidence} from './outlet-evidence-contract.js';
export const SOLAR_SCHEMA='experimental-earth-solar-occlusion/1';
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
export function solarContext(project){return JSON.stringify(canonicalEvidence({width:project.width,height:project.height,cellSizeM:project.weather.cellSizeM,source:project.source??'',existing:project.existing.map(c=>({elevationM:c.elevationM,provenance:c.provenance,terrainSource:c.terrainSource??null,...(c.rasterSource===undefined?{}:{rasterSource:c.rasterSource})})),proposal:project.proposal.map(c=>({elevationM:c.elevationM,provenance:c.provenance,terrainSource:c.terrainSource??null,...(c.rasterSource===undefined?{}:{rasterSource:c.rasterSource})}))}));}
export function validateSolarStudy(study){
 if(study===undefined)return;
 if(!study||study.schema!==SOLAR_SCHEMA||study.geometry!=='opaque-ground-columns'||!text(study.contextJson,400000)||!finite(study.headingDeg,0,360)||study.headingDeg===360||!finite(study.elevationDeg,1,90)||!text(study.sunSource,400))throw Error('Declare a sourced grid-relative sun direction: heading0–<360°, elevation1–90°');
 let context;try{context=JSON.parse(study.contextJson);}catch{throw Error('Invalid retained solar source context');}
 if(!context||!Number.isInteger(context.width)||!Number.isInteger(context.height)||!finite(context.width,2,24)||!finite(context.height,2,24)||!finite(context.cellSizeM,.25,100)||!['existing','proposal'].every(k=>Array.isArray(context[k])&&context[k].length===context.width*context.height&&context[k].every(c=>finite(c.elevationM,-10,10)&&typeof c.provenance==='string')))throw Error('Retain the original metric ground grid for solar comparison');
 for(const key of ['existing','proposal']){
  const rows=study[key];if(!Array.isArray(rows)||rows.length>64)throw Error('Declare at most64 obstacle cells per scenario');const seen=new Set();
  for(const r of rows){if(!r||!Number.isInteger(r.cellIndex)||r.cellIndex<0||r.cellIndex>=context.width*context.height||seen.has(r.cellIndex)||!finite(r.heightMinM,0,100)||!finite(r.heightMaxM,0,100)||r.heightMaxM===0||r.heightMinM>r.heightMaxM||!text(r.source,300))throw Error('Each opaque column needs a unique cell, ordered height bounds and source');seen.add(r.cellIndex);}
 }
 return study;
}

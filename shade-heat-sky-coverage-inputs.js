import {checkShadeHeatBytes} from './shade-heat.js';
import {parseSkyRelaxationOriginals} from './shade-heat-sky-relaxation-inputs.js';
import {SKY_COVERAGE_KIND,parseSkyCoverageSource} from './shade-heat-sky-coverage-course.js';
export function parseSkyCoverageOriginals(texts){
 if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
  checkShadeHeatBytes(new Blob(texts).size);let raw;
  try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
  if(raw?.kind===SKY_COVERAGE_KIND){
   const source=parseSkyCoverageSource(texts[0]);
   return {readings:source.readings,sharingSource:source.query.sharingSource,ownQuery:source.query,modelQuery:null};
  }
 }
 const prior=parseSkyRelaxationOriginals(texts),query=prior.ownQuery??prior.modelQuery;
 return {readings:prior.readings,sharingSource:prior.sharingSource,ownQuery:null,
  modelQuery:query?{bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource}:null};
}

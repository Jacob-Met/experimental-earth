import {checkShadeHeatBytes} from './shade-heat.js';
import {parseSkyCoverageOriginals} from './shade-heat-sky-coverage-inputs.js';
import {SKY_CONDITIONAL_KIND,parseSkyConditionalSource} from './shade-heat-sky-conditional-course.js';
export function parseSkyConditionalOriginals(texts){
 if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
  checkShadeHeatBytes(new Blob(texts).size);let raw;
  try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
  if(raw?.kind===SKY_CONDITIONAL_KIND){
   const source=parseSkyConditionalSource(texts[0]);
   return {readings:source.readings,sharingSource:source.query.sharingSource,ownQuery:source.query,modelQuery:null};
  }
 }
 const prior=parseSkyCoverageOriginals(texts),query=prior.ownQuery??prior.modelQuery;
 return {readings:prior.readings,sharingSource:prior.sharingSource,ownQuery:null,
  modelQuery:query?{bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource,
   ...(query.requirements?{requirements:structuredClone(query.requirements)}:{})}:null};
}

import {checkShadeHeatBytes} from './shade-heat.js';
import {parseSkyJointOriginals} from './shade-heat-sky-joint-inputs.js';
import {SKY_RELAXATION_KIND,parseSkyRelaxationSource} from './shade-heat-sky-relaxation-course.js';
export function parseSkyRelaxationOriginals(texts){
 if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
  checkShadeHeatBytes(new Blob(texts).size);let raw;
  try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
  if(raw?.kind===SKY_RELAXATION_KIND){
   const source=parseSkyRelaxationSource(texts[0]);
   return {readings:source.readings,sharingSource:source.query.sharingSource,ownQuery:source.query,modelQuery:null};
  }
 }
 const prior=parseSkyJointOriginals(texts),query=prior.ownQuery??prior.modelQuery;
 return {readings:prior.readings,sharingSource:prior.sharingSource,ownQuery:null,
  modelQuery:query?{bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource}:null};
}

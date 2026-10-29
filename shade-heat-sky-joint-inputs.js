import {checkShadeHeatBytes} from './shade-heat.js';
import {parseSkyConsequenceOriginals} from './shade-heat-sky-consequence-inputs.js';
import {SKY_JOINT_KIND,parseSkyJointSource} from './shade-heat-sky-joint-course.js';
export function parseSkyJointOriginals(texts){
 if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
  checkShadeHeatBytes(new Blob(texts).size);let raw;
  try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
  if(raw?.kind===SKY_JOINT_KIND){
   const source=parseSkyJointSource(texts[0]);
   return {readings:source.readings,sharingSource:source.query.sharingSource,ownQuery:source.query,modelQuery:null};
  }
 }
 const prior=parseSkyConsequenceOriginals(texts),query=prior.ownQuery??prior.modelQuery;
 return {readings:prior.readings,sharingSource:prior.sharingSource,ownQuery:null,
  modelQuery:query?{bins:query.bins,maximumChanges:query.maximumChanges,sharingSource:query.sharingSource,searchSource:query.searchSource}:null};
}

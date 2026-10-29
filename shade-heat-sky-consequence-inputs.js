import {checkShadeHeatBytes} from './shade-heat.js';
import {parseSkyChangeOriginals} from './shade-heat-sky-change-inputs.js';
import {SKY_CONSEQUENCE_KIND,parseSkyConsequenceSource} from './shade-heat-sky-consequence-course.js';

export function parseSkyConsequenceOriginals(texts){
  if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
    checkShadeHeatBytes(new Blob(texts).size);let raw;
    try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
    if(raw?.kind===SKY_CONSEQUENCE_KIND){
      const source=parseSkyConsequenceSource(texts[0]);
      return {readings:source.readings,sharingSource:source.query.sharingSource,ownQuery:source.query,modelQuery:null};
    }
  }
  const prior=parseSkyChangeOriginals(texts);
  return {readings:prior.readings,sharingSource:prior.sharingSource,ownQuery:null,modelQuery:prior.ownQuery};
}

import {checkShadeHeatBytes} from './shade-heat.js';
import {parseManyOriginals} from './shade-heat-many-inputs.js';
import {THREE_EPOCH_SKY_KIND,parseThreeEpochSkySource} from './shade-heat-three-epoch-course.js';
import {RECORD_BOUNDARY_KIND,parseRecordBoundarySource} from './shade-heat-record-boundaries.js';

export function parseThreeEpochOriginals(texts){
  if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
    checkShadeHeatBytes(new Blob(texts).size);
    let raw;try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
    if(raw?.kind===THREE_EPOCH_SKY_KIND||raw?.kind===RECORD_BOUNDARY_KIND){
      const source=raw.kind===THREE_EPOCH_SKY_KIND?parseThreeEpochSkySource(texts[0]):parseRecordBoundarySource(texts[0]);
      return {readings:source.readings,sharingSource:source.query.sharingSource};
    }
  }
  return parseManyOriginals(texts);
}

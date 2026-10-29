import {parseManyOriginals} from './shade-heat-many-inputs.js';
import {RECORD_BOUNDARY_KIND,parseRecordBoundarySource} from './shade-heat-record-boundaries.js';
import {checkShadeHeatBytes} from './shade-heat.js';

export function parseRecordBoundaryOriginals(texts){
  if(Array.isArray(texts)&&texts.length===1&&typeof texts[0]==='string'){
    checkShadeHeatBytes(new Blob([texts[0]]).size);
    let raw;try{raw=JSON.parse(texts[0]);}catch{throw Error('Invalid original evidence JSON');}
    if(raw?.kind===RECORD_BOUNDARY_KIND){
      const source=parseRecordBoundarySource(texts[0]);
      return {readings:source.readings,sharingSource:source.query.sharingSource};
    }
  }
  return parseManyOriginals(texts);
}

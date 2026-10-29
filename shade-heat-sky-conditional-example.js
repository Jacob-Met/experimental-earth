import {makeSkyCoverageExample} from './shade-heat-sky-coverage-example.js';
export function makeSkyConditionalExample(){
 const original=makeSkyCoverageExample();
 return {readings:original.readings,query:{...original.query,allowanceC:'1 / 1000',
  consequence:{receiverReadingIndex:8,utc:'2026-06-21T10:00:00.000Z',store:'subsurfaceC',
   source:'Authored third consequence at an original receiver and clock endpoint; infer its represented range after both declared requirements are satisfied at the fixed allowance.'}}};
}

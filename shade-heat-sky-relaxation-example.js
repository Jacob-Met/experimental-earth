import {makeThreeEpochSkyExample} from './shade-heat-three-epoch-example.js';
export function makeSkyRelaxationExample(){
 const original=makeThreeEpochSkyExample();
 return {readings:original.readings,query:{bins:4,maximumChanges:2,
  sharingSource:'Authored unchanged original site, forcing and receiver thermal declarations. Common sky profiles across all original receivers; this is a numerical example.',
  searchSource:'Compare every original boundary under at most two changes before applying requirements. The search receives no generating cuts.',
  requirements:[
   {receiverReadingIndex:0,utc:'2026-06-21T08:00:00.000Z',store:'surfaceC',relation:'at-most',differenceC:-2.594279033846392,
    source:'Authored whole-interval upper requirement for asking for the smallest common relaxation; this original threshold remains declared; relaxation is a separate conditional question.'},
   {receiverReadingIndex:0,utc:'2026-06-21T12:00:00.000Z',store:'surfaceC',relation:'at-most',differenceC:-0.0022405847503513153,
    source:'Authored second whole-interval upper requirement on the same original receiver; this threshold is a declared question, not an observation.'}
  ]}};
}

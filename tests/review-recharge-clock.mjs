// Independent review of experimental-earth d92053c09f8049a7c71d96614dd86035b9e915fe.
// Run: node review-earth-recharge-clock.mjs /absolute/path/to/that/source
import assert from 'node:assert/strict';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
if(!process.argv[2])throw new Error('Provide the exact reviewed source directory');
const root=resolve(process.argv[2]);
const {rechargeCoolingExample}=await import(pathToFileURL(join(root,'recharge-cooling-example.js')));
const {compareRechargeCooling,inspectRechargeCooling}=await import(pathToFileURL(join(root,'recharge-cooling.js')));
const original=rechargeCoolingExample(),before=JSON.stringify(original);
const reference=compareRechargeCooling(original.project,original.study),split=structuredClone(original);
const heat=split.study.cooling.heatColumn.heatStudy,first=heat.schedule[0],last=heat.schedule[1];
heat.schedule=[{...first,minutes:73.25},{...first,minutes:166.75},last];
split.study.cooling.demands=[structuredClone(split.study.cooling.demands[0]),...split.study.cooling.demands];
split.project.surfaceHeatStudy=structuredClone(heat);
split.project.heatColumnStudy=structuredClone(split.study.cooling.heatColumn);
const divided=compareRechargeCooling(split.project,split.study);let comparisons=0,maximum=0;
for(const minute of [0,.123,73.249,73.25,73.251,117.7,239.999,240,240.001,301.5,480])
 for(const side of ['existing','proposal'])for(const timing of ['interval','latePulse']){
  const a=inspectRechargeCooling(reference,minute)[side][timing],b=inspectRechargeCooling(divided,minute)[side][timing];
  for(const key of ['availableMm','suppliedMm','rechargeMm','drainageMm','surfaceC','subsurfaceC','surfaceMeanC','subsurfaceMeanC','surfaceLossJm2','inputJm2','exchangeOutJm2','transferDownJm2']){
   const error=Math.abs(a[key]-b[key])/Math.max(1,Math.abs(a[key]),Math.abs(b[key]));
   maximum=Math.max(maximum,error);assert.ok(error<2e-10,key+' '+error);comparisons++;
  }
 }
assert.equal(JSON.stringify(original),before);
console.log(JSON.stringify({independentFractionalHeatBoundaryComparisons:comparisons,maximumRelativeDifference:maximum,sourceInputUnchanged:true}));

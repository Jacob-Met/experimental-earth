// Portable, deterministic field-sheet data shared by the CLI and browser.
import {exactWaterNumber} from './water-history-values.js';

export const safePayloadJson = value => JSON.stringify(value)
  .replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026')
  .replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');

export function buildPairedWaterPayload(a,b,ea,pa,pb,stats) {
  const samples=ea.map((s,i)=>{
    const values=[s.minute,s.storedLiters,pa[i].storedLiters,pb[i].storedLiters,
      pb[i].storedLiters-pa[i].storedLiters];
    if(!values.every(Number.isFinite))throw Error('Refusing a nonfinite report sample.');
    return values.map((value,index)=>exactWaterNumber(value,index===4));
  });
  return {titleA:a.project.title,titleB:b.project.title,shaA:a.digest,shaB:b.digest,samples,stats};
}

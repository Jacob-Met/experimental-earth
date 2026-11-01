// Deterministic, offline and source-attributed visual inspection of two original modeled courses.
// This is a presentation artifact; it does not generate or interpolate any new model values.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {exactWaterNumber} from './water-history-values.js';

const TEMPLATE=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'paired-water-report-template.html'),'utf8');
const MAX_HTML_BYTES=512*1024;
const safeJson=x=>JSON.stringify(x).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026')
  .replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
export function pairedWaterReport(a,b,ea,pa,pb,stats){
  const samples=ea.map((s,i)=>{
    const values=[s.minute,s.storedLiters,pa[i].storedLiters,pb[i].storedLiters,pb[i].storedLiters-pa[i].storedLiters];
    if(!values.every(Number.isFinite))throw Error('Refusing a nonfinite report sample.');
    return values.map((value,index)=>exactWaterNumber(value,index===4));
  });
  const payload={titleA:a.project.title,titleB:b.project.title,shaA:a.digest,shaB:b.digest,samples,stats};
  const html=TEMPLATE.replace('__EARTH_DATA_JSON__',safeJson(payload));
  const bytes=Buffer.from(html,'utf8');
  if(bytes.length>MAX_HTML_BYTES)throw Error('Offline field sheet exceeds the 512 KiB bound.');
  return bytes;
}

// Deterministic, offline and source-attributed visual inspection of two original modeled courses.
// This is a presentation artifact; it does not generate or interpolate any new model values.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPairedWaterPayload,safePayloadJson} from './paired-water-payload.js';

const TEMPLATE=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'paired-water-report-template.html'),'utf8');
const MAX_HTML_BYTES=512*1024;
export function pairedWaterReport(a,b,ea,pa,pb,stats){
  const payload=buildPairedWaterPayload(a,b,ea,pa,pb,stats);
  const html=TEMPLATE.replace('__EARTH_DATA_JSON__',safePayloadJson(payload));
  const bytes=Buffer.from(html,'utf8');
  if(bytes.length>MAX_HTML_BYTES)throw Error('Offline field sheet exceeds the 512 KiB bound.');
  return bytes;
}

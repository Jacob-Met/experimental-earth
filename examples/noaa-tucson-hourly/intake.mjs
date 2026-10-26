// Node file/hash wrapper around the shared original hourly parser.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseHourlyText} from '../../noaa-hourly.js';
export {README,fields,selectCourse} from '../../noaa-hourly.js';
export function parseHourlyBytes(bytes,{sourceUrl,expectedSha256}={}) {
 if(!Buffer.isBuffer(bytes))throw Error('Provide original byte Buffer');
 if(!bytes.length||bytes.length>4_000_000||bytes.some(b=>b>127))throw Error('Refuse non-ASCII or oversized source');
 const hash=createHash('sha256').update(bytes).digest('hex');
 if(expectedSha256!==undefined&&expectedSha256!==hash)throw Error('Source SHA mismatch');
 return {...parseHourlyText(bytes.toString('ascii'),{sourceUrl}),sha256:hash};
}
export function replayIntake(saved){
 if(saved?.schema!=='research.uscrn-hourly03-intake/v1'||typeof saved.sha256!=='string'||!/^[0-9a-f]{64}$/.test(saved.sha256)||typeof saved.rawText!=='string'||/[^\x00-\x7f]/.test(saved.rawText))throw Error('Unsupported raw intake replay');
 return parseHourlyBytes(Buffer.from(saved.rawText,'ascii'),{sourceUrl:saved.sourceUrl,expectedSha256:saved.sha256});
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [file,url,expectedSha256]=process.argv.slice(2);
  const parsed=parseHourlyBytes(readFileSync(file),{sourceUrl:url,expectedSha256});
  process.stdout.write(JSON.stringify(parsed,null,2)+'\n');
}


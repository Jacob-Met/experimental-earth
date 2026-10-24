// Research intake only: no fitting, uncertainty inference, or production adapter.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
export const README = 'https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/readme.txt';
const names = 'WBANNO UTC_DATE UTC_TIME LST_DATE LST_TIME CRX_VN LONGITUDE LATITUDE T_CALC T_HR_AVG T_MAX T_MIN P_CALC SOLARAD SOLARAD_FLAG SOLARAD_MAX SOLARAD_MAX_FLAG SOLARAD_MIN SOLARAD_MIN_FLAG SUR_TEMP_TYPE SUR_TEMP SUR_TEMP_FLAG SUR_TEMP_MAX SUR_TEMP_MAX_FLAG SUR_TEMP_MIN SUR_TEMP_MIN_FLAG RH_HR_AVG RH_HR_AVG_FLAG SOIL_MOISTURE_5 SOIL_MOISTURE_10 SOIL_MOISTURE_20 SOIL_MOISTURE_50 SOIL_MOISTURE_100 SOIL_TEMP_5 SOIL_TEMP_10 SOIL_TEMP_20 SOIL_TEMP_50 SOIL_TEMP_100'.split(' ');
const ranges = [[1,5],[7,14],[16,19],[21,28],[30,33],[35,40],[42,48],[50,56],[58,64],[66,72],[74,80],[82,88],[90,96],[98,103],[105,105],[107,112],[114,114],[116,121],[123,123],[125,125],[127,133],[135,135],[137,143],[145,145],[147,153],[155,155],[157,161],[163,163],[165,171],[173,179],[181,187],[189,195],[197,203],[205,211],[213,219],[221,227],[229,235],[237,243]];
export const fields = names.map((name,i)=>({name,start:ranges[i][0]-1,end:ranges[i][1]}));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function timestamp(date,time) {
  if (!/^\d{8}$/.test(date) || !/^\d{1,4}$/.test(time)) throw Error('Malformed date/time');
  const t=time.padStart(4,'0'), iso=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${t.slice(0,2)}:${t.slice(2)}:00.000Z`;
  const ms=Date.parse(iso);
  if (!Number.isFinite(ms) || new Date(ms).toISOString()!==iso || t.slice(2)!=='00') throw Error('Invalid calendar or non-hourly endpoint');
  return ms;
}
function value(raw,width) {
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw Error(`Invalid numeric lexeme: ${raw}`);
  // README's lowest representable field sentinel: minus, all 9 integer digits,
  // optional all-zero fractional part, filling the complete fixed width.
  const missing=raw.length===width && /^-9+(?:\.0+)?$/.test(raw);
  return {raw,missing,value:missing?null:Number(raw)};
}
export function parseHourlyBytes(bytes,{sourceUrl,expectedSha256}={}) {
  if (!Buffer.isBuffer(bytes)) throw Error('Provide original byte Buffer');
  if (bytes.length>4_000_000 || !bytes.length || bytes.some(b=>b>127)) throw Error('Refuse non-ASCII or oversized source');
  if (!/^https:\/\/www\.ncei\.noaa\.gov\/pub\/data\/uscrn\/products\/hourly02\/\d{4}\/CRNH0203-\d{4}-.+\.txt$/.test(sourceUrl??'')) throw Error('Require explicit NOAA yearly format03 URL');
  const hash=sha(bytes); if(expectedSha256 && hash!==expectedSha256) throw Error('Source SHA mismatch');
  let lines=bytes.toString('ascii').split(/\r?\n/); if(lines.at(-1)==='') lines.pop();
  if(lines.length>9000) throw Error('Yearly row bound exceeded');
  const rows=lines.map((rawLine,i)=>{
    if(rawLine.length!==243) throw Error(`Line ${i+1}: expected 243 fixed-width characters`);
    const raw=Object.fromEntries(fields.map(f=>[f.name,rawLine.slice(f.start,f.end).trim()]));
    for(let j=1;j<fields.length;j++) if(!/^ +$/.test(rawLine.slice(fields[j-1].end,fields[j].start))) throw Error('Invalid field separator');
    const end=timestamp(raw.UTC_DATE,raw.UTC_TIME); timestamp(raw.LST_DATE,raw.LST_TIME);
    if(!/^\d{1,5}$/.test(raw.WBANNO)||!raw.CRX_VN) throw Error('Missing station or logger identity');
    if(!['C','R','U'].includes(raw.SUR_TEMP_TYPE)) throw Error('Unknown surface correction type');
    const numbers={}; for(const f of fields.slice(6)) {
      if(f.name==='SUR_TEMP_TYPE') continue;
      if(f.name.endsWith('_FLAG')) {if(!['0','3'].includes(raw[f.name])) throw Error('Unknown QC flag'); numbers[f.name]=Number(raw[f.name]);}
      else numbers[f.name]=value(raw[f.name],f.end-f.start);
    }
    return {line:i+1,rawLine,raw,intervalStartUtc:new Date(end-3600000).toISOString(),intervalEndUtc:new Date(end).toISOString(),numbers};
  });
  return {schema:'research.uscrn-hourly03-intake/v1',sourceUrl,sha256:hash,byteLength:bytes.length,rawText:bytes.toString('ascii'),readme:README,rows};
}
export function replayIntake(saved) {
  if(saved?.schema!=='research.uscrn-hourly03-intake/v1' || typeof saved.rawText!=='string' || /[^\x00-\x7f]/.test(saved.rawText)) throw Error('Unsupported raw intake replay');
  return parseHourlyBytes(Buffer.from(saved.rawText,'ascii'),{sourceUrl:saved.sourceUrl,expectedSha256:saved.sha256});
}
export function selectCourse(intake,{firstLine,count,correctionType,initialState}={}) {
  if(!Number.isInteger(firstLine)||firstLine<1||!Number.isInteger(count)||count<1||count>48||firstLine+count-1>intake.rows.length) throw Error('Select 1–48 existing contiguous rows');
  if(!['C','R'].includes(correctionType)) throw Error('Declare corrected C or raw R policy');
  const rows=intake.rows.slice(firstLine-1,firstLine-1+count), start=rows[0].intervalStartUtc;
  if(!initialState || initialState.timeUtc!==start || !Number.isFinite(initialState.surfaceC)||!Number.isFinite(initialState.lowerC)||typeof initialState.assumption!=='string'||!initialState.assumption.trim()) throw Error('Require explicit two-store point initial-state assumption at first interval start');
  const station=rows[0].raw.WBANNO;
  rows.forEach((r,i)=>{
    if(r.raw.WBANNO!==station || r.raw.LONGITUDE!==rows[0].raw.LONGITUDE || r.raw.LATITUDE!==rows[0].raw.LATITUDE) throw Error('Station/location changes');
    if(i && rows[i-1].intervalEndUtc!==r.intervalStartUtc) throw Error('Gap, duplicate, or reordered interval');
    if(r.raw.SUR_TEMP_TYPE!==correctionType) throw Error('Missing or mixed surface correction type');
    for(const name of ['T_HR_AVG','SOLARAD','SUR_TEMP']) if(r.numbers[name].missing) throw Error(`Missing required ${name}`);
    if(r.numbers.SOLARAD_FLAG!==0 || r.numbers.SUR_TEMP_FLAG!==0) throw Error('Erroneous required measurement');
    if(r.numbers.SOLARAD.value<0) throw Error('Negative radiation requires explicit handling; never clip silently');
  });
  return {schema:'research.uscrn-course/v1',source:{url:intake.sourceUrl,sha256:intake.sha256,firstLine,count},correctionType,initialState:structuredClone(initialState),forcingAssumption:'Hourly global solar and air means represented as piecewise constant forcing; not measured within-hour history.',rows:structuredClone(rows)};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [file,url,expectedSha256]=process.argv.slice(2);
  const parsed=parseHourlyBytes(readFileSync(file),{sourceUrl:url,expectedSha256});
  process.stdout.write(JSON.stringify(parsed,null,2)+'\n');
}

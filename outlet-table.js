import { records } from './csv-records.js';
import { decimalValue } from './observation-units.js';
import { validateProject } from './core.js';
import { appendOutletReading } from './outlet-evidence.js';
import { outletTableOriginKey } from './outlet-table-origin.js';
const REQUIRED=['start_minute','end_minute','volume','uncertainty','unit','source'];
const OPTIONAL=['use'];
function append(project,settings,readings) {
  validateProject(project);
  if (project.outletEvidence && project.outletEvidence.durationMinutes !== project.weather.durationMinutes) throw Error('Original collection duration differs from this event; restore its source before importing.');
  if (!Array.isArray(readings)||!readings.length) throw Error('The table has no collection rows.');
  if ((project.outletEvidence?.readings.length??0)+readings.length>80) throw Error('Import exceeds the 80 retained collection limit.');
  const seen=new Set((project.outletEvidence?.readings??[]).map(outletTableOriginKey).filter(Boolean));
  for (const reading of readings) {
    const key=outletTableOriginKey(reading);
    if (key&&seen.has(key)) throw Error(`Line ${reading.tableSource.line}: this supplied file row is already retained.`);
    if (key)seen.add(key);
  }
  const next=appendOutletReading(project,settings,readings[0]);
  next.outletEvidence.readings.push(...structuredClone(readings.slice(1)));
  validateProject(next);return next;
}
export function previewOutletTable(text,project,settings,fileName='collections.csv') {
  validateProject(project);
  if (typeof text!=='string'||new TextEncoder().encode(text).length>128000) throw Error('Collection table exceeds 128000 UTF-8 bytes.');
  if (typeof fileName!=='string'||!fileName.trim()||fileName.length>160) throw Error('Supply a table filename of 1–160 characters.');
  const rows=records(text,{maxRows:80,label:'Collection table',rowLabel:'collection'});
  if (!rows.length)throw Error('The collection table is empty.');
  const headers=rows.shift().fields.map(s=>s.trim().toLowerCase());
  if (new Set(headers).size!==headers.length||REQUIRED.some(h=>!headers.includes(h))||headers.some(h=>!REQUIRED.includes(h)&&!OPTIONAL.includes(h))) throw Error('Use start_minute,end_minute,volume,uncertainty,unit,source and optional use columns.');
  const readings=rows.map(row=>{
    try {
      if (row.fields.length!==headers.length)throw Error('Column count differs from the header.');
      const raw=Object.fromEntries(headers.map((h,i)=>[h,row.fields[i]]));
      return {startMinute:decimalValue(raw.start_minute,'Start minute'),endMinute:decimalValue(raw.end_minute,'End minute'),
        volume:decimalValue(raw.volume,'Volume'),uncertainty:decimalValue(raw.uncertainty,'Uncertainty'),unit:raw.unit.trim(),source:raw.source.trim(),use:raw.use?.trim()||'unassigned',
        tableSource:{fileName,line:row.line,startMinuteValue:raw.start_minute,endMinuteValue:raw.end_minute,volumeValue:raw.volume,uncertaintyValue:raw.uncertainty,unit:raw.unit.trim(),sourceText:raw.source,useValue:raw.use??''}};
    }catch(e){throw Error(`Line ${row.line}: ${e.message}`);}
  });
  append(project,settings,readings);
  return {context:JSON.stringify(project),settings:structuredClone(settings),fileName,readings};
}
export function commitOutletTablePreview(project,settings,preview) {
  if (!preview||preview.context!==JSON.stringify(project)||JSON.stringify(settings)!==JSON.stringify(preview.settings)) throw Error('The site, evidence or collection settings changed; preview again.');
  return append(project,settings,preview.readings);
}

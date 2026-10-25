import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=resolve(process.argv[2]||fileURLToPath(new URL('./evidence-source/',import.meta.url)));
const moduleAt=path=>import(pathToFileURL(resolve(source,path)).href);
const {makeExample}=await moduleAt('core.js');
const {prepareSurfaceHeatStudy}=await moduleAt('surface-heat.js');
const {prepareHeatColumnStudy}=await moduleAt('heat-column.js');
const {prepareBottomHeatStudy,evaluateBottomHeatTarget}=await moduleAt('bottom-heat-study.js');
const raw=await readFile(new URL('./bottom-window-reference.json',import.meta.url));
const reference=JSON.parse(raw),rows=[];
let maxError=0;
for(const c of reference.cases){
 const a=c.parameters,p=makeExample(),source='Authored independent mathematical reference; no acquired data';
 const top={absorptivity:.8,capacityJm2K:a.c1,exchangeWm2K:a.h,initialC:a.surface,source};
 const lower={capacityJm2K:a.c2,conductanceWm2K:a.g,initialC:a.lower,source};
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:top,proposal:top,schedule:[{minutes:60,incidentWm2:700,reservoirC:a.ambient,source},{minutes:360,incidentWm2:0,reservoirC:a.ambient,source}]});
 p.heatColumnStudy=prepareHeatColumnStudy(p,{existing:lower,proposal:lower});
 const bottom={conductanceWm2K:a.b,reservoirC:a.deep,source};
 const original=prepareBottomHeatStudy(p,{existing:bottom,proposal:bottom});
 const actual=evaluateBottomHeatTarget(original,'existing',[],c.means.map(x=>({fromMinute:x.fromMinute,minute:x.minute})));
 actual.averages.forEach((mean,i)=>{for(const key of ['surfaceMeanC','subsurfaceMeanC']){
  const expected=Number(c.means[i][key]),error=Math.abs(mean[key]-expected);maxError=Math.max(maxError,error);
  assert.ok(error<=3e-10,c.name+' '+i+' '+key+' '+error);
  rows.push({case:c.name,fromMinute:mean.fromMinute,minute:mean.minute,quantity:key,expected:c.means[i][key],actual:mean[key],absoluteError:error});
 }});
}
const report={status:'PASS',referenceSha256:createHash('sha256').update(raw).digest('hex'),comparisons:rows.length,declaredAbsoluteToleranceC:3e-10,maximumAbsoluteErrorC:maxError,rows};
await writeFile(new URL('./bottom-window-comparison.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,comparisons:rows.length,maximumAbsoluteErrorC:maxError,referenceSha256:report.referenceSha256}));

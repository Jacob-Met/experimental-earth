import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {authoredPowerWeather} from './weather-power-fixture.mjs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
test('sampling preserves original forcing, native parity, thermal balances, uncertainty and work bounds', async () => {
const sourceRoot=fileURLToPath(new URL('../',import.meta.url));
const imp=p=>import(pathToFileURL(resolve(sourceRoot,p)).href);
const [{compareShadeHeatSampling},{compareShadeHeat},{makeShadeHeatExample},{parsePowerHourly},
 {prepareSolarStudy},{prepareSurfaceHeatStudy},{prepareHeatColumnStudy}]=await Promise.all([
 'shade-heat-sampling.js','shade-heat.js','shade-heat-example.js','weather-power.js','solar-occlusion.js','surface-heat.js','heat-column.js'].map(imp));
const raw=JSON.stringify(authoredPowerWeather()),parsed=parsePowerHourly(raw);
const targets=['existing','proposal'],bounds=['lower','upper'];
const close=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol,`${a} != ${b}; tolerance ${tol}`);
const checks=[];
const {project:base,declaration}=makeShadeHeatExample();
function input(text=raw){const w=parsePowerHourly(text);return {path:{...declaration.path,latitudeDeg:w.latitudeDeg,longitudeDeg:w.longitudeDeg,startUtc:w.startUtc,endUtc:w.endUtc,stepMinutes:60},weather:{format:w.format,rawText:text}};}
function snapshot(project,declaration){return JSON.stringify({project,declaration});}
function run(project,declaration){const before=snapshot(project,declaration);const result=compareShadeHeatSampling(project,declaration);assert.equal(snapshot(project,declaration),before,'Successful sampling mutated caller inputs');assert.deepEqual(result.courses.map(c=>c.solarStepMinutes),[60,30,15]);return result;}
const declarationInput=input(),report=run(base,declarationInput),baseline=compareShadeHeat(base,declarationInput);
const hourly=report.courses[0];let compared=0;
for(const target of targets)for(const bound of bounds){const actual=new Map(hourly.targets[target][bound].trajectory.map(p=>[p.minute,p]));for(const p of baseline.trajectory){if(!Number.isInteger(p.minute))continue;const a=actual.get(p.minute);assert.ok(a,'Missing common minute '+p.minute);for(const field of ['surfaceC','subsurfaceC'])close(a[field],p[target][bound][field],1e-10);compared++;}}
assert.equal(compared,1441*4);checks.push({name:'Maintained60-minute allinteger-minute parity',points:compared});
let contained=0;
for(const course of report.courses){assert.equal(course.intervals.length,1440/course.solarStepMinutes);let previous=0;for(const row of course.intervals){assert.equal(row.fromMinute,previous);assert.equal(row.toMinute-row.fromMinute,course.solarStepMinutes);previous=row.toMinute;const hour=Math.floor(row.fromMinute/60),original=parsed.intervals[hour];assert.ok(row.toMinute<=(hour+1)*60);assert.equal(Date.parse(row.fromUtc),Date.parse(parsed.startUtc)+row.fromMinute*60000);assert.equal(Date.parse(row.toUtc),Date.parse(parsed.startUtc)+row.toMinute*60000);for(const field of ['sourceKey','directNormalWm2','diffuseHorizontalWm2','reservoirC'])assert.equal(row.weather[field],original[field]);contained++;}assert.equal(previous,1440);}
assert.equal(contained,168);checks.push({name:'Everyderivedinterval retains originalhour forcing andcontainment',intervals:contained});
let ledgers=0;
for(const course of report.courses)for(const target of targets)for(const bound of bounds){const response=course.targets[target][bound],final=response.final,surface=base.heatColumnStudy.heatStudy[target],lower=base.heatColumnStudy.lowerLayers[target];let absorbed=0;for(const row of course.intervals)absorbed+=surface.absorptivity*row[target].irradiance[bound]*(row.toMinute-row.fromMinute)*60;
 const stored1=surface.capacityJm2K*(final.surfaceC-surface.initialC),stored2=lower.capacityJm2K*(final.subsurfaceC-lower.initialC);
 close(final.inputJm2,absorbed,1e-6);close(final.surfaceStoredJm2,stored1,1e-6);close(final.subsurfaceStoredJm2,stored2,1e-6);close(final.totalStoredJm2,stored1+stored2,1e-6);close(final.transferDownJm2,stored2,1e-6);close(final.inputJm2-final.exchangeOutJm2,stored1+stored2,1e-6);close(final.balanceResidualJm2,0,1e-6);ledgers++;}
checks.push({name:'Independent absorbedenergy andoriginal-state ledger algebra',courses:ledgers});
function rebuild(project,{surface,lower,columns}={}){
 const p=structuredClone(project),old=p.heatColumnStudy;
 p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored independent sampling control',existing:[],proposal:columns??[{cellIndex:6,heightMinM:3,heightMaxM:3,source:'Authored column'}]});
 p.heatColumnStudy=undefined;p.surfaceHeatStudy=undefined;
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:5,existing:surface??old.heatStudy.existing,proposal:surface??old.heatStudy.proposal,schedule:[{minutes:60,incidentWm2:0,reservoirC:20,source:'Authored original declaration'}]});
 p.heatColumnStudy=prepareHeatColumnStudy(p,{existing:lower??old.lowerLayers.existing,proposal:lower??old.lowerLayers.proposal});return p;
}
const uncertain=rebuild(base,{columns:[{cellIndex:6,heightMinM:0,heightMaxM:20,source:'Authored unknownheight0–20m'}]}),uncertainReport=run(uncertain,input());let nonzeroBands=0;
for(const course of uncertainReport.courses){assert.ok(course.intervals.some(row=>row.proposal.irradiance.lower<row.proposal.irradiance.upper),'Unknownheight control didnot create ambiguousbeam');const a=new Map(course.targets.proposal.lower.trajectory.map(p=>[p.minute,p]));for(const upper of course.targets.proposal.upper.trajectory){const lower=a.get(upper.minute);if(!lower)continue;for(const field of ['surfaceC','subsurfaceC']){assert.ok(lower[field]<=upper[field]+1e-10,'Temperature envelope reversed');if(upper[field]-lower[field]>1e-6)nonzeroBands++;}}}
assert.ok(nonzeroBands>0);checks.push({name:'Unknownheight retains nonzero orderedthermalbands',nonzeroBands});
const document=JSON.parse(raw);for(const [name,rows] of Object.entries(document.properties.parameter))for(const key of Object.keys(rows))rows[key]=name==='ALLSKY_SFC_SW_DIFF'?100:name==='T2M'?20:0;
document.header.title='Authored constantdiffuse control; not observed weather';
const hot=rebuild(base,{surface:{absorptivity:1,capacityJm2K:100000,exchangeWm2K:0,initialC:200,source:'Authored finiteconstantwarming'},lower:{capacityJm2K:80000,conductanceWm2K:0,initialC:200,source:'Authored isolatedlowerstore'}});
const hotInput=input(JSON.stringify(document)),hotReport=run(hot,hotInput);let highStates=0;
for(const course of hotReport.courses)for(const target of targets)for(const bound of bounds){const value=course.targets[target][bound];close(value.final.surfaceC,286.4,1e-9);close(value.final.subsurfaceC,200,1e-12);close(value.means.surfaceC,243.2,1e-9);close(value.means.subsurfaceC,200,1e-9);close(value.surface.maximumC,286.4,1e-9);close(value.surface.minimumC,200,1e-12);close(value.final.inputJm2,8640000,1e-6);for(const point of value.trajectory){close(point.surfaceC,200+.06*point.minute,1e-9);if(point.surfaceC>200)highStates++;}}
assert.ok(highStates>0);checks.push({name:'Legitimate carriedstatesabove200C preserve originaldeclarationlimits',highStates,expectedFinalC:286.4});
const large=structuredClone(base);large.width=14;large.height=14;large.existing=Array.from({length:196},()=>structuredClone(base.existing[0]));large.proposal=structuredClone(large.existing);const overBudget=rebuild(large),before=snapshot(overBudget,declarationInput);
assert.throws(()=>compareShadeHeatSampling(overBudget,declarationInput),/budget|ray|work|16 million/i);assert.equal(snapshot(overBudget,declarationInput),before);checks.push({name:'Combinedthreegrid budget refuses with callerinputs unchanged',hourlyRayEstimate:6*196*195*24,combinedRayEstimate:6*196*195*168});
assert.equal(checks.length,6);
});

test('sampling envelopes retain only original inputs and reject incompatible declarations', async () => {
 const {makeShadeHeatExample}=await import('../shade-heat-example.js');
 const {parsePowerHourly}=await import('../weather-power.js');
 const {prepareShadeHeatSampling,parseShadeHeatSampling}=await import('../shade-heat-sampling.js');
 const {project,declaration}=makeShadeHeatExample(),rawText=JSON.stringify(authoredPowerWeather()),w=parsePowerHourly(rawText);
 const input={path:{...declaration.path,latitudeDeg:w.latitudeDeg,longitudeDeg:w.longitudeDeg,startUtc:w.startUtc,endUtc:w.endUtc,stepMinutes:60},weather:{format:w.format,rawText}};
 const original=JSON.stringify({project,input}),a=prepareShadeHeatSampling(project,input),text=JSON.stringify(a.investigation),b=parseShadeHeatSampling(text);
 assert.deepEqual(b,a);assert.equal(JSON.stringify({project,input}),original);
 assert.deepEqual(Object.keys(a.investigation).sort(),['kind','model','source']);
 assert.equal(b.investigation.source.declaration.weather.rawText,rawText);
 for(const mutate of [v=>{v.kind='unsupported';},v=>{v.model.version=99;},v=>{v.report=a.report;},v=>{v.source.report=a.report;},v=>{v.source.declaration.path.stepMinutes=15;},v=>{v.source.project.heatColumnStudy.heatStudy.existing.initialC=201;}]){
  const v=JSON.parse(text);mutate(v);assert.throws(()=>parseShadeHeatSampling(JSON.stringify(v)));
 }
 assert.throws(()=>parseShadeHeatSampling('{'));assert.throws(()=>prepareShadeHeatSampling(project,declaration));
});

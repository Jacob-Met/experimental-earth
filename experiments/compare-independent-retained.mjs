import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fitReceivingAccountBands} from '../receiving-account-band-fit.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
import {independentRetainedCourses,independentRetainedSourceSha256} from '../tests/receiving-retained-fixtures.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const freeze=JSON.parse(readFileSync(new URL('./retained-method-independent-freeze.json',import.meta.url)));
for(const [path,expected]of Object.entries(freeze.sourceHashes))assert.equal(sha(readFileSync(new URL('../'+path,import.meta.url))),expected,path);
assert.equal(independentRetainedSourceSha256,freeze.independentTupleSha256);
const baselineBytes=readFileSync(new URL('./retained-baseline-band-fit.js.txt',import.meta.url));
const baselineUrl=new URL('../receiving-account-band-fit.js',import.meta.url);
const baselineSource=baselineBytes.toString().replace(/from '(\.[^']+)';/g,(_,path)=>"from '"+new URL(path,baselineUrl).href+"';");
const baseline=await import('data:text/javascript;base64,'+Buffer.from(baselineSource).toString('base64'));
const receipt={schema:'experimental-earth-independent-retained-band-comparison/1',startedAtUtc:new Date().toISOString(),freeze,
  baselineMethodSha256:sha(baselineBytes),checks:[],total:0,eligible:0,excluded:[],summary:{baselineCalibration:0,currentCalibration:0,baselineHeld:0,currentHeld:0},records:[],
  interpretation:'Independently authored model controls. Calibration-witness coverage and held support are separate. All adverse outcomes remain; no field accuracy, continuous enclosure or identified parameters are claimed.'};
const output=process.env.RECEIVING_RETAINED_COMPARISON??new URL('./independent-retained-comparison.json',import.meta.url);
const save=()=>writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
save();
const all=independentRetainedCourses();receipt.total=all.length;receipt.eligible=all.filter(c=>c.eligible).length;
receipt.excluded=all.filter(c=>!c.eligible).map(c=>({id:c.id,reasons:c.reasons}));
assert.equal(receipt.total,18);assert.equal(receipt.eligible,15);
function compact(result){return {status:result.status,compatibleIds:result.compatibleIds,survivingIds:result.survivingIds,reservation:result.reservation,counts:result.counts,searches:result.searches,refusals:result.refusals,
  candidates:result.candidates.map(c=>({hypothesis:c.hypothesis,calibration:c.calibration,challenge:c.challenge,surfaceCalibration:c.surfaceCalibration,surfaceChallenge:c.surfaceChallenge,accountReadings:c.accountReadings}))};}
for(const course of all.filter(c=>c.eligible)){
  const originals=course.project.observations.map((reading,index)=>({reading,index}));
  const rows=evaluateReceivingAccountRows(course.result,course.account.readings);
  const truth=Object.fromEntries(['calibration','challenge'].map(use=>[use,receivingAccountVerdict(evaluateReadings(course.result,originals.filter(row=>row.reading.use===use)),rows.filter(row=>row.use===use))]));
  assert.equal(truth.calibration.compatible,true);assert.equal(truth.challenge.compatible,true);
  const sourceBefore=JSON.stringify({project:course.project,selection:course.selection,account:course.account});
  const started=performance.now(),old=baseline.fitReceivingAccountBands(course.project,course.selection,course.account),oldMs=performance.now()-started;
  const nextStarted=performance.now(),current=fitReceivingAccountBands(course.project,course.selection,course.account),currentMs=performance.now()-nextStarted;
  assert.equal(JSON.stringify({project:course.project,selection:course.selection,account:course.account}),sourceBefore);
  if(old.compatibleIds.length)receipt.summary.baselineCalibration++;
  if(current.compatibleIds.length)receipt.summary.currentCalibration++;
  if(old.survivingIds.length)receipt.summary.baselineHeld++;
  if(current.survivingIds.length)receipt.summary.currentHeld++;
  assert.ok(current.counts.reducedTrials<=current.reservation.reducedTrials);
  assert.ok(current.counts.projectedKernelCalls<=current.reservation.projectedKernelCalls);
  receipt.records.push({id:course.id,source:JSON.parse(sourceBefore),knownModel:course.truth,truth,baseline:{...compact(old),milliseconds:oldMs},current:{...compact(current),milliseconds:currentMs}});
  save();console.log(JSON.stringify({id:course.id,old:old.compatibleIds.length,current:current.compatibleIds.length,held:current.survivingIds.length,status:current.status,ms:Math.round(currentMs)}));
}
receipt.checks=['all18independent tuples retained','all15truth-eligible inputs satisfy every original calibration and held band','identical sources supplied to frozen baseline and current methods','all source objects unchanged','complete budgets respected','every held failure retained'];
receipt.completedAtUtc=new Date().toISOString();save();console.log(JSON.stringify({summary:receipt.summary,eligible:receipt.eligible,total:receipt.total}));

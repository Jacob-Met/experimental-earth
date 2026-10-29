import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {filledIndependentCourses,filledIndependentTupleSha256} from '../tests/receiving-filled-independent-fixtures.mjs';
import {predecessor} from '../tests/receiving-drain-predecessor.mjs';
import {fitReceivingAccountPhases} from '../receiving-account-phase-fit.js';
const root=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const freezeBytes=readFileSync(new URL('./filled-independent-method-freeze.json',import.meta.url)),freeze=JSON.parse(freezeBytes);
assert.equal(sha(freezeBytes),'56072993016d2983c96b7df3f2a536df3db39e60d2cf608486d6b0c43b82a930');
for(const [path,expected] of Object.entries(freeze.sourceHashes))assert.equal(sha(readFileSync(new URL(path,root))),expected,'Frozen source changed: '+path);
assert.equal(filledIndependentTupleSha256,freeze.independentTupleSha256);
assert.equal(sha(readFileSync(new URL('./filled-independent-validation.json',import.meta.url))),freeze.independentOracleSha256);
const courses=filledIndependentCourses();assert.equal(courses.length,12);assert.equal(courses.filter(c=>c.eligible).length,7);
const receipt={schema:'experimental-earth-filled-independent-comparison/1',startedUtc:new Date().toISOString(),freezeSha256:sha(freezeBytes),sourceHashes:freeze.sourceHashes,tupleSha256:filledIndependentTupleSha256,oracleSha256:freeze.independentOracleSha256,method:'Exact qualified161 predecessor versus frozen filled original-drain conditioning; identical independent originals. Future challenge values never used to fit, select or rank candidates. Every truth-eligible case counted, including budget or model refusals. No numerical changes after tuple release.',summary:{originalTuples:12,eligible:7,excluded:5,baselineCalibration:0,baselineHeld:0,currentCalibration:0,currentHeld:0,baselineRefused:0,currentRefused:0,baselineMilliseconds:0,currentMilliseconds:0,maximumCurrentReservation:0},excluded:[],records:[]};
for(const c of courses){
 if(!c.eligible){receipt.excluded.push({id:c.id,tuple:c.sourceTuple,reasons:c.reasons,forwardAdmissionError:c.forwardAdmissionError,truth:c.truth,originalReportedPhase:c.originalReportedPhase,truthSnapshotPhase:c.truthSnapshotPhase});continue;}
 const source={project:c.project,selection:c.selection,account:c.account},unchanged=structuredClone(source),record={id:c.id,source:structuredClone(source),knownModelForEvaluationOnly:c.truth,originalReportedPhase:c.originalReportedPhase,truthSnapshotPhase:c.truthSnapshotPhase};
 for(const [name,fn] of [['baseline',predecessor.fitReceivingAccountPhases],['current',fitReceivingAccountPhases]]){
  const started=performance.now();let result;
  try { result={status:'evaluated',result:fn(c.project,c.selection,c.account)}; }
  catch(error){result={status:'refused',error:{name:error.name,message:error.message}};}
  const milliseconds=performance.now()-started;result.milliseconds=milliseconds;record[name]=result;assert.deepEqual(source,unchanged);
  receipt.summary[name+'Milliseconds']+=milliseconds;
  if(result.status==='refused')receipt.summary[name+'Refused']++;
  else {receipt.summary[name+'Calibration']+=Number(result.result.compatibleIds.length>0);receipt.summary[name+'Held']+=Number(result.result.survivingIds.length>0);if(name==='current')receipt.summary.maximumCurrentReservation=Math.max(receipt.summary.maximumCurrentReservation,result.result.reservation.totalCellEquivalentSteps);}
 }
 receipt.records.push(record);
 console.log(JSON.stringify({id:c.id,phase:c.truthSnapshotPhase,...Object.fromEntries(['baseline','current'].map(name=>[name,record[name].status==='evaluated'?{calibration:record[name].result.compatibleIds.length,held:record[name].result.survivingIds.length,reserved:record[name].result.reservation.totalCellEquivalentSteps,milliseconds:record[name].milliseconds,filledProposals:record[name].result.filledDrain?.proposals?.length}:record[name]]))}));
}
assert.equal(receipt.records.length,7);assert.equal(receipt.excluded.length,5);
receipt.finishedUtc=new Date().toISOString();writeFileSync(new URL('./filled-independent-comparison.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt.summary));

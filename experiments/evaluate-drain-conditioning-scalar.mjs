import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {phaseIndependentCourses} from '../tests/receiving-phase-independent-fixtures.mjs';
import {fitReceivingAccountBands} from '../receiving-account-band-fit.js';
import {fitReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {evaluateReceivingAccountRows} from '../receiving-account-evidence.js';

const protocol=JSON.parse(readFileSync(new URL('./drain-conditioning-scalar-method.json',import.meta.url))),sha=b=>createHash('sha256').update(b).digest('hex');
for(const [path,expected]of Object.entries(protocol.baseHashes))assert.equal(sha(readFileSync(new URL('../'+path,import.meta.url))),expected,path);
const receipt={schema:'experimental-earth-original-drainage-conditioned/1',protocol,startedUtc:new Date().toISOString(),summary:{eligible:0,bandCalibration:0,bandHeld:0,phaseCalibration:0,phaseHeld:0},records:[],meaning:'Consumed authored development cases with one fixed additional original calibration reading; no field or independent method qualification.'};
const out=new URL('./drain-conditioning-scalar-result.json',import.meta.url),save=()=>writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');save();
for(const c of phaseIndependentCourses().filter(x=>x.eligible)){
  receipt.summary.eligible++;
  const minute=Math.max(...c.account.readings.filter(x=>x.channel==='retained'&&x.use==='calibration').map(x=>x.minute));
  c.account.readings.push({id:'additional-drained-'+minute,channel:'drained',minute,valueLiters:c.result.drainingLayer.snapshots.find(x=>x.minute===minute).drainedLiters,uncertaintyLiters:.02,use:'calibration',source:'Authored additional original from unchanged maintained model; later original retained calibration time and0.02L half-width fixed before this experiment. Not acquired field evidence.'});
  assert.ok(evaluateReceivingAccountRows(c.result,c.account.readings).every(x=>x.withinBand));
  const originals=structuredClone({project:c.project,selection:c.selection,account:c.account}),record={id:c.id,truthPhase:c.truthSnapshotPhase,originals,additionalOriginal:c.account.readings.at(-1)};
  for(const [name,fn]of [['band',fitReceivingAccountBands],['phase',fitReceivingAccountPhases]]){
    const start=performance.now(),r=fn(c.project,c.selection,c.account);
    record[name]={status:r.status,compatibleIds:r.compatibleIds,survivingIds:r.survivingIds,counts:r.counts,reservation:r.reservation,milliseconds:performance.now()-start,candidates:r.candidates};
    receipt.summary[name+'Calibration']+=!!r.compatibleIds.length;receipt.summary[name+'Held']+=!!r.survivingIds.length;
  }
  assert.deepEqual({project:c.project,selection:c.selection,account:c.account},originals);receipt.records.push(record);save();
  console.log(JSON.stringify({id:c.id,phase:c.truthSnapshotPhase,bandCal:record.band.compatibleIds.length,phaseCal:record.phase.compatibleIds.length,bandHeld:record.band.survivingIds.length,phaseHeld:record.phase.survivingIds.length}));
}
receipt.completedUtc=new Date().toISOString();save();console.log(JSON.stringify(receipt.summary));

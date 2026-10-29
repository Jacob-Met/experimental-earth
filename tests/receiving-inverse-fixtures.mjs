import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {makeReceivingAccountProposalExample} from '../receiving-account-proposals.js';

const template=makeReceivingAccountProposalExample();
const provenance='Authored maintained-forward control; no field observations';
export const relativeError=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(b));
export const matchesTruth=(candidate,truth,tolerance=1e-6)=>['capacityMm','initialStoredMm','drainagePerHour'].every(key=>relativeError(candidate.hypothesis[key],truth[key])<=tolerance);
export function originalCourse({rainMmHr,capacityMm,initialStoredMm,drainagePerHour,stormMinutes=60,durationMinutes=720,stepMinutes=5,cellSizeM=1.3}){
  const project=structuredClone(template.project);
  project.title='Independent authored receiver course';
  project.weather={...project.weather,rainMmHr,stormMinutes,durationMinutes,stepMinutes,cellSizeM};
  project.proposal[3].surface='sealed';project.observations=[];
  const selection={target:'proposal',surface:'garden',uniformReceiverBasis:'Authored uniform receiver across three selected cells, with one unselected sealed cell'};
  const truth={capacityMm,initialStoredMm,drainagePerHour,source:provenance};
  const result=runRain(project.proposal,2,2,project.weather,{drainingLayer:hypothesisLayer(selection,truth)});
  const surface=minute=>{const row=result.snapshots.find(row=>row.minute===minute);if(!row)throw Error('Missing original surface endpoint '+minute);return row.depthsMm[0];};
  const receiver=minute=>{const row=result.drainingLayer.snapshots.find(row=>row.minute===minute);if(!row)throw Error('Missing original receiver endpoint '+minute);return row;};
  const surfaceRow=(minute,use='calibration')=>({cellIndex:0,minute,depthMm:surface(minute),uncertaintyMm:1e-5,scenario:'proposal',use,source:provenance});
  const receiverRow=(minute,channel,use='calibration',id=channel+'-'+String(minute).replace('.','_'))=>({id,channel,minute,valueLiters:receiver(minute)[channel==='retained'?'retainedLiters':'drainedLiters'],uncertaintyLiters:1e-5,use,source:provenance});
  const account={footprintBasis:'Original authored whole-footprint total across three selected cells, not a point reading or surface outlet',readings:[],offers:[]};
  return {project,selection,account,truth,result,areaM2:3*cellSizeM**2,surface,receiver,surfaceRow,receiverRow};
}
export function wetCourse(parameters,channel){
  const T=parameters.stormMinutes??60;
  const course=originalCourse({...parameters,durationMinutes:3*T,stepMinutes:1.5,cellSizeM:1.7});
  course.project.observations=[course.surfaceRow(T),course.surfaceRow(1.5*T),course.surfaceRow(2*T,'challenge')];
  course.account.readings=[course.receiverRow(parameters.accountMinute??T+15,channel),course.receiverRow(2*T,channel==='retained'?'drained':'retained','challenge')];
  return course;
}
export function postDryGridInputs(){
  const all=[];
  for(const rainMmHr of [11,27,41])for(const capacityMm of [4.7,13.2,29.1])for(const drainagePerHour of [.117,.41,.89])for(const fraction of [0,.37,1])for(const stormMinutes of [40,95]){
    const course=originalCourse({rainMmHr,capacityMm,initialStoredMm:fraction*capacityMm,drainagePerHour,stormMinutes});
    const atStorm=course.receiver(stormMinutes),full=Math.abs(atStorm.retainedLiters/course.areaM2-capacityMm)<=1e-8*Math.max(1,capacityMm);
    const eligible=course.surface(stormMinutes)>0&&full&&course.surface(420)===0;
    const reasons=[];if(!(course.surface(stormMinutes)>0))reasons.push('no-positive-storm-end-depth');if(!full)reasons.push('not-full-at-storm-end');if(course.surface(420)!==0)reasons.push('not-surface-dry-at-first-account');
    course.project.observations=[course.surfaceRow(stormMinutes),course.surfaceRow(420),course.surfaceRow(690,'challenge')];
    course.account.readings=[420,510,690].map(t=>course.receiverRow(t,'drained'));
    course.account.readings.push(course.receiverRow(600,'retained','challenge'));
    all.push({...course,eligible,reasons});
  }
  return all;
}


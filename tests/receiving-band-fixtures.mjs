import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {makeReceivingAccountProposalExample} from '../receiving-account-proposals.js';

const template=makeReceivingAccountProposalExample();
export function independentBandCourse({rainMmHr,capacityMm,drainagePerHour,fraction,stormMinutes,index=0,width=4,height=3,cellSizeM=2.1}){
  const project=structuredClone(template.project),selection=structuredClone(template.selection);
  project.title='Independent authored noisy receiving course';project.width=width;project.height=height;project.selectedIndex=0;
  project.weather={...project.weather,rainMmHr,stormMinutes,durationMinutes:720,stepMinutes:5,cellSizeM};
  project.proposal=Array.from({length:width*height},(_,i)=>({surface:i%3===2?'sealed':'garden',elevationM:(i%4)*.01,provenance:'Authored mixed-surface geometry, not field evidence'}));
  project.existing=structuredClone(project.proposal);project.observations=[];
  selection.target='proposal';selection.surface='garden';selection.uniformReceiverBasis='Authored uniform isolated layer over every selected garden cell; independent control';
  const truth={capacityMm,initialStoredMm:capacityMm*fraction,drainagePerHour,source:'Authored independent parameter control, never supplied to the fitter'};
  const result=runRain(project.proposal,width,height,project.weather,{drainingLayer:hypothesisLayer(selection,truth)});
  const count=project.proposal.filter(c=>c.surface===selection.surface).length,areaM2=count*cellSizeM**2;
  const snapshot=t=>result.snapshots.find(r=>r.minute===t),receiver=t=>result.drainingLayer.snapshots.find(r=>r.minute===t);
  const positive=snapshot(stormMinutes).depthsMm[0]>0,full=Math.abs(receiver(stormMinutes).retainedLiters/areaM2-capacityMm)<1e-8*Math.max(1,capacityMm),dry=snapshot(390).depthsMm[0]===0;
  const eligible=positive&&full&&dry,reasons=[];if(!positive)reasons.push('no-positive-storm-end-depth');if(!full)reasons.push('not-full-at-storm-end');if(!dry)reasons.push('not-dry-at-first-account');
  const source='Authored maintained-forward original with declared within-band perturbation; not measured field evidence';
  project.observations=[
    {cellIndex:0,minute:stormMinutes,depthMm:snapshot(stormMinutes).depthsMm[0]+.0021*Math.sin((index+1)*1.393),uncertaintyMm:.003,scenario:'proposal',use:'calibration',source},
    {cellIndex:0,minute:390,depthMm:snapshot(390).depthsMm[0]+.0005,uncertaintyMm:.003,scenario:'proposal',use:'calibration',source},
    {cellIndex:0,minute:700,depthMm:snapshot(700).depthsMm[0],uncertaintyMm:.003,scenario:'proposal',use:'challenge',source:'Authored original held aside before fitting'},
  ];
  const account={footprintBasis:'Original whole-footprint account over '+count+' selected cells / '+areaM2+' square metres; no point probe',
    readings:[390,495,675].map((minute,i)=>({id:'independent-drain-'+minute,channel:'drained',minute,valueLiters:receiver(minute).drainedLiters+.011*Math.sin((index+1)*1.819+(i+1)*2.331),uncertaintyLiters:.018,use:'calibration',source})),offers:[]};
  account.readings.push({id:'independent-retained-570',channel:'retained',minute:570,valueLiters:receiver(570).retainedLiters,uncertaintyLiters:.018,use:'challenge',source:'Authored retained amount held aside from numerical fitting'});
  return {project,selection,account,truth,result,areaM2,eligible,reasons};
}

export function independentBandGrid(){
  const courses=[];let index=0;
  for(const rainMmHr of [16,28,39])for(const capacityMm of [6.8,17.9])for(const drainagePerHour of [.23,.47,.73])for(const fraction of [0,.22,.67,1])for(const stormMinutes of [55,100])
    courses.push(independentBandCourse({rainMmHr,capacityMm,drainagePerHour,fraction,stormMinutes,index:index++}));
  return courses;
}

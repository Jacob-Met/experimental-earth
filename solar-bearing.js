import {validateProject} from './core.js';
import {solarContext} from './solar-occlusion-contract.js';
import {compareSolarOcclusion} from './solar-occlusion.js';
import {validateSunPath,sunPathPosition,sunPathContext,SUN_PATH_MODEL} from './solar-path.js';
import {rectangleDiskHeadingArc,headingArcBearings,unionBearingIntervals,bearingDomainCovered,bearingGapWitness,BEARING_ANGLE_FRINGE_DEG} from './solar-bearing-geometry.js';

export const SUN_BEARING_LIMITS=Object.freeze({maxWitnesses:7,maxRayTests:16000000});
export const SUN_BEARING_NUMERICS='Finite angular geometry with conservative spatial margins, screened clipping and unresolved angular endpoint fringes. These floating-point envelopes are engineering screens, not certified interval arithmetic or authenticated survey bounds.';
export const SUN_BEARING_SEMANTICS='One original ground centre and UTC instant under the retained opaque-column and stepped-terrain model. Only the declared true-north bearing range is varied. Column heights retain their existing bounds. No mapped blocker does not establish sunlight; off-map objects, clouds and omitted geometry remain unknown. No area, duration, irradiance or comfort is inferred.';
const wrap=a=>((a%360)+360)%360,finite=n=>typeof n==='number'&&Number.isFinite(n);

export function planSunBearing(project,input,options){
  validateProject(project);const declaration=validateSunPath(input),count=project.width*project.height;
  if(!project.solarStudy||project.solarStudy.contextJson!==solarContext(project))throw Error('Retain a current sourced obstruction declaration for this original site.');
  const keys=['cellIndex','sampleIndex','halfWidthDeg','basis'];
  if(!options||typeof options!=='object'||Object.keys(options).length!==keys.length||!keys.every(k=>Object.hasOwn(options,k)))throw Error('Supply only the original cell, sample, bearing half width and its basis.');
  if(!Number.isInteger(options.cellIndex)||options.cellIndex<0||options.cellIndex>=count)throw Error('Select an original ground centre.');
  if(!Number.isInteger(options.sampleIndex)||options.sampleIndex<0||options.sampleIndex>=declaration.sampleCount)throw Error('Select one original sampled UTC instant.');
  if(!finite(options.halfWidthDeg)||options.halfWidthDeg<0||options.halfWidthDeg>180)throw Error('Declare a bearing half width from 0 through 180 degrees.');
  if(typeof options.basis!=='string'||!options.basis.trim()||options.basis.length>400)throw Error('Retain the source or assumption for the bearing range (up to 400 characters).');
  const settings={...options,basis:options.basis.trim()},center=declaration.gridColumnBearingDeg;
  const estimatedRayTests=SUN_BEARING_LIMITS.maxWitnesses*6*count*(count-1);
  if(estimatedRayTests>SUN_BEARING_LIMITS.maxRayTests)throw Error('The complete original-site witness calculation exceeds its ray budget.');
  const utc=new Date(Math.min(Date.parse(declaration.endUtc),Date.parse(declaration.startUtc)+settings.sampleIndex*declaration.stepMinutes*60000)).toISOString();
  // Every bearing is admitted at180 degrees. A canonical full circle avoids
  // center±180 rounding to a span slightly greater than360 without widening or
  // merging any actual angular interval. The original nominal bearing is kept.
  const domain=settings.halfWidthDeg===180?[0,360]:[center-settings.halfWidthDeg,center+settings.halfWidthDeg];
  return {declaration,settings,domain,utc,
    position:sunPathPosition(utc,declaration.latitudeDeg,declaration.longitudeDeg,center),estimatedRayTests};
}

function scenarioEnvelope(project,target,plan,epsilonM,nominal){
  const {cellIndex}=plan.settings,cells=project[target],side=project.weather.cellSizeM;
  if(nominal.status==='footprint')return {status:'footprint',inner:[],outer:[],columns:[],fallbackCount:0};
  const features=new Map(project.solarStudy[target].map(c=>[c.cellIndex,c]));
  const origin=[(cellIndex%project.width+.5)*side,(Math.floor(cellIndex/project.width)+.5)*side,cells[cellIndex].elevationM];
  const elevation=plan.position.elevationDeg*Math.PI/180,horizontal=Math.cos(elevation),vertical=Math.sin(elevation);
  const columns=[],inner=[],outer=[];let fallbackCount=0;
  for(let i=0;i<cells.length;i++){
    if(i===cellIndex)continue;
    const feature=features.get(i),x=(i%project.width)*side-origin[0],y=Math.floor(i/project.width)*side-origin[1];
    const envelopes={cellIndex:i,source:feature?.source??cells[i].provenance,kind:feature?'declared column':'declared terrain'};
    for(const envelope of ['inner','outer']){
      // One extra epsilon beyond the geometric 2epsilon robust-chord proof and
      // 1epsilon possible-hit box absorbs component snapping over admitted reach.
      const padding=(envelope==='inner'?-3:2)*epsilonM;
      const height=cells[i].elevationM+(envelope==='inner'?(feature?.heightMinM??0):(feature?.heightMaxM??0))+padding-origin[2];
      let result={arc:null,fallback:null,radialScreenM:0};
      if(height>0){
        const rect=[x-padding,x+side+padding,y-padding,y+side+padding];
        const reach=height*horizontal/vertical;
        if(rect[0]<=rect[1]&&rect[2]<=rect[3])result=rectangleDiskHeadingArc(rect,reach,envelope);
      }
      const ranges=headingArcBearings(result.arc,plan.position.azimuthDeg,plan.domain,envelope);
      envelopes[envelope]={ranges,fallback:result.fallback,radialScreenM:result.radialScreenM};
      if(result.fallback)fallbackCount++;
      (envelope==='inner'?inner:outer).push(...ranges);
    }
    if(envelopes.inner.ranges.length||envelopes.outer.ranges.length||envelopes.inner.fallback||envelopes.outer.fallback)columns.push(envelopes);
  }
  const sufficient=unionBearingIntervals(inner),possible=unionBearingIntervals(outer);
  const status=bearingDomainCovered(sufficient,plan.domain)?'blocked-throughout':possible.length===0?'no-mapped-blocker-throughout':'not-established';
  return {status,inner:sufficient,outer:possible,columns,fallbackCount};
}

export function inspectSunBearing(project,input,options){
  const plan=planSunBearing(project,input,options),base={schema:'experimental-earth-sun-bearing/1',model:SUN_PATH_MODEL,
    sourceContext:sunPathContext(project),...plan,numericQualification:SUN_BEARING_NUMERICS,semantics:SUN_BEARING_SEMANTICS,angularFringeDeg:BEARING_ANGLE_FRINGE_DEG};
  if(plan.position.elevationDeg<1){const status=plan.position.elevationDeg<=0?'below-horizon':'low-elevation';return {...base,condition:status,existing:{status},proposal:{status},witnesses:[],paired:'not-established'};}
  const working=structuredClone(project),cache=new Map();
  const calculate=bearing=>{
    const key=wrap(bearing);if(cache.has(key))return cache.get(key);
    if(cache.size>=SUN_BEARING_LIMITS.maxWitnesses)throw Error('The complete witness set exceeds its declared bound.');
    working.solarStudy={...project.solarStudy,headingDeg:wrap(plan.position.azimuthDeg-key),elevationDeg:plan.position.elevationDeg};
    const result=compareSolarOcclusion(working);if(result.status!=='compared')throw Error('Original obstruction inputs no longer admit this witness.');
    const witness={bearingDeg:key,unwrappedBearingDeg:bearing,headingDeg:working.solarStudy.headingDeg,
      existing:result.existing[options.cellIndex],proposal:result.proposal[options.cellIndex]};
    cache.set(key,{witness,epsilonM:result.epsilonM});return cache.get(key);
  };
  const nominal=calculate(plan.declaration.gridColumnBearingDeg),epsilonM=nominal.epsilonM;
  const existing=scenarioEnvelope(project,'existing',plan,epsilonM,nominal.witness.existing),proposal=scenarioEnvelope(project,'proposal',plan,epsilonM,nominal.witness.proposal);
  const candidates=[...plan.domain];
  for(const envelope of [existing,proposal]){
    if(envelope.inner.length)candidates.push((envelope.inner[0][0]+envelope.inner[0][1])/2);
    const gap=bearingGapWitness(envelope.outer,plan.domain);if(gap!==null)candidates.push(gap);
  }
  for(const bearing of candidates)calculate(bearing);
  const witnesses=[...cache.values()].map(x=>x.witness);
  for(const [target,envelope]of [['existing',existing],['proposal',proposal]]){
    const expected=envelope.status==='blocked-throughout'?'blocked':envelope.status==='no-mapped-blocker-throughout'?'no-mapped-blocker':null;
    if(expected&&witnesses.some(w=>w[target].status!==expected)){envelope.status='numerically-unresolved';envelope.disagreement='A maintained-kernel witness disagreed with the sufficient envelope. No whole-range conclusion is retained.';}
  }
  const paired=existing.status==='no-mapped-blocker-throughout'&&proposal.status==='blocked-throughout'?'additional-throughout':existing.status==='blocked-throughout'&&proposal.status==='no-mapped-blocker-throughout'?'removed-throughout':'not-established';
  return {...base,condition:'modeled',epsilonM,existing,proposal,nominal:nominal.witness,witnesses,paired,
    actualWitnessCount:cache.size,bearingSensitive:['existing','proposal'].some(k=>new Set(witnesses.map(w=>w[k].status)).size>1)};
}

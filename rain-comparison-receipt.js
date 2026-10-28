/** Shared base-rain receipt; calculations and schema match the original file CLI. */
import {compare} from './core.js';

const FIELDS=['rainLiters','absorbedLiters','exitLiters','storedLiters','massErrorLiters','peakPondingLiters','maxDepthMm','cellsOver10Mm'];
const summary=run=>Object.fromEntries(FIELDS.map(field=>[field,run[field]]));
export function computeReceipt(project,sourceSHA256,sourceBytes){
  const result=compare(project),existing=summary(result.existing),proposal=summary(result.proposal);
  return {
    schema:'experimental-earth-rain-comparison/1',
    claim:'Conceptual finite-volume grid calculation from declared original project inputs; not measured site performance.',
    source:{sha256:sourceSHA256,bytes:sourceBytes,projectSchema:project.schema,title:project.title,description:project.source??null,observationsRetainedInOriginal:project.observations.length},
    geometry:{width:project.width,height:project.height,cellSizeM:project.weather.cellSizeM},
    event:{rainMmHr:project.weather.rainMmHr,stormMinutes:project.weather.stormMinutes,durationMinutes:project.weather.durationMinutes,stepMinutes:project.weather.stepMinutes},
    units:{rainLiters:'L',absorbedLiters:'L',exitLiters:'L',storedLiters:'L',massErrorLiters:'L',peakPondingLiters:'L',maxDepthMm:'mm',cellsOver10Mm:'cells'},
    existing,proposal,
    proposalMinusExisting:Object.fromEntries(FIELDS.map(field=>[field,proposal[field]-existing[field]])),
  };
}


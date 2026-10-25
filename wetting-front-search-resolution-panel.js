import {compareSoilSearchResolution} from './wetting-front-search-resolution.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=x=>Number(x).toLocaleString('en-US',{maximumSignificantDigits:6,notation:x!==0&&Math.abs(x)<.001?'scientific':'standard'});
/** Receives the accepted original search, including independently reopened sources. */
export function mountSoilSearchResolution({container,project,query,isCurrent}){
  const section=node('section');section.id='soil-search-resolution';
  const button=node('button','Check finer calculation intervals');button.type='button';button.id='soil-search-resolution-run';
  const status=node('p');status.setAttribute('role','status');
  const results=node('div');section.append(button,status,results);container.append(section);
  button.addEventListener('click',()=>{
    if(!isCurrent()){status.textContent='Search changed; recompute it first.';return;}
    status.textContent='Comparing the same parameter grid at finer intervals…';button.disabled=true;
    setTimeout(()=>{
      if(!isCurrent())return;
      try{
        const report=compareSoilSearchResolution(project,query);
        if(!isCurrent())return;
        results.replaceChildren();
        if(report.status==='minimum-step'){status.textContent='The saved calculation interval is already at the one-minute minimum.';return;}
        if(report.status==='work-limit'){status.textContent='The complete finer-interval comparison exceeds the work limit. Reduce the grid or event before comparing; no partial result is shown.';return;}
        if(!report.candidates.length){status.textContent='Original calibration readings and the investigated source material are required.';return;}
        status.textContent=report.status==='step-sensitive'?'The inferred alternatives or a reading-band conclusion depend on the tested calculation interval.':'No tested compatibility, closest-set or reading-band decision changed. Predictions can still differ.';
        const counts=node('ul');for(const run of report.runs){counts.append(node('li',`${run.stepMinutes} min: ${run.compatibleIds.length} calibration-compatible pairs; ${run.closestIds.length} closest calibration pairs. Compatible pairs: ${run.compatibleIds.length?run.compatibleIds.map(id=>{const c=run.candidates.find(x=>x.id===id);return `K ${fmt(c.conductivityMmHr)} / A ${fmt(c.capillaryDriveMm)}`;}).join('; '):'none'}. Closest calibration pairs: ${run.closestIds.map(id=>{const c=run.candidates.find(x=>x.id===id);return `K ${fmt(c.conductivityMmHr)} / A ${fmt(c.capillaryDriveMm)}`;}).join('; ')}.`));}results.append(counts);
        results.append(node('p',`Every interval tests all ${report.candidates.length} identical declared K/A pairs. ${report.cellSteps} total cell-steps. Held-aside values never choose the compatible calibration or closest sets.`));
        const detail=node('details');detail.append(node('summary','Inspect each pair and original reading across calculation intervals'));
        for(const candidate of report.candidates){const item=node('details');item.append(node('summary',`K ${fmt(candidate.conductivityMmHr)} / A ${fmt(candidate.capillaryDriveMm)}`));
          for(const reading of candidate.readings){const original=project.observations[reading.index];item.append(node('p',`${reading.role} cell ${original.cellIndex}, original minute ${original.minute}: ${original.depthMm} ± ${original.uncertaintyMm} mm. Source: ${original.source}. Prediction spread ${fmt(reading.spreadMm)} mm; ${reading.bandChanged?'band conclusion changes':'band conclusion unchanged'}.`));
            for(const prediction of reading.predictions)item.append(node('p',`${prediction.stepMinutes} min calculation: ${fmt(prediction.depthMm)} mm predicted; residual ${fmt(prediction.residualMm)} mm; ${prediction.withinBand?'inside':'outside'} original band. ${prediction.method==='snapshot'?'Saved model time':`Interpolated ${prediction.beforeMinute}–${prediction.afterMinute} min`}.`));
          }detail.append(item);
        }results.append(detail,node('p',report.meaning));
      }catch(error){if(isCurrent())status.textContent='Sensitivity comparison refused: '+error.message;}
      finally{if(isCurrent())button.disabled=false;}
    },0);
  });
}

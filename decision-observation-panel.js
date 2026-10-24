import { compareDecisionObservations } from './decision-observation.js';
const number=n=>Number(n.toPrecision(5)).toLocaleString('en-US',{maximumSignificantDigits:5});
const element=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
export function mountDecisionObservationPanel({host,getProject,getSettings,notice,prepareReading,prepareCollection}) {
  const panel=document.createElement('div');panel.className='observation-import';
  panel.innerHTML=`<h3>Would a collection separate the decision more clearly?</h3><p class="mini-note">Use the outcome and depth tolerance above. Compare opposing prediction gaps divided by twice each declared tolerance. This dimensionless band margin does not measure probability, cost or expected information gain.</p><label class="mini-note outlet-coverage"><input id="decision-collection-enabled" type="checkbox"><span>Include a feasible collection of all modeled boundary outflow as an option</span></label><div class="input-pair"><label class="input-label">Collection duration <span class="unit">minutes</span><input id="decision-collection-duration" type="number" min="0.000001" step="any" value="30"></label><label class="input-label">Prospective collection tolerance <span class="unit">± liters</span><input id="decision-collection-tolerance" type="number" min="0.000001" step="any" value="20"></label></div><button id="compare-decision-measurements" type="button" class="subtle">Compare measurement options</button><p id="decision-measurement-status" role="status"></p><div id="decision-measurement-options"></div><p class="mini-note">Candidates still come only from depth calibration; outlet coefficients remain fixed. Collection values do not fit or select this question. Retained collection intervals exclude overlapping suggestions. Model error and practical cost are outside these margins. A partial drain collection is not the modeled total. Preparing an option does not assert permission, coverage or a measured value.</p>`;
  host.append(panel);const find=id=>panel.querySelector(`#${id}`);
  function refresh(){find('decision-measurement-options').replaceChildren();find('decision-measurement-status').dataset.state='not-compared';find('decision-measurement-status').textContent='Declare the available collection option and tolerances, then compare.';}
  for(const id of ['decision-collection-enabled','decision-collection-duration','decision-collection-tolerance'])find(id).addEventListener('input',refresh);
  find('compare-decision-measurements').addEventListener('click',()=>{
    refresh();
    try{
      const result=compareDecisionObservations(getProject(),{...getSettings(),collectionEnabled:find('decision-collection-enabled').checked,
        collectionMinutes:Number(find('decision-collection-duration').value),volumeToleranceLiters:Number(find('decision-collection-tolerance').value)});
      find('decision-measurement-status').dataset.state=result.status;
      const names={depth:'local depth',collection:'full-boundary collection'};
      find('decision-measurement-status').textContent=result.options.length
        ? `Largest declared band margin: ${result.largestMarginTypes.map(type=>names[type]).join(' and ')}. A margin above 1 means opposing prediction bands do not overlap; it does not guarantee a real-world decision.`
        : `No distinguishing option: ${result.status}. Assign compatible calibration evidence and retain opposing outcome hypotheses first.`;
      const options=find('decision-measurement-options');
      for(const option of result.options){
        const card=element('article','');card.className='study-candidate';card.dataset.measurementType=option.type;
        card.append(element('h4',`${names[option.type]} · band margin ${number(option.bandMargin)}`));
        if(option.type==='depth'){
          const p=getProject(),cell=`${String.fromCharCode(65+option.cellIndex%p.width)}${Math.floor(option.cellIndex/p.width)+1}`;
          card.append(element('p',`${cell}, ${option.minute} min in the ${result.target} scenario. Minimum opposing gap ${number(option.separationMm)} mm for ±${number(option.uncertaintyMm)} mm tolerance.`));
        }else{
          card.append(element('p',`${option.startMinute}–${option.endMinute} min in the ${result.target} scenario. Minimum opposing gap ${number(option.separationLiters)} L for ±${number(option.toleranceLiters)} L tolerance. ${option.evaluatedCount} windows evaluated; ${option.excludedCount} overlapping recorded windows excluded.`));
        }
        const details=element('details','');details.append(element('summary','Inspect modeled predictions'));
        for(const prediction of option.predictions){
          details.append(element('p',option.type==='depth'
            ? `${prediction.rateMmHr} mm/h → ${number(prediction.depthMm)} mm depth.`
            : `${prediction.rateMmHr} mm/h → ${number(prediction.volumeLiters)} L (${prediction.direction} of the selected proposal outcome). Start: ${prediction.start.method} ${prediction.start.beforeMinute}–${prediction.start.afterMinute} min; end: ${prediction.end.method} ${prediction.end.beforeMinute}–${prediction.end.afterMinute} min.`));
        }
        card.append(details);
        const button=element('button',option.type==='depth'?'Prepare depth reading':'Prepare collection reading');button.type='button';button.className='subtle';button.dataset.prepareMeasurement=option.type;
        button.addEventListener('click',()=>{try{if(option.type==='depth')prepareReading(option);else prepareCollection({...option,target:result.target});}catch(error){notice(error.message);}});
        card.append(button);options.append(card);
      }
      const explanations={'not-enabled':'Collection was not declared available.','record-context-conflict':'The retained collection record belongs to another scenario or event context. Restore it or begin a separate record before preparing a collection.','all-recorded':'Every collection window overlaps an existing retained interval.','indistinguishable':'The available collection windows do not separate every opposing pair.','not-evaluated':'Collection was not evaluated because the decision hypotheses are unavailable.'};
      if(result.volume.status!=='question')options.append(element('p',explanations[result.volume.status]??result.volume.status));
    }catch(error){find('decision-measurement-status').dataset.state='error';find('decision-measurement-status').textContent=error.message;notice(error.message);}
  });
  return {refresh};
}

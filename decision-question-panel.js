import { chooseDecisionQuestion } from './decision-question.js';
import { INTERVENTION_METRICS } from './intervention-study.js';
const number=n=>Number(n.toPrecision(5)).toLocaleString('en-US',{maximumSignificantDigits:5});
export function mountDecisionQuestionPanel({ host, getProject, notice, prepareReading }) {
  const panel=document.createElement('div');panel.className='observation-import';
  panel.innerHTML=`<h3>Which reading could resolve a proposal reversal?</h3><p class="mini-note">Use calibration-compatible candidates only, independently of the comparison filter above. Seek depth readings that distinguish candidates predicting less versus more of one outcome. Held-aside values do not select the question.</p><div class="study-fields"><label class="input-label">Outcome to investigate<select id="decision-metric"></select></label><label class="input-label">Prospective depth tolerance <span class="unit">± mm</span><input id="decision-tolerance" type="number" min="0" max="1000" step="any" value="1"></label></div><div class="obs-actions"><button id="find-decision-reading" type="button" class="subtle">Find a decision-focused reading</button><button id="prepare-decision-reading" type="button" class="subtle" hidden>Prepare this reading</button></div><p id="decision-status" role="status"></p><div id="decision-predictions"></div><p class="mini-note">This maximizes the smallest predicted depth gap between opposite-effect candidate pairs, over unrecorded solver snapshots. It is a finite heuristic, not expected information gain or a physical guarantee. Equal-effect candidates are reported but are not part of the opposing-pair score. Measurement tolerance does not include model error. Measurements require an actually observable scenario and permission; a hypothetical proposal cannot supply a field observation.</p>`;
  host.append(panel);const find=id=>panel.querySelector(`#${id}`);let question=null;
  for(const [key,value] of Object.entries(INTERVENTION_METRICS)){const option=document.createElement('option');option.value=key;option.textContent=value.label;find('decision-metric').append(option);}
  function refresh(){question=null;find('prepare-decision-reading').hidden=true;find('decision-predictions').replaceChildren();find('decision-status').dataset.state='not-compared';find('decision-status').textContent='Find a question for the current site and saved candidates.';}
  find('decision-metric').addEventListener('change',refresh);find('decision-tolerance').addEventListener('input',refresh);
  find('find-decision-reading').addEventListener('click',()=>{
    refresh();
    try{
      const text=find('decision-tolerance').value.trim();if(!text)throw Error('Enter a prospective measurement tolerance');
      const result=chooseDecisionQuestion(getProject(),{metric:find('decision-metric').value,uncertaintyMm:Number(text)});
      find('decision-status').dataset.state=result.status;
      const reasons={'need-calibration':'Assign calibration readings before choosing an evidence-supported question.','no-compatible-rates':'No candidates meet the calibration bands. Revisit contradicted assumptions before requesting a reading.','surface-absent':'The investigated surface is absent.','no-reversal':'Calibration-compatible candidates do not predict opposing directions for this outcome. No reversal-resolving measurement is suggested.','all-recorded':'All eligible solver points already have readings for this scenario.','indistinguishable':'At every eligible point, at least one opposing candidate pair has indistinguishable predicted depth. No single point separates all opposing pairs.'};
      if(result.status!=='question'){find('decision-status').textContent=reasons[result.status]??result.status;return;}
      question=result;find('prepare-decision-reading').hidden=false;
      const p=getProject(),cell=`${String.fromCharCode(65+result.cellIndex%p.width)}${Math.floor(result.cellIndex/p.width)+1}`;
      find('decision-status').textContent=`${cell} at ${result.minute} min in the ${result.target} scenario: nearest opposing-pair depth gap ${number(result.separationMm)} mm across ${result.opposingPairCount} pairs. ${result.bandsDisjoint?'The ± tolerance bands of opposing predictions do not overlap.':'At this tolerance, at least one opposing pair has overlapping or touching bands; this reading may not resolve the direction.'} Evaluated ${result.evaluatedCount} unrecorded points; excluded ${result.excludedCount}.`;
      const group=document.createElement('p');group.textContent=`Less: ${result.lowerRatesMmHr.join(', ')} mm/h. More: ${result.higherRatesMmHr.join(', ')} mm/h. Equal within numerical tolerance: ${result.neutralRatesMmHr.length?result.neutralRatesMmHr.join(', '):'none'}.`;find('decision-predictions').append(group);
      const list=document.createElement('ul');
      for(const prediction of result.predictions){const row=document.createElement('li');row.textContent=`${prediction.rateMmHr} mm/h: depth ${number(prediction.depthMm)} mm; proposal minus existing ${number(prediction.effect)} ${INTERVENTION_METRICS[result.metric].unit} ${INTERVENTION_METRICS[result.metric].label.toLowerCase()}.`;list.append(row);}
      find('decision-predictions').append(list);
    }catch(error){find('decision-status').dataset.state='error';find('decision-status').textContent=error.message;notice(error.message);}
  });
  find('prepare-decision-reading').addEventListener('click',()=>{if(question)prepareReading(question);});
  return {refresh};
}

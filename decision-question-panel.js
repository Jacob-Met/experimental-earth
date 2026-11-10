import { mountDecisionObservationPanel } from './decision-observation-panel.js';
import { mountDecisionDepthPairPanel } from './decision-depth-pair-panel.js';
import { chooseDecisionQuestion } from './decision-question.js';
import { INTERVENTION_METRICS } from './intervention-study.js';
const number=n=>Number(n.toPrecision(5)).toLocaleString('en-US',{maximumSignificantDigits:5});
export function mountDecisionQuestionPanel({ host, getProject, notice, prepareReading, prepareCollection }) {
  const panel=document.createElement('div');panel.className='observation-import';panel.id='decision-question-panel';panel.dataset.investigation='';
  panel.innerHTML=`<h3>Which reading could resolve a proposal decision?</h3><p class="mini-note">Choose an outcome and a required change, then find a reading that could distinguish the remaining explanations.</p><div class="study-fields"><label class="input-label">Outcome to investigate<select id="decision-metric"></select></label><label class="input-label">Decision rule<select id="decision-criterion-mode"><option value="legacy">Opposite effect directions (default)</option><option value="at-most">Proposal minus existing is at most</option><option value="at-least">Proposal minus existing is at least</option></select></label><label class="input-label" id="decision-criterion-label" hidden>Signed proposal-minus-existing boundary <span class="unit" id="decision-criterion-unit"></span><input id="decision-criterion-value" type="number" step="any" disabled aria-describedby="decision-criterion-help"></label><label class="input-label">Prospective depth tolerance <span class="unit">± mm</span><input id="decision-tolerance" type="number" min="0" max="1000" step="any" value="1"></label></div><p class="mini-note" id="decision-criterion-help">Negative changes are reductions. Equality meets the target. Changing outcome resets the rule.</p><div class="obs-actions"><button id="find-decision-reading" type="button" class="subtle">Find a decision-focused reading</button><button id="prepare-decision-reading" type="button" class="subtle" hidden>Prepare this reading</button></div><p id="decision-status" role="status"></p><div id="decision-predictions"></div><details class="decision-method"><summary>How readings are compared</summary><p class="mini-note">This maximizes the smallest predicted depth gap between candidates on opposite sides of the chosen decision rule, over unrecorded solver snapshots. It is a finite heuristic, not expected information gain or a physical guarantee. In default mode, equal-effect candidates are reported but are not scored. With a custom boundary, every candidate is classified as meeting or missing that boundary, independently of whether its effect is less, more or neutral. Measurement tolerance does not include model error. Measurements require an actually observable scenario and permission; a hypothetical proposal cannot supply a field observation. Only calibration-compatible candidates are used, independently of the comparison filter above. Held-aside values never select this question.</p></details>`;
  host.append(panel);const find=id=>panel.querySelector(`#${id}`);let question=null;
  for(const [key,value] of Object.entries(INTERVENTION_METRICS)){const option=document.createElement('option');option.value=key;option.textContent=value.label;find('decision-metric').append(option);}
  function settings() {
    const mode=find('decision-criterion-mode').value;
    const text=find('decision-tolerance').value.trim();
    const value={metric:find('decision-metric').value,uncertaintyMm:text?Number(text):NaN};
    if(mode!=='legacy'){
      const bound=find('decision-criterion-value').value.trim();
      if(!['at-most','at-least'].includes(mode)||!bound||!Number.isFinite(Number(bound)))throw Error('Enter a finite signed decision boundary');
      value.criterion={operator:mode,value:Number(bound)};
    }
    return value;
  }
  function syncCriterion(){
    const custom=find('decision-criterion-mode').value!=='legacy';
    find('decision-criterion-label').hidden=!custom;find('decision-criterion-value').disabled=!custom;
    find('decision-criterion-unit').textContent=INTERVENTION_METRICS[find('decision-metric').value].unit;
  }
  const measurementPanel = mountDecisionObservationPanel({host:panel,getProject,notice,prepareReading,prepareCollection,
    getSettings:()=>{const {uncertaintyMm,...rest}=settings();return {...rest,depthToleranceMm:uncertaintyMm};}});
  const pairPanel=mountDecisionDepthPairPanel({host:panel,getProject,notice,prepareReading,getSettings:settings});
  function refresh(){pairPanel.refresh();measurementPanel.refresh();question=null;find('prepare-decision-reading').hidden=true;find('decision-predictions').replaceChildren();find('decision-status').dataset.state='not-compared';find('decision-status').textContent='Find a question for the current site and saved candidates.';}
  find('decision-metric').addEventListener('change',()=>{find('decision-criterion-mode').value='legacy';find('decision-criterion-value').value='';syncCriterion();refresh();});
  find('decision-criterion-mode').addEventListener('change',()=>{syncCriterion();refresh();});
  find('decision-criterion-value').addEventListener('input',refresh);
  find('decision-tolerance').addEventListener('input',refresh);syncCriterion();
  find('find-decision-reading').addEventListener('click',()=>{
    refresh();
    try{
      const text=find('decision-tolerance').value.trim();if(!text)throw Error('Enter a prospective measurement tolerance');
      const result=chooseDecisionQuestion(getProject(),settings());
      find('decision-status').dataset.state=result.status;
      const reasons={'need-calibration':'Assign calibration readings before choosing an evidence-supported question.','no-compatible-rates':'No candidates meet the calibration bands. Revisit contradicted assumptions before requesting a reading.','surface-absent':'The investigated surface is absent.','no-reversal':'Calibration-compatible candidates do not predict opposing directions for this outcome. No reversal-resolving measurement is suggested.','all-recorded':'All eligible solver points already have readings for this scenario.','indistinguishable':'At every eligible point, at least one opposing candidate pair has indistinguishable predicted depth. No single point separates all opposing pairs.'};
      if(result.criterion){
        const goal=document.createElement('p');
        goal.textContent=`Decision: proposal minus existing ${result.criterion.operator==='at-most'?'≤':'≥'} ${String(result.criterion.value)} ${INTERVENTION_METRICS[result.metric].unit} (${INTERVENTION_METRICS[result.metric].label}); equality meets the boundary. Meets: ${result.meetsCriterionRatesMmHr.join(', ')||'none'} mm/h. Misses: ${result.missesCriterionRatesMmHr.join(', ')||'none'} mm/h.`;

        find('decision-predictions').append(goal);
      }
      if(result.status==='no-decision-disagreement'){find('decision-status').textContent=result.criterionAgreement==='all-meet'?'All calibration-compatible candidates meet the declared boundary. No distinguishing reading is suggested.':'All calibration-compatible candidates miss the declared boundary. No distinguishing reading is suggested.';return;}
      if(result.status!=='question'){find('decision-status').textContent=reasons[result.status]??result.status;return;}
      question=result;find('prepare-decision-reading').hidden=false;
      const p=getProject(),cell=`${String.fromCharCode(65+result.cellIndex%p.width)}${Math.floor(result.cellIndex/p.width)+1}`;
      find('decision-status').textContent=`${cell} at ${result.minute} min in the ${result.target} scenario: nearest opposing-pair depth gap ${number(result.separationMm)} mm across ${result.opposingPairCount} pairs. ${result.bandsDisjoint?'The ± tolerance bands of opposing predictions do not overlap.':'At this tolerance, at least one opposing pair has overlapping or touching bands; this reading may not resolve the decision.'} Evaluated ${result.evaluatedCount} unrecorded points; excluded ${result.excludedCount}.`;
      if(result.criterion){
        const table=document.createElement('table');table.className='resolution-table decision-prediction-table';
        const caption=document.createElement('caption');caption.textContent=`Predicted outcomes at ${cell}, ${result.minute} min`;table.append(caption);
        const head=table.createTHead().insertRow();
        for(const label of ['Soil rate (mm/h)','Depth (mm)',`Change (${INTERVENTION_METRICS[result.metric].unit})`,'Target']){
          const th=document.createElement('th');th.scope='col';th.textContent=label;head.append(th);
        }
        const body=table.createTBody();
        for(const prediction of result.predictions){
          const row=body.insertRow();
          for(const value of [number(prediction.rateMmHr),number(prediction.depthMm),number(prediction.effect),prediction.meetsCriterion?'Meets':'Misses']){
            const td=row.insertCell();td.textContent=value;
          }
        }
        find('decision-predictions').append(table);
      }else{
      const group=document.createElement('p');group.textContent=`Less: ${result.lowerRatesMmHr.join(', ')} mm/h. More: ${result.higherRatesMmHr.join(', ')} mm/h. Equal within numerical tolerance: ${result.neutralRatesMmHr.length?result.neutralRatesMmHr.join(', '):'none'}.`;find('decision-predictions').append(group);
      const list=document.createElement('ul');
      for(const prediction of result.predictions){const row=document.createElement('li');row.textContent=`${prediction.rateMmHr} mm/h: depth ${number(prediction.depthMm)} mm; proposal minus existing ${number(prediction.effect)} ${INTERVENTION_METRICS[result.metric].unit} ${INTERVENTION_METRICS[result.metric].label.toLowerCase()}.${result.criterion?` ${prediction.meetsCriterion?'Meets':'Misses'} the declared boundary.`:''}`;list.append(row);}
      find('decision-predictions').append(list);
      }
    }catch(error){find('decision-status').dataset.state='error';find('decision-status').textContent=error.message;notice(error.message);}
  });
  find('prepare-decision-reading').addEventListener('click',()=>{if(question)prepareReading(question);});
  return {refresh};
}


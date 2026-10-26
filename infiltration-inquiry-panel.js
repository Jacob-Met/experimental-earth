import {SURFACES} from './core.js';
import {planInfiltrationInquiry} from './infiltration-inquiry.js';

export function mountInfiltrationInquiry({getProject,selectCell}) {
  const button=document.getElementById('suggest-infiltration');
  const status=document.getElementById('infiltration-reading');
  // Keep progress and the modeled proposal beside its action, before the
  // separate form for actual water-depth observations.
  button.closest('.section-heading').after(status);
  const coverage=document.createElement('select'); coverage.id='infiltration-coverage';
  coverage.setAttribute('aria-label','Infiltration inquiry coverage');
  for(const [value,text] of [['complete','Complete grid'],['shortlist','Quick shortlist']]) {
    const option=document.createElement('option');option.value=value;option.textContent=text;coverage.append(option);
  }
  const cancel=document.createElement('button');cancel.type='button';cancel.id='cancel-infiltration-inquiry';
  cancel.className='subtle';cancel.textContent='Cancel inquiry';cancel.hidden=true;
  button.before(coverage);button.after(cancel);button.textContent='Find infiltration check ↗';
  let serial=0,pending=null;
  const initial='Compare assumed infiltration ranges across the complete grid, or explicitly choose the quick shortlist. These are modeled endpoint effects, not measured soil properties.';
  const number=value=>Number(value).toLocaleString('en-US',{maximumSignificantDigits:6});
  function stop() { const wasPending=Boolean(pending);pending?.terminate();pending=null;serial++;button.disabled=false;cancel.hidden=true;return wasPending; }
  function retire() { const wasPending=stop();status.textContent=wasPending?'Project changed; the pending infiltration inquiry was cancelled. Run it again on the current project.':initial; }
  coverage.addEventListener('change',()=>{stop();status.textContent=initial;});
  cancel.addEventListener('click',()=>{stop();status.textContent='Infiltration inquiry cancelled; no partial result was adopted.';button.focus();});
  button.addEventListener('click',()=>{
    stop();const id=serial;const snapshot=structuredClone(getProject());
    try {
      const plan=planInfiltrationInquiry(snapshot,'proposal',coverage.value);
      if(plan.status==='capacity') {
        status.textContent='Inquiry exceeds the work limit: '+number(plan.estimatedCellSteps)+' nominal cell-steps, limit '+number(plan.cellStepLimit)+'. No cells were evaluated. '+(coverage.value==='complete'?'Choose Quick shortlist explicitly to test fewer cells, or shorten the modeled event.':'Shorten the modeled event to run this inquiry.');
        return;
      }
      const worker=new Worker(new URL('./infiltration-inquiry-worker.js',import.meta.url),{type:'module'});
      pending=worker;button.disabled=true;cancel.hidden=false;
      status.textContent='Starting infiltration inquiry: '+plan.candidateCount+'/'+plan.totalCount+' proposed cells.';
      worker.onerror=()=>{if(id!==serial||pending!==worker)return;stop();status.textContent='Infiltration inquiry unavailable. No result was adopted.';};
      worker.onmessage=({data})=>{
        if(id!==serial||pending!==worker||data.id!==id)return;
        const result=data.result;
        if(result.status==='running') {status.textContent='Evaluating proposed infiltration ranges: '+result.evaluatedCount+'/'+result.candidateCount+' cells'+(result.candidateCount<result.totalCount?' in a shortlist of '+result.totalCount+' total cells.':' across the complete grid.');return;}
        stop();
        if(result.status!=='complete') {status.textContent='Infiltration inquiry unavailable: '+(result.message||result.status)+'. No result was adopted.';return;}
        const scope='Evaluated '+result.evaluatedCount+'/'+result.totalCount+' cells'+(result.completeCoverage?' (complete grid).':' (heuristic shortlist; untested cells remain unknown).');
        if(!result.winner) {status.textContent=scope+' No tested material-range endpoint changes modeled water remaining + exiting by more than 0.000000001 L. '+(result.completeCoverage?'This does not validate the model or exclude effects between those endpoints.':'A complete-grid inquiry may still find a consequential cell.');return;}
        const check=result.winner;
        selectCell(check.cellIndex);
        const name=String.fromCharCode(65+check.cellIndex%snapshot.width)+(Math.floor(check.cellIndex/snapshot.width)+1);
        status.textContent='Check '+name+': the proposed '+SURFACES[check.surface].label.toLowerCase()+' cell was tested from '+check.rangeLowMmHr+'–'+check.rangeHighMmHr+' mm/h assumed infiltration. That single input changes modeled water remaining + exiting by '+number(check.impactLiters)+' L. '+scope+' These rates are invented example bounds, not measured soil properties or statistical confidence limits. The measured-depth form below records water depth, not infiltration rate.';
      };
      worker.postMessage({id,project:snapshot,target:'proposal',coverage:coverage.value});
    } catch(error) {stop();status.textContent='Infiltration inquiry unavailable: '+error.message+'. No result was adopted.';}
  });
  status.textContent=initial;
  return {retire};
}

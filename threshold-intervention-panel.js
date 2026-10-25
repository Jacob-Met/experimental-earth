import {compareThresholdIntervention} from './threshold-intervention.js';
import {INTERVENTION_METRICS} from './intervention-study.js';
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
export function mountThresholdIntervention(parent,{getProject,notice}){
 const section=node('section','');section.id='threshold-intervention';
 section.innerHTML='<h3>What do these bounds imply for the proposal?</h3><p>Carry every compatible rate into the same existing/proposal comparison. Only the original one-sided record selects rates; the numeric-depth notebook is separate.</p><label>Retain rates<select id="threshold-effect-subset"><option value="calibration">Compatible with calibration bounds</option><option value="surviving">Also compatible with held-aside bounds</option></select></label><button type="button" id="threshold-effect-run">Compare bound-supported consequences</button><p id="threshold-effect-status" role="status"></p><div id="threshold-effect-results"></div>';
 parent.append(section);const $=id=>section.querySelector('#'+id);let signature='';
 const clear=()=>{$('threshold-effect-results').replaceChildren();$('threshold-effect-status').dataset.state='not-compared';$('threshold-effect-status').textContent='Run the comparison after changing the original source, evidence or subset.';};
 $('threshold-effect-subset').addEventListener('change',clear);
 $('threshold-effect-run').addEventListener('click',()=>{clear();try{
  const r=compareThresholdIntervention(getProject(),{subset:$('threshold-effect-subset').value});
  const messages={'no-record':'Retain original sourced bounds first.','context-changed':'Original observed source changed; bounds cannot be reassigned.','surface-absent':'Studied surface is absent from the observed source.','work-limit':'Complete source and paired work exceeds three million cell-steps.','need-calibration':'Assign calibration bounds first.','need-challenge':'Assign held-aside bounds before requesting surviving rates.','no-compatible-rates':'No rate meets the requested original bounds; no consequence is substituted.'};
  $('threshold-effect-status').dataset.state=r.status;
  $('threshold-effect-status').textContent=r.status==='compared'?'Compared '+r.candidates.length+' retained rate(s) for '+r.eventRef+'.':messages[r.status]??r.status;
  if(r.status!=='compared')return;const host=$('threshold-effect-results');
  host.append(node('p',r.semantics),node('p','Retained rates: '+r.candidates.map(c=>c.rateMmHr).join(', ')+' mm/h. Observed scenario: '+r.evidenceTarget+'.'));
  for(const [key,m] of Object.entries(r.metrics))host.append(node('p',INTERVENTION_METRICS[key].label+': proposal minus existing '+m.min.toFixed(3)+' to '+m.max.toFixed(3)+' '+INTERVENTION_METRICS[key].unit+' ('+m.direction+').'));
  for(const c of r.candidates){const detail=node('details','');detail.append(node('summary',c.rateMmHr+' mm/h: paired quantities and water-account residuals'));
   for(const [key,m] of Object.entries(c.metrics))detail.append(node('p',INTERVENTION_METRICS[key].label+': '+m.existing.toFixed(3)+' → '+m.proposal.toFixed(3)+' '+INTERVENTION_METRICS[key].unit+'; change '+m.delta.toFixed(3)+'.'));
   detail.append(node('p','Water-account residuals: existing '+c.massErrorLiters.existing+' L; proposal '+c.massErrorLiters.proposal+' L.'));host.append(detail);
  }
  const local=node('details','');local.append(node('summary','Every cell: change in separate modeled peak depth'));
  for(const c of r.cells)local.append(node('p','Cell '+(c.cellIndex+1)+': '+c.min.toFixed(3)+' to '+c.max.toFixed(3)+' mm ('+c.direction+').'));
  host.append(local);
 }catch(error){clear();$('threshold-effect-status').textContent=error.message;notice(error.message);}});
 return {refresh(){const next=JSON.stringify(getProject());if(next!==signature){signature=next;clear();}}};
}

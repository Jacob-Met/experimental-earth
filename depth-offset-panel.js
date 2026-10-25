import {mountDepthOffsetQuestionPanel} from './depth-offset-question-panel.js';
import {DEFAULT_STUDY} from './study-contract.js';
import {prepareDepthOffset,depthOffsetReceipt,parseDepthOffsetReceipt} from './depth-offset-evidence.js';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=x=>Number(x).toLocaleString('en-US',{maximumSignificantDigits:7});
const band=x=>x?`${fmt(x[0])} to ${fmt(x[1])} mm`:'None';
export function mountDepthOffsetPanel({getProject,notice}){
 const panel=node('section');panel.id='depth-offset-panel';panel.className='panel study';
 panel.innerHTML=`<h2>Could one sensor zero explain these depth readings?</h2><p>Test one constant additive offset shared by explicitly selected readings. Reported depth = modeled depth + offset. A positive offset means the instrument reports a greater depth. Original values, roles and site parameters stay intact.</p><div class="input-pair"><label class="input-label">Minimum offset (mm)<input id="depth-offset-min" type="number" min="-1000" max="1000" step="any" value="-5"></label><label class="input-label">Maximum offset (mm)<input id="depth-offset-max" type="number" min="-1000" max="1000" step="any" value="5"></label></div><label class="input-label">Basis for a common sensor zero<input id="depth-offset-association" maxlength="500" placeholder="Identify the instrument and why its zero is shared"></label><fieldset><legend>Original readings associated with this sensor</legend><div id="depth-offset-rows"></div></fieldset><button id="depth-offset-run" type="button">Compare active project with a shared offset</button><button id="depth-offset-save" type="button" disabled>Download original investigation</button><label class="input-label">Reopen original investigation<input id="depth-offset-open" type="file" accept="application/json,.json"></label><p id="depth-offset-status" role="status" aria-live="polite"></p><div id="depth-offset-results"></div><p class="mini-note">These are conditional modeled explanations, not instrument calibration or evidence that a sensor caused the disagreement. Other model errors can mimic a zero offset. One offset must satisfy every associated reading; held-aside values never change calibration intervals. Closed interval endpoints use the retained numeric predictions and declared bands without an added fitting tolerance.</p>`;
 document.getElementById('infiltration-form').closest('section').after(panel);
 const find=id=>panel.querySelector('#depth-offset-'+id);
 let current=null,generation=0;
 const questions=mountDepthOffsetQuestionPanel({anchor:panel,notice,onReopen:()=>{generation++;current=null;find('results').replaceChildren();find('save').disabled=true;find('status').dataset.state='not-compared';find('status').textContent='An independent original question is reopened below. Active project unchanged.';}});
 function clear(message='Inputs changed; compare again.') {generation++;current=null;questions.clear();find('save').disabled=true;find('results').replaceChildren();find('status').dataset.state='not-compared';find('status').textContent=message;}
 function render(received,reopened=false){
  current=received;const {input,report:r}=received,host=find('results');if(r.candidates.length)questions.setSource(input);else questions.clear();host.replaceChildren();find('status').dataset.state=r.status;
  const messages={'context-changed':'The model context changed. Reassociate the original readings.','reading-changed':'An associated original row changed. Review and reassociate it.','work-limit':'The complete hypothesis calculation exceeds one million cell-steps; nothing was fitted.','surface-absent':'The studied surface is absent from the observed place.','need-calibration':'No selected calibration reading: no rate is supported.','calibration-rejected':'No offered rate and shared offset meet every calibration band.','challenged':'Held-aside readings contradict every calibration-compatible shared offset.','needs-challenge':'Calibration-compatible offsets remain; no selected held-aside reading challenges them.','one-survivor':'One offered rate has a shared offset compatible with both roles. Other untested explanations may exist.','ambiguous':'Several offered rates retain shared offsets; these readings do not distinguish them.'};
  find('status').textContent=(reopened?'Recomputed the reopened original source; active project unchanged. ':'')+(messages[r.status]??r.status);
  find('save').disabled=!r.candidates.length;
  host.append(node('p',`Association: ${input.declaration.association}`));
  const p=input.project,s=p.infiltrationStudy??DEFAULT_STUDY;
  host.append(node('p',`Original ${s.target} place, ${p.width} × ${p.height} cells; ${s.surface} rates ${s.ratesMmHr.join(', ')} mm/h. Declared offset ${fmt(input.declaration.minimumMm)} to ${fmt(input.declaration.maximumMm)} mm.`));
  if(!r.candidates.length)return;
  host.append(node('p',`${r.counts.calibration} selected calibration, ${r.counts.challenge} selected held aside, ${r.counts.excluded} excluded original rows. ${r.cellSteps.toLocaleString()} model cell-steps.`));
  for(const c of r.candidates){
   const card=node('article');card.className='study-candidate';card.dataset.rate=c.rateMmHr;
   card.append(node('h3',`${fmt(c.rateMmHr)} mm/h`),node('p',`Calibration-allowed offset: ${band(c.calibrationInterval)}`),node('p',`Held-aside-only offset: ${r.counts.challenge?band(c.challengeInterval):'No selected readings'}`),node('p',`${r.counts.challenge?'Shared offset after challenge':'Remaining shared offset (no challenge yet)'}: ${band(c.survivingInterval)}`));
   const details=node('details');details.append(node('summary','Inspect original rows and offset constraints'));
   for(const constraint of c.constraints){const reading=p.observations[constraint.index];details.append(node('p',`Row ${constraint.index+1}, ${constraint.role==='challenge'?'held aside':'calibration'}: cell ${reading.cellIndex+1}, minute ${reading.minute}; original ${fmt(reading.depthMm)} ± ${fmt(reading.uncertaintyMm)} mm, predicted ${fmt(constraint.predictedMm)} mm. This row allows ${fmt(constraint.minimumMm)} to ${fmt(constraint.maximumMm)} mm offset. Source: ${reading.source}. ${constraint.method}, retained bracket ${constraint.beforeMinute}–${constraint.afterMinute} minutes.`));}
   card.append(details);host.append(card);
  }
  host.style.overflowWrap='anywhere';
 }
 function refresh(){
  clear('Select original readings and declare a common sensor-zero range.');const p=getProject(),s=p.infiltrationStudy??DEFAULT_STUDY,rows=find('rows');rows.replaceChildren();
  for(const [index,reading]of p.observations.entries())if(reading.scenario===s.target&&['calibration','challenge'].includes(reading.use)){
   const label=node('label');label.className='joint-choice';const check=node('input');check.type='checkbox';check.value=index;label.append(check,node('span',`Row ${index+1}: cell ${reading.cellIndex+1}, ${reading.minute} min; ${reading.depthMm} ± ${reading.uncertaintyMm} mm; ${reading.use}; ${reading.source}`));rows.append(label);
  }
  if(!rows.childElementCount)rows.append(node('p','Assign sourced depth readings to this study scenario in the notebook first.'));
 }
 for(const id of ['min','max','association','rows'])find(id).addEventListener('input',()=>clear());
 find('run').addEventListener('click',()=>{clear();try{const p=structuredClone(getProject());const min=find('min').value,max=find('max').value;if(!min.trim()||!max.trim())throw Error('Supply both offset bounds.');const d=prepareDepthOffset(p,{minimumMm:Number(min),maximumMm:Number(max),association:find('association').value,indices:[...find('rows').querySelectorAll('input:checked')].map(e=>Number(e.value))});render(depthOffsetReceipt(p,d));}catch(error){clear(error.message);find('status').dataset.state='error';notice(error.message);}});
 find('save').addEventListener('click',()=>{if(!current)return;const text=JSON.stringify(current.input,null,2);if(new TextEncoder().encode(text).length>4*1024*1024){notice('Investigation exceeds 4 MiB.');return;}const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=node('a');a.href=url;a.download='depth-offset-investigation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);});
 find('open').addEventListener('change',async()=>{const file=find('open').files?.[0];if(!file)return;clear();const request=generation;try{if(file.size>4*1024*1024)throw Error('Investigation exceeds 4 MiB.');const text=await file.text();if(request!==generation)return;const received=parseDepthOffsetReceipt(text);if(request===generation)render(received,true);}catch(error){if(request===generation){clear(error.message);find('status').dataset.state='error';notice(error.message);}}finally{find('open').value='';}});
 refresh();return {refresh};
}


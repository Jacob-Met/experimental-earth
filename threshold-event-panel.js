import {createStormConsequencePanel} from './storm-consequences-panel.js';
import {parsePortableProject,MAX_PROJECT_FILE_BYTES} from './project-portability.js';
import {prepareThresholdTransfer,parseThresholdTransfer,serializeThresholdTransfer,MAX_THRESHOLD_TRANSFER_BYTES} from './threshold-event-transfer.js';
import {INTERVENTION_METRICS} from './intervention-study.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountThresholdEvents(parent,{getProject,notice}){
 const section=node('section');section.id='threshold-events';
 section.innerHTML='<h3>Do these rates transfer to another observed storm?</h3><p>Keep the first event and its proposal fixed. Load a second original project with one-sided bounds explicitly held aside. The same observed geometry and model assumptions must match; forcing may differ. This tests the declared unchanged-rate assumption, not a different site or authenticated evidence independence.</p><label>Second event project JSON<input id="threshold-event-file" type="file" accept=".json,application/json"></label><p id="threshold-event-source">No second event loaded.</p><label>Why is this a separate held-aside event?<textarea id="threshold-event-basis" maxlength="400" rows="3"></textarea></label><button type="button" id="threshold-event-run">Challenge rates and original proposal consequences</button><button type="button" id="threshold-event-export" disabled>Save both original events</button><label>Reopen original two-event investigation<input id="threshold-event-reopen" type="file" accept=".json,application/json"></label><p role="status" id="threshold-event-status"></p><div id="threshold-event-results"></div>';
 parent.append(section);const $=id=>section.querySelector('#'+id);
 let second=null,bundle=null,generation=0,signature=JSON.stringify(getProject());
 function clear(message){bundle=null;$('threshold-event-export').disabled=true;$('threshold-event-results').replaceChildren();$('threshold-event-status').textContent=message;$('threshold-event-status').dataset.state='not-compared';}
 function render(prepared,historical=false){
  const {report:r}=prepared;bundle=prepared.bundle;const host=$('threshold-event-results');host.replaceChildren();
  $('threshold-event-export').disabled=false;$('threshold-event-status').dataset.state=r.status;
  $('threshold-event-status').textContent=(historical?'Reopened original source; active site unchanged. ':'')+r.calibrationReference+' → '+r.challengeReference+': '+r.status+'.';
  host.append(node('p','Event independence basis: '+r.independence));
  const origin=bundle.calibrationProject,originalBounds=node('details');
  originalBounds.append(node('summary','Original first-event bounds'),node('p','Observed '+origin.thresholdEvidence.target+'; exact rates '+bundle.options.study.ratesMmHr.join(', ')+' mm/h.'));
  for(const [i,o] of origin.thresholdEvidence.readings.entries())originalBounds.append(node('p','Bound '+(i+1)+', cell '+String.fromCharCode(65+o.cellIndex%origin.width)+(Math.floor(o.cellIndex/origin.width)+1)+', '+o.minute+' min: '+o.relation+' '+o.thresholdMm+' mm ± '+o.uncertaintyMm+' mm, '+o.use+'. Source: '+o.source));
  host.append(originalBounds);
  if(r.firstEffects?.status==='compared'){
   host.append(node('h4','First-event evidence alone'));
   for(const [key,m] of Object.entries(r.firstEffects.metrics))host.append(node('p',INTERVENTION_METRICS[key].label+': '+m.min.toFixed(3)+' to '+m.max.toFixed(3)+' '+INTERVENTION_METRICS[key].unit+' ('+m.direction+').'));
  }
  for(const c of (r.candidates??[])){
   const detail=node('details');detail.append(node('summary',c.rateMmHr+' mm/h — '+(c.survives?'retained':'contradicted')));
   const tested=r.challenge.candidates.find(x=>x.rateMmHr===c.rateMmHr);
   for(const e of tested.readings){const raw=bundle.challengeProject.thresholdEvidence.readings[e.index];detail.append(node('p','Original second-event bound '+(e.index+1)+', '+e.use+': '+raw.relation+' '+raw.thresholdMm+' mm ± '+raw.uncertaintyMm+' mm; modeled '+e.depthMm.toFixed(3)+' mm; '+(e.compatible?'compatible':'contradicted')+'. Source: '+raw.source));}
   host.append(detail);
  }
  if(!r.survivingRatesMmHr.length){host.append(node('p','No transferred consequence is reported. A missing or rejected source is not replaced by the closest rate. The first-event result above remains a separate conditional calculation.'));return;}
  host.append(node('h4','After the separate storm'),node('p','Rates still supported: '+r.survivingRatesMmHr.join(', ')+' mm/h. Consequences below use the original first storm and its original two plans.'));
  for(const [key,m] of Object.entries(r.metrics))host.append(node('p',INTERVENTION_METRICS[key].label+': '+m.min.toFixed(3)+' to '+m.max.toFixed(3)+' '+INTERVENTION_METRICS[key].unit+' ('+m.direction+').'));
  host.append(node('p',r.limitation));
  host.append(createStormConsequencePanel(bundle));
 }
 async function read(event,limit,accept){
  const file=event.target.files?.[0];if(!file)return;const ticket=++generation,before=JSON.stringify(getProject());$('threshold-event-status').textContent='Reading '+file.name+'; previously accepted source remains unchanged until this read finishes.';
  try{if(file.size>limit)throw Error('File exceeds the complete-source size limit.');const text=await file.text();if(ticket!==generation||before!==JSON.stringify(getProject()))return;
   accept(text,file.name);
  }catch(error){if(ticket===generation){$('threshold-event-status').textContent='Import refused: '+error.message+' Previously accepted source remains unchanged.';notice(error.message);}}
  finally{if(event.target.files?.[0]===file)event.target.value='';}
 }
 $('threshold-event-file').addEventListener('change',e=>read(e,MAX_PROJECT_FILE_BYTES,(text,name)=>{const next=parsePortableProject(text);second=structuredClone(next);clear('Second original event loaded. Compare after declaring independence.');$('threshold-event-source').textContent=name+' · '+(second.thresholdEvidence?.eventRef??'no one-sided record');}));
 $('threshold-event-reopen').addEventListener('change',e=>read(e,MAX_THRESHOLD_TRANSFER_BYTES,text=>render(parseThresholdTransfer(text),true)));
 $('threshold-event-basis').addEventListener('input',()=>{generation++;clear('Declaration changed; compare again.');});
 $('threshold-event-run').addEventListener('click',()=>{generation++;clear('');try{if(!second)throw Error('Load the original second event project first.');render(prepareThresholdTransfer(getProject(),second,{independence:$('threshold-event-basis').value}));}catch(error){$('threshold-event-status').textContent=error.message;notice(error.message);}});
 $('threshold-event-export').addEventListener('click',()=>{if(!bundle)return;try{const url=URL.createObjectURL(new Blob([serializeThresholdTransfer(bundle)],{type:'application/json'})),a=node('a');a.href=url;a.download='experimental-earth-threshold-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}catch(error){notice(error.message);}});
 return {refresh(){const next=JSON.stringify(getProject());if(next!==signature){signature=next;generation++;clear('Active source changed; compare again with the retained second event.');}}};
}

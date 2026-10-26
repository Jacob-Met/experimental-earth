import {parsePortableProject,MAX_PROJECT_FILE_BYTES} from './project-portability.js';
import {mountJointHeatTransfer} from './heat-column-joint-transfer-panel.js';
import {prepareHeatColumnTransfer,compareHeatColumnTransfer,serializeHeatColumnTransfer,parseHeatColumnTransfer,MAX_TRANSFER_FILE_BYTES,MAX_TRANSFER_CSV_BYTES} from './heat-column-transfer.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const display=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:4});
const messages={'need-original-calibration':'The original investigation has no calibration readings. Transfer compatibility is unknown.','original-family-rejected':'No original alternative remains supported. New readings cannot restore a rejected original family.','transfer-rejected':'Every originally retained alternative conflicts with the separate exposure. No parameters were refitted.','one-finite-alternative':'One alternative from the original finite family remains compatible with the separate exposure. This does not establish unique physical properties.',ambiguous:'Several original alternatives remain compatible with the separate exposure.'};
export function mountHeatColumnTransfer({getProject}){
 const style=node('link');style.rel='stylesheet';style.href=new URL('./heat-column-transfer.css',import.meta.url);document.head.append(style);
 const panel=node('section');panel.id='heat-column-transfer';panel.className='panel study';
 panel.innerHTML=`<span class="eyebrow">HEAT / A SEPARATE EXPOSURE</span><h2>Do the same hidden-store explanations work again?</h2>
 <p>Freeze an original surface-temperature investigation, then challenge every original capacity/conductance alternative under another declared exposure at the same place. The original calibration and challenge outcomes stay unchanged. Each exposure retains its own supplied starting temperatures.</p>
 <div class="heat-layers"><fieldset><legend>Original investigation</legend><button id="transfer-use-current" type="button">Freeze current investigation</button><label class="input-label">Or open its exported project<input id="transfer-original-file" type="file" accept=".json,application/json"></label><p id="transfer-original-summary">No original investigation selected.</p></fieldset>
 <fieldset><legend>Separate exposure</legend><label class="input-label">Open its exported two-store project<input id="transfer-exposure-file" type="file" accept=".json,application/json"></label><p id="transfer-exposure-summary">No separate exposure selected.</p></fieldset></div>
 <label class="input-label">Why these exposures concern the same unchanged material<textarea id="transfer-association" maxlength="600" rows="3"></textarea></label>
 <label class="input-label">Original temperature CSV for the separate exposure<input id="transfer-readings-file" type="file" accept=".csv,text/csv"></label><p id="transfer-readings-summary">No temperature file selected.</p>
 <p class="mini-note">Columns: <code>minute,from_minute,aggregation,temperature,half_width,unit,use,source</code>. Retain explicit C/F/K units and instantaneous or interval-mean quantities. Every new reading must declare <code>challenge</code> use. This does not establish independent acquisition. Neither project replaces the current workspace.</p>
 <div class="obs-actions"><button id="transfer-run" type="button">Challenge frozen alternatives</button><button id="transfer-export" type="button" disabled>Download both original sources</button><label>Reopen transfer inputs<input id="transfer-import" type="file" accept=".json,application/json"></label></div>
 <p id="transfer-status" role="status">Choose both original sources and a temperature CSV.</p><div id="transfer-results"></div>`;
 document.getElementById('heat-column-evidence').after(panel);
 const $=id=>panel.querySelector('#'+id);
 let original=null,exposure=null,readingFile=null,bundle=null;
 const versions={original:0,exposure:0,readings:0,bundle:0},pending=new Set();
 function updateRun(){ $('transfer-run').disabled=pending.size>0||!original||!exposure||!readingFile||!$('transfer-association').value.trim(); }
 function cancelBundle(){versions.bundle++;pending.delete('bundle');}
 function begin(kind,message){cancelBundle();versions[kind]++;pending.add(kind);if(kind==='original')original=null;else if(kind==='exposure')exposure=null;else readingFile=null;invalidate(message);summaries();updateRun();return versions[kind];}
 function finish(kind,ticket){if(ticket===versions[kind]){pending.delete(kind);updateRun();}}
 function invalidate(message){bundle=null;$('transfer-results').replaceChildren();$('transfer-results').dataset.state='not-compared';$('transfer-export').disabled=true;$('transfer-status').textContent=message;}
 function summaries(){
  $('transfer-original-summary').textContent=original?original.title+' · frozen original project; '+(original.heatColumnEvidence?.hypotheses.length??0)+' original alternatives.':'No original investigation selected.';
  $('transfer-exposure-summary').textContent=exposure?exposure.title+' · '+display(exposure.heatColumnStudy?.heatStudy.schedule.reduce((s,r)=>s+r.minutes,0)??0)+' minutes; original project preserved.':'No separate exposure selected.';
  $('transfer-readings-summary').textContent=readingFile?readingFile.name+' · original CSV retained for recomputation.':'No temperature file selected.';
 }
 async function textFile(file,limit){if(file.size>limit)throw Error('Original file exceeds its supported byte limit');return new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}
 $('transfer-use-current').onclick=()=>{cancelBundle();versions.original++;pending.delete('original');original=null;invalidate('Original source retired. Selecting a current snapshot…');try{const p=structuredClone(getProject());if(!p.heatColumnEvidence)throw Error('Save an original two-store surface evidence investigation first');original=p;$('transfer-status').textContent='Original snapshot selected. Complete the separate exposure and readings.';}catch(e){$('transfer-status').textContent=e.message;}summaries();updateRun();};
 for(const [id,kind]of[['transfer-original-file','original'],['transfer-exposure-file','exposure']])$(id).onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;const request=begin(kind,'Reading replacement project; prior source retired…');
  try{const p=parsePortableProject(await textFile(file,MAX_PROJECT_FILE_BYTES));if(request!==versions[kind])return;if(kind==='original'&&!p.heatColumnEvidence)throw Error('The original project needs a saved two-store surface investigation');if(!p.heatColumnStudy)throw Error('Retain a complete two-store heat declaration');if(kind==='original')original=p;else exposure=p;summaries();$('transfer-status').textContent='Original project selected. Complete the other inputs, then challenge the frozen family.';}catch(e){if(request===versions[kind])$('transfer-status').textContent=e.message+'; the prior selected source remains retired.';}finally{finish(kind,request);event.target.value='';}
 };
 $('transfer-readings-file').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;const request=begin('readings','Reading replacement temperatures; prior CSV retired…');try{const text=await textFile(file,MAX_TRANSFER_CSV_BYTES);if(request!==versions.readings)return;readingFile={name:file.name,text};summaries();$('transfer-status').textContent='Original CSV selected; comparison validates every row before showing a result.';}catch(e){if(request===versions.readings)$('transfer-status').textContent=e.message+'; the prior selected CSV remains retired.';}finally{finish('readings',request);event.target.value='';}};
 $('transfer-association').addEventListener('input',()=>{cancelBundle();invalidate('Association changed; challenge the original inputs again.');updateRun();});
 function draw(result,source){
  const host=$('transfer-results');host.replaceChildren();$('transfer-status').textContent=messages[result.status];host.dataset.state=result.status;
  host.append(node('h3',result.originalCalibrationLabels.length+' original calibration-compatible · '+result.originalSurvivingLabels.length+' originally retained · '+(result.transferLabels===null?'transfer unknown':result.transferLabels.length+' retained across exposures')));
  host.append(node('p','Both original projects and every candidate remain retained. The current workspace is unchanged.'));
  const target=source.originalProject.heatColumnEvidence.target;
  const old=source.originalProject.heatColumnStudy,newer=source.challengeProject.heatColumnStudy;
  host.append(node('p','Supplied initial states: original surface '+display(old.heatStudy[target].initialC)+' °C / lower '+display(old.lowerLayers[target].initialC)+' °C; separate exposure surface '+display(newer.heatStudy[target].initialC)+' °C / lower '+display(newer.lowerLayers[target].initialC)+' °C. These are declarations, not inferred states.'));
  const list=node('div');list.className='heat-layers';
  for(const [i,c]of result.candidates.entries()){
   const h=source.originalProject.heatColumnEvidence.hypotheses[i],card=node('article');card.className='heat-result-card';card.dataset.label=c.label;
   card.append(node('h4',c.label),node('p',display(h.capacityJm2K)+' J/(m²·K) · '+display(h.conductanceWm2K)+' W/(m²·K)'),node('p',!c.retainedOriginally?'Not retained by original evidence; cannot regain support here.':c.challenge.compatible?'Within every separate-exposure band.':'Conflicts with a separate-exposure band.'),node('p',h.source));
   for(const row of c.challenge.rows){const r=result.readings[row.index];card.append(node('p',(row.aggregation==='interval-mean'?'Mean '+display(row.fromMinute)+'–'+display(row.minute):'Instant '+display(row.minute))+' min: predicted '+display(row.predictionC)+' °C; observed '+display(r.temperatureC)+' ± '+display(r.halfWidthC)+' °C; '+(row.withinBand?'within band':'outside band')+'. Arithmetic guard '+row.arithmeticGuardC+' °C.'));}
   list.append(card);
  }
  host.append(list);
  const details=node('details');details.append(node('summary','Inspect original association and temperature rows'),node('p',source.associationSource));for(const r of result.readings)details.append(node('p',r.source));const raw=node('pre',source.readingFile.text);raw.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';details.append(raw);host.append(details,node('p',result.semantics));
  $('transfer-export').disabled=false;
 }
 $('transfer-run').onclick=()=>{if(pending.size||!original||!exposure||!readingFile){invalidate('Complete the current source files before comparing.');updateRun();return;}invalidate('Comparing original inputs…');try{const source=prepareHeatColumnTransfer(original,exposure,readingFile,$('transfer-association').value);const result=compareHeatColumnTransfer(source);bundle=source;draw(result,source);}catch(e){$('transfer-status').textContent=e.message;}};
 $('transfer-export').onclick=()=>{if(!bundle)return;try{const blob=new Blob([serializeHeatColumnTransfer(bundle)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='experimental-earth-heat-transfer.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){invalidate(e.message);}};
 $('transfer-import').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;for(const key of Object.keys(versions))versions[key]++;pending.clear();pending.add('bundle');original=null;exposure=null;readingFile=null;summaries();invalidate('Reading replacement transfer; prior sources retired…');updateRun();const request=versions.bundle;try{const source=parseHeatColumnTransfer(await textFile(file,MAX_TRANSFER_FILE_BYTES));if(request!==versions.bundle)return;const result=compareHeatColumnTransfer(source);original=source.originalProject;exposure=source.challengeProject;readingFile=source.readingFile;$('transfer-association').value=source.associationSource;bundle=source;summaries();draw(result,source);}catch(e){if(request===versions.bundle)$('transfer-status').textContent=e.message+'; prior transfer sources remain retired.';}finally{finish('bundle',request);event.target.value='';}};
 updateRun();
 mountJointHeatTransfer(panel,{getTransfer:()=>bundle});
 // Every comparison uses explicit frozen inputs; workspace changes do not retarget them.
 return {};
}

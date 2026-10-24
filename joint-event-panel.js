import {validateProject} from './core.js';
import {readingIdentity} from './joint-evidence-contract.js';
import {prepareJointEventChallenge,reopenJointEventChallenge,JOINT_EVENT_SCHEMA} from './joint-event-challenge.js';
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
const fmt=n=>n===null?'unscored':Number(n).toLocaleString('en-US',{maximumSignificantDigits:7});
export function mountJointEventChallenge({getProject,notice}){
 const panel=node('section');panel.id='joint-event-panel';panel.className='panel study';
 panel.innerHTML=`<div class="section-heading"><div><span class="eyebrow">KEEP THE HYPOTHESIS / CHANGE THE EVENT</span><h2>Will these explanations survive another storm?</h2></div></div>
 <p class="muted">Carry the current joint soil/outlet pairs to another declared event on the same site. Second-event evidence can contradict them; it never changes the pair values or first-event calibration.</p>
 <p id="jce-current" class="mini-note"></p><label class="input-label">Open the second event's ordinary project<input id="jce-project" type="file" accept=".json,application/json"></label><p id="jce-source" class="mini-note">No second event loaded.</p>
 <form id="jce-form"><fieldset><legend>Associate held-aside depths from the second event</legend><div id="jce-depths"></div></fieldset>
 <label class="input-label">Source for associated depths sharing this second event and time origin<input id="jce-association" maxlength="400" placeholder="Required if selecting a depth"></label>
 <label class="input-label">Why is the second event independently held aside?<textarea id="jce-independence" maxlength="400" rows="3" required placeholder="State the event separation and how its readings were held aside"></textarea></label>
 <p class="mini-note">All assigned collection readings in the loaded event are included. Calibration-assigned second-event evidence is refused, never relabeled. Supplied geometry, grid scale, mobility and numerical step must match. Every explicit pair overrides both events' default outlet coefficients.</p>
 <button id="jce-compare" class="primary" type="submit" disabled>Compare the unchanged pairs</button></form>
 <p id="jce-status" role="status" aria-live="polite"></p><div id="jce-results"></div>
 <div class="jce-files"><button id="jce-save" type="button" disabled>Download both events and evidence</button><label class="input-label">Reopen a saved joint event challenge<input id="jce-reopen" type="file" accept=".json,application/json"></label></div>
 <p class="mini-note">Opening a saved challenge inspects its retained snapshots without replacing the active workspace. Identity and independence are declarations, not verified acquisition. Matching a finite set of readings does not establish unique physical parameters or predictive accuracy.</p>`;
 document.querySelector('#joint-evidence-panel').after(panel);const find=id=>panel.querySelector('#'+id);
 let second=null,accepted=null,serial=0,revision=0;
 const status=(state,text)=>{find('jce-status').dataset.state=state;find('jce-status').textContent=text;};
 function retire(message){accepted=null;find('jce-results').replaceChildren();find('jce-save').disabled=true;status('edited',message);}
 function sources(){const first=getProject();find('jce-current').textContent=first.jointEvidenceStudy?`Current first event: ${first.outletEvidence?.eventRef??'collection unavailable'} · ${first.jointEvidenceStudy.pairs.length} fixed pairs.`:'Save a joint pair set in the current event above before transferring it.';find('jce-compare').disabled=!(first.jointEvidenceStudy&&second);}
 function renderSecond(study){
  const box=find('jce-depths');box.replaceChildren();
  if(!second){find('jce-source').textContent='No second event loaded.';return;}
  find('jce-source').textContent=`Loaded second event: ${second.outletEvidence.eventRef} · ${second.outletEvidence.collectionSource}`;
  for(const [index,r]of second.observations.entries())if(r.scenario===second.outletEvidence.target&&r.use==='challenge'){
   const label=node('label'),check=node('input');label.className='joint-choice';check.type='checkbox';check.value=index;check.checked=!!study?.depthReferences.some(ref=>ref.index===index&&ref.readingJson===readingIdentity(r));label.append(check,node('span',`Cell ${r.cellIndex+1}, ${r.minute} min · ${fmt(r.depthMm)} ± ${fmt(r.uncertaintyMm)} mm · ${r.source}`));box.append(label);
  }
  if(!box.children.length)box.append(node('p','No held-aside depths for this scenario. A held-aside collection alone can challenge the pair set.'));
 }
 function render(bundle,report,prefix){
  accepted=bundle;const out=find('jce-results');out.replaceChildren();find('jce-save').disabled=!report.candidates.length;
  const messages={'one-survivor':'One declared pair meets both events’ assigned bands. Untested explanations may still exist.',ambiguous:'Several declared pairs remain compatible with both events.',challenged:'The held-aside evidence contradicts every calibration-compatible pair.','calibration-rejected':'No declared pair satisfies the first event’s calibration evidence.','work-limit':'The combined two-event comparison exceeds the work limit; no pair was simulated.'};
  status(report.status,prefix+' '+messages[report.status]);
  out.append(node('p',`${report.calibrationReference} → ${report.challengeReference}. Independence declaration: ${report.independence}`));
  if(!report.candidates.length)return;
  out.append(node('p',`First calibration-compatible pairs: ${report.compatiblePairs.join(', ')||'none'}. Compatible with both events and first-event holdout: ${report.survivingPairs.join(', ')||'none'}.`));
  const wrap=node('div');wrap.className='joint-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Two-event evidence table; scroll horizontally if needed');const table=node('table'),head=node('tr');
  for(const label of ['Fixed pair','First calibration','First held aside','Second held aside'])head.append(node('th',label));const thead=node('thead');thead.append(head);table.append(thead);const body=node('tbody');
  const score=group=>['depth','volume'].map(kind=>{const g=group[kind];return g.count?`${g.errors.filter(e=>e.withinBand).length}/${g.count} ${kind} bands; RMSE ${fmt(g.rmse)} ${g.unit}`:`${kind}: unscored`;}).join('; ');
  for(const c of report.candidates){const row=node('tr');row.dataset.jointEventPair=c.label;row.append(node('th',`${c.label}: ${fmt(c.infiltrationMmHr)} mm/h + ${fmt(c.outletPerHour)}/h`),node('td',score(c.calibration)),node('td',score(c.challenge)),node('td',score(c.secondEvent)));body.append(row);}
  table.append(body);wrap.append(table);out.append(wrap);
  for(const c of report.candidates){const details=node('details');details.className='joint-residuals';details.append(node('summary',c.label+' · every original reading and prediction'));
   for(const [label,group,p]of [['First calibration',c.calibration,bundle.calibrationProject],['First held aside',c.challenge,bundle.calibrationProject],['Second held aside',c.secondEvent,bundle.challengeProject]])for(const kind of ['depth','volume'])for(const e of group[kind].errors){
    const r=kind==='depth'?p.observations[e.index]:p.outletEvidence.readings[e.index],where=kind==='depth'?`cell ${r.cellIndex+1}, minute ${r.minute}`:`minutes ${r.startMinute}–${r.endMinute}; supplied ${fmt(r.volume)} ± ${fmt(r.uncertainty)} ${r.unit}`;
    const brackets=kind==='depth'?`${e.beforeMinute}–${e.afterMinute} min`:`start ${e.start.beforeMinute}–${e.start.afterMinute}, end ${e.end.beforeMinute}–${e.end.afterMinute} min`;
    details.append(node('p',`${label} · ${where}. Predicted ${fmt(e.predicted)} ${group[kind].unit}; signed observed-minus-predicted ${fmt(e.residual)}; ± band ${fmt(e.tolerance)}. ${e.withinBand?'Within':'Outside'} band. Source: ${r.source}. Interpolation: ${brackets}.`));
   }out.append(details);
  }
 }
 function refresh(){revision++;serial++;retire('Workspace changed; compare again to use the current first-event snapshot.');sources();}
 find('jce-form').addEventListener('input',()=>{revision++;retire('Association or independence draft changed. Compare again before exporting.');});
 find('jce-form').addEventListener('submit',event=>{event.preventDefault();try{
  const {bundle,report}=prepareJointEventChallenge(getProject(),second,{depthIndices:[...find('jce-depths').querySelectorAll('input:checked')].map(e=>Number(e.value)),depthAssociation:find('jce-association').value,independence:find('jce-independence').value});
  revision++;serial++;render(bundle,report,'Current workspace compared.');
 }catch(e){status('error',e.message);notice(e.message);}});
 async function loadFile(input,kind){const file=input.files[0];if(!file)return;const token=++serial,version=revision,first=readingIdentity(getProject());try{
  if(file.size<1||file.size>(kind==='project'?1000000:4*1024*1024))throw Error(kind==='project'?'Choose a project up to 1 MB.':'Choose a joint challenge up to 4 MiB.');
  const raw=JSON.parse(await file.text());if(token!==serial||version!==revision||first!==readingIdentity(getProject()))return;
  if(kind==='project'){validateProject(raw);if(!raw.outletEvidence)throw Error('The second project needs a sourced collection event.');second=structuredClone(raw);revision++;retire('Second event loaded. Associate its depths and declare independence before comparing.');find('jce-association').value='';find('jce-independence').value='';renderSecond();sources();}
  else{const report=reopenJointEventChallenge(raw),bundle=structuredClone({schema:JOINT_EVENT_SCHEMA,calibrationProject:raw.calibrationProject,challengeProject:raw.challengeProject,challengeStudy:raw.challengeStudy,independence:raw.independence});second=bundle.challengeProject;revision++;find('jce-association').value=bundle.challengeStudy.depthAssociation;find('jce-independence').value=bundle.independence;renderSecond(bundle.challengeStudy);sources();render(bundle,report,'Saved snapshots reopened; active workspace unchanged.');}
 }catch(e){if(token===serial&&version===revision){status('error','Open refused; previous accepted work retained. '+e.message);notice(e.message);}}}
 find('jce-project').addEventListener('change',()=>loadFile(find('jce-project'),'project'));find('jce-reopen').addEventListener('change',()=>loadFile(find('jce-reopen'),'bundle'));
 find('jce-save').addEventListener('click',()=>{try{if(!accepted)throw Error('Compare the current drafts before exporting.');const blob=new Blob([JSON.stringify(accepted,null,2)],{type:'application/json'});if(blob.size>4*1024*1024)throw Error('Combined snapshots exceed the 4 MiB export limit.');const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='experimental-earth-joint-events.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice(e.message);}});
 renderSecond();sources();status('unconfigured','Open a second observed event to challenge the fixed pair set.');return {refresh};
}

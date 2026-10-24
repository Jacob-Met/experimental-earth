import { SURFACES, validateProject } from './core.js';
import { prepareJointStudy, compareJointEvidence } from './joint-evidence.js';
import { readingIdentity } from './joint-evidence-contract.js';
import { drawJointEvidencePlane } from './joint-evidence-plot.js';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=n=>n===null?'unscored':Number(n).toLocaleString('en-US',{maximumSignificantDigits:6});

export function mountJointEvidence({getProject,replaceProject,notice}) {
  const panel=node('section');panel.id='joint-evidence-panel';panel.className='panel study';
  panel.innerHTML=`<div class="section-heading"><div><span class="eyebrow">TWO ASSUMPTIONS / ONE EVENT</span><h2>Could different soil and outlet conditions explain the same water?</h2></div></div>
  <p class="muted">A single collected volume can fit different explanations. Compare explicit soil/outlet pairs against the retained collection and selected ponding readings from the same event.</p>
  <p id="joint-event" class="mini-note"></p>
  <details id="joint-setup" open><summary>Define pairs and associate depth evidence</summary><form id="joint-form">
    <label class="input-label">Surface whose infiltration varies<select id="joint-surface"><option value="sealed">Sealed paving</option><option value="turf">Turf</option><option value="garden">Rain garden</option></select></label>
    <label class="input-label">One pair per line: infiltration (mm/h), outlet coefficient (per hour)<textarea id="joint-pairs" rows="4" maxlength="1500" placeholder="1, 0.1&#10;21, 0.13333333333333333" required></textarea></label>
    <p class="mini-note">Declare 2–12 distinct pairs. The chosen infiltration applies to every cell of that surface in the observed scenario; other surfaces retain their current assumptions.</p>
    <fieldset><legend>Depth readings explicitly associated with this collection event</legend><div id="joint-depth-choices"></div></fieldset>
    <label class="input-label">Source for the shared event, scenario and time origin<input id="joint-association" maxlength="400" placeholder="Required when associating depths; explain the common event record"></label>
    <button id="joint-save" type="submit">Save pairs and evidence association</button>
  </form></details>
  <button id="joint-compare" type="button" class="primary" disabled>Compare saved joint explanations</button>
  <p id="joint-status" role="status" aria-live="polite"></p><p id="joint-support"></p>
  <div id="joint-axis-controls" class="input-pair" hidden><label class="input-label">Collection shown horizontally<select id="joint-volume-axis"></select></label><label class="input-label">Depth shown vertically<select id="joint-depth-axis"></select></label></div>
  <div id="joint-plane"></div><div id="joint-results"></div>
  <p class="mini-note">Each reading keeps its own stated ± acceptance band and units. Pairs stay in declared order; depth and volume errors are never added into one score. Held-aside evidence can contradict a fit but cannot choose or rank the pairs. Event association and independence are supplied declarations. Changing pairs after inspecting held-aside results makes those results part of fitting. Passing finite hypotheses does not establish unique physical parameters or environmental accuracy.</p>`;
  document.querySelector('#outlet-evidence-panel').after(panel);
  const find=id=>panel.querySelector('#'+id);
  let plotted=null;
  function status(state,text){find('joint-status').dataset.state=state;find('joint-status').textContent=text;}
  function invalidate(){plotted=null;find('joint-results').replaceChildren();find('joint-plane').replaceChildren();find('joint-support').textContent='';find('joint-axis-controls').hidden=true;}
  function refresh(){
    invalidate();
    const p=getProject(),record=p.outletEvidence,study=p.jointEvidenceStudy;
    find('joint-save').disabled=!record;find('joint-compare').disabled=!study;
    find('joint-event').textContent=record?`${record.eventRef} · ${record.target} site · ${record.collectionSource}. The original collection record stays intact.`:'Retain a sourced collection above to begin a joint comparison.';
    find('joint-surface').value=study?.surface??'sealed';
    find('joint-pairs').value=study?study.pairs.map(pair=>`${pair.infiltrationMmHr}, ${pair.outletPerHour}`).join('\n'):'';
    find('joint-association').value=study?.depthAssociation??'';
    const choices=find('joint-depth-choices');choices.replaceChildren();
    const eligible=p.observations.map((reading,index)=>({reading,index})).filter(({reading})=>record&&reading.scenario===record.target&&['calibration','challenge'].includes(reading.use));
    if(!eligible.length)choices.append(node('p','No assigned depth readings for this observed scenario. A volume-only comparison is available; assign sourced depths in the notebook to associate them here.'));
    for(const {reading,index}of eligible){
      const label=node('label'),check=node('input');label.className='joint-choice';check.type='checkbox';check.value=index;
      check.checked=!!study?.depthReferences.some(ref=>ref.index===index&&ref.readingJson===readingIdentity(reading));
      const cell=`${String.fromCharCode(65+reading.cellIndex%p.width)}${Math.floor(reading.cellIndex/p.width)+1}`;
      label.append(check,node('span',`${cell}, ${reading.minute} min · ${fmt(reading.depthMm)} ± ${fmt(reading.uncertaintyMm)} mm · ${reading.use} · ${reading.source}`));choices.append(label);
    }
    status(study?'saved':'unconfigured',study?'Saved pairs and association are retained. Compare to recompute all evidence.':'Define explicit pairs and save the evidence association.');
  }
  find('joint-form').addEventListener('input',()=>{invalidate();find('joint-compare').disabled=true;status('edited','Inputs changed. Save these pairs and evidence association before comparing.');});
  find('joint-form').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const pairs=find('joint-pairs').value.trim().split(/\r?\n/).map((line,index)=>{
        const values=line.split(',').map(s=>s.trim());
        if(values.length!==2||values.some(v=>v===''))throw Error('Use exactly two comma-separated values on each pair line.');
        return {label:`Pair ${index+1}`,infiltrationMmHr:Number(values[0]),outletPerHour:Number(values[1])};
      });
      const p=getProject(),depthIndices=[...find('joint-depth-choices').querySelectorAll('input:checked')].map(e=>Number(e.value));
      const study=prepareJointStudy(p,{surface:find('joint-surface').value,pairs,depthIndices,depthAssociation:find('joint-association').value});
      const next=structuredClone(p);next.jointEvidenceStudy=study;validateProject(next);replaceProject(next);
      status('saved','Pairs and explicit evidence association saved. Compare to recompute their support.');
    }catch(error){invalidate();status('error',error.message);notice(error.message);}
  });
  function drawPlane(){if(plotted)drawJointEvidencePlane(find('joint-plane'),plotted.report,plotted.project,Number(find('joint-volume-axis').value),Number(find('joint-depth-axis').value));}
  for(const id of ['joint-volume-axis','joint-depth-axis'])find(id).addEventListener('change',drawPlane);
  find('joint-compare').addEventListener('click',()=>{
    try{
      invalidate();const p=getProject(),report=compareJointEvidence(p);
      const messages={
        'context-changed':'The saved association belongs to a different event, site or collection. No pairs were scored.',
        'depth-evidence-changed':'A selected notebook reading changed or moved. Review its source and save an explicit new association before comparing.',
        'surface-absent':'The chosen surface is absent from the observed scenario. No infiltration alternatives were scored.',
        'work-limit':'This pair set exceeds the interactive work limit. Use fewer pairs or a smaller model before comparing.',
        'need-calibration':'No calibration evidence is assigned. Held-aside results are visible, but no pair is calibration-compatible.',
        'calibration-rejected':'Every pair misses at least one calibration band. A closer error in one quantity cannot cancel a contradiction in another.',
        'challenged':'Held-aside readings contradict every calibration-compatible pair.',
        'needs-challenge':'Calibration-compatible pairs remain. No held-aside evidence has challenged them.',
        'one-survivor':'One declared pair meets every assigned band. Other untested explanations may still exist.',
        'ambiguous':'Several declared pairs meet every assigned band. The evidence has not distinguished them.'};
      status(report.status,messages[report.status]);
      if(!report.candidates.length)return;
      const c=report.counts;
      find('joint-support').textContent=`Calibration: ${c.calibrationDepth} depths / ${c.calibrationVolume} collections. Held aside: ${c.challengeDepth} depths / ${c.challengeVolume} collections. Not used: ${c.ignoredDepth} notebook depths / ${c.ignoredVolume} notebook-only collections. Within every calibration band: ${report.compatiblePairs.join(', ')||'none'}. Also within available held-aside bands: ${report.survivingPairs.join(', ')||'none'}. ${c.affectedCells} ${SURFACES[p.jointEvidenceStudy.surface].label.toLowerCase()} cells vary; model step ${report.stepMinutes} min.`;
      const wrap=node('div');wrap.className='joint-table-wrap';wrap.tabIndex=0;wrap.setAttribute('aria-label','Joint explanation evidence table; scroll horizontally if needed');
      const table=node('table'),thead=node('thead'),head=node('tr');
      for(const title of ['Pair / assumptions','Calibration depth · mm','Calibration volume · L','Held-aside depth · mm','Held-aside volume · L'])head.append(node('th',title));
      thead.append(head);table.append(thead);const body=node('tbody');
      const score=group=>group.count?`${group.errors.filter(e=>e.withinBand).length}/${group.count} bands; RMSE ${fmt(group.rmse)} ${group.unit}`:'No assigned readings';
      for(const [index,candidate]of report.candidates.entries()){
        const row=node('tr');row.dataset.pairLabel=candidate.label;
        row.append(node('th',`${index+1}. ${candidate.label}: ${fmt(candidate.infiltrationMmHr)} mm/h + ${fmt(candidate.outletPerHour)}/h`));
        for(const role of ['calibration','challenge'])for(const kind of ['depth','volume'])row.append(node('td',score(candidate[role][kind])));
        body.append(row);
      }
      table.append(body);wrap.append(table);find('joint-results').append(wrap);
      for(const candidate of report.candidates){
        const details=node('details');details.className='joint-residuals';details.append(node('summary',`${candidate.label} · inspect every reading and interpolation bracket`));
        for(const role of ['calibration','challenge'])for(const kind of ['depth','volume'])for(const error of candidate[role][kind].errors){
          const reading=kind==='depth'?p.observations[error.index]:p.outletEvidence.readings[error.index];
          const location=kind==='depth'?`Cell ${reading.cellIndex+1}, minute ${reading.minute}`:`Collection ${reading.startMinute}–${reading.endMinute} min; supplied ${fmt(reading.volume)} ± ${fmt(reading.uncertainty)} ${reading.unit}`;
          const bracket=kind==='depth'?`${error.beforeMinute}–${error.afterMinute} min (${error.method})`:`start ${error.start.beforeMinute}–${error.start.afterMinute}, end ${error.end.beforeMinute}–${error.end.afterMinute} min`;
          const unit=kind==='depth'?'mm':'L';
          details.append(node('p',`${role==='challenge'?'Held aside':'Calibration'} · ${location} · ${reading.source}. Observed ${fmt(error.observed)} ± ${fmt(error.tolerance)} ${unit}; modeled ${fmt(error.predicted)} ${unit}; observed minus modeled ${fmt(error.residual)} ${unit} (${error.withinBand?'within':'outside'} band). Retained-step brackets: ${bracket}.`));
        }
        find('joint-results').append(details);
      }
      plotted={report,project:structuredClone(p)};
      const first=report.candidates[0];
      for(const [kind,id]of [['volume','joint-volume-axis'],['depth','joint-depth-axis']]){
        const select=find(id);select.replaceChildren();
        for(const error of [...first.calibration[kind].errors,...first.challenge[kind].errors]){
          const reading=kind==='volume'?p.outletEvidence.readings[error.index]:p.observations[error.index];
          const option=node('option',kind==='volume'?`${reading.startMinute}–${reading.endMinute} min · ${reading.use}`:`Cell ${reading.cellIndex+1}, ${reading.minute} min · ${reading.use}`);
          option.value=error.index;select.append(option);
        }
      }
      if(find('joint-volume-axis').options.length&&find('joint-depth-axis').options.length){find('joint-axis-controls').hidden=false;drawPlane();}
      else find('joint-plane').append(node('p','A depth/volume prediction plane is available when both observation kinds are explicitly assigned. Missing observations are not zero-valued constraints.'));
    }catch(error){invalidate();status('error',error.message);notice(error.message);}
  });
  return {refresh};
}

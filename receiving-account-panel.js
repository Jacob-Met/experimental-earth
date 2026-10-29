import {inspectReceivingAccounts,serializeReceivingAccounts,parseReceivingAccounts,makeReceivingAccountExample} from './receiving-account-evidence.js';
import {validateProject} from './core.js';
import {validateDrainingHypotheses} from './draining-layer-evidence.js';
import {mountReceivingAccountProposals} from './receiving-account-proposals-panel.js';

const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const fmt=n=>n.toLocaleString('en-US',{maximumSignificantDigits:8});
const channelName={retained:'Water retained below ground',drained:'Cumulative drainage from the receivers'};
const messages={
  'surface-absent':'The selected surface is absent. No receiver account supports an explanation.',
  'need-calibration':'No original calibration readings are assigned. No explanation is supported.',
  'calibration-rejected':'Every offered explanation contradicts an original calibration band. No fallback is selected.',
  'needs-challenge':'Calibration-compatible explanations remain; no original held-aside reading challenges them yet.',
  'challenged':'Every calibration-compatible explanation contradicts a held-aside reading.',
  'one-survivor':'One offered explanation is compatible with both reading roles. Untested explanations may also fit.',
  'ambiguous':'Several offered explanations remain compatible with both reading roles.',
};
const questionMessages={
  'no-supported-pair':'Fewer than two calibration-compatible explanations remain. No new measurement is selected.',
  'no-offers':'No receiving measurements have been explicitly offered.',
  'all-recorded':'Every offered channel and time already has an original receiving reading.',
  'no-separating-offer':'None of the unrecorded offers separates a supported pair at its declared precision.',
};

/** A separate original source is copied explicitly; parent edits cannot retarget
 * retained measurements to another footprint or replace the working project. */
export function mountReceivingAccounts({host,getSource}){
  const panel=node('section');panel.id='receiving-accounts';
  panel.innerHTML='<h3>Can water below ground distinguish these explanations?</h3>'+
    '<p>Compare total retained water or cumulative drainage across the selected receiving footprint. A point soil probe and water collected at the surface boundary measure different quantities.</p>'+
    '<div class="dl-actions"><button id="ra-current" type="button">Start a new account from these explanations</button><button id="ra-example" type="button" class="subtle">Try the authored equal-surface example</button></div>'+
    '<div id="ra-source"></div><form id="ra-form" novalidate>'+
    '<label class="input-label">Basis for associating these measurements with the whole receiving footprint<textarea id="ra-basis" rows="2" maxlength="600"></textarea></label>'+
    '<h4>Original receiving measurements</h4><p class="mini-note">Retain the original value, uncertainty, source and role. Calibration readings constrain support. Held-aside values only challenge it.</p><div id="ra-readings"></div><button id="ra-add-reading" type="button" class="subtle" disabled>Add an original receiving reading</button>'+
    '<h4>Measurements explicitly available to ask for</h4><p class="mini-note">Offer a channel, original-event time and uncertainty with an availability basis. An offer has no observed value. This does not acquire a measurement.</p><div id="ra-offers"></div><button id="ra-add-offer" type="button" class="subtle" disabled>Add a measurement offer</button>'+
    '<div class="dl-actions"><button id="ra-run" type="submit" class="primary" disabled>Compare accounts and offered questions</button></div></form>'+
    '<p id="ra-status" role="status" aria-live="polite">Start from the offered receiving explanations, try the example, or reopen original inputs.</p><div id="ra-results"></div>'+
    '<div class="dl-actions"><button id="ra-save" type="button" disabled>Save original receiving account</button><label class="input-label">Reopen a separate original account<input id="ra-open" type="file" accept=".json,application/json"></label></div>'+
    '<p class="mini-note">The copied site, storm, footprint and offered parameters stay fixed. Editing the investigation above does not change this separate source. Receiver totals use exact retained solver endpoints; they are not interpolated. Numerical rounding guards are not measurement uncertainty or certified error bounds. Nothing is automatically adopted.</p>';
  host.append(panel);const $=id=>panel.querySelector('#ra-'+id);
  let source=null,accepted=null,generation=0,nextId=1;
  const status=(message,state)=>{$('status').textContent=message;$('status').dataset.state=state;};
  function retire(message='Original account inputs changed. Compare again.'){
    generation++;accepted=null;$('results').replaceChildren();$('save').disabled=true;
    $('run').disabled=!source;status(message,'draft');
  }
  function input(row,field,label,type,value,options){
    const wrapper=node('label',label);wrapper.className='input-label';const e=node(type==='select'?'select':type==='textarea'?'textarea':'input');
    e.dataset.field=field;
    if(type==='select')for(const [id,text]of options){const o=node('option',text);o.value=id;e.append(o);}
    else if(type==='textarea'){e.rows=2;e.maxLength=600;}
    else{e.type=type;e.min='0';e.max=field==='minute'?String(source.project.weather.durationMinutes):'1000000000000';e.step='any';}
    e.value=value??'';wrapper.append(e);row.append(wrapper);return e;
  }
  function addRow(kind,value){
    const list=$(kind==='reading'?'readings':'offers');
    if(list.children.length>=128){status('Retain at most 128 original readings and 128 offered measurements.','refused');return;}
    let id=value?.id;
    if(!id)do{id=kind+'-'+nextId++;}while([...list.children].some(e=>e.dataset.id===id));
    const row=node('fieldset');row.dataset.id=id;row.append(node('legend',id));const fields=node('div');fields.className='input-pair';
    input(fields,'channel','Receiving quantity','select',value?.channel??'retained',Object.entries(channelName));
    input(fields,'minute','Original-event minute','number',value?.minute);
    if(kind==='reading')input(fields,'valueLiters','Original total · L','number',value?.valueLiters);
    input(fields,'uncertaintyLiters','Declared uncertainty ± L','number',value?.uncertaintyLiters);
    if(kind==='reading')input(fields,'use','Original evidence role','select',value?.use??'challenge',[['calibration','Calibration'],['challenge','Held aside']]);
    row.append(fields);input(row,kind==='reading'?'source':'basis',kind==='reading'?'Original measurement source':'Availability and measurement basis','textarea',value?.[kind==='reading'?'source':'basis']);
    const remove=node('button',kind==='reading'?'Remove this reading':'Remove this offer');remove.type='button';remove.className='subtle';remove.onclick=()=>{row.remove();retire();};row.append(remove);list.append(row);
  }
  function fill(project,study,account){
    source={project:structuredClone(project),study:structuredClone(study)};
    $('basis').value=account.footprintBasis;$('readings').replaceChildren();$('offers').replaceChildren();
    for(const row of account.readings)addRow('reading',row);for(const row of account.offers)addRow('offer',row);
    $('add-reading').disabled=false;$('add-offer').disabled=false;
    const cells=project[study.target].flatMap((c,i)=>c.surface===study.surface?[i]:[]),place=$('source');place.replaceChildren();
    place.append(node('p','Separate original source: '+project.title+' · '+study.target+' · '+study.surface+' · '+cells.length+' cells / '+fmt(cells.length*project.weather.cellSizeM**2)+' m².'));
    const details=node('details');details.append(node('summary','Inspect the copied footprint and '+study.hypotheses.length+' explanations'));
    details.append(node('p','Original cell indices: '+(cells.join(', ')||'none')+'. Event duration '+fmt(project.weather.durationMinutes)+' min; retained step '+fmt(project.weather.stepMinutes)+' min.'));
    for(const h of study.hypotheses)details.append(node('p',h.id+' · '+h.label+': '+fmt(h.capacityMm)+' mm storage, '+fmt(h.initialStoredMm)+' mm initial water, '+fmt(h.drainagePerHour)+' /hour drainage. '+h.source));
    place.append(details);
  }
  function readAccount(){
    if(!source)throw Error('Copy a receiving source or reopen original inputs first.');
    const rows=kind=>[...$(kind==='reading'?'readings':'offers').children].map(row=>{
      const value={id:row.dataset.id};
      for(const e of row.querySelectorAll('[data-field]')){
        if(!e.value.trim())throw Error('Complete every original value, offered time, uncertainty and source basis. Blank numbers are not zero.');
        value[e.dataset.field]=e.tagName==='INPUT'?Number(e.value):e.value;
      }return value;
    });
    return {footprintBasis:$('basis').value,readings:rows('reading'),offers:rows('offer')};
  }
  const verdict=v=>v===null?'no assigned original readings':v?'compatible with every original band':'contradicted by an original band';
  function render(report){
    const results=$('results');results.replaceChildren();
    results.append(node('p','Calibration-compatible: '+(report.compatibleIds.join(', ')||'none')+'. Compatible with both original roles: '+(report.survivingIds.join(', ')||'none')+'.'));
    results.append(node('p','Receiving footprint: '+fmt(report.footprint.areaM2)+' m² across '+report.footprint.cellIndices.length+' selected cells. '+report.footprint.basis));
    for(const candidate of report.candidates){
      const card=node('article');card.className='de-candidate';card.dataset.hypothesis=candidate.hypothesis.id;
      card.dataset.calibration=String(candidate.calibration.compatible);card.dataset.challenge=String(candidate.challenge.compatible);
      card.append(node('h4',candidate.hypothesis.label),node('p','All original calibration readings: '+verdict(candidate.calibration.compatible)+'. All held-aside readings: '+verdict(candidate.challenge.compatible)+'.'));
      const readings=node('details');readings.append(node('summary','Inspect every original surface and receiver reading'));
      for(const role of ['surfaceCalibration','surfaceChallenge'])for(const e of candidate[role].errors){
        const original=report.project.observations[e.index];readings.append(node('p','Surface row '+(e.index+1)+' · '+original.use+' · cell '+original.cellIndex+' · minute '+fmt(original.minute)+': original '+fmt(original.depthMm)+' ± '+fmt(original.uncertaintyMm)+' mm; modeled '+fmt(e.depthMm)+' mm. '+(e.withinBand?'Within band. ':'Outside band. ')+original.source));
      }
      for(const r of candidate.accountReadings){
        const p=node('p',r.id+' · '+r.use+' · '+channelName[r.channel]+' · minute '+fmt(r.minute)+': original '+fmt(r.valueLiters)+' ± '+fmt(r.uncertaintyLiters)+' L; modeled '+fmt(r.modeledLiters)+' L. '+(r.withinBand?'Within band. ':'Outside band. ')+r.source+' Numerical guard '+r.numericalGuardLiters+' L.');
        p.dataset.reading=r.id;p.dataset.prediction=String(r.modeledLiters);readings.append(p);
      }
      card.append(readings);results.append(card);
    }
    const question=node('section');question.id='ra-question';question.dataset.state=report.question.status;
    question.append(node('h4','A question for the calibration-compatible explanations'));
    if(report.surfaceOnlyQuestion){
      const s=report.surfaceOnlyQuestion;question.append(node('p','Surface-depth comparison at ±'+fmt(s.halfWidthMm)+' mm: '+(s.status==='no-separation'?'no separating unrecorded surface point on the maintained modeled grid.':s.status==='question'?'a separating surface question is also available.':s.status==='unsupported'?'the complete surface question is unsupported: '+s.reason+'.':'fewer than two supported explanations.')));
    }
    const q=report.question;
    if(q.best){const p=node('p','Selected offer: '+channelName[q.best.channel]+' at minute '+fmt(q.best.minute)+' with ±'+fmt(q.best.uncertaintyLiters)+' L. Separates '+q.best.separatedCount+' of '+q.best.pairs.length+' supported pairs.');p.dataset.best=q.best.id;question.append(p);}
    else question.append(node('p',questionMessages[q.status]??'No receiving question is selected.'));
    question.append(node('p','Only original calibration support ranks these offers; held-aside values never choose the question. Ties keep the original offer order. An offered original-event time may already be in the past.'));
    if(q.offers.length){
      const label=node('label','Inspect every offered measurement');label.className='input-label';const select=node('select');select.id='ra-inspect';
      for(const o of q.offers){const option=node('option',o.id+' · '+o.channel+' · '+fmt(o.minute)+' min · '+o.separatedCount+'/'+o.pairs.length+' pairs · '+o.status);option.value=o.id;select.append(option);}
      select.value=q.best?.id??q.offers[0].id;label.append(select);question.append(label);const detail=node('div');detail.id='ra-offer-detail';question.append(detail);
      const show=()=>{const o=q.offers.find(x=>x.id===select.value);detail.replaceChildren(node('p',channelName[o.channel]+' · minute '+fmt(o.minute)+' · ±'+fmt(o.uncertaintyLiters)+' L. '+o.basis));
        for(const p of o.predictions){const line=node('p',p.id+': modeled '+fmt(p.modeledLiters)+' L; hypothetical interval '+fmt(p.modeledLiters-o.uncertaintyLiters)+' to '+fmt(p.modeledLiters+o.uncertaintyLiters)+' L.');line.dataset.prediction=p.id;detail.append(line);}
        const pairs=node('details');pairs.append(node('summary','Inspect all '+o.pairs.length+' pairs and numerical guards'));
        for(const p of o.pairs)pairs.append(node('p',p.ids.join(' / ')+': '+(p.separated?'separated':'unresolved')+'; gap '+fmt(p.gapLiters)+' L, combined numerical guard '+p.numericalGuardLiters+' L.'));
        detail.append(pairs);};select.onchange=show;show();
    }
    results.append(question);
  }
  function install(project,study,account,report){accepted={project,study,account};render(report);$('save').disabled=false;status(messages[report.status],report.status);}
  $('form').addEventListener('input',()=>retire());$('form').addEventListener('change',()=>retire());
  $('add-reading').onclick=()=>{addRow('reading');retire();};$('add-offer').onclick=()=>{addRow('offer');retire();};
  $('current').onclick=()=>{
    retire();try{const input=getSource();validateProject(input.project);validateDrainingHypotheses(input.study);fill(input.project,input.study,{footprintBasis:'',readings:[],offers:[]});retire('A separate original source was copied. Declare the measurement footprint and add original readings or available offers.');}
    catch(error){status(error.message,'refused');}
  };
  $('example').onclick=()=>{retire();const input=makeReceivingAccountExample();fill(input.project,input.study,input.account);retire('Authored control loaded: equal surface courses with different receiving accounts. Compare to inspect the offers. These are not field observations.');};
  $('form').onsubmit=event=>{
    event.preventDefault();retire();const token=generation;let project,study,account;
    try{account=readAccount();({project,study}=structuredClone(source));}catch(error){status(error.message,'refused');return;}
    $('run').disabled=true;status('Comparing every original band and every offered receiving measurement…','pending');
    setTimeout(()=>{if(token!==generation)return;try{install(project,study,account,inspectReceivingAccounts(project,study,account));}catch(error){status(error.message,'refused');}finally{if(token===generation)$('run').disabled=false;}},10);
  };
  $('save').onclick=()=>{
    if(!accepted)return;try{const text=serializeReceivingAccounts(accepted.project,accepted.study,accepted.account),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');
      a.href=url;a.download='experimental-earth-receiving-account.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){status(error.message,'refused');}
  };
  $('open').onchange=async()=>{
    const file=$('open').files?.[0];if(!file)return;$('open').value='';retire();const token=generation;$('run').disabled=true;status('Reading original receiving inputs…','opening');
    try{if(file.size>2*1024*1024)throw Error('Choose original receiving-account JSON under 2 MiB.');const bytes=await file.arrayBuffer();if(token!==generation)return;
      const input=parseReceivingAccounts(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),report=inspectReceivingAccounts(input.project,input.study,input.account);if(token!==generation)return;
      fill(input.project,input.study,input.account);install(input.project,input.study,input.account,report);status('Recomputed from original inputs. '+messages[report.status],report.status);
    }catch(error){if(token===generation)status(error.message,'refused');}finally{if(token===generation)$('run').disabled=!source;}
  };
  mountReceivingAccountProposals({host:panel,getSource:()=>{
    if(!source)throw Error('Copy or reopen an original receiving account above first.');
    const {project,study}=structuredClone(source);
    return {project,selection:{target:study.target,surface:study.surface,uniformReceiverBasis:''},account:readAccount()};
  }});
  return {element:panel};
}

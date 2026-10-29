import {compareReceivingAccountConsequences,serializeReceivingAccountConsequences,parseReceivingAccountConsequences} from './receiving-account-consequences.js';
import {makeNoisyReceivingAccountBandExample} from './receiving-account-band-fit.js';

const node=(tag,text='')=>{const element=document.createElement(tag);element.textContent=text;return element;};
const clone=value=>structuredClone(value);
const fmt=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumSignificantDigits:7}):'unresolved';
const metrics=[['absorbedLiters','Water entering the ground','L'],['storedLiters','Surface water at event end','L'],['exitLiters','Surface-boundary outflow','L'],['maxDepthMm','Peak depth anywhere','mm']];
const receiverMetrics=[['initialLiters','Initial water below ground','L'],['retainedLiters','Receiver water at event end','L'],['drainedLiters','Cumulative receiver drainage','L']];
const messages={compared:'Both original layouts were compared for every generated calibration-compatible receiver.',
  'needs-challenge':'The calibration-compatible family was compared. No original held-aside reading challenges it yet.',
  challenged:'The family was compared, but every member contradicts an original held-aside band. Its predicted changes remain conditional; no supported winner is selected.',
  'no-compatible-receivers':'No generated receiver passes every original calibration band. There is no consequence range or fallback model.'};
function details(label,fill){const d=node('details');d.append(node('summary',label));let drawn=false;d.addEventListener('toggle',()=>{if(d.open&&!drawn){drawn=true;fill(d);}});return d;}
function table(host,headers,rows,label){
  const wrap=node('div');wrap.className='dl-table rac-table';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);
  const t=node('table'),head=node('tr');for(const label of headers){const th=node('th',label);th.scope='col';head.append(th);}const h=node('thead');h.append(head);t.append(h);const b=node('tbody');
  for(const values of rows){const tr=node('tr');for(const value of values)tr.append(node('td',String(value)));b.append(tr);}t.append(b);wrap.append(t);host.append(wrap);
}
function range(value,unit){return value?fmt(value.minimum)+' to '+fmt(value.maximum)+' '+unit:'No compatible models';}

/** Independent original-source consumer. Copying is explicit; later parent
 * edits cannot reattach its measurements or overwrite the copied layouts. */
export function mountReceivingAccountConsequences({host,getSource}){
  const panel=node('section');panel.id='receiving-account-consequences';
  panel.innerHTML='<h3>What do these receiver explanations mean for the proposal?</h3>'+
    '<p>Carry the inferred family into the existing and proposal layouts. Every calibration-compatible explanation is retained, including any that later readings contradict.</p>'+
    '<div class="dl-actions"><button id="rac-current" type="button">Copy these original inverse inputs</button><button id="rac-example" type="button" class="subtle">Try the inferred-bed comparison</button></div><div id="rac-source"></div>'+
    '<form id="rac-form" novalidate><label class="input-label">Receiver family<select id="rac-mode"><option value="bands">Original-band search plus retained analytic proposals</option><option value="phases">Include finite filled and never-filled alternatives</option><option value="central">Analytic proposals from original centers</option></select></label>'+
    '<label class="input-label">Why the same per-cell receiver and initial water apply in both layouts<textarea id="rac-basis" rows="3" maxlength="600"></textarea></label>'+
    '<div class="dl-actions"><button id="rac-run" type="submit" class="primary" disabled>Infer and compare the complete family</button></div></form>'+
    '<p id="rac-status" role="status" aria-live="polite">Copy original inverse inputs, try the authored comparison, or reopen original comparison inputs.</p><div id="rac-results"></div>'+
    '<div class="dl-actions"><button id="rac-save" type="button" disabled>Save original family comparison</button><label class="input-label">Reopen a separate original family comparison<input id="rac-open" type="file" accept=".json,application/json"></label></div>'+
    '<p class="mini-note">The copied site, storm and readings stay fixed. Compare only after declaring material transfer. Changing the area of this material also changes its initial below-ground water inventory. Results are generated-model predictions, not a physical approval, continuous uncertainty range or automatic change to the site.</p>';
  host.append(panel);const $=id=>panel.querySelector('#rac-'+id);
  let source=null,accepted=null,generation=0;
  const status=(message,state)=>{$('status').textContent=message;$('status').dataset.state=state;};
  function retire(message='Original comparison inputs changed. Infer and compare again.'){
    generation++;accepted=null;$('results').replaceChildren();$('save').disabled=true;$('run').disabled=!source;status(message,'draft');
  }
  function fill(input){
    source=clone({project:input.project,selection:input.selection,account:input.account});
    $('mode').value=input.options?.mode??'bands';$('basis').value=input.options?.transferBasis??'';
    const place=$('source');place.replaceChildren(node('p','Separate original source: '+source.project.title+' · evidence scenario '+source.selection.target+' · receiving material '+source.selection.surface+'.'));
    place.append(details('Inspect the copied layouts, measurements and footprint',d=>{
      d.append(node('p',source.selection.uniformReceiverBasis),node('p',source.account.footprintBasis));
      for(const side of ['existing','proposal']){const indices=source.project[side].flatMap((cell,i)=>cell.surface===source.selection.surface?[i]:[]);d.append(node('p',side+': selected cells '+(indices.join(', ')||'none')+'; '+fmt(indices.length*source.project.weather.cellSizeM**2)+' m².'));}
      d.append(node('p','The identical original storm applies to both layouts: '+fmt(source.project.weather.rainMmHr)+' mm/hour for '+fmt(source.project.weather.stormMinutes)+' minutes; event '+fmt(source.project.weather.durationMinutes)+' minutes.'));
      source.project.observations.forEach((r,i)=>d.append(node('p','Surface row '+(i+1)+' · '+r.scenario+' · '+r.use+' · cell '+r.cellIndex+' · '+fmt(r.minute)+' min: '+fmt(r.depthMm)+' ± '+fmt(r.uncertaintyMm)+' mm. '+r.source)));
      source.account.readings.forEach(r=>d.append(node('p',r.id+' · '+r.use+' · '+r.channel+' · '+fmt(r.minute)+' min: '+fmt(r.valueLiters)+' ± '+fmt(r.uncertaintyLiters)+' L. '+r.source)));
    }));
  }
  function read(){if(!source)throw Error('Copy or reopen original inverse inputs first.');return {...clone(source),options:{mode:$('mode').value,transferBasis:$('basis').value}};}
  function render(report){
    const result=$('results');result.replaceChildren();
    result.append(node('p',report.candidates.length+' distinct calibration-compatible receivers compared; '+report.survivingIds.length+' also pass their held-aside bands. No parameter was selected using held-aside values.'));
    const all=report.effects.calibration,held=report.effects.surviving;
    const ranges=node('section');ranges.id='rac-ranges';ranges.dataset.calibrationCount=String(all.count);ranges.dataset.survivingCount=String(held.count);
    ranges.append(node('h4','Proposal minus existing, across the retained family'));
    table(ranges,['Predicted quantity','All calibration-compatible models','Also compatible with held-aside readings'],[
      ...metrics.map(([key,label,unit])=>[label,range(all.metrics[key],unit),range(held.metrics[key],unit)]),
      ...receiverMetrics.map(([key,label,unit])=>[label,range(all.receiverMetrics[key],unit),range(held.receiverMetrics[key],unit)]),
    ],'Generated-model consequence ranges; scroll horizontally for both evidence groups');result.append(ranges);
    result.append(node('p','Positive differences mean more of that quantity in the proposal; negative differences mean less. Initial below-ground water is separate from rainfall. The held-aside column is a separate evidence summary; it does not change which models were fitted or compared.'));
    for(const candidate of report.candidates){
      const h=candidate.hypothesis,card=node('article');card.className='de-candidate';card.dataset.consequence=h.id;card.dataset.challenge=String(candidate.challenge.compatible);
      card.dataset.capacity=String(h.capacityMm);card.dataset.initial=String(h.initialStoredMm);card.dataset.drainage=String(h.drainagePerHour);card.dataset.surfaceChange=String(candidate.change.storedLiters);card.dataset.peakChange=String(candidate.change.maxDepthMm);
      card.append(node('h4',h.id+' · '+candidate.origins.map(o=>o.family+' '+o.hypothesisId).join('; ')),
        node('p',fmt(h.capacityMm)+' mm storage · '+fmt(h.initialStoredMm)+' mm initial water · '+fmt(h.drainagePerHour)+' /hour drainage.'),
        node('p','Original calibration rechecked in the paired consumer: compatible. Held aside: '+(candidate.challenge.compatible===true?'compatible':candidate.challenge.compatible===false?'contradicted':'no readings assigned')+'.'));
      card.append(details('Inspect this receiver in both original layouts',d=>{
        table(d,['Quantity','Existing','Proposal','Proposal minus existing'],[
          ...metrics.map(([key,label,unit])=>[label,fmt(candidate.existing[key])+' '+unit,fmt(candidate.proposal[key])+' '+unit,fmt(candidate.change[key])+' '+unit]),
          ...receiverMetrics.map(([key,label,unit])=>[label,fmt(candidate.existing.receiver[key])+' '+unit,fmt(candidate.proposal.receiver[key])+' '+unit,fmt(candidate.receiverChange[key])+' '+unit]),
        ],h.id+' original paired model quantities');
        for(const side of ['existing','proposal'])d.append(node('p',side+': '+candidate[side].receiver.affectedCellCount+' receiving cells; surface balance error '+fmt(candidate[side].massErrorLiters)+' L; receiver balance error '+fmt(candidate[side].receiver.balanceErrorLiters)+' L.'));
        for(const row of candidate.accountReadings)d.append(node('p',row.id+' · '+row.use+': original '+fmt(row.valueLiters)+' ± '+fmt(row.uncertaintyLiters)+' L; paired-consumer prediction '+fmt(row.modeledLiters)+' L. '+(row.withinBand?'Within band. ':'Outside band. ')+row.source));
      }));result.append(card);
    }
    result.append(details('Inspect the complete work reservation and model limits',d=>{
      d.append(node('p','Reserved '+report.reservation.totalCellEquivalentSteps+' of '+report.reservation.limit+' cell-equivalent steps for inference and every possible paired consumer. Executed '+report.counts.comparisonRuns+' maintained comparison runs for '+report.counts.comparedCandidates+' distinct supported receivers.'),node('p',report.meaning),node('p','Declared transfer basis: '+report.options.transferBasis));
    }));
  }
  function install(input,report){accepted=clone(input);render(report);$('save').disabled=false;status(messages[report.status]??report.status,report.status);}
  $('form').addEventListener('input',()=>retire());$('form').addEventListener('change',()=>retire());
  $('current').onclick=()=>{retire();try{fill(getSource());retire('Copied separate original inverse inputs. Declare the shared material and initial-water assumption before comparison.');}catch(error){status(error.message,'refused');}};
  $('example').onclick=()=>{retire();fill({...makeNoisyReceivingAccountBandExample(),options:{mode:'bands',transferBasis:'Authored example: the same hypothetical garden receiver and per-cell initial water are applied wherever garden appears in either layout. No field material transfer or physical intervention is established.'}});retire('Authored inferred-bed example loaded; its readings are synthetic, not field measurements.');};
  $('form').onsubmit=event=>{
    event.preventDefault();retire();const token=generation;let input;
    try{input=read();}catch(error){status(error.message,'refused');return;}
    $('run').disabled=true;status('Inferring from original calibration, then comparing every supported receiver in both copied layouts…','pending');
    setTimeout(()=>{if(token!==generation)return;try{install(input,compareReceivingAccountConsequences(input.project,input.selection,input.account,input.options));}catch(error){status(error.message,'refused');}finally{if(token===generation)$('run').disabled=!source;}},10);
  };
  $('save').onclick=()=>{if(!accepted)return;try{const text=serializeReceivingAccountConsequences(accepted.project,accepted.selection,accepted.account,accepted.options),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download='experimental-earth-receiving-family-comparison.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status(error.message,'refused');}};
  $('open').onchange=async()=>{
    const file=$('open').files?.[0];if(!file)return;$('open').value='';retire();const token=generation;$('run').disabled=true;status('Reading original family comparison…','opening');
    try{if(file.size>2*1024*1024)throw Error('Choose original comparison JSON under 2 MiB.');const bytes=await file.arrayBuffer();if(token!==generation)return;
      const input=parseReceivingAccountConsequences(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      const report=compareReceivingAccountConsequences(input.project,input.selection,input.account,input.options);if(token!==generation)return;
      fill(input);install(input,report);status('Recomputed from original inputs. '+messages[report.status],report.status);
    }catch(error){if(token===generation)status(error.message,'refused');}finally{if(token===generation)$('run').disabled=!source;}
  };
  return {element:panel};
}

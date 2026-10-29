import {proposeReceivingAccountLayers,serializeReceivingAccountProposals,parseReceivingAccountProposals,makeReceivingAccountProposalExample,makePostDryReceivingAccountProposalExample,makePostDryDrainageAccountProposalExample} from './receiving-account-proposals.js';
import {fitReceivingAccountBands,serializeReceivingAccountBandSearch,parseReceivingAccountBandSearch,makeNoisyReceivingAccountBandExample,makeUncertainRetainedBandExample,RECEIVING_ACCOUNT_BAND_SCHEMA} from './receiving-account-band-fit.js';
import {fitReceivingAccountPhases,serializeReceivingAccountPhases,parseReceivingAccountPhases,makeUnfilledReceivingPhaseExample,RECEIVING_ACCOUNT_PHASE_SCHEMA} from './receiving-account-phase-fit.js';
import {mountReceivingAccountConsequences} from './receiving-account-consequences-panel.js';

const node=(tag,text='')=>{const element=document.createElement(tag);element.textContent=text;return element;};
const fmt=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumSignificantDigits:8}):'unresolved';
const channels={retained:'Retained water',drained:'Cumulative receiver drainage'};
const messages={
  'surface-absent':'The selected receiving surface is absent. No parameters are proposed.',
  'need-storm-end-calibration':'An original calibration depth at storm end is needed for this inverse.',
  'need-calibration-account':'Assign at least one original receiving reading to calibration before proposing parameters.',
  'need-calibration-pair':'Provide a later surface calibration depth, two late retained-water calibration readings, or three late cumulative drainage calibration readings.',
  'non-identifying-trials':'The admitted readings do not identify these parameters. No fallback is selected.',
  'unsupported-trials':'No admitted inverse trial produced a supported parameter proposal. Inspect the retained refusals.',
  'no-compatible-proposal':'Every proposed model contradicts an original calibration band. No fallback is selected.',
  'no-search-starts':'The bounded search had no supported numerical start. The original analytic proposals remain available; no exclusion or fallback is claimed.',
  'no-band-witness':'The bounded search did not find a receiver that passes every original calibration band. This is unresolved, not proof that no receiver fits.',
  'needs-challenge':'Calibration-compatible proposals remain. Original held-aside readings are still needed to challenge them.',
  'challenged':'Every calibration-compatible proposal contradicts an original held-aside band.',
  'one-surviving-proposal':'One generated proposal is compatible with both original roles. Other untested receivers may also fit.',
  'several-surviving-proposals':'Several generated proposals remain compatible with both original roles. These readings do not distinguish them.',
};
const questionMessages={
  'no-supported-pair':'Fewer than two calibration-compatible proposals remain.',
  'no-offers':'No receiving measurement has been explicitly offered.',
  'all-recorded':'Every offered channel and time already has an original reading.',
  'no-separating-offer':'No unrecorded offer separates a supported pair at its declared precision.',
};
const compatible=value=>value===null?'no original readings assigned':value?'compatible with every original band':'contradicted by an original band';
function lazyDetails(title,fill){
  const details=node('details');details.append(node('summary',title));let populated=false;
  details.addEventListener('toggle',()=>{if(details.open&&!populated){populated=true;fill(details);}});return details;
}

/** The consumer owns a separate original-input copy. Parent edits cannot retarget
 * its measurements; retired asynchronous file reads cannot install results. */
export function mountReceivingAccountProposals({host,getSource}){
  const panel=node('section');panel.id='receiving-account-proposals';
  panel.innerHTML='<h3>Infer receivers without supplying their initial water</h3>'+
    '<p>Use original surface depths and whole-footprint receiver measurements to propose storage, initial water and drainage together. Every proposal must then satisfy all original calibration bands.</p>'+
    '<div class="dl-actions"><button id="rai-current" type="button">Copy the current original receiving account</button><button id="rai-example" type="button" class="subtle">Try the wet-surface example</button><button id="rai-late-example" type="button" class="subtle">Try the late-water ambiguity</button><button id="rai-drain-example" type="button" class="subtle">Try three late drainage readings</button><button id="rai-band-example" type="button" class="subtle">Try measurements with uncertainty</button><button id="rai-retained-band-example" type="button" class="subtle">Try uncertain late retained water</button><button id="rai-phase-example" type="button" class="subtle">Try a receiver that never fills</button></div>'+
    '<div id="rai-source"></div><form id="rai-form" novalidate><label class="input-label">Basis for one uniform receiving layer across the selected footprint<textarea id="rai-basis" rows="2" maxlength="300"></textarea></label><div class="dl-actions"><button id="rai-run" type="submit" class="primary" disabled>Propose and challenge receivers</button><button id="rai-band-run" type="button" disabled>Search the original calibration bands</button><button id="rai-phase-run" type="button" disabled>Include filled and never-filled alternatives</button></div></form>'+
    '<p id="rai-status" role="status" aria-live="polite">Copy an original receiving account, try an authored example, or reopen original inputs.</p><div id="rai-results"></div>'+
    '<div class="dl-actions"><button id="rai-save" type="button" disabled>Save original inverse inputs</button><label class="input-label">Reopen separate original inverse inputs<input id="rai-open" type="file" accept=".json,application/json"></label></div>'+
    '<p class="mini-note">The copied site, storm, footprint, readings and offers stay fixed. To change measurements, edit the original receiving account above and copy it again. This inverse assumes zero lateral water movement and zero surface-boundary outflow. Drainage is cumulative from the original event start. Numerical rounding guards are not measurement uncertainty or certified error bounds. Nothing is automatically adopted.</p>';
  host.append(panel);const $=id=>panel.querySelector('#rai-'+id);
  let source=null,accepted=null,acceptedMode='central',generation=0;
  const status=(text,state)=>{$('status').textContent=text;$('status').dataset.state=state;};
  function retire(message='Original inverse inputs changed. Propose again.'){
    generation++;accepted=null;acceptedMode='central';$('results').replaceChildren();$('save').disabled=true;$('run').disabled=$('band-run').disabled=$('phase-run').disabled=!source;status(message,'draft');
  }
  function fill(input){
    source=structuredClone({project:input.project,selection:input.selection,account:input.account});
    $('basis').value=source.selection.uniformReceiverBasis;
    const {project,selection,account}=source,cells=project[selection.target].flatMap((cell,index)=>cell.surface===selection.surface?[index]:[]);
    const place=$('source');place.replaceChildren(node('p','Separate original source: '+project.title+' · '+selection.target+' · '+selection.surface+' · '+cells.length+' cells / '+fmt(cells.length*project.weather.cellSizeM**2)+' m².'));
    place.append(node('p',account.footprintBasis));
    place.append(lazyDetails('Inspect every copied original reading and offered measurement',details=>{
      details.append(node('p','Original selected cell indices: '+(cells.join(', ')||'none')+'. Rain '+fmt(project.weather.rainMmHr)+' mm/hour for '+fmt(project.weather.stormMinutes)+' minutes; event '+fmt(project.weather.durationMinutes)+' minutes.'));
      project.observations.forEach((row,index)=>{
        if(row.scenario===selection.target)details.append(node('p','Surface row '+(index+1)+' · '+row.use+' · cell '+row.cellIndex+' · minute '+fmt(row.minute)+': '+fmt(row.depthMm)+' ± '+fmt(row.uncertaintyMm)+' mm. '+row.source));
      });
      for(const row of account.readings)details.append(node('p',row.id+' · '+row.use+' · '+channels[row.channel]+' · minute '+fmt(row.minute)+': '+fmt(row.valueLiters)+' ± '+fmt(row.uncertaintyLiters)+' L. '+row.source));
      for(const row of account.offers)details.append(node('p',row.id+' · offered '+channels[row.channel]+' · minute '+fmt(row.minute)+' at ±'+fmt(row.uncertaintyLiters)+' L. '+row.basis));
    }));
  }
  function read(){
    if(!source)throw Error('Copy an original receiving account or reopen original inverse inputs first.');
    const input=structuredClone(source);input.selection.uniformReceiverBasis=$('basis').value;return input;
  }
  function renderQuestion(report,results,prefix='rai'){
    const q=report.question,section=node('section');section.id=prefix+'-question';section.dataset.state=q.status;
    section.append(node('h4','A measurement to distinguish the calibration-compatible proposals'));
    if(q.best){const best=node('p','Selected offer: '+channels[q.best.channel]+' at minute '+fmt(q.best.minute)+' with ±'+fmt(q.best.uncertaintyLiters)+' L. Separates '+q.best.separatedCount+' of '+q.best.pairs.length+' supported pairs.');best.dataset.best=q.best.id;section.append(best);}
    else section.append(node('p',q.reason??questionMessages[q.status]??'No receiving question is selected.'));
    section.append(node('p','Only calibration support ranks the offers. Held-aside values never choose the question. Ties keep original offer order; a recorded channel and time is excluded.'));
    if(q.offers.length){
      const label=node('label','Inspect every offered measurement');label.className='input-label';const select=node('select');select.id=prefix+'-inspect';
      for(const offer of q.offers){const option=node('option',offer.id+' · '+offer.channel+' · '+fmt(offer.minute)+' min · '+offer.separatedCount+'/'+offer.pairs.length+' pairs · '+offer.status);option.value=offer.id;select.append(option);}
      select.value=q.best?.id??q.offers[0].id;label.append(select);section.append(label);
      const detail=node('div');detail.id=prefix+'-offer-detail';section.append(detail);
      const show=()=>{
        const offer=q.offers.find(row=>row.id===select.value);detail.replaceChildren(node('p',channels[offer.channel]+' · minute '+fmt(offer.minute)+' · ±'+fmt(offer.uncertaintyLiters)+' L. '+offer.basis));
        for(const prediction of offer.predictions)detail.append(node('p',prediction.id+': modeled '+fmt(prediction.modeledLiters)+' L; hypothetical interval '+fmt(prediction.modeledLiters-offer.uncertaintyLiters)+' to '+fmt(prediction.modeledLiters+offer.uncertaintyLiters)+' L.'));
        detail.append(lazyDetails('Inspect all '+offer.pairs.length+' pairs and numerical guards',pairs=>{
          let page=0;const controls=node('div'),previous=node('button','Previous 50'),next=node('button','Next 50'),range=node('p'),rows=node('div');controls.className='dl-actions';previous.type=next.type='button';controls.append(previous,next);pairs.append(range,rows,controls);
          const draw=()=>{const start=page*50,end=Math.min(start+50,offer.pairs.length);range.textContent=offer.pairs.length?'Pairs '+(start+1)+'–'+end+' of '+offer.pairs.length:'No supported pairs.';rows.replaceChildren();
            for(const pair of offer.pairs.slice(start,end))rows.append(node('p',pair.ids.join(' / ')+': '+(pair.separated?'separated':'unresolved')+'; gap '+fmt(pair.gapLiters)+' L, combined numerical guard '+fmt(pair.numericalGuardLiters)+' L.'));
            previous.disabled=page===0;next.disabled=end===offer.pairs.length;
          };previous.onclick=()=>{page--;draw();};next.onclick=()=>{page++;draw();};draw();
        }));
      };select.onchange=show;show();
    }
    results.append(section);
  }
  function render(report,results=$('results'),prefix='rai',band=false){
    results.replaceChildren();
    results.append(node('p','Calibration-compatible: '+(report.compatibleIds.join(', ')||'none')+'. Compatible with both original roles: '+(report.survivingIds.join(', ')||'none')+'.'));
    if(band){
      results.append(node('p','Searched '+report.searches.length+' calibration-only starts. Every receiver below was checked on the complete original site after fitting. The original analytic proposals remain separately available.'));
      if(report.schema===RECEIVING_ACCOUNT_PHASE_SCHEMA)results.append(node('p','Added '+report.counts.phaseUniqueParameters+' distinct finite phase alternatives and rechecked the original-band candidates. A never-filled receiver does not identify capacity: the displayed capacities are explicit arbitrary witnesses above their modeled inventory, not estimates or a continuous uncertainty range.'));
      results.append(lazyDetails('Inspect the bounded search and its work reservation',details=>{
        details.append(node('p','Reserved '+report.reservation.totalCellEquivalentSteps+' of '+report.reservation.limit+' cell-equivalent steps, including the original analytic family, all numerical starts and full-site checks.'));
        for(const search of report.searches){
          details.append(node('p',search.seedId+' · '+search.status+' · '+search.modelTrials+' trials. '+(search.origin??search.reason??'')));
          if(search.calibrationStart){const start=search.calibrationStart;details.append(node('p','Conditional retained-band rate start: '+fmt(start.ratePerHour)+' /hour within '+fmt(start.minimumRatePerHour)+' to '+fmt(start.maximumRatePerHour)+' /hour. '+start.meaning));if(start.parameterization)details.append(node('p',start.parameterization+'. '+start.restriction));}
        }
        for(const refused of report.refusals)details.append(node('p','Unresolved '+(refused.phase??refused.family??'proposal')+': '+refused.reason));
        if(report.schema===RECEIVING_ACCOUNT_PHASE_SCHEMA)details.append(node('p','Phase work reserves '+report.reservation.maximumPhaseProposals+' possible extra models, '+report.reservation.phaseRootEvaluations+' bounded inverse root evaluations, '+report.reservation.phaseBandIntersections+' band intersections and '+report.reservation.finalGridChecks+' final original-grid checks.'));
        if(report.reservation.filledDrain?.maximumProposals)details.append(node('p','The filled-course drainage search additionally reserves '+report.reservation.filledDrain.qEvaluations+' full-store-rate points and '+report.reservation.filledDrain.modelEvaluations+' monotone original-band model evaluations before any fitting.'));
      }));
    }else results.append(node('p','Complete work reserved: '+report.trialCount+' model trials / '+report.reservedCellSteps+' cell-steps. '+report.candidates.length+' distinct parameter proposals were forwarded through the maintained rain model.'));
    for(const candidate of report.candidates){
      const h=candidate.hypothesis,card=node('article');card.className='de-candidate';card.dataset.hypothesis=h.id;card.dataset.calibration=String(candidate.calibration.compatible);card.dataset.challenge=String(candidate.challenge.compatible);
      card.dataset.capacity=String(h.capacityMm);card.dataset.initial=String(h.initialStoredMm);card.dataset.drainage=String(h.drainagePerHour);
      card.append(node('h4',h.label),node('p',fmt(h.capacityMm)+' mm storage · '+fmt(h.initialStoredMm)+' mm initial water · '+fmt(h.drainagePerHour)+' /hour drainage.'),node('p','All original calibration readings: '+compatible(candidate.calibration.compatible)+'. All held-aside readings: '+compatible(candidate.challenge.compatible)+'.'));
      card.append(lazyDetails('Inspect original bands and the source of this proposal',details=>{
        if(candidate.phaseOrigins)for(const origin of candidate.phaseOrigins){
          details.append(node('p',origin.family+' · '+origin.meaning));
          if(origin.targetLiters)details.append(node('p','Computational targets inside original bands: '+origin.targetLiters.map(fmt).join(' / ')+' L. These are not additional observations.'));
          if(origin.family==='filled-drain')details.append(node('p','Conditional full-store drainage '+fmt(origin.fullStoreRateMmHr)+' mm/hour; fill minute '+fmt(origin.fillMinute)+'; surface dry minute '+fmt(origin.dryMinute)+'. Computational decay-rate intersection '+origin.rateInterval.map(fmt).join(' to ')+' /hour; this is not a certified parameter enclosure.'));
          if(origin.family==='unfilled')details.append(node('p','Capacity choice: '+origin.capacityChoice+'; maximum modeled inventory '+fmt(origin.maximumModeledStorageMm)+' mm. Other untested capacities may reproduce the same course.'));
        }
        else if(candidate.search)details.append(node('p',candidate.search.origin+'. All original calibration readings then constrain the fit. '+candidate.search.iterations+' iterations / '+candidate.search.modelTrials+' model trials; final full-site bands below determine support.'));
        else details.append(node('p','Conditional fill minute '+fmt(candidate.fillMinute)+(Object.hasOwn(candidate,'dryMinute')?'; surface dry minute '+fmt(candidate.dryMinute):'')+'. These phase predictions are checked through the original forward bands.'));
        for(const trial of candidate.originalTrials){
          details.append(node('p',trial.branch+' · original surface rows '+trial.surfaceRows.map(i=>i+1).join(', ')+' · receiver rows '+(trial.accountIndices??[trial.accountIndex]).map(i=>i+1).join(', ')+(trial.capacityBranch?' · '+trial.capacityBranch:'')+'.'));
          if(trial.derivedCourse){const d=trial.derivedCourse;details.append(node('p','Derived course, not additional observations: retained '+fmt(d.firstRetainedLiters)+' L at minute '+fmt(d.firstMinute)+' and '+fmt(d.secondRetainedLiters)+' L at minute '+fmt(d.secondMinute)+'; implied initial water '+fmt(d.derivedInitialStoredMm)+' mm. Only the original drainage rows supply evidence.'));}
        }
        for(const role of ['surfaceCalibration','surfaceChallenge'])for(const error of candidate[role].errors){const original=report.project.observations[error.index];details.append(node('p','Surface row '+(error.index+1)+' · '+original.use+' · cell '+original.cellIndex+' · minute '+fmt(original.minute)+': original '+fmt(original.depthMm)+' ± '+fmt(original.uncertaintyMm)+' mm; modeled '+fmt(error.depthMm)+' mm. '+(error.withinBand?'Within band. ':'Outside band. ')+original.source));}
        for(const row of candidate.accountReadings){const p=node('p',row.id+' · '+row.use+' · '+channels[row.channel]+' · minute '+fmt(row.minute)+': original '+fmt(row.valueLiters)+' ± '+fmt(row.uncertaintyLiters)+' L; modeled '+fmt(row.modeledLiters)+' L. '+(row.withinBand?'Within band. ':'Outside band. ')+row.source+' Numerical guard '+row.numericalGuardLiters+' L.');p.dataset.reading=row.id;details.append(p);}
      }));results.append(card);
    }
    if(!band){const failures=lazyDetails('Inspect '+report.refusedTrials.length+' refused and '+report.nonIdentifyingTrials.length+' non-identifying trials',details=>{
      for(const [label,rows]of [['Refused',report.refusedTrials],['Non-identifying',report.nonIdentifyingTrials]])for(const trial of rows)details.append(node('p',label+' · '+trial.branch+' · surface rows '+trial.surfaceRows.map(i=>i+1).join(', ')+' · '+trial.accountId+': '+trial.reason+'.'));
    });failures.id=prefix+'-refusals';results.append(failures);}renderQuestion(report,results,prefix);
    if(report.meaning)results.append(node('p',report.meaning));
  }
  function install(input,report,mode='central'){
    accepted=structuredClone(input);acceptedMode=mode;
    if(mode==='bands'||mode==='phases'){
      const results=$('results');results.replaceChildren();
      const baseline=lazyDetails('Inspect the retained analytic proposals: '+report.baseline.compatibleIds.length+' calibration-compatible',details=>{
        const content=node('div');details.append(content);render(report.baseline,content,'rai-central');
      });baseline.id='rai-band-incumbent';results.append(baseline);
      const searched=node('div');searched.id='rai-band-results';results.append(searched);render(report,searched,'rai-band',true);
    }else render(report);
    $('save').disabled=false;status((mode==='phases'?'Phase alternatives: ':mode==='bands'?'Original-band search: ':'')+(messages[report.status]??report.status),report.status);
  }
  $('form').addEventListener('input',()=>retire());$('form').addEventListener('change',()=>retire());
  $('current').onclick=()=>{retire();try{fill(getSource());retire('Copied a separate original account. Declare why one uniform receiver is appropriate, then propose. Existing offered parameter values are not used.');}catch(error){status(error.message,'refused');}};
  for(const [id,factory,message]of [['example',makeReceivingAccountProposalExample,'Wet-surface example loaded.'],['late-example',makePostDryReceivingAccountProposalExample,'Late-water ambiguity loaded: the same retained course may come from different receivers.'],['drain-example',makePostDryDrainageAccountProposalExample,'Three unequal-time cumulative drainage readings loaded.'],['band-example',makeNoisyReceivingAccountBandExample,'Measurements with small declared uncertainty loaded. Try the analytic proposals, then search their original calibration bands.'],['retained-band-example',makeUncertainRetainedBandExample,'Increasing central retained amounts need not contradict their original bands. The later held receiver readings can reject a fitted alternative; finding a calibration witness does not establish its physical parameters.'],['phase-example',makeUnfilledReceivingPhaseExample,'This receiver never fills. Include finite phase alternatives, then inspect why different capacities can pass the same original readings without identifying capacity.']])$(id).onclick=()=>{retire();try{fill(factory());retire(message+' These are authored controls, not field observations.');}catch(error){status(error.message,'refused');}};
  function compute(mode){
    retire();const token=generation;let input;
    try{input=read();}catch(error){status(error.message,'refused');return;}
    $('run').disabled=$('band-run').disabled=$('phase-run').disabled=true;status(mode==='phases'?'Generating finite filled and never-filled alternatives, retaining the original-band search and checking every original band…':mode==='bands'?'Searching original calibration bands, then checking each frozen candidate on the complete site…':'Proposing from original calibration centers and checking every original band…','pending');
    setTimeout(()=>{if(token!==generation)return;try{const producer=mode==='phases'?fitReceivingAccountPhases:mode==='bands'?fitReceivingAccountBands:proposeReceivingAccountLayers;install(input,producer(input.project,input.selection,input.account),mode);}catch(error){status(error.message,'refused');}finally{if(token===generation)$('run').disabled=$('band-run').disabled=$('phase-run').disabled=!source;}},10);
  }
  $('form').onsubmit=event=>{event.preventDefault();compute('central');};$('band-run').onclick=()=>compute('bands');$('phase-run').onclick=()=>compute('phases');
  $('save').onclick=()=>{if(!accepted)return;try{const serialize=acceptedMode==='phases'?serializeReceivingAccountPhases:acceptedMode==='bands'?serializeReceivingAccountBandSearch:serializeReceivingAccountProposals,text=serialize(accepted.project,accepted.selection,accepted.account),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download=acceptedMode==='phases'?'experimental-earth-receiving-phase-search.json':acceptedMode==='bands'?'experimental-earth-receiving-band-search.json':'experimental-earth-receiving-inverse.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status(error.message,'refused');}};
  $('open').onchange=async()=>{
    const file=$('open').files?.[0];if(!file)return;$('open').value='';retire();const token=generation;$('run').disabled=$('band-run').disabled=$('phase-run').disabled=true;status('Reading original inverse inputs…','opening');
    try{if(file.size>2*1024*1024)throw Error('Choose original inverse JSON under 2 MiB.');const bytes=await file.arrayBuffer();if(token!==generation)return;
      const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),schema=JSON.parse(text).schema,mode=schema===RECEIVING_ACCOUNT_PHASE_SCHEMA?'phases':schema===RECEIVING_ACCOUNT_BAND_SCHEMA?'bands':'central';
      const parsed=(mode==='phases'?parseReceivingAccountPhases:mode==='bands'?parseReceivingAccountBandSearch:parseReceivingAccountProposals)(text);const input={project:parsed.project,selection:parsed.selection,account:parsed.account};const report=(mode==='phases'?fitReceivingAccountPhases:mode==='bands'?fitReceivingAccountBands:proposeReceivingAccountLayers)(input.project,input.selection,input.account);if(token!==generation)return;
      fill(input);install(input,report,mode);status('Recomputed '+(mode==='phases'?'phase alternatives ':mode==='bands'?'band search ':'')+'from original inputs. '+(messages[report.status]??report.status),report.status);
    }catch(error){if(token===generation)status(error.message,'refused');}finally{if(token===generation)$('run').disabled=$('band-run').disabled=$('phase-run').disabled=!source;}
  };
  mountReceivingAccountConsequences({host:panel,getSource:()=>({...read(),...(acceptedMode==='phases'?{options:{mode:'phases'}}:{})})});
  return {element:panel};
}


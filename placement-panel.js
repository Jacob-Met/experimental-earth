import {comparePlacementResolution} from './placement-resolution.js';
import { comparePlacements, adoptPlacement, placementSignature, PLACEMENT_METRICS } from './placement-search.js';
import { SURFACES } from './core.js';
import { DEFAULT_STUDY } from './study-contract.js';

const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
const number=n=>Number(n).toLocaleString('en-US',{maximumSignificantDigits:6});
export function mountPlacementSearch({getProject,replaceProject,notice}) {
  const panel=document.createElement('section');panel.id='placement-search';panel.className='panel study';
  panel.innerHTML=`<h2>Where could a small surface change help?</h2>
    <p>Choose eligible cells in the current proposal, then compare every zero-, one- and two-cell change within that set. The investigation's supported infiltration rates are fixed from the unchanged source before any hypothetical edit.</p>
    <div class="input-pair"><label class="input-label">Replace selected surfaces with<select id="placement-surface"><option value="garden">Rain garden</option><option value="turf">Turf</option><option value="sealed">Sealed paving</option></select></label>
    <label class="input-label">Maximum edited cells<select id="placement-count"><option value="1">One</option><option value="2" selected>Two</option></select></label></div>
    <label class="input-label">Minimize the worst additional change in<select id="placement-objective"></select></label>
    <label class="input-label">Fixed source hypotheses<select id="placement-subset"><option value="all">All saved rates (no evidence filter)</option><option value="calibration">Within all calibration bands</option><option value="surviving">Within calibration and held-aside bands</option></select></label>
    <fieldset style="min-width:0"><legend>Optional local peak-depth targets</legend>
    <label class="input-label">Target cells (for example C2, D2; blank means none)<input id="placement-target-cells" type="text" maxlength="100"></label>
    <label class="input-label">Maximum peak-depth change at every target (mm)<input id="placement-target-limit" type="number" min="-1000" max="1000" step="any" value="0"></label>
    <label class="input-label">Declared reason for this target<input id="placement-target-basis" type="text" maxlength="500"></label>
    <p class="mini-note">Relative to the current proposal, for every retained soil hypothesis. Zero requires no modeled increase; −1 requests at least 1 mm reduction. Peaks may occur at different times. This is a decision condition, not an access or safety threshold.</p></fieldset>
    <p id="placement-study" class="mini-note"></p>
    <div class="obs-actions"><button id="placement-sealed" type="button">Select proposed sealed cells</button><button id="placement-clear" type="button">Clear selection</button></div>
    <p id="placement-selection" class="mini-note"></p><div id="placement-grid" class="placement-grid" aria-label="Eligible proposal cells"></div>
    <button id="placement-run" type="button" class="primary">Compare eligible placements</button>
    <p id="placement-status" role="status" aria-live="polite"></p>
    <div id="placement-results"></div>
    <p class="mini-note">Eligibility and surface capacities are declared assumptions, not site permission or verified feasibility. This finite search does not establish an optimum elsewhere, physical benefit, confidence intervals or numerical convergence. Different objectives can prefer different locations. Other materials retain their current model defaults; transfer of a surface capacity to edited cells is an assumption.</p>`;
  document.querySelector('.observations').before(panel);
  const $=id=>panel.querySelector('#'+id);
  for(const [key,m] of Object.entries(PLACEMENT_METRICS)){const o=node('option',`${m.label} (${m.unit})`);o.value=key;$('placement-objective').append(o);}
  let eligible=new Set(),generation=0,lastSource='',report=null;
  const name=(p,i)=>`${String.fromCharCode(65+i%p.width)}${Math.floor(i/p.width)+1}`;
  function invalidate(message='Compare again after changing inputs.') {
    generation++;report=null;$('placement-results').replaceChildren();$('placement-status').dataset.state='not-compared';$('placement-status').textContent=message;
  }
  function drawEligibility() {
    const p=getProject(),surface=$('placement-surface').value;
    eligible=new Set([...eligible].filter(i=>i<p.proposal.length&&p.proposal[i].surface!==surface));
    const grid=$('placement-grid');grid.style.gridTemplateColumns=`repeat(${p.width},minmax(28px,1fr))`;grid.replaceChildren();
    for(const [i,cell] of p.proposal.entries()){
      const b=node('button',name(p,i),'placement-cell');b.type='button';b.dataset.cellIndex=i;b.style.background=SURFACES[cell.surface].color;
      b.disabled=cell.surface===surface;b.setAttribute('aria-pressed',String(eligible.has(i)));
      b.setAttribute('aria-label',`${name(p,i)}, ${SURFACES[cell.surface].label}, ${eligible.has(i)?'eligible':'not selected'}${b.disabled?', already replacement surface':''}`);
      b.addEventListener('click',()=>{
        if(eligible.has(i))eligible.delete(i);else if(eligible.size<12)eligible.add(i);else{notice('Choose at most 12 eligible cells; no automatic shortlist is used.');return;}
        invalidate();drawEligibility();
      });grid.append(b);
    }
    const n=eligible.size,count=Number($('placement-count').value),variants=1+n+(count===2?n*(n-1)/2:0);
    $('placement-selection').textContent=`${n}/12 eligible cells; ${variants} variants including the unchanged proposal. Selection does not paint or edit the project.`;
    const study=p.infiltrationStudy??DEFAULT_STUDY;
    $('placement-study').textContent=`Saved ${study.surface} rates: ${study.ratesMmHr.join(', ')} mm/h. Evidence scenario: ${study.target}. Support is evaluated once on this unchanged source, never refitted to a hypothetical layout.`;
  }
  function readTargets(p) {
    const raw=$('placement-target-cells').value.trim();if(!raw)return [];
    const limit=$('placement-target-limit').value.trim();if(!limit)throw Error('Enter a local peak-change limit');
    return raw.split(',').map(label=>{
      const match=/^([A-X])([1-9][0-9]?)$/.exec(label.trim().toUpperCase());
      if(!match)throw Error('Use target cell labels such as C2, D2');
      const col=match[1].charCodeAt(0)-65,row=Number(match[2])-1;
      if(col>=p.width||row>=p.height)throw Error('Target cell is outside this project');
      return {cellIndex:row*p.width+col,maxPeakChangeMm:Number(limit),basis:$('placement-target-basis').value};
    });
  }
  function inspect(plan,p,current) {
    const detail=$('placement-detail');detail.replaceChildren();
    detail.append(node('h3',plan.cells.length?`${plan.cells.map(i=>name(p,i)).join(' + ')} → ${SURFACES[current.query.surface].label}`:'Unchanged current proposal'));
    detail.append(node('p',`${plan.cells.length} edited cells; ${number(plan.cells.length*p.weather.cellSizeM**2)} m² modeled area. Effects below are additional changes from the current proposal.`));
    const grid=node('div','','placement-grid placement-preview');grid.style.gridTemplateColumns=`repeat(${p.width},minmax(28px,1fr))`;
    for(const [i,cell] of p.proposal.entries()){
      const edited=plan.cells.includes(i),deeper=plan.worseningCells.some(c=>c.cellIndex===i);
      const square=node('div',`${name(p,i)}${edited?' ★':''}${deeper?' ↑':''}`,'placement-cell');square.style.background=SURFACES[edited?current.query.surface:cell.surface].color;
      square.setAttribute('aria-label',`${name(p,i)}${edited?', hypothetical surface edit':''}${deeper?', higher peak in at least one hypothesis':''}`);grid.append(square);
    }
    detail.append(grid,node('p','★ hypothetical edit · ↑ a higher cell peak under at least one retained hypothesis. Peak times can differ.'));
    const list=node('ul','');for(const [key,m] of Object.entries(PLACEMENT_METRICS)){const range=plan.metrics[key];list.append(node('li',`${m.label}: ${number(range.min)} to ${number(range.max)} ${m.unit}; ${range.direction}.`));}detail.append(list);
    const perRate=node('details','');perRate.append(node('summary','Inspect every retained hypothesis and its source-to-candidate change'));
    for(const c of plan.candidates){const card=node('article','','study-candidate');card.append(node('h4',`${c.rateMmHr} mm/h ${current.query.study.surface}`));for(const [key,m] of Object.entries(PLACEMENT_METRICS)){const v=c.metrics[key];card.append(node('p',`${m.label}: ${number(v.current)} → ${number(v.proposed)} ${m.unit}; change ${number(v.delta)}.`));}perRate.append(card);}detail.append(perRate);
    const local=node('details','');local.append(node('summary',`${plan.worseningCells.length} cells deepen under at least one retained rate`));for(const c of plan.worseningCells)local.append(node('p',`${name(p,c.cellIndex)}: ${number(c.min)} to ${number(c.max)} mm peak-depth change.`));detail.append(local);
    if(current.query.targets.length){
      const targets=node('div','','placement-target-witnesses');targets.style.overflowWrap='anywhere';targets.append(node('h4',plan.localTargets.meets?'Meets every local target':'Does not meet every local target'));
      for(const check of plan.localTargets.checks){
        targets.append(node('p',`${name(p,check.cellIndex)}: limit ${number(check.maxPeakChangeMm)} mm; worst change ${number(check.worstChangeMm)} mm. Basis: ${check.basis}`));
        for(const w of check.witnesses)targets.append(node('p',`${w.rateMmHr} mm/h hypothesis: ${number(w.changeMm)} mm change — ${w.meets?'meets target':'exceeds target by '+number(w.excessMm)+' mm'}.`));
      }detail.append(targets);
    }
    if(plan.cells.length){
      const adopt=node('button','Apply these hypothetical surface edits','primary');adopt.type='button';adopt.id='placement-adopt';adopt.disabled=current.adoptionBlockedByProposalEvidence||!plan.localTargets.meets;
      adopt.addEventListener('click',()=>{try{const next=adoptPlacement(getProject(),current.query,plan.cells,current.sourceSignature);replaceProject(next);notice('Hypothetical proposal edits applied; retained source readings were not changed.');}catch(error){notice(error.message);invalidate(error.message);}});
      detail.append(adopt);
      if(current.adoptionBlockedByProposalEvidence)detail.append(node('p','This workspace has observations assigned to the proposal. Keep those readings with their observed geometry; this alternative remains inspectable but cannot replace that observed proposal.','mini-note'));
    }
  }
  function resolutionView(result,p,host) {
    host.replaceChildren();host.dataset.state=result.status;
    if(result.status!=='compared'){
      const reasons={'minimum-step':'Already at the supported one-minute minimum; no finer comparison was run.','work-limit':'The combined calculation exceeds the 3 million cell-step limit. Choose fewer eligible cells, a shorter event or fewer declared hypotheses; no layouts were silently removed.'};
      host.append(node('p',reasons[result.status]??`Source comparison refused: ${result.status}.`));return;
    }
    host.append(node('h3','Sensitivity to calculation interval'),node('p',result.semantics),node('p',`Fixed original support: ${result.ratesMmHr.join(', ')} mm/h; original evidence subset: ${result.sourceSupport.subset}. Combined work: ${result.estimatedCellSteps.toLocaleString()} estimated cell-steps.`));
    host.append(node('p',`${result.qualificationChanged?'Some local-target qualifications change.':'Local-target qualifications are unchanged across these tested intervals.'} ${result.bestChanged?'The best qualifying set changes.':'The best qualifying set is unchanged across these tested intervals.'}`));
    const table=node('table','','placement-table'),body=node('tbody','');
    const head=node('tr','');for(const label of ['Step (min)','Qualifying layouts','Best qualifying edits'])head.append(node('th',label));body.append(head);
    for(const run of result.runs){const row=node('tr','');row.append(node('td',String(run.stepMinutes)),node('td',String(run.qualifyingCount)),node('td',run.best.length?run.best.map(c=>c.map(i=>name(p,i)).join(' + ')||'No change').join('; '):'None'));body.append(row);}table.append(body);
    const wrap=node('div','','placement-table-wrap');wrap.append(table);host.append(wrap);
    const all=node('details','');all.append(node('summary',`Inspect all ${result.plans.length} layouts at every tested interval`));
    for(const plan of result.plans){
      const item=node('details','');item.append(node('summary',`${plan.cells.map(i=>name(p,i)).join(' + ')||'No change'}${plan.qualificationChanged?' · local qualification changes':''}${plan.bestChanged?' · best-set membership changes':''}`));
      for(const at of plan.atSteps){
        item.append(node('h4',`${at.stepMinutes} min: ${at.meets?'meets every local target':'does not meet every local target'}${at.isBest?' · best qualifying set':''}`),node('p',`Worst additional ${PLACEMENT_METRICS[result.query.metric].label}: ${number(at.score)} ${PLACEMENT_METRICS[result.query.metric].unit}.`));
        for(const check of at.checks){item.append(node('p',`${name(p,check.cellIndex)} limit ${number(check.maxPeakChangeMm)} mm; worst ${number(check.worstChangeMm)} mm. Basis: ${check.basis}`));
          for(const w of check.witnesses)item.append(node('p',`${w.rateMmHr} mm/h: ${number(w.changeMm)} mm change; ${w.meets?'meets target':'exceeds by '+number(w.excessMm)+' mm'}.`));}
      }all.append(item);
    }host.append(all);host.style.overflowWrap='anywhere';
  }
  function show(current,p) {
    const host=$('placement-results');host.replaceChildren();$('placement-status').dataset.state=current.status;
    const refusal={'need-calibration':'Assign calibration readings before filtering.','need-challenge':'Assign held-aside readings before using their bands.','no-compatible-rates':'No source hypotheses meet these bands; no closest-fit fallback is used.','surface-absent':'The studied surface is absent from the source comparison.'};
    if(current.status!=='compared'){$('placement-status').textContent=refusal[current.status]??current.status;return;}
    const metric=PLACEMENT_METRICS[current.query.metric];
    $('placement-status').dataset.state=current.qualifyingCount?'compared':'no-qualifying-placement';
    $('placement-status').textContent=`Compared ${current.variantCount} variants × ${current.ratesMmHr.length} fixed hypotheses. ${current.qualifyingCount} meet every local target; ${current.best.length} share the lowest worst additional change among those placements. ${current.qualifyingCount?'':'No qualifying placement; no fallback is selected.'}`;
    host.append(node('p',`${current.semantics} Ranking objective: ${metric.label}. Negative means less; the unchanged proposal is always included.`));
    if(!current.sourceAffected.existing&&!current.sourceAffected.proposal)host.append(node('p',`The unchanged source contains no ${current.query.study.surface} cells. These capacities are declared hypotheses; source observations have not constrained them. The original result is identical across these rates. They affect a variant only where ${current.query.study.surface} is present.`, 'placement-absent-note'));
    const table=node('table','','placement-table'),thead=node('thead',''),tr=node('tr','');for(const t of ['Edited cells',`Worst additional ${metric.label} (${metric.unit})`,'Local targets','Inspect'])tr.append(node('th',t));thead.append(tr);table.append(thead);
    const body=node('tbody','');for(const plan of current.plans){const row=node('tr','');row.dataset.cells=plan.cells.join(',');const best=current.best.some(c=>c.join(',')===plan.cells.join(','));row.append(node('td',(plan.cells.map(i=>name(p,i)).join(' + ')||'No change')+(best?' · best for this objective':'')),node('td',number(plan.score)),node('td',plan.localTargets.meets?'Meets all':'Does not meet'));const action=node('td',''),b=node('button','Inspect');b.type='button';b.addEventListener('click',()=>inspect(plan,p,current));action.append(b);row.append(action);body.append(row);}table.append(body);
    const details=node('details','');details.append(node('summary',`Inspect all ${current.plans.length} enumerated placements`));const wrap=node('div','','placement-table-wrap');wrap.append(table);details.append(wrap);host.append(details);
    const calculation=node('details','');calculation.append(node('summary','Calculation details'),node('p',`Numerical tie guard: ${current.tieGuard} ${metric.unit}. Conservative work estimate: ${current.cellStepUpperBound.toLocaleString()} cell-steps. This tolerance groups near-equal numerical scores; it is not a physical uncertainty interval.`));host.append(calculation);
    const detail=node('div','','placement-detail');detail.id='placement-detail';host.append(detail);inspect(current.plans.find(p=>p.localTargets.meets)??current.plans[0],p,current);
    const finer=node('button','Check finer calculation intervals');finer.id='placement-resolution-run';finer.type='button';
    const sensitivity=node('section','');sensitivity.id='placement-resolution-results';sensitivity.setAttribute('aria-live','polite');host.append(finer,sensitivity);
    finer.addEventListener('click',()=>{
      const request=generation;finer.disabled=true;sensitivity.textContent='Checking the same layouts and fixed original hypotheses…';
      setTimeout(()=>{try{if(request!==generation||placementSignature(getProject())!==current.sourceSignature)return;
        const result=comparePlacementResolution(p,current.query);
        if(request===generation&&placementSignature(getProject())===current.sourceSignature)resolutionView(result,p,sensitivity);
      }catch(error){if(request===generation){sensitivity.textContent=error.message;sensitivity.dataset.state='error';}}finally{finer.disabled=false;}},20);
    });
  }
  for(const id of ['placement-surface','placement-count','placement-objective','placement-subset'])$(id).addEventListener('change',()=>{invalidate();drawEligibility();});
  for(const id of ['placement-target-cells','placement-target-limit','placement-target-basis'])$(id).addEventListener('input',()=>invalidate());
  $('placement-clear').addEventListener('click',()=>{eligible.clear();invalidate();drawEligibility();});
  $('placement-sealed').addEventListener('click',()=>{const cells=getProject().proposal.flatMap((c,i)=>c.surface==='sealed'&&c.surface!==$('placement-surface').value?[i]:[]);if(cells.length>12){notice('More than 12 sealed cells: choose an explicit smaller eligible set.');return;}eligible=new Set(cells);invalidate();drawEligibility();});
  $('placement-run').addEventListener('click',()=>{
    const p=structuredClone(getProject());let targets;try{targets=readTargets(p);}catch(error){invalidate(error.message);notice(error.message);return;}const query={targets,eligibleCells:[...eligible],maxEdits:Number($('placement-count').value),surface:$('placement-surface').value,metric:$('placement-objective').value,subset:$('placement-subset').value};
    const request=++generation;$('placement-run').disabled=true;
    setTimeout(()=>{try{if(request!==generation)return;const next=comparePlacements(p,query);if(request!==generation||placementSignature(getProject())!==next.sourceSignature)return;report=next;show(report,p);}catch(error){invalidate(error.message);$('placement-status').dataset.state='error';notice(error.message);}finally{$('placement-run').disabled=false;}},20);
  });
  function refresh(){const source=placementSignature(getProject());if(source!==lastSource){lastSource=source;invalidate('Source changed; compare the current eligible set again.');}drawEligibility();}
  return {refresh};
}

import { comparePlacementTradeoffs } from './placement-tradeoffs.js';
import {comparePlacementResolution} from './placement-resolution.js';
import { comparePlacements, adoptPlacement, placementSignature, PLACEMENT_METRICS } from './placement-search.js';
import { SURFACES } from './core.js';
import { DEFAULT_STUDY } from './study-contract.js';
import {DRAINING_LAYER_SCHEMA} from './draining-infiltration.js';
import {serializePlacementInvestigation,parsePlacementInvestigation,PLACEMENT_FILE_LIMIT} from './placement-investigation.js';

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
    <fieldset style="min-width:0"><legend>Optional finite receiving layer</legend>
    <label><input id="placement-layer-enabled" type="checkbox"> Compare a layer that can fill and drain</label>
    <div id="placement-layer-inputs" hidden>
    <label class="input-label">Applies to every cell of this surface<select id="placement-layer-surface"><option value="garden">Rain garden</option><option value="turf">Turf</option><option value="sealed">Sealed paving</option></select></label>
    <div class="input-pair"><label class="input-label">Total storage depth (mm)<input id="placement-layer-capacity" type="number" min="0" max="10000" step="any" value="5"></label><label class="input-label">Water already in the layer (mm)<input id="placement-layer-initial" type="number" min="0" max="10000" step="any" value="0"></label></div>
    <label class="input-label">Drainage coefficient (per hour)<input id="placement-layer-drainage" type="number" min="0" max="100" step="any" value="1"></label>
    <label class="input-label">Measurement source or explicit hypothetical basis<input id="placement-layer-source" type="text" maxlength="500"></label>
    <p class="mini-note">The same declared layer applies in every compared map. A full layer limits infiltration; drainage frees space. Use all declared rates: evidence fitted with unlimited receiving space cannot calibrate this model. This assumption belongs to the placement comparison; applying surface edits does not establish a measured soil property.</p></div></fieldset>
    <label class="input-label">Open original placement inputs<input id="placement-open" type="file" accept=".json,application/json"></label>
    <fieldset style="min-width:0"><legend>Optional local peak-depth targets</legend>
    <label class="input-label">Target cells (for example C2, D2; blank means none)<input id="placement-target-cells" type="text" maxlength="100"></label>
    <label class="input-label">Maximum peak-depth change at every target (mm)<input id="placement-target-limit" type="number" min="-1000" max="1000" step="any" value="0"></label>
    <label class="input-label">Declared reason for this target<input id="placement-target-basis" type="text" maxlength="500"></label>
    <p class="mini-note">Relative to the current proposal, for every retained soil hypothesis. Zero requires no modeled increase; −1 requests at least 1 mm reduction. Peaks may occur at different times. This is a decision condition, not an access or safety threshold.</p></fieldset>
    <fieldset style="min-width:0"><legend>Optional within-window wet-duration goal</legend>
    <label class="input-label">Duration target cells (for example C2; blank means none)<input id="placement-duration-cells" type="text" maxlength="100"></label>
    <label class="input-label">Count minutes strictly above this modeled depth (mm)<input id="placement-duration-threshold" type="number" min="0.001" max="1000" step="any" value="5"></label>
    <label class="input-label">Maximum additional wet minutes at every target<input id="placement-duration-limit" type="number" min="-720" max="720" step="any" value="0"></label>
    <label class="input-label">Declared threshold and goal basis<input id="placement-duration-basis" type="text" maxlength="500"></label>
    <p class="mini-note">Negative requests a reduction from the current proposal, for every retained rate. Counts cover only the modeled event, with linear interpolation between saved solver snapshots. Still-wet endpoints remain visible; this is not total drawdown time or a safety/access threshold.</p></fieldset>
    <fieldset style="min-width:0"><legend>Optional cost and environmental tradeoffs</legend>
    <label><input id="placement-tradeoff-enabled" type="checkbox"> Compare cost and multiple objectives together</label>
    <div id="placement-tradeoff-inputs" hidden><p class="mini-note">Declare additive costs for the selected cell edits. The unchanged proposal costs zero. Shared setup costs, discounts and maintenance costs are omitted unless included in your declaration.</p>
    <div class="input-pair"><label class="input-label">Common cost unit<input id="placement-cost-unit" maxlength="40" placeholder="For example USD or work hours"></label><label class="input-label">Maximum total cost<input id="placement-budget" type="number" min="0" max="1000000000000" step="any"></label></div>
    <label class="input-label">Cost source or explicit assumption<input id="placement-cost-basis" maxlength="240"></label><fieldset id="placement-tradeoff-metrics" style="min-width:0"><legend>Environmental objectives (smaller additional change is better)</legend></fieldset><div id="placement-cell-costs"></div></div></fieldset>
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
  let eligible=new Set(),generation=0,openRequest=0,lastSource='',report=null,loadedStudy=null;
  const name=(p,i)=>`${String.fromCharCode(65+i%p.width)}${Math.floor(i/p.width)+1}`;
  const declaredCosts=new Map();
  for(const [key,m] of Object.entries(PLACEMENT_METRICS)){
    const label=node('label',m.label+' ('+m.unit+') '),input=document.createElement('input');
    input.type='checkbox';input.value=key;input.checked=['exitLiters','maxDepthMm'].includes(key);
    label.prepend(input);label.style.display='block';$('placement-tradeoff-metrics').append(label);input.addEventListener('change',()=>invalidate());
  }
  function drawCostInputs(p){
    const host=$('placement-cell-costs');host.replaceChildren();
    for(const cellIndex of [...eligible].sort((a,b)=>a-b)){
      const label=node('label',name(p,cellIndex)+' edit cost','input-label'),input=document.createElement('input');
      input.type='number';input.min='0';input.max='1000000000000';input.step='any';input.dataset.costCell=String(cellIndex);input.value=declaredCosts.get(cellIndex)??'';
      input.addEventListener('input',()=>{declaredCosts.set(cellIndex,input.value);invalidate();});label.append(input);host.append(label);
    }
  }
  function readTradeoffs(){
    if(!$('placement-tradeoff-enabled').checked)return null;
    const budget=$('placement-budget').value.trim();if(!budget)throw Error('Declare an explicit cost budget');
    return {metrics:[...$('placement-tradeoff-metrics').querySelectorAll('input:checked')].map(e=>e.value),costUnit:$('placement-cost-unit').value,budget:Number(budget),cellCosts:[...eligible].map(cellIndex=>{
      const value=declaredCosts.get(cellIndex)?.trim();if(!value)throw Error('Declare the edit cost for every eligible cell');return {cellIndex,cost:Number(value),source:$('placement-cost-basis').value};
    })};
  }
  function showTradeoffs(current,p,host){
    const trade=current.tradeoffs;if(!trade)return;
    const section=node('section','');section.id='placement-tradeoff-results';section.dataset.frontierCount=String(trade.frontier.length);
    section.append(node('h3','Cost and environmental tradeoffs'),node('p',trade.semantics),node('p',trade.frontier.length+' nondominated layouts; '+trade.feasibleCount+' meet budget and local targets. Budget: '+number(trade.declaration.budget)+' '+trade.declaration.costUnit+'. '+(trade.frontier.length?'No single winner is chosen.':'No feasible layout; no fallback is selected.')),node('p','A layout is dominated only when another feasible layout is no worse on every selected coordinate and strictly better on at least one. Equal vectors remain alternatives. This uses computed numbers without a dominance tolerance; tiny numerical differences are not established physical differences.'));
    const table=node('table','','placement-table'),head=node('tr','');
    for(const label of ['Edits','Cost ('+trade.declaration.costUnit+')',...trade.declaration.metrics.map(key=>'Worst additional '+PLACEMENT_METRICS[key].label+' ('+PLACEMENT_METRICS[key].unit+')'),'Tradeoff status','Inspect'])head.append(node('th',label));
    const thead=node('thead','');thead.append(head);table.append(thead);const body=node('tbody','');
    const ordered=[...trade.plans].sort((a,b)=>Number(trade.frontier.includes(b.index))-Number(trade.frontier.includes(a.index))||a.index-b.index);
    for(const plan of ordered){
      const row=node('tr','');row.dataset.cells=plan.cells.join(',');
      const classification=plan.rejection==='declared-targets'?'Outside local targets':plan.rejection==='declared-budget'?'Over budget':trade.frontier.includes(plan.index)?'Nondominated':'Dominated';row.dataset.tradeoffStatus=classification;
      row.append(node('td',plan.cells.map(i=>name(p,i)).join(' + ')||'No change'));for(const coordinate of plan.coordinates)row.append(node('td',number(coordinate)));row.append(node('td',classification));
      const cell=node('td',''),button=node('button','Inspect');button.type='button';button.addEventListener('click',()=>inspect(current.plans[plan.index],p,current));cell.append(button);row.append(cell);body.append(row);
    }
    table.append(body);const wrap=node('div','','placement-table-wrap');wrap.append(table);section.append(wrap);host.append(section);
  }
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
    drawCostInputs(p);
    const study=loadedStudy??p.infiltrationStudy??DEFAULT_STUDY;
    $('placement-study').textContent=`${loadedStudy?'Loaded placement':'Saved'} ${study.surface} rates: ${study.ratesMmHr.join(', ')} mm/h. Evidence scenario: ${study.target}. ${$('placement-layer-enabled').checked?'The complete declared rate family is used; original readings have not calibrated this receiving layer.':'Support is evaluated once on this unchanged source, never refitted to a hypothetical layout.'}`;
  }
  function readLayer() {
    if(!$('placement-layer-enabled').checked)return null;
    const amount=id=>{const value=$(id).value.trim();if(!value)throw Error('Enter every receiving-layer amount explicitly');return Number(value);};
    return {schema:DRAINING_LAYER_SCHEMA,surface:$('placement-layer-surface').value,
      capacityMm:amount('placement-layer-capacity'),initialStoredMm:amount('placement-layer-initial'),
      drainagePerHour:amount('placement-layer-drainage'),source:$('placement-layer-source').value};
  }
  function loadInputs(input) {
    const {project:p,query:q,tradeoffs:t}=input;
    if(q.targets.some(x=>x.maxPeakChangeMm!==q.targets[0].maxPeakChangeMm||x.basis!==q.targets[0].basis))
      throw Error('This panel requires one common peak target and basis; keep distinct targets in their original investigation');
    if(t&&t.cellCosts.some(x=>x.source!==t.cellCosts[0].source))
      throw Error('This panel requires one common cost basis; keep distinct cost sources in their original investigation');
    replaceProject(p);loadedStudy=structuredClone(q.study);eligible=new Set(q.eligibleCells);
    for(const [id,value] of Object.entries({'placement-surface':q.surface,'placement-count':q.maxEdits,'placement-objective':q.metric,'placement-subset':q.subset,
      'placement-target-cells':q.targets.map(t=>name(p,t.cellIndex)).join(', '),'placement-target-limit':q.targets[0]?.maxPeakChangeMm??0,'placement-target-basis':q.targets[0]?.basis??'',
      'placement-duration-cells':q.durationGoal?.cellIndices.map(i=>name(p,i)).join(', ')??'','placement-duration-threshold':q.durationGoal?.thresholdMm??5,
      'placement-duration-limit':q.durationGoal?.maxAdditionalMinutes??0,'placement-duration-basis':q.durationGoal?.basis??''}))$(id).value=String(value);
    $('placement-layer-enabled').checked=Boolean(q.drainingLayer);$('placement-layer-inputs').hidden=!q.drainingLayer;
    if(q.drainingLayer)for(const [id,value] of Object.entries({'placement-layer-surface':q.drainingLayer.surface,'placement-layer-capacity':q.drainingLayer.capacityMm,
      'placement-layer-initial':q.drainingLayer.initialStoredMm,'placement-layer-drainage':q.drainingLayer.drainagePerHour,'placement-layer-source':q.drainingLayer.source}))$(id).value=String(value);
    $('placement-tradeoff-enabled').checked=Boolean(t);$('placement-tradeoff-inputs').hidden=!t;declaredCosts.clear();
    if(t){for(const row of t.cellCosts)declaredCosts.set(row.cellIndex,String(row.cost));$('placement-cost-unit').value=t.costUnit;$('placement-budget').value=String(t.budget);$('placement-cost-basis').value=t.cellCosts[0].source;
      for(const box of $('placement-tradeoff-metrics').querySelectorAll('input'))box.checked=t.metrics.includes(box.value);}
    invalidate('Original placement inputs opened. Compare again to recompute every layout.');drawEligibility();notice('Original project, placement choices and receiving assumptions opened; results will be recomputed.');
  }
  function parseCellLabels(p,raw) {
    return raw.split(',').map(label=>{
      const match=/^([A-X])([1-9][0-9]?)$/.exec(label.trim().toUpperCase());
      if(!match)throw Error('Use target cell labels such as C2, D2');
      const col=match[1].charCodeAt(0)-65,row=Number(match[2])-1;
      if(col>=p.width||row>=p.height)throw Error('Target cell is outside this project');
      return row*p.width+col;
    });
  }
  function readTargets(p) {
    const raw=$('placement-target-cells').value.trim();if(!raw)return [];
    const limit=$('placement-target-limit').value.trim();if(!limit)throw Error('Enter a local peak-change limit');
    return parseCellLabels(p,raw).map(cellIndex=>({cellIndex,maxPeakChangeMm:Number(limit),basis:$('placement-target-basis').value}));
  }
  function readDurationGoal(p) {
    const raw=$('placement-duration-cells').value.trim();if(!raw)return null;
    const threshold=$('placement-duration-threshold').value.trim(),limit=$('placement-duration-limit').value.trim();
    if(!threshold||!limit)throw Error('Enter an explicit duration threshold and change limit');
    return {cellIndices:parseCellLabels(p,raw),thresholdMm:Number(threshold),maxAdditionalMinutes:Number(limit),basis:$('placement-duration-basis').value};
  }
  function appendDurationChecks(host,checks,p) {
    const conditions=x=>`above threshold at start: ${x.aboveAtStart?'yes':'no'}; at modeled end: ${x.aboveAtEnd?'yes':'no'}`;
    const intervals=x=>x.intervals.length?x.intervals.map(i=>`${number(i.startMinute)}–${number(i.endMinute)} min`).join('; '):'None';
    for(const check of checks){
      const block=node('div','','placement-duration-witnesses');block.style.overflowWrap='anywhere';
      block.append(node('h4',`${name(p,check.cellIndex)}: minutes above ${number(check.thresholdMm)} mm within 0–${number(p.weather.durationMinutes)} min`),node('p',`Change limit ${number(check.maxAdditionalMinutes)} min; worst change ${number(check.worstChangeMinutes)} min. Basis: ${check.basis}`));
      for(const w of check.witnesses){
        block.append(node('p',`${w.rateMmHr} mm/h: ${number(w.current.minutesAbove)} → ${number(w.proposed.minutesAbove)} wet min; change ${number(w.minutesChange)} min — ${w.meets?'meets goal':'exceeds goal by '+number(w.excessMinutes)+' min'}.`));
        block.append(node('p',`Current proposal ${conditions(w.current)}. Candidate ${conditions(w.proposed)}. A wet endpoint does not establish when wetness began or will end.`));
        const times=node('details','');times.append(node('summary',`Inspect ${w.rateMmHr} mm/h within-window wet intervals`),node('p',`Current proposal: ${intervals(w.current)}.`),node('p',`Candidate: ${intervals(w.proposed)}.`));block.append(times);
      }host.append(block);
    }
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
    for(const c of plan.candidates){const card=node('article','','study-candidate');card.append(node('h4',`${c.rateMmHr} mm/h ${current.query.study.surface}`));for(const [key,m] of Object.entries(PLACEMENT_METRICS)){const v=c.metrics[key];card.append(node('p',`${m.label}: ${number(v.current)} → ${number(v.proposed)} ${m.unit}; change ${number(v.delta)}.`));}
      if(c.drainingLayer)for(const [side,label] of [['current','Current proposal'],['proposed','Candidate']]){const r=c.drainingLayer[side];card.append(node('p',`${label} receiving layer: ${r.affectedCellCount} cells; initial ${number(r.initialLiters)} L, retained ${number(r.retainedLiters)} L, drained ${number(r.drainedLiters)} L; accepted ${number(r.infiltratedLiters)} L from the surface. Receiver balance error ${number(r.balanceErrorLiters)} L.`));}
      perRate.append(card);}detail.append(perRate);
    const local=node('details','');local.append(node('summary',`${plan.worseningCells.length} cells deepen under at least one retained rate`));for(const c of plan.worseningCells)local.append(node('p',`${name(p,c.cellIndex)}: ${number(c.min)} to ${number(c.max)} mm peak-depth change.`));detail.append(local);
    if(current.query.targets.length||current.query.durationGoal){
      const targets=node('div','','placement-target-witnesses');targets.style.overflowWrap='anywhere';targets.append(node('h4',plan.meetsAllTargets?'Meets every local target':'Does not meet every local target'));
      for(const check of plan.localTargets.checks){
        targets.append(node('p',`${name(p,check.cellIndex)}: limit ${number(check.maxPeakChangeMm)} mm; worst change ${number(check.worstChangeMm)} mm. Basis: ${check.basis}`));
        for(const w of check.witnesses)targets.append(node('p',`${w.rateMmHr} mm/h hypothesis: ${number(w.changeMm)} mm change — ${w.meets?'meets target':'exceeds target by '+number(w.excessMm)+' mm'}.`));
      }appendDurationChecks(targets,plan.durationTargets.checks,p);detail.append(targets);
    }
    const costPlan=current.tradeoffs?.plans.find(row=>row.cells.join(',')===plan.cells.join(','));
    if(costPlan)detail.append(node('p','Declared edit cost: '+number(costPlan.cost)+' '+current.tradeoffs.declaration.costUnit+'. '+(costPlan.feasible?'Within budget and local targets.':'Outside declared budget or local targets.')));
    if(plan.cells.length){
      const adopt=node('button','Apply these hypothetical surface edits','primary');adopt.type='button';adopt.id='placement-adopt';adopt.disabled=current.adoptionBlockedByProposalEvidence||!plan.meetsAllTargets||(costPlan&&!costPlan.feasible);
      adopt.addEventListener('click',()=>{try{if(report!==current)throw Error('Inputs changed; compare placements again.');if(costPlan&&!costPlan.feasible)throw Error('This layout does not meet the declared budget and targets');const next=adoptPlacement(getProject(),current.query,plan.cells,current.sourceSignature);replaceProject(next);notice('Hypothetical proposal edits applied; retained source readings were not changed.');}catch(error){notice(error.message);invalidate(error.message);}});
      detail.append(adopt);
      if(current.adoptionBlockedByProposalEvidence)detail.append(node('p','This workspace has observations assigned to the proposal. Keep those readings with their observed geometry; this alternative remains inspectable but cannot replace that observed proposal.','mini-note'));
    }
  }
  function resolutionView(result,p,host) {
    host.replaceChildren();host.dataset.state=result.status;
    if(result.status!=='compared'){
      const reasons={'minimum-step':'Already at the supported one-minute minimum; no finer comparison was run.','work-limit':'The combined calculation exceeds the 3 million combined model/exposure work limit. Choose fewer eligible cells, a shorter event or fewer declared hypotheses; no layouts were silently removed.'};
      host.append(node('p',reasons[result.status]??`Source comparison refused: ${result.status}.`));return;
    }
    host.append(node('h3','Sensitivity to calculation interval'),node('p',result.semantics),node('p',`Fixed original support: ${result.ratesMmHr.join(', ')} mm/h; original evidence subset: ${result.sourceSupport.subset}. Combined work: ${result.workDetail.modelCellSteps.toLocaleString()} model cell-steps + ${result.workDetail.exposureCellSegments.toLocaleString()} exposure cell-segments = ${result.estimatedCellSteps.toLocaleString()} total.`));
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
        appendDurationChecks(item,at.durationChecks,p);
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
    if(current.query.drainingLayer){const r=current.query.drainingLayer;host.append(node('p',`Receiving layer on ${SURFACES[r.surface].label}: ${number(r.capacityMm)} mm total storage, ${number(r.initialStoredMm)} mm initially stored, drainage ${number(r.drainagePerHour)} per hour. Basis: ${r.source}`,'placement-layer-basis'));}
    const save=node('button','Download original placement inputs');save.id='placement-save';save.type='button';
    save.addEventListener('click',()=>{try{if(report!==current||placementSignature(getProject())!==current.sourceSignature)throw Error('Inputs changed; compare again before saving');
      const text=serializePlacementInvestigation(p,current.query,current.tradeoffs?.declaration??null),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download='placement-investigation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){notice(error.message);}});host.append(save);
    if(!current.sourceAffected.existing&&!current.sourceAffected.proposal)host.append(node('p',`The unchanged source contains no ${current.query.study.surface} cells. These capacities are declared hypotheses; source observations have not constrained them. The original result is identical across these rates. They affect a variant only where ${current.query.study.surface} is present.`, 'placement-absent-note'));
    showTradeoffs(current,p,host);
    const table=node('table','','placement-table'),thead=node('thead',''),tr=node('tr','');for(const t of ['Edited cells',`Worst additional ${metric.label} (${metric.unit})`,'Local targets','Inspect'])tr.append(node('th',t));thead.append(tr);table.append(thead);
    const body=node('tbody','');for(const plan of current.plans){const row=node('tr','');row.dataset.cells=plan.cells.join(',');const best=current.best.some(c=>c.join(',')===plan.cells.join(','));row.append(node('td',(plan.cells.map(i=>name(p,i)).join(' + ')||'No change')+(best?' · best for this objective':'')),node('td',number(plan.score)),node('td',plan.meetsAllTargets?'Meets all':'Does not meet'));const action=node('td',''),b=node('button','Inspect');b.type='button';b.addEventListener('click',()=>inspect(plan,p,current));action.append(b);row.append(action);body.append(row);}table.append(body);
    const details=node('details','');details.append(node('summary',`Inspect all ${current.plans.length} enumerated placements`));const wrap=node('div','','placement-table-wrap');wrap.append(table);details.append(wrap);host.append(details);
    const calculation=node('details','');calculation.append(node('summary','Calculation details'),node('p',`Numerical tie guard: ${current.tieGuard} ${metric.unit}. Conservative work estimate: ${current.workDetail.modelCellSteps.toLocaleString()} model cell-steps + ${current.workDetail.exposureCellSegments.toLocaleString()} exposure cell-segments = ${current.cellStepUpperBound.toLocaleString()} total. This tolerance groups near-equal numerical scores; it is not a physical uncertainty interval.`));host.append(calculation);
    const detail=node('div','','placement-detail');detail.id='placement-detail';host.append(detail);inspect(current.tradeoffs?.frontier.length?current.plans[current.tradeoffs.frontier[0]]:current.plans.find(p=>p.meetsAllTargets)??current.plans[0],p,current);
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
  for(const id of ['placement-target-cells','placement-target-limit','placement-target-basis','placement-duration-cells','placement-duration-threshold','placement-duration-limit','placement-duration-basis'])$(id).addEventListener('input',()=>invalidate());
  $('placement-tradeoff-enabled').addEventListener('change',()=>{$('placement-tradeoff-inputs').hidden=!$('placement-tradeoff-enabled').checked;invalidate();});
  $('placement-layer-enabled').addEventListener('change',()=>{$('placement-layer-inputs').hidden=!$('placement-layer-enabled').checked;invalidate();drawEligibility();});
  for(const id of ['placement-layer-surface','placement-layer-capacity','placement-layer-initial','placement-layer-drainage','placement-layer-source'])$(id).addEventListener('input',()=>invalidate());
  $('placement-open').addEventListener('change',async()=>{
    const file=$('placement-open').files?.[0];if(!file)return;
    const request=++openRequest;invalidate('Opening original placement inputs…');const sourceGeneration=generation;
    try{
      if(file.size>PLACEMENT_FILE_LIMIT)throw Error('Placement investigation exceeds the 5 MiB input limit');
      const text=await file.text();
      // A later intake, source edit or choice owns the interface now. An old
      // asynchronous read must not replace that newer project or declarations.
      if(request!==openRequest||sourceGeneration!==generation)return;
      loadInputs(parsePlacementInvestigation(text));
    }catch(error){if(request===openRequest&&sourceGeneration===generation){notice(error.message);invalidate(error.message);}}
    finally{if(request===openRequest)$('placement-open').value='';}
  });
  for(const id of ['placement-cost-unit','placement-budget','placement-cost-basis'])$(id).addEventListener('input',()=>invalidate());
  $('placement-clear').addEventListener('click',()=>{eligible.clear();invalidate();drawEligibility();});
  $('placement-sealed').addEventListener('click',()=>{const cells=getProject().proposal.flatMap((c,i)=>c.surface==='sealed'&&c.surface!==$('placement-surface').value?[i]:[]);if(cells.length>12){notice('More than 12 sealed cells: choose an explicit smaller eligible set.');return;}eligible=new Set(cells);invalidate();drawEligibility();});
  $('placement-run').addEventListener('click',()=>{
    const p=structuredClone(getProject());let targets,durationGoal,tradeoffs,drainingLayer;try{targets=readTargets(p);durationGoal=readDurationGoal(p);tradeoffs=readTradeoffs();drainingLayer=readLayer();}catch(error){invalidate(error.message);notice(error.message);return;}const query={targets,durationGoal,eligibleCells:[...eligible],maxEdits:Number($('placement-count').value),surface:$('placement-surface').value,metric:$('placement-objective').value,subset:$('placement-subset').value,...(loadedStudy?{study:loadedStudy}:{}),...(drainingLayer?{drainingLayer}:{})};
    const request=++generation;$('placement-run').disabled=true;
    setTimeout(()=>{try{if(request!==generation)return;const next=tradeoffs?comparePlacementTradeoffs(p,query,tradeoffs):comparePlacements(p,query);if(request!==generation||placementSignature(getProject())!==next.sourceSignature)return;report=next;show(report,p);}catch(error){invalidate(error.message);$('placement-status').dataset.state='error';notice(error.message);}finally{$('placement-run').disabled=false;}},20);
  });
  function refresh(){const source=placementSignature(getProject());if(source!==lastSource){lastSource=source;loadedStudy=null;invalidate('Source changed; compare the current eligible set again.');}drawEligibility();}
  return {refresh};
}

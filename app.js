import { mountPondingPanel } from './ponding-panel.js';
import { SURFACES, makeExample, validateProject, compare, depthAtMinute, chooseNextObservation, chooseInfiltrationObservation } from './core.js';
import { evidenceControls, mountInfiltrationPanel } from './infiltration-panel.js';
import { mountInterventionPanel } from './intervention-panel.js';
import { mountTerrainImport } from './terrain-panel.js';
import { mountObservationImport } from './observation-import-panel.js';
import { mountOutletEvidence } from './outlet-evidence-panel.js';
import { mountEventChallengePanel } from './event-challenge-panel.js';
import { mountLocalWaterBudget } from './local-water-budget-panel.js';
import { mountRainTrace } from './rain-trace-panel.js';
const $ = id => document.getElementById(id);
const storeKey = 'experimental-earth-site-v1';
let project;
try { project = validateProject(JSON.parse(localStorage.getItem(storeKey))); }
catch { project = makeExample(); }
let brush = 'inspect';
let view = 'peak';
let results;
let toastTimeout;

function notice(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 3800);
}
function nameCell(index) { return `${String.fromCharCode(65 + index % project.width)}${Math.floor(index / project.width) + 1}`; }
function numeric(value) { return Number(value).toLocaleString('en-US',{maximumFractionDigits:1}); }
function readingNumber(value) { return Number(value).toLocaleString('en-US',{maximumSignificantDigits:6}); }
function safeText(value) { const s = document.createElement('span'); s.textContent=String(value); return s.innerHTML; }
function persist() {try {localStorage.setItem(storeKey,JSON.stringify(project));}catch {notice('Browser storage is unavailable. Export your project to retain it.');}}
function rerun() { results = compare(project); persist(); draw(); infiltrationPanel.refresh(); eventChallengePanel.refresh(); observationImporter.refresh(); interventionPanel.refresh(); outletEvidencePanel.refresh(); localWaterBudgetPanel.refresh(); rainTracePanel.refresh(); pondingPanel.refresh(); terrainImporter.refresh(); $('infiltration-reading').textContent='Compare assumed infiltration ranges to find a consequential missing material measurement.'; }
function byName(id, value) { const el=$(id); if (el) el.value=value; }
function syncForm() {
  byName('project-title', project.title);byName('rain', project.weather.rainMmHr);byName('storm', project.weather.stormMinutes);byName('duration', project.weather.durationMinutes);byName('cell-size', project.weather.cellSizeM);
  $('obs-minute').max = project.weather.durationMinutes;
  if (Number($('obs-minute').value)>project.weather.durationMinutes) $('obs-minute').value=project.weather.stormMinutes;
}
function applyBrush(target, index) {
  project.selectedIndex = index;
  if (brush !== 'inspect') {
    const cell = project[target][index];
    if (['sealed','turf','garden'].includes(brush)) cell.surface = brush;
    else if (brush==='raise'||brush==='lower') { delete cell.terrainSource; cell.elevationM = Number(Math.max(-10, Math.min(10, cell.elevationM + (brush==='raise'?0.025:-0.025))).toFixed(3)); }
    cell.provenance = 'manually edited hypothetical assumption';
  }
  rerun();
}
function gridInto(target, result) {
  const el=$(`${target}-grid`);el.style.gridTemplateColumns=`repeat(${project.width},minmax(0,1fr))`;const fragment=document.createDocumentFragment();
  for (let index=0;index<project[target].length;index++) {
    const cell=project[target][index];
    const mm=view==='peak'?result.peakDepthMm[index]:view==='final'?result.finalDepthMm[index]:0;
    const waterAlpha = view==='surface' ? 0 : Math.min(0.66,mm/50*0.65);
    const btn=document.createElement('button'); btn.type='button';btn.className=`cell ${index===project.selectedIndex?'selected':''}`;
    btn.setAttribute('aria-label',`${target} cell ${nameCell(index)}, ${SURFACES[cell.surface].label}, elevation ${numeric(cell.elevationM)} meters, modeled ${numeric(mm)} millimeters ${view} depth`);
    btn.style.background=SURFACES[cell.surface].color;
    btn.style.setProperty('--water-alpha',String(waterAlpha));
    btn.dataset.cellIndex=String(index);
    btn.dataset.grid=target;
    const depthLabel=view==='surface' ? `${Math.round(cell.elevationM*100)} cm` : `${numeric(mm)} mm`;
    btn.innerHTML=`<i class="water"></i><b>${nameCell(index)}</b><span>${depthLabel}</span>`;
    btn.addEventListener('click',()=>applyBrush(target,index));fragment.appendChild(btn);
  }
  el.replaceChildren(fragment);
}
function metric(title,a,b,unit,desirable='low') {
  const delta=b-a;
  let change=Math.abs(delta)<0.001?'No change':`${delta>0?'+':'−'}${numeric(Math.abs(delta))} ${unit} in proposal`;
  if(Math.abs(delta)>.001 && desirable!=='neutral')change+=` · ${delta<0?'less':'more'}`;
  return `<div class="metric"><div class="metric-label">${title}</div><div class="metric-columns"><div><small>Existing</small><strong>${numeric(a)}</strong></div><div><small>Proposal</small><strong>${numeric(b)}</strong></div></div><div class="metric-foot ${Math.abs(delta)<.001?'no-change':''}">${change}</div></div>`;
}
function chart() {
  const svg=$('chart');const w=700,h=215,left=48,right=12,top=18,bottom=26;
  const arr=[results.existing,results.proposal];
  const maximum=Math.max(1,...arr.flatMap(r=>r.snapshots.map(s=>s.storedLiters)));
  const duration=project.weather.durationMinutes;
  const xx=t=>left+(w-left-right)*t/duration;
  const yy=v=>top+(h-top-bottom)*(1-v/maximum);
  const gridlines=Array.from({length:5},(_,i)=>{
    const value=maximum*i/4, y=yy(value);
    return `<line x1="${left}" y1="${y}" x2="${w-right}" y2="${y}" stroke="#e8efec" stroke-width="1"/><text x="${left-8}" y="${y+4}" text-anchor="end">${numeric(value)}</text>`;
  }).join('');
  const paths=arr.map((r,i)=>`<path d="${r.snapshots.map((s,j)=>`${j?'L':'M'}${xx(s.minute).toFixed(2)},${yy(s.storedLiters).toFixed(2)}`).join(' ')}" fill="none" stroke="${i?'#248c7a':'#cc8965'}" stroke-width="3.5" stroke-linejoin="round"/>`).join('');
  const times=Array.from({length:5},(_,i)=>`<text x="${xx(duration*i/4)}" y="${h-7}" text-anchor="middle">${Math.round(duration*i/4)} min</text>`).join('');
  const stormX=xx(project.weather.stormMinutes);
  svg.innerHTML=`${gridlines}<line x1="${stormX}" y1="${top}" x2="${stormX}" y2="${h-bottom}" stroke="#a4b9ae" stroke-dasharray="4 5"/><text x="${Math.min(stormX+5,w-70)}" y="12">rain stops</text>${paths}${times}`;
}
function observations() {
  const n=project.selectedIndex; const base=project.existing[n]; const plan=project.proposal[n];
  $('obs-cell').value=nameCell(n);
  $('selection').innerHTML=`<div><strong>Selected ${nameCell(n)}</strong> · existing: ${SURFACES[base.surface].label}, ${numeric(base.elevationM)} m</div><div>proposed: ${SURFACES[plan.surface].label}, ${numeric(plan.elevationM)} m</div>`;
  $('terrain-origin').textContent = ['existing', 'proposal'].map(target => {
    const origin = project[target][n].terrainSource;
    return origin ? `${target}: ${origin.fileName}, line ${origin.line}; ${origin.elevationValue} ± ${origin.uncertaintyValue} ${origin.unit}; datum ${origin.datum}; ${origin.source}. Supplied uncertainty is retained, not propagated by the solver.` : `${target}: ${project[target][n].provenance}`;
  }).join(' | ');
  const suggested=chooseNextObservation(project,results);
  $('next-reading').textContent=`Potential next check: cell ${nameCell(suggested.cellIndex)} at ${suggested.minute} min · ${numeric(suggested.differenceMm)} mm simulated disagreement. Choose a safe measurement you have permission to make; this is a sensitivity cue, not a confidence score.`;
  const list=$('observation-list');list.replaceChildren();
  if(!project.observations.length){const p=document.createElement('p');p.className='muted';p.textContent='No measurements retained yet. A field reading can challenge either simulated alternative.';list.append(p);return;}
  for(let i=project.observations.length-1;i>=0;i--){
    const o=project.observations[i];const a=depthAtMinute(results.existing,o.cellIndex,o.minute),b=depthAtMinute(results.proposal,o.cellIndex,o.minute);
    const row=document.createElement('div');row.className='observation';
    const info=document.createElement('div');const main=document.createElement('strong');main.textContent=`${nameCell(o.cellIndex)} · ${o.minute} min · ${readingNumber(o.depthMm)} ± ${readingNumber(o.uncertaintyMm)} mm measured`;
    const body=document.createElement('small');body.textContent=`${o.source} · model depths at ${a.minute} min: existing ${numeric(a.depthMm)} mm (residual ${numeric(o.depthMm-a.depthMm)}), proposal ${numeric(b.depthMm)} mm (residual ${numeric(o.depthMm-b.depthMm)})`;
    info.append(main,body);
    if(o.tableSource){const origin=document.createElement('small');origin.className='table-origin';origin.textContent=`Supplied table: ${o.tableSource.fileName}, line ${o.tableSource.line} · original ${o.tableSource.depthValue} ± ${o.tableSource.uncertaintyValue} ${o.tableSource.unit}`;info.append(origin);}
    info.append(evidenceControls(o,rerun));const remove=document.createElement('button');remove.textContent='Remove';remove.type='button';remove.addEventListener('click',()=>{project.observations.splice(i,1);rerun();});row.append(info,remove);list.append(row);
  }
}
function draw() {
  const a=results.existing,b=results.proposal;
  $('site-area').textContent=`${project.width*project.weather.cellSizeM} × ${project.height*project.weather.cellSizeM} m site`;
  $('storm-total').textContent=`${numeric(a.rainLiters)} L hypothetical rain`;
  gridInto('existing',a);gridInto('proposal',b);
  $('metrics').innerHTML=metric('Water leaving modeled edges',a.exitLiters,b.exitLiters,'L')+metric('Water infiltrated',a.absorbedLiters,b.absorbedLiters,'L','high')+metric('Peak standing water',a.peakPondingLiters,b.peakPondingLiters,'L')+metric('Final stored water',a.storedLiters,b.storedLiters,'L')+metric('Cells ever ≥ 10 mm',a.cellsOver10Mm,b.cellsOver10Mm,'cells')+metric('Maximum cell water depth',a.maxDepthMm,b.maxDepthMm,'mm');
  $('balance').innerHTML=`<strong>Mass balance (both scenarios)</strong> · rain = infiltrated + edge outflow + water still stored. Rounding residual: existing ${numeric(Math.abs(a.massErrorLiters))} L; proposal ${numeric(Math.abs(b.massErrorLiters))} L. These are accounting checks, not field validation.`;
  chart();observations();
}
for(const [id,key] of [['rain','rainMmHr'],['storm','stormMinutes'],['duration','durationMinutes'],['cell-size','cellSizeM']]) {
  $(id).addEventListener('change',()=>{
    const prev=project.weather[key];const n=Number($(id).value);project.weather[key]=n;
    try {validateProject(project);rerun();}catch(err){project.weather[key]=prev;byName(id,prev);notice(err.message);}
  });
}
$('project-title').addEventListener('change',()=>{const n=$('project-title').value.trim();project.title=n||'Untitled site';rerun();});
$('brushes').addEventListener('click',event=>{const b=event.target.closest('[data-brush]');if(!b)return;brush=b.dataset.brush;for(const el of document.querySelectorAll('[data-brush]')){const active=el.dataset.brush===brush;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}});
$('map-view').addEventListener('change',()=>{view=$('map-view').value;draw();});
$('copy-existing').addEventListener('click',()=>{project.proposal=structuredClone(project.existing);rerun();notice('Proposal now matches the existing site.');});
$('reset').addEventListener('click',()=>{project=makeExample();syncForm();rerun();notice('Fictional example restored.');});
$('suggest').addEventListener('click',()=>{const s=chooseNextObservation(project,results);project.selectedIndex=s.cellIndex;$('obs-minute').value=s.minute;brush='inspect';for(const el of document.querySelectorAll('[data-brush]')){const active=el.dataset.brush==='inspect';el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}rerun();$('obs-depth').focus();});
$('suggest-infiltration').addEventListener('click',()=>{
  const button=$('suggest-infiltration');
  button.disabled=true;
  setTimeout(()=>{
    try{
      const check=chooseInfiltrationObservation(project,'proposal');
      if(!check) { notice('Under these storm settings, no evaluated infiltration uncertainty changes the modeled outcome.');return; }
      project.selectedIndex=check.cellIndex;
      brush='inspect';
      for (const el of document.querySelectorAll('[data-brush]')) {
        const active=el.dataset.brush==='inspect';
        el.classList.toggle('active',active);
        el.setAttribute('aria-pressed',String(active));
      }
      rerun();
      $('infiltration-reading').textContent='Check '+nameCell(check.cellIndex)+': the proposed '+SURFACES[check.surface].label.toLowerCase()+' cell was tested from '+check.rangeLowMmHr+'–'+check.rangeHighMmHr+' mm/h assumed infiltration. That single input changes modeled water remaining + exiting by '+numeric(check.impactLiters)+' L. Evaluated '+check.evaluatedCount+'/'+check.totalCount+' cells'+(check.evaluatedCount<check.totalCount?' (heuristic shortlist)':'')+'; these rates are invented example bounds, NOT tested soil properties or statistical confidence limits. A permitted infiltration observation here could help challenge the model. The measured-depth form below is for water depth, not infiltration-rate readings.';
      // This soil-rate sensitivity must not focus the unrelated water-depth form.
    }catch(error){notice('Sensitivity unavailable: '+error.message)}
    finally{button.disabled=false}
  },20);
});
$('observe-form').addEventListener('submit',event=>{
  event.preventDefault();
  const o={cellIndex:project.selectedIndex,minute:Number($('obs-minute').value),depthMm:Number($('obs-depth').value),uncertaintyMm:Number($('obs-uncertainty').value),source:$('obs-source').value.trim(),scenario:$('obs-scenario').value,use:$('obs-use').value};
  project.observations.push(o);
  try{validateProject(project);rerun();$('obs-depth').value='';$('obs-source').value='';notice(`Observation for ${nameCell(o.cellIndex)} retained locally.`);}catch(err){project.observations.pop();notice(err.message);}
});
$('export').addEventListener('click',()=>{
  const data=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(data);const link=document.createElement('a');link.href=url;link.download='experimental-earth-site.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  notice('Portable project downloaded.');
});
$('import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try {if(file.size>1_000_000)throw Error('Project file exceeds 1 MB limit');const parsed=JSON.parse(await file.text());validateProject(parsed);project=parsed;syncForm();rerun();notice('Validated project imported.');}
  catch(err){notice(`Import refused: ${err.message}`);}finally{event.target.value='';}
});
function prepareObservedReading(question) {
    project.selectedIndex = question.cellIndex;
    $('obs-minute').value = question.minute;
    $('obs-scenario').value = question.target;
    $('obs-use').value = 'challenge';
    $('obs-depth').value = '';
    $('obs-source').value = '';
    if (question.uncertaintyMm !== undefined) $('obs-uncertainty').value = question.uncertaintyMm;
    brush = 'inspect';
    for (const el of document.querySelectorAll('[data-brush]')) {
      const active = el.dataset.brush === 'inspect';
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    }
    rerun();
    $('obs-depth').focus();
    notice('Location, time and evidence role prepared. Previous depth/source draft cleared to avoid attaching it to a different reading. Enter an actual reading and source.');
}
const infiltrationPanel = mountInfiltrationPanel({ getProject: () => project, changed: rerun, notice, prepareReading: prepareObservedReading });
const observationImporter = mountObservationImport({ getProject: () => project,
  replaceProject: next => { project = next; syncForm(); rerun(); }, notice });
const eventChallengePanel = mountEventChallengePanel({ getProject: () => project });
const interventionPanel = mountInterventionPanel({ getProject: () => project, notice, prepareReading: prepareObservedReading });
const localWaterBudgetPanel = mountLocalWaterBudget({ getProject: () => project,
  selectCell: cellIndex => {
    brush = 'inspect';
    for (const el of document.querySelectorAll('[data-brush]')) {
      const active = el.dataset.brush === 'inspect';
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    }
    applyBrush('existing', cellIndex);
  },
});
const outletEvidencePanel = mountOutletEvidence({ getProject: () => project,
  replaceProject: next => { project = next; syncForm(); rerun(); }, notice });
const rainTracePanel = mountRainTrace({ getProject: () => project, changed: rerun, notice });
const terrainImporter = mountTerrainImport({ getProject: () => project,
  replaceProject: next => { project = next; syncForm(); rerun(); }, notice });
const pondingPanel = mountPondingPanel({getProject: () => project, getResults: () => results});
syncForm();rerun();

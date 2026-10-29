import { openSavedProject, mountSavedProjectRecovery } from './saved-project-recovery.js';
import {mountInvestigationNavigation} from './investigation-navigation.js';
import {arrowGridIndex} from './grid-keyboard.js';
import {mountHeatColumnSearch} from './heat-column-search-panel.js';
import {mountSharedObservedConnection} from './observed-shared-connection-panel.js';
import {mountMeasuredChange} from './measured-change-panel.js';
import {mountInfiltrationStorage} from './infiltration-storage-panel.js';
import {mountDrainingLayer} from './draining-layer-panel.js';
import {mountPondingConnectivity} from './ponding-connectivity-panel.js';
import {mountRootZone} from './root-zone-panel.js';
import {mountCooling} from './evaporative-cooling-panel.js';
import { mountTerrainSensitivity } from './terrain-sensitivity-panel.js';
import {mountHeatColumnQuestion} from './heat-column-question-panel.js';
import {mountHeatChannelQuestion} from './heat-channel-question-panel.js';
import { mountShadeHeat } from './shade-heat-panel.js';
import {mountSolarPanel} from './solar-panel.js';
import {mountSunPathPanel} from './solar-path-panel.js';
import {mountSurfaceHeat} from './surface-heat-panel.js';
import {mountLateralHeat} from './lateral-heat-panel.js';
import {mountHeatEvidence} from './surface-heat-evidence-panel.js';
import {mountHeatColumn} from './heat-column-panel.js';
import {mountHeatColumnEvidence} from './heat-column-evidence-panel.js';
import {mountHeatColumnTransfer} from './heat-column-transfer-panel.js';
import { mountStormIntensityPanel } from './storm-intensity-panel.js';
import { mountWettingFrontPanel } from './wetting-front-panel.js';
import { mountPressureHeadPanel } from './pressure-head-panel.js';
import { mountProposalComponents } from './proposal-components-panel.js';
import {mountThresholdEvidence} from './threshold-evidence-panel.js';
import {mountClockPanel} from './clock-panel.js';
import { mountPlacementSearch } from './placement-panel.js';
import { mountObservationMap } from './observation-map-panel.js';
import { interpolateDepth } from './infiltration-study.js';
import { mountInternalBarriers } from './internal-barrier-panel.js';
import { mountPondingPanel } from './ponding-panel.js';
import { mountRoutePondingPanel } from './route-ponding-panel.js';
import { SURFACES, makeExample, validateProject, compare, chooseNextObservation } from './core.js';
import { createRainComparisonComputation } from './rain-comparison-computation.js';
import {mountInfiltrationInquiry} from './infiltration-inquiry-panel.js';
import { checkProjectFileBytes, serializePortableProject, parsePortableProject } from './project-portability.js';
import { evidenceControls, mountInfiltrationPanel } from './infiltration-panel.js';
import { mountInterventionPanel } from './intervention-panel.js';
import { mountTerrainImport } from './terrain-panel.js';
import { mountObservationImport } from './observation-import-panel.js';
import { mountOutletEvidence } from './outlet-evidence-panel.js';
import { mountJointEvidence } from './joint-evidence-panel.js';
import { mountJointEventChallenge } from './joint-event-panel.js';
import { mountEventChallengePanel } from './event-challenge-panel.js';
import { mountLocalWaterBudget } from './local-water-budget-panel.js';
import { mountRainTrace } from './rain-trace-panel.js';
const $ = id => document.getElementById(id);
const savedProject = openSavedProject();
let project = savedProject.project;
const savedProjectRecovery = mountSavedProjectRecovery(savedProject);
let brush = 'inspect';
let view = 'peak';
let mapSnapshotMinute = 0;
let results;
let toastTimeout;
let browserSaveState = 'pending';
const saveFailureMessage = 'Browser save failed. Keep this tab open and export the current project to retain changes.';
let projectRevision = 0;
let projectImportSerial = 0;
let infiltrationInquiry;
let observationDraftProject = project;
let observationDraftCell = project.selectedIndex;
let observationDraftMinute = Number($('obs-minute').value);

const comparisonComputation = createRainComparisonComputation(() =>
  new Worker(new URL('./rain-comparison-worker.js', import.meta.url), { type: 'module' }));
// This schedules work; it does not change the model or its admitted input range.
// The ordinary 48-cell example requires 4,608 paired cell-steps. Larger jobs
// move both complete maintained runs off the UI thread, without a fallback.
const INLINE_COMPARISON_WORK = 10_000;
let comparisonGeneration = 0;
let completedComparison = null;
let comparisonState = 'initial';
let comparisonFocus = null;
let comparisonInert = [];
const comparisonStatus = document.createElement('section');
comparisonStatus.id = 'rain-comparison-status';
comparisonStatus.className = 'panel main-comparison-status';
comparisonStatus.hidden = true;
comparisonStatus.dataset.state = 'initial';
const comparisonMessage = document.createElement('p');
comparisonMessage.id = 'rain-comparison-message';
comparisonMessage.setAttribute('role', 'status');
comparisonMessage.setAttribute('aria-live', 'polite');
comparisonMessage.tabIndex = -1;
const comparisonActions = document.createElement('div');
comparisonActions.className = 'obs-actions';
const retryComparison = document.createElement('button');
retryComparison.type = 'button'; retryComparison.id = 'retry-rain-comparison';
retryComparison.className = 'subtle'; retryComparison.textContent = 'Retry comparison';
const restoreComparison = document.createElement('button');
restoreComparison.type = 'button'; restoreComparison.id = 'restore-rain-comparison';
restoreComparison.className = 'subtle'; restoreComparison.textContent = 'Restore last completed project';
comparisonActions.append(retryComparison, restoreComparison);
comparisonStatus.append(comparisonMessage, comparisonActions);
document.querySelector('.layout').before(comparisonStatus);
retryComparison.addEventListener('click', () => { try { rerun(); } catch (error) { notice(error.message); } });
restoreComparison.addEventListener('click', () => {
  if (!completedComparison) return;
  ++comparisonGeneration; ++projectRevision; ++projectImportSerial;
  comparisonComputation.cancel();
  project = structuredClone(completedComparison.project);
  results = completedComparison.results;
  try {
    syncForm(); retireRetargetedObservationDraft(); infiltrationInquiry?.retire();
    refreshObservationImporterForProject(true);
    draw(); refreshComparisonPanels(); persist();
    finishComparisonDisplay();
    $('project-title').focus({ preventScroll: true });
    notice('Last completed project restored.');
  } catch (error) {
    showComparisonDisplayFailure(error);
  }
});
window.addEventListener('pagehide', () => {
  ++comparisonGeneration; ++projectImportSerial; comparisonComputation.cancel();
});
window.addEventListener('pageshow', event => {
  // A back/forward-cache return must not leave a retired calculation pending.
  if (event.persisted && comparisonState !== 'ready') {
    try { rerun(); } catch (error) { notice(error.message); }
  }
});


function notice(message) {
  $('toast').textContent = browserSaveState === 'unsaved'
    ? [message, saveFailureMessage].filter(Boolean).join(' ')
    : message;
  $('toast').classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 3800);
}
function nameCell(index) { return `${String.fromCharCode(65 + index % project.width)}${Math.floor(index / project.width) + 1}`; }
function numeric(value) { return Number(value).toLocaleString('en-US',{maximumFractionDigits:1}); }
function readingNumber(value) { return Number(value).toLocaleString('en-US',{maximumSignificantDigits:6}); }
function safeText(value) { const s = document.createElement('span'); s.textContent=String(value); return s.innerHTML; }
function persist() {
  const previousState = browserSaveState;
  const saved = savedProject.save(project);
  savedProjectRecovery.refresh();
  browserSaveState = saved ? 'saved' : 'unsaved';
  const status = $('project-save-status');
  if (status.dataset.saveState !== browserSaveState) status.dataset.saveState = browserSaveState;
  const message = saved ? 'Saved in this browser.' : saveFailureMessage;
  if (status.textContent !== message) status.textContent = message;
  if (!saved) notice('');
  else if (previousState === 'unsaved') notice('Saved in this browser.');
  return saved;
}
function clearObservationDraft(reason) {
  if (!$('obs-depth').value && !$('obs-source').value) return;
  $('obs-depth').value = ''; $('obs-source').value = '';
  $('observation-draft-status').textContent = `Unsaved reading cleared: ${reason} Enter the actual reading and source for the current target.`;
}
function retireRetargetedObservationDraft() {
  const cellOrSiteChanged = project !== observationDraftProject || project.selectedIndex !== observationDraftCell;
  const minute = Number($('obs-minute').value);
  if (cellOrSiteChanged || minute !== observationDraftMinute) {
    clearObservationDraft(cellOrSiteChanged ? 'The selected cell or site changed.' : 'The observation time changed.');
  }
  observationDraftProject = project;
  observationDraftCell = project.selectedIndex;
  observationDraftMinute = minute;
}
function setComparisonInteraction(pending) {
  if (pending) {
    if (!comparisonInert.length) {
      const active = document.activeElement;
      const cell = active?.closest('#existing-grid .cell, #proposal-grid .cell');
      if (cell) comparisonFocus = { grid: cell.dataset.grid, index: cell.dataset.cellIndex };
      else comparisonFocus = null;
      const panels = [...document.querySelectorAll('.workspace, main > section.panel')]
        .filter(node => node !== comparisonStatus && !node.inert);
      comparisonInert = panels;
      if (panels.some(node => node.contains(active))) comparisonMessage.focus({ preventScroll: true });
      for (const node of panels) { node.inert = true; node.setAttribute('aria-busy', 'true'); }
    }
    $('map-view').disabled = true;
  } else {
    for (const node of comparisonInert) { node.inert = false; node.removeAttribute('aria-busy'); }
    comparisonInert = [];
    $('map-view').disabled = false;
  }
}
function setComparisonState(state, error) {
  comparisonState = state;
  comparisonStatus.dataset.state = state;
  comparisonStatus.dataset.generation = String(comparisonGeneration);
  comparisonStatus.hidden = state === 'ready';
  comparisonMessage.setAttribute('role', state === 'failed' ? 'alert' : 'status');
  retryComparison.hidden = state !== 'failed';
  restoreComparison.hidden = state === 'ready' || !completedComparison;
  if (state === 'ready') return;
  const retained = completedComparison
    ? 'The displayed comparison still belongs to the last completed project, “' + completedComparison.project.title + '”.'
    : 'No comparison has completed for this project yet.';
  comparisonMessage.textContent = state === 'loading'
    ? 'Reading the selected project. ' + retained
    : state === 'pending'
    ? 'Comparing the changed site. You can keep editing the site assumptions. ' + retained
    : 'The changed site could not be compared: ' + (error?.message || String(error)) + '. ' + retained;
  const saveStatus = $('project-save-status');
  saveStatus.dataset.saveState = 'comparison-' + state;
  saveStatus.textContent = 'These changes have not been saved in this browser. Export project retains the current input, or restore the last completed project.';
}
// Retire observation imports when their source project changes, before work
// becomes asynchronous. Retrying the same input must retain its original CSV.
let observationImporterContext = null;
let observationImporterProject = null;
function refreshObservationImporterForProject(force = false) {
  const context = JSON.stringify(project);
  if (!force && project === observationImporterProject && context === observationImporterContext) return;
  observationImporter.refresh();
  observationImporterContext = context;
  observationImporterProject = project;
}
function refreshComparisonPanels() {
  sharedObservedPanel.refresh(); measuredChangePanel.refresh(); drainingLayerPanel.refresh();
  infiltrationStoragePanel.refresh(); connectivityPanel.refresh(); rootZonePanel.refresh();
  coolingPanel.refresh(); infiltrationPanel.refresh(); clockPanel.refresh();
  eventChallengePanel.refresh(); interventionPanel.refresh();
  outletEvidencePanel.refresh(); jointEvidencePanel.refresh(); jointEventPanel.refresh();
  localWaterBudgetPanel.refresh(); rainTracePanel.refresh(); pondingPanel.refresh();
  routePondingPanel.refresh(); terrainImporter.refresh(); terrainSensitivity.refresh();
  observationMap.refresh(); internalBarriersPanel.refresh(); placementPanel.refresh();
  proposalComponentsPanel.refresh(); thresholdPanel.refresh(); solarPanel.refresh();
  sunPathPanel.refresh(); stormIntensityPanel.refresh(); wettingFrontPanel.refresh();
  pressureHeadPanel.refresh(); surfaceHeatPanel.refresh(); lateralHeatPanel.refresh();
  heatEvidencePanel.refresh(); heatColumnPanel.refresh(); heatColumnEvidencePanel.refresh();
  heatColumnSearchPanel.refresh(); heatColumnQuestionPanel.refresh();
  heatChannelQuestionPanel.refresh(); shadeHeatPanel.refresh();
}
function showComparisonDisplayFailure(error) {
  results = completedComparison?.results;
  setComparisonState('failed', error);
  setComparisonInteraction(true);
  comparisonMessage.textContent = 'The comparison display could not be refreshed: ' +
    error.message + '. The display may be incomplete. Retry or restore the last completed project.';
}
function finishComparisonDisplay() {
  const restoreFocus = comparisonFocus;
  const focusedStatus = comparisonStatus.contains(document.activeElement);
  comparisonFocus = null;
  setComparisonState('ready');
  setComparisonInteraction(false);
  if (focusedStatus && restoreFocus) {
    const cell = $(restoreFocus.grid + '-grid')
      .querySelector('[data-cell-index="' + restoreFocus.index + '"]');
    if (cell) cell.focus({ preventScroll: true });
    else $('project-title').focus({ preventScroll: true });
  } else if (focusedStatus) {
    $('project-title').focus({ preventScroll: true });
  }
}
function acceptComparison(nextResults, source, generation, revision) {
  if (generation !== comparisonGeneration || revision !== projectRevision) return;
  results = nextResults;
  try {
    draw(); refreshComparisonPanels();
  } catch (error) {
    // Rendering has its own failure state; a partly updated DOM is not described
    // as an unchanged completed view, and it remains unavailable for analysis.
    if (generation !== comparisonGeneration || revision !== projectRevision) return;
    showComparisonDisplayFailure(error);
    return;
  }
  if (generation !== comparisonGeneration || revision !== projectRevision) return;
  completedComparison = { project: source, results: nextResults };
  persist();
  finishComparisonDisplay();
}
function rerun() {
  // Invalidate before validation so a queued older response cannot become
  // eligible after a newer request is refused.
  const generation = ++comparisonGeneration, revision = ++projectRevision;
  comparisonComputation.cancel();
  try {
    validateProject(project);
    refreshObservationImporterForProject();
    retireRetargetedObservationDraft(); infiltrationInquiry?.retire();
    const source = structuredClone(project);
    const work = 2 * project.width * project.height *
      Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
    if (work <= INLINE_COMPARISON_WORK) {
      acceptComparison(compare(project), source, generation, revision);
      return;
    }
    setComparisonState('pending');
    setComparisonInteraction(true);
    comparisonComputation.compute(source).then(nextResults => {
      if (generation !== comparisonGeneration || revision !== projectRevision) return;
      try {
        acceptComparison(nextResults, source, generation, revision);
      } catch (error) {
        if (generation !== comparisonGeneration || revision !== projectRevision) return;
        showComparisonDisplayFailure(error);
      }
    }, error => {
      if (generation !== comparisonGeneration || revision !== projectRevision ||
          error?.code === 'superseded') return;
      setComparisonState('failed', error);
    });
  } catch (error) {
    setComparisonState('failed', error);
    setComparisonInteraction(true);
    throw error;
  }
}
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
    else if (brush==='raise'||brush==='lower') { delete cell.terrainSource; delete cell.rasterSource; cell.elevationM = Number(Math.max(-10, Math.min(10, cell.elevationM + (brush==='raise'?0.025:-0.025))).toFixed(3)); }
    cell.provenance = 'manually edited hypothetical assumption';
  }
  rerun();
}
function gridInto(target, result, snapshotIndex) {
  const el=$(`${target}-grid`);el.style.gridTemplateColumns=`repeat(${project.width},minmax(0,1fr))`;const fragment=document.createDocumentFragment();
  el.dataset.view = view;
  if (view === 'snapshot') el.dataset.minute = String(result.snapshots[snapshotIndex].minute);
  else delete el.dataset.minute;
  for (let index=0;index<project[target].length;index++) {
    const cell=project[target][index];
    const mm=view==='peak'?result.peakDepthMm[index]:view==='final'?result.finalDepthMm[index]:view==='snapshot'?result.snapshots[snapshotIndex].depthsMm[index]:0;
    const waterAlpha = view==='surface' ? 0 : Math.min(0.66,mm/50*0.65);
    const btn=document.createElement('button'); btn.type='button';btn.className=`cell ${index===project.selectedIndex?'selected':''}`;
    const depthContext = view === 'snapshot' ? `depth at ${result.snapshots[snapshotIndex].minute} minutes after event start` : `${view} depth`;
    btn.setAttribute('aria-label',`${target} cell ${nameCell(index)}, ${SURFACES[cell.surface].label}, elevation ${numeric(cell.elevationM)} meters, modeled ${numeric(mm)} millimeters ${depthContext}`);
    btn.style.background=SURFACES[cell.surface].color;
    btn.style.setProperty('--water-alpha',String(waterAlpha));
    btn.dataset.cellIndex=String(index);
    btn.dataset.grid=target;
    if (view !== 'surface') btn.dataset.depthMm = String(mm);
    const depthLabel=view==='surface' ? `${Math.round(cell.elevationM*100)} cm` : `${numeric(mm)} mm`;
    btn.innerHTML=`<i class="water"></i><b>${nameCell(index)}</b><span>${depthLabel}</span>`;
    for (const side of ['east', 'south']) if (cell.internalBarriers?.[side]?.closed || typeof cell.internalBarriers?.[side]?.crestElevationM === 'number') {
      const line = document.createElement('i'); line.className = 'internal-barrier internal-barrier-' + side + (typeof cell.internalBarriers?.[side]?.crestElevationM === 'number' ? ' internal-crest' : '');
      line.setAttribute('aria-hidden', 'true'); btn.append(line);
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + (typeof cell.internalBarriers?.[side]?.crestElevationM === 'number' ? ', finite crest ' + cell.internalBarriers[side].crestElevationM + ' meters on ' + side + ' edge' : ', closed ' + side + ' edge'));
    }
    // Only one cell per original grid is a Tab stop; arrows move focus, never paint.
    btn.tabIndex = index === project.selectedIndex ? 0 : -1;
    btn.addEventListener('keydown', event => {
      const next = arrowGridIndex(index, project.width, project[target].length, event.key);
      if (next === null) return;
      event.preventDefault();
      if (next === index) return;
      const destination = el.querySelector(`[data-cell-index="${next}"]`);
      if (!destination) return;
      btn.tabIndex = -1;
      destination.tabIndex = 0;
      destination.focus();
    });
    btn.addEventListener('click', () => {
      if (comparisonState !== 'ready') return;
      applyBrush(target, index);
      // rerun() replaces cell nodes; keep the new original-cell control focused.
      $(`${target}-grid`).querySelector(`[data-cell-index="${index}"]`)?.focus();
    });fragment.appendChild(btn);
  }
  el.replaceChildren(fragment);
}
function drawMaps() {
  const snapshots = results.existing.snapshots;
  // Preserve the nearest retained time after new results, with earlier ties.
  // The range selects indexes, so fractional final intervals remain reachable.
  let snapshotIndex = 0;
  for (let i = 1; i < snapshots.length; i++) {
    if (Math.abs(snapshots[i].minute - mapSnapshotMinute) < Math.abs(snapshots[snapshotIndex].minute - mapSnapshotMinute)) snapshotIndex = i;
  }
  mapSnapshotMinute = snapshots[snapshotIndex].minute;
  const time = `${mapSnapshotMinute} minutes after event start`;
  $('map-snapshot-controls').hidden = view !== 'snapshot';
  const range = $('map-snapshot-index');
  range.max = String(snapshots.length - 1); range.value = String(snapshotIndex);
  range.setAttribute('aria-valuetext', `${time}, snapshot ${snapshotIndex + 1} of ${snapshots.length}`);
  $('map-snapshot-time').textContent = `${mapSnapshotMinute} min · snapshot ${snapshotIndex + 1} of ${snapshots.length}`;
  // Keep a focused endpoint control in place; unavailable moves are no-ops.
  $('map-snapshot-prev').setAttribute('aria-disabled', String(snapshotIndex === 0));
  $('map-snapshot-next').setAttribute('aria-disabled', String(snapshotIndex === snapshots.length - 1));
  $('map-view-context').textContent = view === 'snapshot' ?
    `Both maps show the same retained model snapshot, ${time}. Blue depth shading uses the same scale in both scenarios; no interpolation is applied.` :
    view === 'peak' ? 'Each cell shows its own modeled peak during the event. These peaks can occur at different times; they are not one simultaneous water map.' :
    view === 'final' ? `Both maps show final modeled depth at ${snapshots.at(-1).minute} minutes after event start.` :
    'Both maps show the declared surfaces and elevations; water-depth shading is hidden.';
  const focused = document.activeElement?.closest('#existing-grid .cell, #proposal-grid .cell');
  const focusedGrid = focused?.dataset.grid, focusedIndex = focused?.dataset.cellIndex;
  gridInto('existing', results.existing, snapshotIndex);
  gridInto('proposal', results.proposal, snapshotIndex);
  if (focused) {
    const grid = $(`${focusedGrid}-grid`), destination = grid.querySelector(`[data-cell-index="${focusedIndex}"]`);
    if (destination) {
      for (const cell of grid.children) cell.tabIndex = cell === destination ? 0 : -1;
      destination.focus({ preventScroll: true });
    }
  }
}
function showMapSnapshot(index) {
  if (comparisonState !== 'ready') return;
  const snapshots = results.existing.snapshots;
  const next = Math.max(0, Math.min(snapshots.length - 1, Math.trunc(Number(index)) || 0));
  if (snapshots[next].minute === mapSnapshotMinute) return;
  mapSnapshotMinute = snapshots[next].minute;
  // View-only changes preserve physics, saved state and unfinished readings.
  drawMaps();
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
    const raster = project[target][n].rasterSource;
    if (raster) return `${target}: ${raster.fileName}, original row ${raster.row}, column ${raster.column} (line ${raster.line}); ${raster.originalValue} ${raster.verticalUnit}; source center (${raster.x}, ${raster.y}) ${raster.horizontalUnit}, ${raster.coordinateReference}; ${raster.datum}; ${raster.source}. Measurement uncertainty is not supplied.`;
    return origin ? `${target}: ${origin.fileName}, line ${origin.line}; ${origin.elevationValue} ± ${origin.uncertaintyValue} ${origin.unit}; datum ${origin.datum}; ${origin.source}. Supplied uncertainty is retained, not propagated by the solver.` : `${target}: ${project[target][n].provenance}`;
  }).join(' | ');
  const suggested=chooseNextObservation(project,results);
  $('suggest').disabled = suggested === null;
  if (suggested === null) {
    $('next-reading').textContent='No difference-driven depth reading at storm end: the two modeled scenarios agree at every cell at that time. You can still record an independent observation to challenge the shared assumptions; this is not evidence the model matches the real site.';
  } else {
    const timeSupport = suggested.method === 'linear interpolation'
      ? ` This is a linear estimate between modeled ${suggested.beforeMinute} and ${suggested.afterMinute} min snapshots, not a separate solver result at that minute.`
      : ' The model has an exact saved snapshot at that minute.';
    $('next-reading').textContent=`Potential next check: cell ${nameCell(suggested.cellIndex)} at ${suggested.minute} min · ${numeric(suggested.differenceMm)} mm simulated disagreement.${timeSupport} Choose a safe measurement you have permission to make; this is a sensitivity cue, not a confidence score.`;
  }
  const list=$('observation-list');list.replaceChildren();
  if(!project.observations.length){const p=document.createElement('p');p.className='muted';p.textContent='No measurements retained yet. A field reading can challenge either simulated alternative.';list.append(p);return;}
  for(let i=project.observations.length-1;i>=0;i--){
    const o=project.observations[i];const a=interpolateDepth(results.existing,o.cellIndex,o.minute),b=interpolateDepth(results.proposal,o.cellIndex,o.minute);
    const row=document.createElement('div');row.className='observation';
    const info=document.createElement('div');const main=document.createElement('strong');main.textContent=`${nameCell(o.cellIndex)} · ${o.minute} min · ${readingNumber(o.depthMm)} ± ${readingNumber(o.uncertaintyMm)} mm measured`;
    const body=document.createElement('small');body.textContent=`${o.source} · model depths at ${o.minute} min (solver brackets ${a.beforeMinute}–${a.afterMinute} min): existing ${numeric(a.depthMm)} mm (residual ${numeric(o.depthMm-a.depthMm)}), proposal ${numeric(b.depthMm)} mm (residual ${numeric(o.depthMm-b.depthMm)})`;
    info.append(main,body);
    if(o.tableSource){const origin=document.createElement('small');origin.className='table-origin';origin.textContent=`Supplied table: ${o.tableSource.fileName}, line ${o.tableSource.line} · original ${o.tableSource.depthValue} ± ${o.tableSource.uncertaintyValue} ${o.tableSource.unit}`;info.append(origin);}
    info.append(evidenceControls(o,rerun));const remove=document.createElement('button');remove.textContent='Remove';remove.type='button';remove.addEventListener('click',()=>{project.observations.splice(i,1);rerun();});row.append(info,remove);list.append(row);
  }
}
function draw() {
  const a=results.existing,b=results.proposal;
  $('site-area').textContent=`${project.width*project.weather.cellSizeM} × ${project.height*project.weather.cellSizeM} m site`;
  $('storm-total').textContent=`${numeric(a.rainLiters)} L hypothetical rain`;
  drawMaps();
  $('metrics').innerHTML=metric('Water leaving modeled edges',a.exitLiters,b.exitLiters,'L')+metric('Water infiltrated',a.absorbedLiters,b.absorbedLiters,'L','high')+metric('Peak standing water',a.peakPondingLiters,b.peakPondingLiters,'L')+metric('Final stored water',a.storedLiters,b.storedLiters,'L')+metric('Cells ever ≥ 10 mm',a.cellsOver10Mm,b.cellsOver10Mm,'cells')+metric('Maximum cell water depth',a.maxDepthMm,b.maxDepthMm,'mm');
  $('balance').innerHTML=`<strong>Mass balance (both scenarios)</strong> · rain = infiltrated + edge outflow + water still stored. Rounding residual: existing ${numeric(Math.abs(a.massErrorLiters))} L; proposal ${numeric(Math.abs(b.massErrorLiters))} L. These are accounting checks, not field validation.`;
  chart();observations();
}
for(const [id,key] of [['rain','rainMmHr'],['storm','stormMinutes'],['duration','durationMinutes'],['cell-size','cellSizeM']]) {
  $(id).addEventListener('change',()=>{
    const prev=project.weather[key];const n=Number($(id).value);project.weather[key]=n;
    try {
      validateProject(project);
      // Update the accepted time bound before rerun retires a retargeted draft.
      if (key === 'durationMinutes') syncForm();
      rerun();
    } catch(err){project.weather[key]=prev;byName(id,prev);notice(err.message);}
  });
}
$('project-title').addEventListener('change',()=>{const n=$('project-title').value.trim();project.title=n||'Untitled site';rerun();});
$('brushes').addEventListener('click',event=>{const b=event.target.closest('[data-brush]');if(!b)return;brush=b.dataset.brush;for(const el of document.querySelectorAll('[data-brush]')){const active=el.dataset.brush===brush;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}});
$('map-view').addEventListener('change',()=>{if(comparisonState!=='ready')return;view=$('map-view').value;drawMaps();});
$('map-snapshot-index').addEventListener('input',event=>showMapSnapshot(event.target.value));
$('map-snapshot-prev').addEventListener('click',()=>showMapSnapshot(Number($('map-snapshot-index').value)-1));
$('map-snapshot-next').addEventListener('click',()=>showMapSnapshot(Number($('map-snapshot-index').value)+1));
$('copy-existing').addEventListener('click',()=>{project.proposal=structuredClone(project.existing);rerun();notice('Proposal now matches the existing site.');});
$('reset').addEventListener('click',()=>{project=makeExample();syncForm();rerun();notice('Fictional example restored.');});
$('suggest').addEventListener('click',()=>{if(comparisonState!=='ready')return;const s=chooseNextObservation(project,results);if(!s)return;if(s.cellIndex!==project.selectedIndex || s.minute!==Number($('obs-minute').value)) clearObservationDraft('The suggested measurement changed the target cell or time.');project.selectedIndex=s.cellIndex;$('obs-minute').value=s.minute;brush='inspect';for(const el of document.querySelectorAll('[data-brush]')){const active=el.dataset.brush==='inspect';el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}rerun();$('obs-depth').focus();});
infiltrationInquiry=mountInfiltrationInquiry({getProject:()=>project,selectCell:index=>{
  project.selectedIndex=index;brush='inspect';
  for(const el of document.querySelectorAll('[data-brush]')) {const active=el.dataset.brush==='inspect';el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));}
  rerun();
}});
$('obs-minute').addEventListener('input', retireRetargetedObservationDraft);
for (const id of ['obs-depth', 'obs-source']) {
  $(id).addEventListener('input', () => { $('observation-draft-status').textContent = ''; });
}
$('observe-form').addEventListener('submit',event=>{
  event.preventDefault();
  const o={cellIndex:project.selectedIndex,minute:Number($('obs-minute').value),depthMm:Number($('obs-depth').value),uncertaintyMm:Number($('obs-uncertainty').value),source:$('obs-source').value.trim(),scenario:$('obs-scenario').value,use:$('obs-use').value};
  project.observations.push(o);
  try{validateProject(project);rerun();$('obs-depth').value='';$('obs-source').value='';notice(`Observation for ${nameCell(o.cellIndex)} added to this project.`);}catch(err){project.observations.pop();notice(err.message);}
});
$('export').addEventListener('click',()=>{
  try {
    const data=new Blob([serializePortableProject(project)],{type:'application/json'});
    const url=URL.createObjectURL(data);const link=document.createElement('a');link.href=url;link.download='experimental-earth-site.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
    notice(comparisonState === 'ready' ? 'Portable project downloaded.' : 'Current input downloaded. Its changed comparison has not completed.');
  } catch(err) { notice(`Export refused: ${err.message}. Current workspace was not changed.`); }
});
$('import').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  // Selecting a new source retires computation before its asynchronous read.
  const serial=++projectImportSerial, revision=++projectRevision;
  ++comparisonGeneration; comparisonComputation.cancel();
  setComparisonState('loading'); setComparisonInteraction(true);
  try {
    checkProjectFileBytes(file.size);
    const text = await file.text();
    if(serial!==projectImportSerial || revision!==projectRevision) return;
    const parsed = parsePortableProject(text);
    project=parsed;syncForm();rerun();notice('Validated project imported.');
  } catch(err) {
    if(serial===projectImportSerial && revision===projectRevision) {
      // A refused file did not replace the current project. Recompute that
      // project's retired job, without admitting the refused source.
      try { rerun(); } catch (error) { notice(error.message); }
      notice(`Import refused: ${err.message}`);
    }
  } finally { if(serial===projectImportSerial) event.target.value=''; }
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
const interventionPanel = mountInterventionPanel({ getProject: () => project, notice, prepareReading: prepareObservedReading,
  prepareCollection: question => outletEvidencePanel.prepareReading(question) });
const localWaterBudgetPanel = mountLocalWaterBudget({ getProject: () => project,
  saveStudy: study => {
    validateProject({ ...project, localWaterBudgetStudy: study });
    project.localWaterBudgetStudy = structuredClone(study);
    rerun();
  },
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
const terrainSensitivity = mountTerrainSensitivity({ getProject: () => project });
const pondingPanel = mountPondingPanel({getProject: () => project, getResults: () => results});
const routePondingPanel = mountRoutePondingPanel({getProject: () => project, getResults: () => results});
const connectivityPanel = mountPondingConnectivity({getProject: () => project, getResults: () => results});
const sharedObservedPanel=mountSharedObservedConnection({getProject:()=>project});
const jointEvidencePanel = mountJointEvidence({ getProject: () => project,
  replaceProject: next => { project = next; syncForm(); rerun(); }, notice });
const jointEventPanel = mountJointEventChallenge({ getProject: () => project, notice });
const observationMap = mountObservationMap({ getProject: () => project, getResults: () => results,
  selectCell: cellIndex => {
    brush = 'inspect';
    for (const el of document.querySelectorAll('[data-brush]')) {
      const active = el.dataset.brush === 'inspect';
      el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active));
    }
    $('obs-depth').value = ''; $('obs-source').value = '';
    applyBrush('existing', cellIndex);
    notice('Cell selected for inspection. Previous depth/source draft cleared; retained readings are unchanged.');
  },
});
const internalBarriersPanel = mountInternalBarriers({ getProject: () => project,
  replaceProject: next => { validateProject(next); project = next; syncForm(); rerun(); }, notice });
const placementPanel = mountPlacementSearch({ getProject: () => project,
  replaceProject: next => { validateProject(next); project = next; syncForm(); rerun(); }, notice });
const thresholdPanel = mountThresholdEvidence({getProject:()=>project, replaceProject:next=>{project=validateProject(next);rerun();}, notice});
const solarPanel = mountSolarPanel({getProject:()=>project, replaceProject:next=>{project=validateProject(next);rerun();}, notice});
const clockPanel = mountClockPanel({getProject:()=>project,notice});
const proposalComponentsPanel = mountProposalComponents({ getProject: () => project });
const stormIntensityPanel = mountStormIntensityPanel({ getProject: () => project });
const surfaceHeatPanel = mountSurfaceHeat({getProject:()=>project, replaceProject:next=>{project=validateProject(next);rerun();}, notice});
const lateralHeatPanel = mountLateralHeat({getProject:()=>project});
const heatColumnPanel = mountHeatColumn({getProject:()=>project, replaceProject:next=>{project=validateProject(next);rerun();}, notice});
const heatColumnEvidencePanel = mountHeatColumnEvidence({getProject:()=>project, replaceProject:next=>{project=validateProject(next);rerun();}, notice});
const heatColumnSearchPanel = mountHeatColumnSearch({getProject:()=>project,draftAlternative:(h,e)=>heatColumnEvidencePanel.draftAlternative(h,e)});
mountHeatColumnTransfer({getProject:()=>project});
const heatColumnQuestionPanel = mountHeatColumnQuestion({getProject:()=>project});
const heatChannelQuestionPanel = mountHeatChannelQuestion({getProject:()=>project});
const sunPathPanel = mountSunPathPanel({getProject:()=>project, notice});
const wettingFrontPanel = mountWettingFrontPanel({ getProject: () => project,
  replaceProject: next => { project = validateProject(next); rerun(); }, prepareReading: prepareObservedReading });
const pressureHeadPanel = mountPressureHeadPanel({ getProject: () => project });
const heatEvidencePanel = mountHeatEvidence({getProject:()=>project, replaceProject:next=>{project=validateProject(next);rerun();}, notice});
const shadeHeatPanel = mountShadeHeat({getProject:()=>project, notice});
const rootZonePanel = mountRootZone({getProject:()=>project});
const coolingPanel = mountCooling({getProject:()=>project});
const infiltrationStoragePanel = mountInfiltrationStorage({getProject:()=>project});
const drainingLayerPanel = mountDrainingLayer({getProject:()=>project});
const measuredChangePanel = mountMeasuredChange({getProject:()=>project});
syncForm();rerun();
mountInvestigationNavigation();

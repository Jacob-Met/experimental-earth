import { compareStormIntensities, STORM_INTENSITY_METRICS } from './storm-intensity.js';
import { compareStormResolution } from './storm-resolution.js';

const fmt = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 });
function parseRates(raw) {
  const parts = raw.split(',');
  if (parts.some(part => !part.trim() || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(part.trim()))) {
    throw new Error('Enter comma-separated numeric intensities, for example 12, 36, 72.');
  }
  return parts.map(part => Number(part.trim()));
}

export function mountStormIntensityPanel({ getProject }) {
  const host = document.createElement('section');
  host.className = 'panel';
  host.setAttribute('aria-labelledby', 'storm-intensity-heading');
  host.innerHTML = `<div class="section-heading"><div>
      <span class="eyebrow">STORM CHALLENGE / CONDITIONAL COMPARISON</span>
      <h2 id="storm-intensity-heading">Does the change behave similarly in lighter and heavier storms?</h2>
    </div></div>
    <p class="mini-note">Test 2–7 explicitly hypothetical <strong>constant</strong> rain intensities. The same rain is applied to the existing site and proposal in each row. Geometry, duration, infiltration and boundary assumptions remain fixed. Notebook readings are neither reassigned nor fitted to these alternate storms.</p>
    <form id="storm-intensity-form">
      <label class="input-label">Alternative rainfall rates · mm/hour
        <input id="storm-intensity-rates" type="text" maxlength="90" value="12, 36, 72"
          required aria-describedby="storm-intensity-description">
      </label>
      <p id="storm-intensity-description" class="mini-note">Comma-separated, distinct numbers from 0 to 250. This study does not change your saved event or rain settings.</p>
      <button id="storm-intensity-run" class="subtle" type="submit">Compare declared storms</button>
    </form>
    <p id="storm-intensity-status" class="mini-note" role="status" aria-live="polite">No storm-range comparison computed.</p>
    <div id="storm-intensity-results"></div>
    <button id="storm-resolution-run" class="subtle" type="button" disabled>Check finer calculation intervals</button>
    <p id="storm-resolution-status" class="mini-note" role="status" aria-live="polite">First compare the declared storms.</p>
    <div id="storm-resolution-results"></div>
    <p class="mini-note">This is sensitivity to assumed constant rainfall, not uncertainty probabilities, a new measured storm, or a calibrated safety or flood-risk prediction. No actual measurements are transferred between events.</p>`;
  const anchor = document.getElementById('results-title')?.closest('.panel');
  if (!anchor) throw new Error('The Rain Lab results panel is unavailable');
  anchor.after(host);
  const $ = id => host.querySelector('#' + id);
  const status = $('storm-intensity-status'), target = $('storm-intensity-results');
  const run = $('storm-intensity-run');
  const resolutionRun = $('storm-resolution-run'), resolutionStatus = $('storm-resolution-status');
  const resolutionResults = $('storm-resolution-results');
  let generation = 0, comparedRates = null;

  function refresh() {
    generation++;
    comparedRates = null;
    target.replaceChildren();
    resolutionResults.replaceChildren();
    status.textContent = 'Site, evidence or intensity input changed; compare declared storms again.';
    resolutionStatus.textContent = 'First compare the declared storms.';
    resolutionRun.disabled = true;
    run.disabled = false;
  }
  function show(report) {
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'max-width:100%;overflow-x:auto;margin-block:1rem';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;min-width:640px;border-collapse:collapse;font-variant-numeric:tabular-nums';
    const head = document.createElement('thead'), header = document.createElement('tr');
    for (const name of ['Rain / mm·h⁻¹', 'Rain entering / L', 'Edge outflow change / L',
                        'Peak standing change / L', 'Final standing change / L',
                        'Maximum depth change / mm']) {
      const cell = document.createElement('th');
      cell.scope = 'col'; cell.textContent = name;
      cell.style.cssText = 'padding:.65rem;text-align:left;border-bottom:1px solid #aac0bc';
      header.append(cell);
    }
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    for (const row of report.rows) {
      const tr = document.createElement('tr');
      const fields = [row.rainMmHr, row.rainLiters,
        row.metrics.exitLiters.delta, row.metrics.peakPondingLiters.delta,
        row.metrics.storedLiters.delta, row.metrics.maxDepthMm.delta];
      fields.forEach((value, index) => {
        const td = document.createElement('td');
        td.textContent = (index >= 2 && value > 0 ? '+' : '') + fmt(value);
        td.style.cssText = 'padding:.6rem;border-bottom:1px solid #dae4de';
        tr.append(td);
      });
      body.append(tr);
    }
    table.append(body); tableWrap.append(table); target.append(tableWrap);
    const findings = document.createElement('ul');
    findings.setAttribute('aria-label', 'Directions across tested storms');
    for (const [key, label] of STORM_INTENSITY_METRICS) {
      const item = document.createElement('li');
      const finding = report.findings[key];
      item.textContent = label + ': ' + finding.finding +
        ' (' + finding.lower + ' lower, ' + finding.higher + ' higher, ' +
        finding.unchanged + ' unchanged).';
      findings.append(item);
    }
    target.append(findings);
    const note = document.createElement('p');
    note.className = 'mini-note';
    note.textContent = 'Each signed change is proposed minus existing. ' + report.meaning;
    target.append(note);
  }

  function showResolution(report) {
    const heading = document.createElement('h3');
    heading.textContent = 'How do the calculated differences move as the step gets finer?';
    resolutionResults.append(heading);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:100%;overflow-x:auto;margin-block:1rem';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;min-width:670px;border-collapse:collapse;font-variant-numeric:tabular-nums';
    const thead = document.createElement('thead'), head = document.createElement('tr');
    for(const label of ['Rain / mm·h⁻¹','Modeled consequence',
      ...report.stepsMinutes.map(step => 'Step ' + fmt(step) + ' min'),
      'Numerical direction across steps']) {
      const th = document.createElement('th');
      th.scope='col';th.textContent=label;
      th.style.cssText='padding:.6rem;text-align:left;border-bottom:1px solid #aac0bc';
      head.append(th);
    }
    thead.append(head);table.append(thead);
    const tbody = document.createElement('tbody');
    for(const row of report.rows) for(const [key,label,unit] of STORM_INTENSITY_METRICS) {
      const metric=row.metrics[key], tr=document.createElement('tr');
      tr.dataset.direction = metric.opposed ? 'opposed' :
        metric.unresolvedAcrossSteps ? 'unresolved' : 'consistent';
      const cells=[fmt(row.rateMmHr),label + ' / ' + unit,
        ...metric.deltas.map(v => (v>0?'+':'') + fmt(v)),metric.finding];
      for(const entry of cells) {
        const td=document.createElement('td');
        td.textContent=entry;
        td.style.cssText='padding:.6rem;border-bottom:1px solid #dae4de';
        if(metric.opposed && entry===cells[cells.length-1])td.style.fontWeight='700';
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);wrap.append(table);resolutionResults.append(wrap);
    const note=document.createElement('p');
    note.className='mini-note';
    note.textContent=report.meaning;
    resolutionResults.append(note);
  }

  $('storm-intensity-form').addEventListener('submit', event => {
    event.preventDefault();
    const epoch = ++generation;
    const original = JSON.stringify(getProject());
    const raw = $('storm-intensity-rates').value;
    comparedRates = null;
    target.replaceChildren();
    resolutionResults.replaceChildren();
    resolutionStatus.textContent = 'First compare the declared storms.';
    resolutionRun.disabled = true;
    status.textContent = 'Computing alternatives from unchanged site assumptions…';
    run.disabled = true;
    setTimeout(() => {
      if (epoch !== generation) return;
      try {
        if (JSON.stringify(getProject()) !== original) {
          throw new Error('The project changed; repeat the comparison.');
        }
        const report = compareStormIntensities(getProject(), parseRates(raw));
        if (epoch !== generation || report.sourceSignature !== JSON.stringify(getProject())) {
          throw new Error('The project changed while comparing.');
        }
        show(report);
        comparedRates = report.ratesMmHr;
        resolutionRun.disabled = false;
        resolutionStatus.textContent = 'Ready to compare the same storm alternatives at finer supported steps.';
        status.textContent = report.rows.length + ' hypothetical storms compared; ' +
          fmt(report.cellSteps) + ' estimated cell-steps. ' +
          'Every alternative used the original paired geometry and equal rainfall.';
      } catch (error) {
        target.replaceChildren();
        status.textContent = 'Comparison refused: ' + error.message;
      } finally {
        if (epoch === generation) run.disabled = false;
      }
    }, 0);
  });
  $('storm-intensity-rates').addEventListener('input',refresh);
  resolutionRun.addEventListener('click', () => {
    if (!comparedRates) return;
    const epoch = ++generation;
    const original = JSON.stringify(getProject());
    const rates = [...comparedRates];
    resolutionResults.replaceChildren();
    resolutionStatus.textContent = 'Checking supported finer steps on the unchanged site…';
    resolutionRun.disabled = true;
    setTimeout(() => {
      if (epoch !== generation) return;
      try {
        if (JSON.stringify(getProject()) !== original) throw Error('The project changed; compare again.');
        const report = compareStormResolution(getProject(), rates);
        if (epoch !== generation || report.sourceSignature !== JSON.stringify(getProject())) {
          throw Error('The project changed during the resolution check.');
        }
        showResolution(report);
        const opposed = report.issues.filter(x => x.finding.startsWith('opposite')).length;
        resolutionStatus.textContent = report.stepsMinutes.length + ' numerical steps checked (' +
          report.stepsMinutes.map(fmt).join(', ') + ' minutes); ' + opposed +
          ' rate/metric pairs have opposite tested directions, ' +
          report.issues.length + ' pairs have a step-dependent direction qualification. ' +
          'This does not prove convergence.';
      } catch (error) {
        resolutionResults.replaceChildren();
        resolutionStatus.textContent = 'Resolution check refused: ' + error.message;
      } finally {
        if (epoch === generation) resolutionRun.disabled = false;
      }
    }, 0);
  });
  return { refresh };
}

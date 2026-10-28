import { parsePowerHourly, checkPowerHourlyBytes, POWER_HOURLY_FORMAT } from './weather-power.js';
import { prepareShadeHeatInvestigation, serializeShadeHeatInvestigation,
  parseShadeHeatInvestigation, checkShadeHeatBytes } from './shade-heat.js';
import { makeShadeHeatExample } from './shade-heat-example.js';
import { mountShadeHeatSampling } from './shade-heat-sampling-panel.js';

const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
const display = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
const range = values => Math.abs(values[1] - values[0]) < 1e-8 ? display(values[0]) : values.map(display).join(' to ');
const pathFields = [
  ['latitudeDeg', 'Latitude · degrees north', 'number'], ['longitudeDeg', 'Longitude · degrees east', 'number'],
  ['gridColumnBearingDeg', 'Grid columns bearing · degrees from true north', 'number'],
  ['startUtc', 'Start · UTC date and time', 'text'], ['endUtc', 'End · UTC date and time', 'text'],
  ['stepMinutes', 'Interval · minutes (maximum 24 intervals)', 'number'],
  ['locationSource', 'Location source or explicit assumption', 'text'],
  ['orientationSource', 'Grid orientation source or explicit assumption', 'text'],
];
const weatherFields = [ ['directNormalWm2', 'Direct-normal irradiance · W/m²', 'number'],
  ['diffuseHorizontalWm2', 'Diffuse-horizontal irradiance · W/m²', 'number'],
  ['reservoirC', 'Ambient reservoir · °C', 'number'], ['weatherSource', 'Weather source or explicit assumption', 'text'] ];

export function mountShadeHeat({ getProject, notice }) {
  const style = node('link'); style.rel = 'stylesheet'; style.href = new URL('./shade-heat.css', import.meta.url); document.head.append(style);
  const panel = node('section'); panel.id = 'shade-heat'; panel.className = 'panel study';
  panel.innerHTML = `<span class="eyebrow">SHADE + HEAT</span><h2>What does a shade change do to stored heat?</h2>
    <p>Connect the mapped columns and ground to the saved surface and lower heat stores. Follow the temperature response as the sun moves, then inspect which shade assumptions drive it.</p>
    <div class="obs-actions"><button id="shade-current" type="button">Use saved site declarations</button><button id="shade-example" type="button">Explore authored shade example</button><label class="shade-file">Reopen an investigation<input id="shade-import" type="file" accept=".json,application/json"></label></div>
    <p id="shade-basis" class="mini-note"></p>
    <details id="shade-settings"><summary>Location, dated exposure and declared weather</summary><form id="shade-form"><div class="obs-actions"><label class="shade-file">Use NASA POWER hourly JSON<input id="shade-weather-import" type="file" accept=".json,application/json"></label><button id="shade-weather-clear" type="button" hidden>Use constant weather</button></div><p id="shade-weather-basis" class="mini-note">Use declared constant weather below, or import one complete UTC day of POWER direct-normal, diffuse-horizontal and two-metre temperature records.</p><div class="shade-fields">${[...pathFields, ...weatherFields].map(([key, label, type]) => `<label class="input-label">${label}<input id="shade-${key}" type="${type}" ${type === 'number' ? 'step="any"' : 'maxlength="400"'} required></label>`).join('')}</div><button id="shade-run" type="submit" class="primary">Compare shade and heat</button></form></details>
    <p class="mini-note">Direct beam is projected onto horizontal ground. The declared diffuse input stays the same under shade; sky-view changes and reflected light are not included. Temperature also depends on each saved material declaration.</p>
    <p id="shade-status" role="status"></p><div id="shade-results"></div>
    <button id="shade-export" type="button" disabled>Download original site + investigation inputs</button>
    <p class="mini-note">The download includes the declared geographic location and original site. Reopening recomputes the comparison without replacing the working site.</p>`;
  document.querySelector('#heat-column').after(panel);
  const $ = id => panel.querySelector('#' + id);
  let source = null, sourceMode = '', signature = '', generation = 0, accepted = null, selectedIndex = 0, store = 'surfaceC', hourlyWeather = null;
  const sampling = mountShadeHeatSampling({ host: panel, getAccepted: () => accepted, notice });

  function state(message, kind = 'not-compared') { $('shade-status').textContent = message; $('shade-status').dataset.state = kind; }
  function invalidate(message) {
    generation++; accepted = null; sampling.invalidate('Source or declarations changed. Accept the hourly comparison again before comparing its solar grids.'); $('shade-results').replaceChildren(); $('shade-export').disabled = true;
    $('shade-run').disabled = !source; state(message);
  }
  function weatherMode() {
    const locked = ['latitudeDeg', 'longitudeDeg', 'startUtc', 'endUtc', 'stepMinutes', ...weatherFields.map(([key]) => key)];
    for (const key of locked) $('shade-' + key).disabled = Boolean(hourlyWeather);
    $('shade-weather-clear').hidden = !hourlyWeather;
    $('shade-weather-basis').textContent = hourlyWeather
      ? 'Original hourly JSON attached. Its point, UTC day and one-hour intervals are retained; grid orientation and all site/material assumptions remain yours. Radiation energy in Wh/m² is divided by one hour for mean W/m². T2M supplies the ambient reservoir.'
      : 'Use declared constant weather below, or import one complete UTC day of POWER direct-normal, diffuse-horizontal and two-metre temperature records.';
  }
  function fill(declaration) {
    hourlyWeather = declaration?.weather ? { ...declaration.weather } : null; weatherMode();
    for (const [key] of pathFields) $('shade-' + key).value = declaration?.path?.[key] ?? '';
    for (const [key] of weatherFields) $('shade-' + key).value = declaration?.[key] ?? '';
  }
  function read() {
    const declaration = { path: {} };
    for (const [key, , type] of pathFields) {
      const raw = $('shade-' + key).value;
      if (!raw.trim()) throw Error('Enter each dated exposure field and source');
      declaration.path[key] = type === 'number' ? Number(raw) : raw;
    }
    if (hourlyWeather) { declaration.weather = { ...hourlyWeather }; return declaration; }
    for (const [key, , type] of weatherFields) {
      const raw = $('shade-' + key).value;
      if (!raw.trim()) throw Error('Enter each weather field and its source');
      declaration[key] = type === 'number' ? Number(raw) : raw;
    }
    return declaration;
  }
  function basis() {
    const cell = source?.heatColumnStudy?.heatStudy?.cellIndex;
    const label = Number.isInteger(cell) ? String.fromCharCode(65 + cell % source.width) + (Math.floor(cell / source.width) + 1) : 'not yet declared';
    $('shade-basis').textContent = source ? `${sourceMode} · ${source.title} · saved heat point ${label}. The original site and thermal declarations stay attached to this investigation.`
      : 'Use a site with saved obstruction geometry, surface properties and a lower heat store, or explore the isolated authored example.';
  }
  function result(next, mode) {
    accepted = next; sampling.invalidate('Hourly comparison replaced. Compare its solar grids to inspect sampling sensitivity.'); source = next.investigation.project; sourceMode = mode; fill(next.investigation.declaration);
    selectedIndex = next.report.trajectory.length - 1; basis(); draw(); $('shade-export').disabled = false; $('shade-run').disabled = false;
    state(`Compared ${next.report.intervals.length} midpoint intervals at the saved ground point. Temperature ranges retain unresolved mapped beam obstruction.`, 'compared');
  }
  function run(event) {
    event?.preventDefault();
    try {
      if (!source) throw Error('Choose original site declarations first');
      const declaration = read(), project = structuredClone(source), mode = sourceMode;
      invalidate('Calculating the dated shade and thermal response…'); const request = generation; $('shade-run').disabled = true;
      setTimeout(() => {
        try { const next = prepareShadeHeatInvestigation(project, declaration); if (request === generation) result(next, mode); }
        catch (error) { if (request === generation) { state(error.message, 'refused'); notice(error.message); } }
        finally { if (request === generation) $('shade-run').disabled = !source; }
      }, 20);
    } catch (error) { invalidate(error.message); state(error.message, 'refused'); }
  }
  $('shade-form').addEventListener('submit', run);
  for (const el of panel.querySelectorAll('form input:not([type=file])')) el.addEventListener('input', () => invalidate('Inputs changed. Compare again to inspect the new assumptions.'));
  $('shade-weather-clear').addEventListener('click', () => {
    hourlyWeather = null; weatherMode(); invalidate('Hourly weather detached. Declare constant irradiance, reservoir and their source before comparing.');
  });
  $('shade-weather-import').addEventListener('change', async () => {
    const file = $('shade-weather-import').files?.[0]; if (!file) return; $('shade-weather-import').value = '';
    const request = ++generation;
    try {
      checkPowerHourlyBytes(file.size);
      const bytes = await file.arrayBuffer(); if (request !== generation) return;
      const rawText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const weather = parsePowerHourly(rawText); if (request !== generation) return;
      for (const key of ['latitudeDeg', 'longitudeDeg', 'startUtc', 'endUtc', 'stepMinutes']) $('shade-' + key).value = weather[key];
      $('shade-locationSource').value = 'Point declared in uploaded NASA POWER hourly JSON; original source resolution, not a surveyed site location';
      hourlyWeather = { format: POWER_HOURLY_FORMAT, rawText }; weatherMode();
      invalidate('Hourly weather attached. Confirm the source site and grid bearing, then compare.');
      $('shade-settings').open = true;
    } catch (error) { if (request === generation) { state('Weather file refused: ' + error.message + '. The prior investigation is retained.', 'weather-refused'); notice(error.message); } }
    finally { if (request === generation) $('shade-run').disabled = !source; }
  });
  $('shade-current').addEventListener('click', () => {
    source = structuredClone(getProject()); sourceMode = 'Snapshot of the working site';
    invalidate('Original site selected. Enter a dated exposure, irradiance and their sources.'); basis(); $('shade-settings').open = true;
  });
  $('shade-example').addEventListener('click', () => {
    const example = makeShadeHeatExample(); source = example.project; sourceMode = 'Isolated authored example'; fill(example.declaration); basis(); run();
  });
  $('shade-import').addEventListener('change', async () => {
    const file = $('shade-import').files?.[0]; if (!file) return;
    // Capture the File before resetting selection. A stale async completion
    // must neither prevent choosing this file again nor clear a newer choice.
    $('shade-import').value = '';
    const request = ++generation;
    try {
      checkShadeHeatBytes(file.size); const text = await file.text(); if (request !== generation) return;
      const next = parseShadeHeatInvestigation(text); if (request !== generation) return;
      result(next, 'Reopened original source');
    } catch (error) { if (request === generation) { state('File refused: ' + error.message + '. The prior accepted investigation is retained.', 'file-refused'); notice(error.message); } }
    finally { if (request === generation) $('shade-run').disabled = !source; }
  });
  $('shade-export').addEventListener('click', () => {
    if (!accepted) return;
    try {
      const { project, declaration } = accepted.investigation;
      const text = serializeShadeHeatInvestigation(project, declaration), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = 'experimental-earth-shade-heat-inputs.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { state(error.message, 'refused'); notice(error.message); }
  });

  function inspect() {
    const report = accepted.report, row = report.trajectory[selectedIndex], host = $('shade-inspect'); host.replaceChildren();
    const utc = new Date(Date.parse(report.declaration.path.startUtc) + row.minute * 60000).toISOString();
    host.append(node('h3', `${display(row.minute)} minutes · ${utc.replace('.000Z', 'Z')}`));
    host.dataset.minute = row.minute; host.dataset.existingLower = row.existing.lower[store]; host.dataset.proposalUpper = row.proposal.upper[store];
    const cards = node('div'); cards.className = 'shade-cards';
    for (const target of ['existing', 'proposal']) {
      const card = node('div'); card.className = 'shade-card ' + target;
      card.append(node('span', target === 'existing' ? 'Existing' : 'Proposal'), node('strong', range([row[target].lower[store], row[target].upper[store]]) + ' °C'));
      cards.append(card);
    }
    host.append(cards, node('p', 'Proposal minus existing at this time: ' + range(row.difference[store]) + ' °C. Includes declared material changes as well as mapped shade.'));
    const interval = report.intervals.find(r => row.minute >= r.fromMinute && row.minute < r.toMinute) ?? report.intervals.at(-1);
    host.append(node('p', `Forcing interval ${display(interval.fromMinute)}–${display(interval.toMinute)} min · sun sampled at ${interval.sampleUtc.replace('.000Z', 'Z')}.`));
    if (report.declaration.weather) host.append(node('p', `Original weather hour ${interval.weather.sourceKey}: direct-normal ${display(interval.weather.original.ALLSKY_SFC_SW_DNI)} Wh/m²; diffuse-horizontal ${display(interval.weather.original.ALLSKY_SFC_SW_DIFF)} Wh/m² over one hour; ambient ${display(interval.weather.reservoirC)} °C.`));
    for (const target of ['existing', 'proposal']) {
      const ray = interval[target]; host.append(node('p', `${target}: ${ray.status}; incident ${range([ray.irradiance.lower, ray.irradiance.upper])} W/m².` +
        (ray.witness ? ` Mapped witness cell ${ray.witness.cellIndex + 1}: ${ray.witness.source}` : '')));
    }
    const ledger = node('details'); ledger.append(node('summary', 'Inspect the cumulative energy balance'));
    const table = node('table'), head = node('tr');
    for (const label of ['Quantity · kJ/m²', 'Existing lower / upper beam', 'Proposal lower / upper beam']) head.append(node('th', label)); table.append(head);
    for (const [label, field] of [['Absorbed input', 'inputJm2'], ['Ambient exchange out', 'exchangeOutJm2'],
      ['Surface stored change', 'surfaceStoredJm2'], ['Lower stored change', 'subsurfaceStoredJm2']]) {
      const tr = node('tr'); tr.append(node('th', label));
      for (const target of ['existing', 'proposal']) tr.append(node('td', ['lower', 'upper'].map(bound => display(row[target][bound][field] / 1000)).join(' / ')));
      table.append(tr);
    }
    ledger.append(table, node('p', 'Two complete courses are shown. Signed ambient exchange may supply heat. Stored surface plus lower heat equals absorbed input minus ambient exchange within floating-point precision.'));
    host.append(ledger);
  }

  function draw() {
    if (!accepted) return;
    const report = accepted.report, host = $('shade-results'); host.replaceChildren();
    const label = node('label', 'Temperature to inspect'); label.className = 'input-label'; const select = node('select'); select.id = 'shade-store';
    for (const [value, title] of [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']]) { const option = node('option', title); option.value = value; select.append(option); }
    select.value = store; label.append(select); host.append(label);
    select.addEventListener('change', () => { store = select.value; draw(); });
    const values = report.trajectory.flatMap(row => ['existing', 'proposal'].flatMap(target => ['lower', 'upper'].map(bound => row[target][bound][store])));
    const lo = Math.min(...values), hi = Math.max(...values), pad = Math.max(1, .1 * (hi - lo));
    const width = Math.max(300, Math.min(700, host.clientWidth || 700)), right = width - 18;
    const xx = minute => 48 + (right - 48) * minute / report.durationMinutes, yy = v => 225 - 200 * (v - lo + pad) / (hi - lo + 2 * pad);
    const chart = svg('svg', { viewBox: `0 0 ${width} 270`, role: 'img', 'aria-label': 'Temperature through time; existing orange, proposed green; filled bands retain uncertain mapped beam' }); chart.id = 'shade-chart';
    for (let i = 0; i <= 4; i++) {
      const value = lo - pad + (hi - lo + 2 * pad) * i / 4, y = yy(value);
      chart.append(svg('line', { x1: 48, x2: right, y1: y, y2: y, stroke: '#dce6df' }));
      const tick = svg('text', { x: 42, y: y + 4, 'text-anchor': 'end' }); tick.textContent = value.toFixed(1); chart.append(tick);
    }
    for (const fraction of width < 500 ? [0, .5, 1] : [0, .25, .5, .75, 1]) {
      const tick = svg('text', { x: xx(fraction * report.durationMinutes), y: 248, 'text-anchor': 'middle' }); tick.textContent = display(fraction * report.durationMinutes); chart.append(tick);
    }
    for (const [target, color] of [['existing', '#b56b3b'], ['proposal', '#167467']]) {
      const points = bound => report.trajectory.map(row => `${xx(row.minute)},${yy(row[target][bound][store])}`);
      const a = points('lower'), b = points('upper');
      chart.append(svg('path', { d: 'M' + a.join(' L') + ' L' + b.reverse().join(' L') + ' Z', fill: color, 'fill-opacity': .16 }));
      for (const bound of ['lower', 'upper']) chart.append(svg('path', { d: 'M' + points(bound).join(' L'), fill: 'none', stroke: color, 'stroke-width': 2.5, ...(bound === 'upper' ? { 'stroke-dasharray': '6 3' } : {}) }));
    }
    host.append(chart, node('p', 'Temperature °C · elapsed minutes. Orange: existing. Green: proposal. Bands concern mapped beam ambiguity within each sampled interval.'));
    const storeName = store === 'surfaceC' ? 'surface' : 'subsurface';
    const summary = node('p'); summary.id = 'shade-summary';
    summary.textContent = ['existing', 'proposal'].map(target => `${target} maximum: ${range(report.summary[target][storeName].maximumRangeC)} °C; ${report.summary[target].ambiguousIntervals} intervals with unresolved beam`).join('. ') + '.';
    host.append(summary);
    const time = node('label', 'Inspect a retained time'); time.className = 'input-label'; const slider = node('input'); slider.id = 'shade-time'; slider.type = 'range'; slider.min = 0; slider.max = report.trajectory.length - 1; slider.step = 1; slider.value = selectedIndex;
    time.append(slider); host.append(time); const inspector = node('div'); inspector.id = 'shade-inspect'; host.append(inspector);
    slider.addEventListener('input', () => { selectedIndex = Number(slider.value); inspect(); }); inspect();
    const sources = node('details'); sources.id = 'shade-sources'; sources.append(node('summary', 'Original declarations, mapped intervals and model limits'));
    const { project, declaration } = accepted.investigation;
    sources.append(node('p', project.source), node('p', declaration.path.locationSource), node('p', declaration.path.orientationSource));
    if (declaration.weather) {
      const weather = report.weatherSource;
      sources.append(node('p', `Uploaded source declaration: ${weather.title}; ${weather.api.name} ${weather.api.version}; ${weather.sources.join(', ')}. Original complete JSON is retained in the download; file metadata is not proof of origin.`));
    } else sources.append(node('p', declaration.weatherSource));
    for (const target of ['existing', 'proposal']) sources.append(node('p', target + ' surface: ' + project.heatColumnStudy.heatStudy[target].source), node('p', target + ' lower: ' + project.heatColumnStudy.lowerLayers[target].source));
    for (const row of report.intervals) sources.append(node('p', `${row.sampleUtc}: existing ${row.existing.status}, proposal ${row.proposal.status}; midpoint clock offset ${row.sampleOffsetSeconds} seconds.`));
    sources.append(node('p', report.semantics), node('p', 'Computed peaks include thermal interval boundaries and interior turning points. Changing interval width can change the answer; no temporal convergence or continuous shadow bound is established.'));
    host.append(sources);
  }
  window.addEventListener('resize', () => { if (accepted) draw(); });
  function refresh() {
    const next = JSON.stringify(getProject()); if (next === signature) return; signature = next;
    if (sourceMode === 'Snapshot of the working site') { source = null; sourceMode = ''; invalidate('Working site changed. Select its new saved declarations before comparing.'); }
    basis(); $('shade-run').disabled = !source;
  }
  return { refresh };
}

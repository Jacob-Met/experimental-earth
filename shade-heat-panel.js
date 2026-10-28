import { parsePowerHourly, checkPowerHourlyBytes, POWER_HOURLY_FORMAT } from './weather-power.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';
import { makeShadeHeatExample } from './shade-heat-example.js';
import { mountShadeHeatSampling } from './shade-heat-sampling-panel.js';

const node = (tag, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
const svg = (tag, attrs = {}) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); return e; };
const display = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
const range = values => Math.abs(values[1] - values[0]) < 1e-8 ? display(values[0]) : values.map(display).join(' to ');
const skyNumber = value => value !== 0 && Math.abs(value) < .0001
  ? value.toExponential(3) : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 6 });
const skyRange = values => values[0] === values[1] ? skyNumber(values[0]) : values.map(skyNumber).join(' to ');
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
    <details id="shade-settings"><summary>Location, dated exposure and declared weather</summary><form id="shade-form"><div class="obs-actions"><label class="shade-file">Use NASA POWER hourly JSON<input id="shade-weather-import" type="file" accept=".json,application/json"></label><button id="shade-weather-clear" type="button" hidden>Use constant weather</button></div><p id="shade-weather-basis" class="mini-note">Use declared constant weather below, or import one complete UTC day of POWER direct-normal, diffuse-horizontal and two-metre temperature records.</p><div class="shade-fields">${[...pathFields, ...weatherFields].map(([key, label, type]) => `<label class="input-label">${label}<input id="shade-${key}" type="${type}" ${type === 'number' ? 'step="any"' : 'maxlength="400"'} required></label>`).join('')}</div><fieldset><legend>Diffuse sky</legend><label class="input-label"><span><input id="shade-sky-enabled" type="checkbox"> Include mapped diffuse-sky obstruction</span></label>
    <p class="mini-note">This optional model treats the sky as equally bright. Declared opaque columns and stepped terrain attenuate diffuse light at the saved ground point. Off-map objects remain unknown.</p>
    <label class="input-label">Sky calculation<select id="shade-sky-method" disabled><option value="sampled">Weighted direction samples</option><option value="continuous-columns">Continuous column horizon</option></select></label>
    <div id="shade-sky-sampling" class="shade-fields"><label class="input-label">Directions around the horizon<input id="shade-sky-azimuthSamples" type="number" min="4" max="128" step="4" value="32" required disabled></label><label class="input-label">Elevation bands<input id="shade-sky-elevationBands" type="number" min="1" max="64" step="1" value="16" required disabled></label></div>
    <p id="shade-sky-method-basis" class="mini-note"></p></fieldset><button id="shade-run" type="submit" class="primary">Compare shade and heat</button></form></details>
    <p class="mini-note">Direct beam is projected onto horizontal ground. Diffuse input uses its original value by default; the optional mapped-sky calculation attenuates it under an equally bright sky assumption. Reflected light is omitted. Temperature also depends on each saved material declaration.</p>
    <p id="shade-status" role="status"></p><div id="shade-results"></div>
    <button id="shade-export" type="button" disabled>Download original site + investigation inputs</button>
    <p class="mini-note">The download includes the declared geographic location and original site. Reopening recomputes the comparison without replacing the working site.</p>`;
  document.querySelector('#heat-column').after(panel);
  const $ = id => panel.querySelector('#' + id);
  let source = null, sourceMode = '', signature = '', generation = 0, accepted = null, selectedIndex = 0, store = 'surfaceC', hourlyWeather = null;
  const sampling = mountShadeHeatSampling({ host: panel,
    getAccepted: () => accepted?.investigation.declaration.diffuseSky ? null : accepted, notice });

  const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-worker.js', import.meta.url), { type: 'module' }));
  function skyMode() {
    const enabled = $('shade-sky-enabled').checked;
    const continuous = $('shade-sky-method').value === 'continuous-columns';
    $('shade-sky-method').disabled = !enabled;
    $('shade-sky-sampling').hidden = continuous;
    for (const key of ['azimuthSamples', 'elevationBands']) $('shade-sky-' + key).disabled = !enabled || continuous;
    $('shade-sky-method-basis').textContent = continuous
      ? 'Integrates the whole visible sky above the declared column horizon. There is no direction grid to choose. Numerical rounding, uncertain heights and omitted objects still limit the result; direct beam keeps its existing time samples.'
      : 'Use at most 4096 weighted directions. Changing this grid tests sampling sensitivity; the displayed geometry ranges do not bound sampling error.';
  }
  function state(message, kind = 'not-compared') { $('shade-status').textContent = message; $('shade-status').dataset.state = kind; }
  function invalidate(message) {
    generation++; computation.cancel(); accepted = null;
    sampling.invalidate('Source or declarations changed. Accept the hourly comparison again before comparing its solar grids.');
    $('shade-results').replaceChildren(); $('shade-export').disabled = true;
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
    $('shade-sky-enabled').checked = Boolean(declaration?.diffuseSky);
    $('shade-sky-method').value = declaration?.diffuseSky?.method === 'continuous-columns' ? 'continuous-columns' : 'sampled';
    $('shade-sky-azimuthSamples').value = declaration?.diffuseSky?.azimuthSamples ?? 32;
    $('shade-sky-elevationBands').value = declaration?.diffuseSky?.elevationBands ?? 16;
    skyMode();
    hourlyWeather = declaration?.weather ? { ...declaration.weather } : null; weatherMode();
    for (const [key] of pathFields) $('shade-' + key).value = declaration?.path?.[key] ?? '';
    for (const [key] of weatherFields) $('shade-' + key).value = declaration?.[key] ?? '';
  }
  function read() {
    const declaration = { path: {} };
    if ($('shade-sky-enabled').checked) declaration.diffuseSky = $('shade-sky-method').value === 'continuous-columns'
      ? { method: 'continuous-columns' } : {
      azimuthSamples: Number($('shade-sky-azimuthSamples').value),
      elevationBands: Number($('shade-sky-elevationBands').value),
    };
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
    accepted = next;
    sampling.invalidate(next.report.diffuseSky
      ? 'Solar-grid comparison currently uses uniform diffuse input. Turn off mapped diffuse-sky obstruction and compare the hourly source again, or reopen original sampling inputs.'
      : 'Hourly comparison replaced. Compare its solar grids to inspect sampling sensitivity.');
    source = next.investigation.project; sourceMode = mode; fill(next.investigation.declaration);
    selectedIndex = next.report.trajectory.length - 1; basis(); draw(); $('shade-export').disabled = false; $('shade-run').disabled = false;
    state(`Compared ${next.report.intervals.length} midpoint intervals at the saved ground point. Temperature ranges retain unresolved mapped ${next.report.diffuseSky ? 'beam and diffuse' : 'beam'} obstruction.`, 'compared');
  }
  async function run(event) {
    event?.preventDefault();
    try {
      if (!source) throw Error('Choose original site declarations first');
      const declaration = read(), project = structuredClone(source), mode = sourceMode;
      invalidate('Calculating the dated shade and thermal response…'); const request = generation; $('shade-run').disabled = true;
      try {
        const next = await computation.compute({ operation: 'prepare', project, declaration });
        if (request === generation) result(next, mode);
      } catch (error) { if (request === generation && error.code !== 'superseded') { state(error.message, 'refused'); notice(error.message); } }
      finally { if (request === generation) { $('shade-run').disabled = !source; $('shade-export').disabled = !accepted || computation.pending; } }
    } catch (error) { invalidate(error.message); state(error.message, 'refused'); }
  }
  $('shade-form').addEventListener('submit', run);
  $('shade-sky-enabled').addEventListener('input', skyMode);
  $('shade-sky-method').addEventListener('input', skyMode);
  for (const el of panel.querySelectorAll('form input:not([type=file]), form select')) el.addEventListener('input', () => invalidate('Inputs changed. Compare again to inspect the new assumptions.'));
  $('shade-weather-clear').addEventListener('click', () => {
    hourlyWeather = null; weatherMode(); invalidate('Hourly weather detached. Declare constant irradiance, reservoir and their source before comparing.');
  });
  $('shade-weather-import').addEventListener('change', async () => {
    const file = $('shade-weather-import').files?.[0]; if (!file) return; $('shade-weather-import').value = '';
    const request = ++generation; computation.cancel(); $('shade-export').disabled = true; $('shade-run').disabled = true;
    state('Reading original hourly weather.' + (accepted ? ' The previous accepted comparison remains visible.' : ''), 'weather-pending');
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
    finally { if (request === generation) { $('shade-run').disabled = !source; $('shade-export').disabled = !accepted || computation.pending; } }
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
    const request = ++generation; computation.cancel(); $('shade-export').disabled = true; $('shade-run').disabled = true;
    state('Reading and recomputing original investigation inputs.' + (accepted ? ' The previous accepted comparison remains visible.' : ''), 'file-pending');
    try {
      checkShadeHeatBytes(file.size); const text = await file.text(); if (request !== generation) return;
      const next = await computation.compute({ operation: 'parse', text }); if (request !== generation) return;
      result(next, 'Reopened original source');
    } catch (error) { if (request === generation) { state('File refused: ' + error.message + '. The prior accepted investigation is retained.', 'file-refused'); notice(error.message); } }
    finally { if (request === generation) { $('shade-run').disabled = !source; $('shade-export').disabled = !accepted || computation.pending; } }
  });
  $('shade-export').addEventListener('click', async () => {
    if (!accepted || computation.pending) return;
    const request = generation; $('shade-export').disabled = true;
    try {
      const { project, declaration } = accepted.investigation;
      const text = await computation.compute({ operation: 'serialize', project, declaration });
      if (request !== generation) return;
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = 'experimental-earth-shade-heat-inputs.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { if (request === generation && error.code !== 'superseded') { state(error.message, 'refused'); notice(error.message); } }
    finally { if (request === generation) $('shade-export').disabled = !accepted || computation.pending; }
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
    for (const label of ['Quantity · kJ/m²', report.diffuseSky ? 'Existing lower / upper incident input' : 'Existing lower / upper beam', report.diffuseSky ? 'Proposal lower / upper incident input' : 'Proposal lower / upper beam']) head.append(node('th', label)); table.append(head);
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
    const chart = svg('svg', { viewBox: `0 0 ${width} 270`, role: 'img', 'aria-label': 'Temperature through time; existing orange, proposed green; filled bands retain uncertain mapped ' + (report.diffuseSky ? 'beam and diffuse light' : 'beam') }); chart.id = 'shade-chart';
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
    host.append(chart, node('p', 'Temperature °C · elapsed minutes. Orange: existing. Green: proposal. Bands concern mapped ' + (report.diffuseSky ? 'beam and diffuse' : 'beam') + ' ambiguity within each sampled interval.'));
    const storeName = store === 'surfaceC' ? 'surface' : 'subsurface';
    const summary = node('p'); summary.id = 'shade-summary';
    summary.textContent = ['existing', 'proposal'].map(target => `${target} maximum: ${range(report.summary[target][storeName].maximumRangeC)} °C; ${report.summary[target].ambiguousIntervals} intervals with unresolved ${report.diffuseSky ? 'incident input' : 'beam'}`).join('. ') + '.';
    host.append(summary);
    if (report.diffuseSky) {
      const sky = report.diffuseSky, details = node('details'); details.id = 'shade-sky-inspection';
      details.append(node('summary', 'Inspect the mapped diffuse sky'));
      if (report.declaration.diffuseSky.method === 'continuous-columns') {
        details.dataset.method = 'continuous-columns';
        details.append(node('p', ['existing', 'proposal'].map(target => target + ' continuous diffuse transmission: '
          + skyRange(sky[target].transmission.map(value => value * 100)) + '%').join('. ') + '.'));
        details.append(node('p', 'The column horizon is integrated over all azimuths and visible elevations. These ranges vary declared roof heights; numerical rounding, omitted objects and physical prediction error are not enclosed. Direct beam retains its original sampled grazing convention.'));
        const choiceLabel = node('label', 'Inspect a declared skyline'); choiceLabel.className = 'input-label';
        const choice = node('select'); choice.id = 'shade-sky-scenario';
        for (const target of ['existing', 'proposal']) for (const roofs of ['minimumRoofs', 'maximumRoofs']) {
          const option = node('option', target + ' · ' + (roofs === 'minimumRoofs' ? 'minimum roofs' : 'maximum roofs'));
          option.value = target + ':' + roofs; choice.append(option);
        }
        choice.value = 'proposal:maximumRoofs'; choiceLabel.append(choice);
        const sectorLabel = node('label', 'Inspect an angular sector'); sectorLabel.className = 'input-label';
        const sector = node('input'); sector.id = 'shade-sky-sector'; sector.type = 'range'; sector.min = 0; sector.step = 1; sector.value = 0; sectorLabel.append(sector);
        const inspection = node('div'); inspection.id = 'shade-sky-arc';
        const show = () => {
          const [target, roofs] = choice.value.split(':'), skyline = sky[target][roofs];
          sector.max = Math.max(0, skyline.arcs.length - 1); sector.value = Math.min(Number(sector.value), Number(sector.max));
          const arc = skyline.arcs[Number(sector.value)]; inspection.replaceChildren();
          if (!arc) { inspection.append(node('p', 'No numerically resolved angular sector.')); return; }
          inspection.dataset.sector = sector.value;
          inspection.append(node('p', target + ' · ' + (roofs === 'minimumRoofs'
            ? 'Minimum roofs give the upper diffuse transmission estimate.'
            : 'Maximum roofs give the lower diffuse transmission estimate.')));
          inspection.append(node('p', 'Sector ' + (Number(sector.value) + 1) + ' of ' + skyline.arcs.length + ': headings '
            + display(arc.headingStartDeg) + '–' + display(arc.headingEndDeg) + '° from increasing grid columns; angular width '
            + skyNumber(arc.angularWidthRad * 180 / Math.PI) + '°.'));
          inspection.append(node('p', arc.controller
            ? 'Horizon set by mapped cell ' + (arc.controller.cellIndex + 1) + ' (' + arc.controller.kind + '): ' + arc.controller.source
            : 'No mapped roof rises above the receiver in this sector.'));
          inspection.append(node('p', 'This sector contributes ' + skyNumber(arc.projectedIntegral / (2 * Math.PI) * 100) + '% of unobstructed horizontal diffuse input.'));
          if (skyline.collapsedSectors || skyline.transmissionClamped)
            inspection.append(node('p', 'Numerical diagnostics: ' + skyline.collapsedSectors + ' unresolved duplicate sectors totaling '
              + skyline.omittedAngularWidthRad.toExponential(3) + ' radians; transmission projection applied: ' + skyline.transmissionClamped + '.'));
        };
        choice.addEventListener('change', () => { sector.value = 0; show(); }); sector.addEventListener('input', show);
        details.append(choiceLabel, sectorLabel, inspection); show(); host.append(details);
      } else {
      details.append(node('p', ['existing', 'proposal'].map(target => target + ' diffuse transmission: '
        + range(sky[target].transmission.map(value => value * 100)) + '%; '
        + sky[target].ambiguousDirections + ' unresolved directions').join('. ') + '.'));
      details.append(node('p', sky.sampleCount + ' equally weighted directions. These ranges concern mapped geometry on the chosen grid; angular-sampling error and unknown off-map objects are not enclosed.'));
      const label = node('label', 'Inspect a sky direction'); label.className = 'input-label';
      const direction = node('input'); direction.id = 'shade-sky-direction'; direction.type = 'range';
      direction.min = 0; direction.max = sky.directions.length - 1; direction.step = 1; direction.value = 0; label.append(direction);
      const inspection = node('div'); inspection.id = 'shade-sky-ray';
      const show = () => {
        const ray = sky.directions[Number(direction.value)]; inspection.replaceChildren();
        inspection.append(node('p', 'Heading from increasing grid columns: ' + display(ray.headingDeg) + '°; elevation: ' + display(ray.elevationDeg) + '°.'));
        for (const target of ['existing', 'proposal']) inspection.append(node('p', target + ': ' + ray[target].status
          + (ray[target].witness ? '; mapped cell ' + (ray[target].witness.cellIndex + 1) + ': ' + ray[target].witness.source : '')));
      };
      direction.addEventListener('input', show); details.append(label, inspection); show(); host.append(details);
      }
    }
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

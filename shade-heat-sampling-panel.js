import { mountCoolingWindow } from './shade-heat-window-view.js';
import { pairedShadeCooling, greatestSampledCooling } from './shade-heat-benefit.js';
import { prepareShadeHeatSampling, parseShadeHeatSampling } from './shade-heat-sampling.js';
import { checkShadeHeatBytes } from './shade-heat.js';

const node = (tag, text = '') => { const el = document.createElement(tag); el.textContent = text; return el; };
const svg = (tag, attributes = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
  return el;
};
const number = value => Number(value).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const signed = value => (value > 0 ? '+' : '') + number(value);
const pair = (lower, upper) => number(lower) + ' / ' + number(upper);
const grids = [[60, '#7441ac'], [30, '#a95500'], [15, '#0076a8']];
const labelForTarget = target => target === 'existing' ? 'Existing site' : 'Proposed site';
const labelForStore = store => store === 'surfaceC' ? 'Ground surface' : 'Lower heat store';

export function mountShadeHeatSampling({ host, getAccepted, notice }) {
  const panel = node('section'); panel.id = 'shade-sampling'; panel.className = 'shade-sampling';
  panel.innerHTML = '<h3>Does the solar sampling grid change the heat result?</h3>' +
    '<p>Keep the original hourly weather and site declarations. Compare solar and mapped-shadow samples every 60, 30 and 15 minutes, with a complete thermal course for each grid.</p>' +
    '<div class="obs-actions"><button id="shade-sampling-run" type="button" disabled>Compare three solar grids</button>' +
    '<label class="shade-file">Reopen sampling inputs<input id="shade-sampling-import" type="file" accept=".json,application/json"></label>' +
    '<button id="shade-sampling-export" type="button" disabled>Download sampling inputs</button></div>' +
    '<p class="mini-note">Use an accepted hourly comparison above, or reopen original sampling inputs. The download retains the original site, geographic location and complete uploaded weather JSON.</p>' +
    '<p id="shade-sampling-status" role="status"></p><div id="shade-sampling-results"></div>';
  host.append(panel);
  const $ = id => panel.querySelector('#shade-sampling-' + id);
  let accepted = null, generation = 0, pending = false, target = 'proposal', store = 'surfaceC', minute = 1440;
  let sourceMode = '';
  const windowView=mountCoolingWindow({host:panel,getAccepted:()=>accepted,beginImport:()=>{const retired=pending;generation++;pending=false;controls();if(retired)state(accepted?'The prior accepted sampling comparison is retained.':'No sampling comparison has been accepted.',accepted?'compared':'not-compared');},adopt:next=>{generation++;receive(next,'Reopened window inputs');},jump:(at,field)=>{minute=at;store=field;draw();$('inspect').scrollIntoView({block:'nearest'});}});
  const sampledCache = new WeakMap();
  const hourlyParent = () => getAccepted()?.investigation?.declaration?.weather ? getAccepted() : null;
  function state(message, kind) { $('status').textContent = message; $('status').dataset.state = kind; }
  function controls() { $('run').disabled = pending || !hourlyParent(); $('export').disabled = pending || !accepted; }
  function invalidate(message = 'Compare the accepted hourly source to inspect its solar sampling sensitivity.') {
    windowView.invalidate(); generation++; pending = false; accepted = null; $('results').replaceChildren(); controls(); state(message, 'not-compared');
  }
  function receive(next, mode) {
    windowView.invalidate(); accepted = next; sourceMode = mode; pending = false; draw(); controls();
    state('Compared all three complete solar grids from the same original hourly source. Sampling differences and beam ambiguity remain separate.', 'compared');
  }
  $('run').addEventListener('click', () => {
    const parent = hourlyParent();
    if (!parent) { invalidate('Accept one complete original hourly weather comparison above before comparing solar grids.'); return; }
    invalidate('Calculating the three complete solar grids…'); pending = true; controls();
    const request = generation;
    setTimeout(() => {
      if (request !== generation || getAccepted() !== parent) return;
      try {
        const source = parent.investigation;
        const next = prepareShadeHeatSampling(source.project, source.declaration);
        if (request === generation && getAccepted() === parent) receive(next, 'Accepted hourly comparison');
      } catch (error) {
        if (request === generation) { state(error.message, 'refused'); notice(error.message); }
      } finally {
        if (request === generation) { pending = false; controls(); }
      }
    }, 20);
  });
  $('import').addEventListener('change', async () => {
    const file = $('import').files?.[0]; if (!file) return;
    $('import').value = ''; windowView.cancelPending();
    const request = ++generation, parent = getAccepted();
    pending = true; controls(); state('Reading original sampling inputs…', 'reading');
    try {
      checkShadeHeatBytes(file.size);
      const bytes = await file.arrayBuffer();
      if (request !== generation || getAccepted() !== parent) return;
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const next = parseShadeHeatSampling(text);
      if (request === generation && getAccepted() === parent) receive(next, 'Reopened sampling inputs');
    } catch (error) {
      if (request === generation) {
        state('File refused: ' + error.message + (accepted ? '. The prior accepted sampling comparison is retained.' : '. No sampling comparison has been accepted.'), 'file-refused');
        notice(error.message);
      }
    } finally {
      if (request === generation) { pending = false; controls(); }
    }
  });
  $('export').addEventListener('click', () => {
    if (!accepted || pending) return;
    try {
      const text = JSON.stringify(accepted.investigation, null, 2);
      checkShadeHeatBytes(new Blob([text]).size);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = node('a'); link.href = url; link.download = 'experimental-earth-shade-heat-sampling-inputs.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { state(error.message, 'refused'); notice(error.message); }
  });
  function table(caption, headings, rows) {
    const outer = node('div'); outer.className = 'shade-sampling-table';
    const title = node('p', caption); title.className = 'shade-sampling-caption'; title.setAttribute('aria-hidden', 'true');
    const scroll = node('div'); scroll.className = 'shade-sampling-scroll'; scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', caption);
    const result = node('table'), semanticCaption = node('caption', caption), head = node('thead'), labels = node('tr'), body = node('tbody');
    for (const heading of headings) { const cell = node('th', heading); cell.scope = 'col'; labels.append(cell); }
    head.append(labels); result.append(semanticCaption, head, body);
    for (const values of rows) {
      const row = node('tr');
      values.forEach((value, index) => { const cell = node(index === 0 ? 'th' : 'td', value); if (index === 0) cell.scope = 'row'; row.append(cell); });
      body.append(row);
    }
    scroll.append(result); outer.append(title, scroll); return outer;
  }
  function choice(label, id, values, selected, change) {
    const wrapper = node('label', label); wrapper.className = 'input-label';
    const select = node('select'); select.id = 'shade-sampling-' + id;
    for (const [value, title] of values) { const option = node('option', title); option.value = value; select.append(option); }
    select.value = selected; select.addEventListener('change', () => change(select.value)); wrapper.append(select); return wrapper;
  }
  function chart(report) {
    const all = report.courses.flatMap(course => ['lower', 'upper'].flatMap(bound => course.targets[target][bound].trajectory.map(row => row[store])));
    let low = Infinity, high = -Infinity;
    for (const value of all) { low = Math.min(low, value); high = Math.max(high, value); }
    const padding = Math.max(1, (high - low) * .1), width = Math.max(280, Math.min(700, $('results').clientWidth || 700)), right = width - 18;
    const x = time => 48 + (right - 48) * time / 1440;
    const y = temperature => 225 - 200 * (temperature - low + padding) / (high - low + 2 * padding);
    const result = svg('svg', { viewBox: '0 0 ' + width + ' 270', role: 'img',
      'aria-label': labelForTarget(target) + ', ' + labelForStore(store) + ': three solar sampling grids with separate beam ambiguity bands' });
    result.id = 'shade-sampling-chart';
    for (let i = 0; i <= 4; i++) {
      const value = low - padding + (high - low + 2 * padding) * i / 4;
      result.append(svg('line', { x1: 48, x2: right, y1: y(value), y2: y(value), stroke: '#dce6df' }));
      const tick = svg('text', { x: 42, y: y(value) + 4, 'text-anchor': 'end' }); tick.textContent = value.toFixed(1); result.append(tick);
    }
    for (const fraction of width < 500 ? [0, .5, 1] : [0, .25, .5, .75, 1]) {
      const tick = svg('text', { x: x(fraction * 1440), y: 248, 'text-anchor': 'middle' }); tick.textContent = String(fraction * 1440); result.append(tick);
    }
    for (const [step, color] of grids) {
      const course = report.courses.find(row => row.solarStepMinutes === step);
      const points = bound => course.targets[target][bound].trajectory.map(row => x(row.minute) + ',' + y(row[store]));
      result.append(svg('path', { d: 'M' + points('lower').join(' L') + ' L' + points('upper').reverse().join(' L') + ' Z',
        fill: color, 'fill-opacity': .14, 'data-grid': step, 'data-kind': 'beam-band' }));
      for (const bound of ['lower', 'upper']) result.append(svg('path', { d: 'M' + points(bound).join(' L'), fill: 'none',
        stroke: color, 'stroke-width': 2, 'data-grid': step, 'data-bound': bound, ...(bound === 'upper' ? { 'stroke-dasharray': '6 3' } : {}) }));
    }
    return result;
  }
  function inspect() {
    const host = $('inspect'), report = accepted.report; host.replaceChildren(); host.dataset.minute = minute;
    const utc = new Date(Date.parse(report.declaration.path.startUtc) + minute * 60000).toISOString();
    host.append(node('h4', 'Common minute ' + minute + ' · ' + utc.replace('.000Z', 'Z')));
    const rows = [];
    for (const course of report.courses) {
      const values = ['lower', 'upper'].map(bound => course.targets[target][bound].trajectory.find(row => row.minute === minute)[store]);
      rows.push([course.solarStepMinutes + ' min', pair(...values) + ' °C']);
    }
    host.append(table(labelForTarget(target) + ' · ' + labelForStore(store) + ' · lower / upper beam', ['Solar grid', 'Temperature'], rows));
    const inspector = node('div'); inspector.className = 'shade-sampling-forcing';
    for (const course of report.courses) {
      const interval = course.intervals.find(row => minute >= row.fromMinute && minute < row.toMinute) ?? course.intervals.at(-1);
      const source = interval.weather, ray = interval[target], item = node('div');
      item.dataset.grid = course.solarStepMinutes; item.dataset.sourceHour = source.sourceKey;
      item.append(node('h4', course.solarStepMinutes + '-minute solar grid'),
        node('p', 'Forcing interval ' + interval.fromMinute + '–' + interval.toMinute + ' min; sun sampled at ' + interval.sampleUtc.replace('.000Z', 'Z') + '.'),
        node('p', 'Original weather hour ' + source.sourceKey + ': direct-normal ' + number(source.original.ALLSKY_SFC_SW_DNI) + ' Wh/m²; diffuse-horizontal ' +
          number(source.original.ALLSKY_SFC_SW_DIFF) + ' Wh/m² over one hour; ambient reservoir ' + number(source.reservoirC) + ' °C.'),
        node('p', labelForTarget(target) + ': ' + ray.status + '; incident ' + pair(ray.irradiance.lower, ray.irradiance.upper) + ' W/m².' +
          (ray.witness ? ' Mapped witness cell ' + (ray.witness.cellIndex + 1) + ': ' + ray.witness.source : '')));
      inspector.append(item);
    }
    host.append(inspector);
    const paired = $('benefit'); paired.replaceChildren();
    paired.append(table('Paired cooling · existing minus proposed · ' + labelForStore(store),
      ['Solar grid', 'At common minute ' + minute + ' · °C', 'Daily mean cooling · °C', 'Difference of separate peaks · °C'],
      pairedShadeCooling(report, minute, store).map(row => [row.solarStepMinutes + ' min',
        ...[row.cooling, row.meanCooling, row.separatePeakDifference].map(v => pair(v.lowerC, v.upperC))])));
    paired.append(node('p', 'Positive cooling means the proposed site is cooler; negative means warmer. Bounds subtract independent beam ranges: existing lower minus proposed upper, and existing upper minus proposed lower. Their extremes need not be jointly attainable. Separate daily peaks can occur at different times; their difference is not the greatest coincident cooling. Each solar grid remains separate; these ranges do not bound sampling error.'));
    for (const course of report.courses) for (const bound of ['lower', 'upper']) {
      const point = course.targets[target][bound].trajectory.find(row => row.minute === minute);
      host.dataset['grid' + course.solarStepMinutes + (bound === 'lower' ? 'Lower' : 'Upper')] = point[store];
    }
  }
  function draw() {
    if (!accepted) return;
    const host = $('results'), report = accepted.report, source = accepted.investigation.source;
    host.replaceChildren(); host.dataset.sourceMode = sourceMode;
    host.append(node('p', sourceMode + ' · ' + source.project.title + ' · ' + source.declaration.path.startUtc.slice(0, 10) + ' UTC. All 12 thermal courses are complete.'));
    const selectors = node('div'); selectors.className = 'shade-sampling-selectors';
    selectors.append(choice('Site to inspect', 'target', [['existing', 'Existing site'], ['proposal', 'Proposed site']], target, value => { target = value; draw(); }),
      choice('Temperature to inspect', 'store', [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']], store, value => { store = value; draw(); }));
    host.append(selectors, chart(report));
    const legend = node('ul'); legend.className = 'shade-sampling-legend';
    for (const [step, color] of grids) { const item = node('li', step + '-minute solar grid'); item.style.color = color; legend.append(item); }
    host.append(legend, node('p', 'Temperature °C · elapsed minutes. Solid and dashed lines retain the lower and upper mapped-beam courses for each grid. Each shaded band concerns beam ambiguity only; it does not bound sampling error.'));
    const storeName = store === 'surfaceC' ? 'surface' : 'subsurface';
    const summary = table('Complete courses · values are lower / upper beam',
      ['Solar grid', 'Day mean · °C', 'Thermal peak · °C', 'Day endpoint · °C'], report.courses.map(course => {
        const a = course.targets[target].lower, b = course.targets[target].upper;
        return [course.solarStepMinutes + ' min · ' + course.intervals.length + ' intervals', pair(a.means[store], b.means[store]),
          pair(a[storeName].maximumC, b[storeName].maximumC), pair(a.final[store], b.final[store])];
      }));
    summary.id = 'shade-sampling-summary'; host.append(summary);
    const differences = table('Grid sensitivity · signed changes are finer minus coarser',
      ['Grid change · beam', 'Largest sampled difference · °C', 'At minute', 'Endpoint change · °C', 'Mean change · °C', 'Peak change · °C'],
      report.differences.filter(row => row.target === target).map(row => {
        const result = row[storeName];
        return [row.coarseMinutes + '→' + row.fineMinutes + ' min · ' + row.bound, number(result.maxSampledDifferenceC), String(result.atMinute),
          signed(result.finalDifferenceC), signed(result.meanDifferenceC), signed(result.maximumDifferenceC)];
      }));
    differences.id = 'shade-sampling-differences'; host.append(differences,
      node('p', 'The largest difference is over the 1,441 common integer-minute samples. Means use duration-weighted analytic interval means; peaks include interval boundaries and thermal turning points. Differences can reverse direction. These comparisons do not establish convergence or that 15-minute samples are best.'));
    let byStore = sampledCache.get(report);
    if (!byStore) { byStore = new Map(); sampledCache.set(report, byStore); }
    if (!byStore.has(store)) byStore.set(store, greatestSampledCooling(report, store));
    const maxima = byStore.get(store);
    const maximumTable = table('Greatest coincident cooling among 1,441 common-minute samples · ' + labelForStore(store),
      ['Solar grid', 'Lower curve maximum · °C', 'Its earliest minute', 'Upper curve maximum · °C', 'Its earliest minute'],
      maxima.map(row => [row.solarStepMinutes + ' min', number(row.lower.coolingC), '', number(row.upper.coolingC), '']));
    maximumTable.id = 'shade-sampling-max-cooling';
    [...maximumTable.querySelectorAll('tbody tr')].forEach((tr, index) => {
      for (const [bound,column] of [['lower',2],['upper',4]]) {
        const result=maxima[index][bound], jump=node('button', String(result.minute));
        jump.type='button'; jump.dataset.grid=maxima[index].solarStepMinutes; jump.dataset.bound=bound;
        jump.setAttribute('aria-label','Inspect '+maxima[index].solarStepMinutes+' minute grid '+bound+' cooling maximum at minute '+result.minute);
        jump.addEventListener('click',()=>{ minute=result.minute; $('time').value=minute; inspect(); $('inspect').scrollIntoView({block:'nearest'}); });
        tr.children[column].append(jump);
      }
    });
    host.append(maximumTable,node('p','Each bound has its own earliest sampled maximum time. These times can differ; the two extrema need not be jointly attainable. No maximum between integer-minute samples, continuous-time bound or finest-grid preference is inferred.'));
    const time = node('label', 'Inspect a common minute'); time.className = 'input-label';
    const slider = node('input'); slider.id = 'shade-sampling-time'; slider.type = 'range'; slider.min = 0; slider.max = 1440; slider.step = 1; slider.value = minute;
    slider.addEventListener('input', () => { minute = Number(slider.value); inspect(); }); time.append(slider);
    const inspector = node('div'); inspector.id = 'shade-sampling-inspect'; const benefit = node('div'); benefit.id = 'shade-sampling-benefit'; host.append(time, benefit, inspector); inspect();
    const energy = node('details'); energy.id = 'shade-sampling-energy'; energy.append(node('summary', 'Inspect final cumulative energy from the original initial state'));
    energy.append(table(labelForTarget(target) + ' · cumulative energy, kJ/m²',
      ['Grid · beam', 'Absorbed input', 'Ambient exchange out', 'Surface stored change', 'Lower stored change', 'Balance residual'],
      report.courses.flatMap(course => ['lower', 'upper'].map(bound => {
        const f = course.targets[target][bound].final;
        return [course.solarStepMinutes + ' min · ' + bound, ...['inputJm2', 'exchangeOutJm2', 'surfaceStoredJm2', 'subsurfaceStoredJm2', 'balanceResidualJm2'].map(key => number(f[key] / 1000))];
      }))), node('p', 'Signed ambient exchange may supply heat. Surface plus lower stored change equals absorbed input minus ambient exchange within floating-point precision. Internal transfer cancels in the two-store total.'));
    host.append(energy);
    const evidence = node('details'); evidence.id = 'shade-sampling-sources'; evidence.append(node('summary', 'Original declarations, work budget and model limits'));
    evidence.append(node('p', source.project.source), node('p', source.declaration.path.locationSource), node('p', source.declaration.path.orientationSource));
    const weather = report.weatherSource;
    evidence.append(node('p', 'Uploaded declaration: ' + weather.title + '; ' + weather.api.name + ' ' + weather.api.version + '; ' + weather.sources.join(', ') + '. File metadata does not authenticate origin.'),
      node('p', 'Original hourly weather values remain unchanged within each original hour. No subhourly weather is created. The complete 24 + 48 + 96 interval comparison preflights ' + report.estimatedRayTests.toLocaleString('en-US') + ' ray checks against the shared 16 million limit.'));
    for (const name of ['existing', 'proposal']) evidence.append(
      node('p', name + ' surface: ' + source.project.heatColumnStudy.heatStudy[name].source),
      node('p', name + ' lower: ' + source.project.heatColumnStudy.lowerLayers[name].source));
    evidence.append(node('p', report.semantics)); host.append(evidence);
  }
  window.addEventListener('resize', () => { if (accepted) draw(); });
  invalidate(); return { invalidate };
}

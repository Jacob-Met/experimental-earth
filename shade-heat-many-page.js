import { node, number, signed, point, table } from './shade-heat-epoch-view.js';
import { drawManyWitness } from './shade-heat-many-view.js';
import { originalSkyReadingTimes, prepareTimedSkyReadingSource } from './shade-heat-timed-reading-source.js';
import { prepareManySkyCourseSource } from './shade-heat-many-course.js';
import { sub } from './vendor/chronos/exact-halfplanes.mjs';
import { profileFraction } from './shade-heat-profile-band.js';
import { checkShadeHeatBytes } from './shade-heat.js';
import { createShadeHeatComputation } from './shade-heat-computation.js';
import { parseManyOriginals } from './shade-heat-many-inputs.js';
import { courseWitnessDifferences } from './shade-heat-course-inputs.js';

const $ = id => document.querySelector('#many-' + id);
const computation = createShadeHeatComputation(() => new Worker(new URL('./shade-heat-many-worker.js', import.meta.url), { type: 'module' }));
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];
let originals = null, primary = 0, editing = null, accepted = null, generation = 0, reading = false, selectedTime = 0, selectedWitness = null;
const pending = () => reading || computation.pending;
const split = () => $('split').value.trim() ? Number($('split').value) : NaN;
const compact = value => (value > 0 ? '+' : '') + (value !== 0 && Math.abs(value) < .000001
  ? value.toExponential(4) : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 7 }));
const timeText = utc => utc.slice(11, utc.slice(17, 19) === '00' ? 16 : 19);
function state(text, kind) { $('status').textContent = text; $('status').dataset.state = kind; }
function controls() { $('run').disabled = pending() || !originals || editing !== null; $('export').disabled = pending() || !accepted || editing !== null;
  document.querySelectorAll('#many-sources input[type=radio]').forEach(e=>{e.disabled=editing!==null;});
  document.querySelectorAll('.source-edit form').forEach(form=>{for(const e of form.querySelectorAll('input,select,textarea,button'))e.disabled=editing!==null&&Number(form.dataset.reading)!==editing;});
}
function clearResult() {
  accepted = null; $('results').replaceChildren(); $('results').hidden = true;
  for (const key of Object.keys($('results').dataset)) delete $('results').dataset[key];
}
function invalidate(message) { generation++; reading = false; computation.cancel(); clearResult(); controls(); state(message, 'not-compared'); }
function startFile(message) { computation.cancel(); const request = ++generation; reading = true; controls(); state(message, 'file-pending'); return request; }
function updateBoundaryHint() {
  if (!originals) { $('boundary').textContent = 'Choose an existing boundary with a whole interval on each side.'; return; }
  const path = originals[0].source.declaration.path;
  const count = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
  $('split').max = String(count - 1);
  const value = split();
  $('boundary').textContent = Number.isInteger(value) && value >= 1 && value < count
    ? 'Declared change: ' + new Date(Date.parse(path.startUtc) + value * path.stepMinutes * 60000).toISOString()
      + '. The initial state and all ' + count + ' original interval ends will be retained.'
    : 'Choose a whole original interval number from 1 to ' + (count - 1) + '. No new time or partial interval is introduced.';
}
function drawSources() {
  updateBoundaryHint();const host=$('sources');host.replaceChildren();
  if(!originals){host.append(node('p','No original readings loaded.'));return;}
  const context=originals,reference=new Set([primary,...originals.map((_,i)=>i).filter(i=>i!==primary)].slice(0,3));
  $('source-summary').textContent=originals.length+' original records · first three in evidence order form the reference';
  originals.forEach((input,index)=>{
    const p=input.source.project,r=input.query.reading,card=node('article');card.className='source-card';
    Object.assign(card.dataset,{primary:String(index===primary),cell:String(r.cellIndex),reading:String(index),utc:r.utc,store:r.store,reference:String(reference.has(index))});
    const label=node('label'),radio=node('input');radio.type='radio';radio.name='comparison-point';radio.value=String(index);radio.checked=index===primary;
    radio.addEventListener('input',()=>{
      if(!radio.checked||originals!==context||editing!==null)return;primary=index;
      invalidate('First reading and comparison point changed. The first three records in the new evidence order form the reference family; every loaded record constrains the complete result.');drawSources();
    });
    label.append(radio,node('span','Use as first reading / comparison point'));
    card.append(node('h3','Original reading '+(index+1)+' · '+point(input)),node('p',reference.has(index)?'Reference family and complete record':'Complete record'),label,node('p',p.title),
      node('strong',String(r.temperatureC)+' ± '+String(r.halfWidthC)+' °C'),
      node('p',(r.store==='surfaceC'?'Existing ground surface':'Existing lower heat store')+' · '+r.utc),node('p',r.source));
    const detail=node('p',p.width+' × '+p.height+' original grid · original inquiry used '+input.query.bins+' sky bins.');detail.className='quiet';card.append(detail);
    const edit=node('details');edit.className='source-edit';edit.dataset.reading=String(index);edit.append(node('summary','Revise this attributed reading'));
    edit.append(node('p','Explicitly replace this reading’s UTC, component, value, width or attribution. The complete source course stays fixed.'));
    const form=node('form');form.noValidate=true;form.dataset.reading=String(index);
    const field=(title,element,name)=>{const label=node('label',title);element.dataset.field=name;label.append(element);form.append(label);return element;};
    const time=field('Original UTC of the revised reading',node('select'),'utc');
    for(const t of originalSkyReadingTimes(input.source)){const o=node('option',t.utc.slice(11,19)+' UTC · original '+(t.index?'interval '+t.index:'initial state'));o.value=t.utc;time.append(o);}time.value=r.utc;
    const timeHint=node('p','Revised UTC: '+time.value);timeHint.className='source-time-hint';form.append(timeHint);
    const store=field('Observed temperature component',node('select'),'store');
    for(const [value,title]of stores){const o=node('option',title);o.value=value;store.append(o);}store.value=r.store;
    const temperature=field('Original temperature, °C',node('input'),'temperatureC');temperature.type='number';temperature.step='any';temperature.min='-100';temperature.max='500';temperature.value=String(r.temperatureC);
    const width=field('Original band half-width, °C',node('input'),'halfWidthC');width.type='number';width.step='any';width.min='0';width.max='600';width.value=String(r.halfWidthC);
    const attribution=field('Original reading source',node('textarea'),'source');attribution.maxLength=400;attribution.value=r.source;
    form.addEventListener('input',()=>{
      if(originals!==context||(editing!==null&&editing!==index))return;
      editing=index;timeHint.textContent='Revised UTC: '+time.value;
      invalidate('Reading '+(index+1)+' has unapplied edits. Apply or cancel them before computing.');
    });
    const actions=node('div');actions.className='actions';const apply=node('button','Use revised reading');apply.type='submit';apply.dataset.action='apply-reading';
    const cancel=node('button','Cancel reading edits');cancel.type='button';cancel.dataset.action='cancel-reading';
    cancel.addEventListener('click',()=>{if(originals!==context||(editing!==null&&editing!==index))return;editing=null;invalidate('Original reading retained. Recompute when ready.');drawSources();controls();});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(originals!==context||(editing!==null&&editing!==index))return;
      try{
        const next=prepareTimedSkyReadingSource(p,input.source.declaration,{bins:input.query.bins,reading:{...r,
          utc:time.value,store:store.value,temperatureC:temperature.value.trim()?Number(temperature.value):NaN,
          halfWidthC:width.value.trim()?Number(width.value):NaN,source:attribution.value}});
        const changed=originals.map((value,i)=>i===index?next:value);
        prepareManySkyCourseSource(changed,{bins:4,splitAfterInterval:1,sharingSource:'Validate explicit reading revision without choosing the inquiry boundary.'});
        originals=changed;editing=null;invalidate('Revised original reading admitted. Its source course remains fixed; recompute the inquiry.');drawSources();
      }catch(error){state('Reading edit refused: '+error.message+'. The loaded original is retained.','reading-refused');}
      controls();
    });
    actions.append(apply,cancel);form.append(actions);edit.append(form);card.append(edit);host.append(card);
  });
  controls();
}

function receive(next) {
  accepted = next; originals = next.investigation.readings; primary = 0; editing = null; reading = false;
  $('split').value = String(next.investigation.query.splitAfterInterval); $('sharing').value = next.investigation.query.sharingSource;
  selectedTime = next.report.readings[2].originalIndex;
  selectedWitness = next.report.pointwiseCourse[selectedTime].ranges?.surfaceC.lower.witnessId ?? null;
  drawSources(); $('source-details').open=false; draw(); controls();
  state(next.report.compatibility === 'compatible'
    ? 'All original original-time readings admit a shared profile family. Inspect its paired consequences at ' + next.report.pointwiseCourse.length + ' original times.'
    : 'These original-time readings admit no shared profile at the declared boundary. All original inputs and times remain available; no temperature course is fabricated.', next.report.compatibility);
}
for (const id of ['split', 'sharing']) $(id).addEventListener('input', () => { invalidate('Shared conditions changed. Recompute the original course.'); updateBoundaryHint(); });
$('originals').addEventListener('change', async () => {
  const files = [...($('originals').files ?? [])]; if (!files.length) return; $('originals').value = '';
  const request = startFile('Reading the original temperature evidence…');
  try {
    if (!(files.length === 1 || (files.length >= 3 && files.length <= 24))) throw Error('Choose three to 24 original reading files, or one saved original-reading inquiry');
    checkShadeHeatBytes(files.reduce((total, file) => total + file.size, 0));
    const texts = await Promise.all(files.map(async file => {
      checkShadeHeatBytes(file.size); return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await file.arrayBuffer());
    }));
    if (request !== generation) return;
    const next = parseManyOriginals(texts);
    originals = next.readings; primary = 0; editing = null;
    if (next.sharingSource !== null) $('sharing').value = next.sharingSource;
    clearResult(); drawSources();
    state('All original readings are loaded in evidence order. The first three form the reference; the remaining records may narrow it. Choose the first reading/comparison point and one original change boundary.', 'inputs-ready');
  } catch (error) { if (request === generation) state('Files refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('form').addEventListener('submit', async event => {
  event.preventDefault(); if (!originals || pending() || editing !== null) return;
  const ordered = [originals[primary], ...originals.filter((_, index) => index !== primary)];
  const query = { bins: 4, splitAfterInterval: split(), sharingSource: $('sharing').value };
  invalidate('Evaluating all original pair courses, original-time band constraints and complete witness replays…'); const request = generation;
  try { const promise = computation.compute({ operation: 'prepare', originals: ordered, query }); controls(); const next = await promise; if (request === generation) receive(next); }
  catch (error) { if (request === generation && error.code !== 'superseded') state(error.message, 'refused'); }
  finally { if (request === generation) controls(); }
});
async function parseIntoWorker(text, request) {
  if (request !== generation) return;
  const next = await computation.compute({ operation: 'parse', text });
  if (request === generation) receive(next);
}
$('reopen').addEventListener('change', async () => {
  const file = $('reopen').files?.[0]; if (!file) return; $('reopen').value = '';
  const request = startFile('Reopening original inputs and recomputing the complete course…');
  try {
    checkShadeHeatBytes(file.size); const bytes = await file.arrayBuffer(); if (request !== generation) return;
    await parseIntoWorker(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes), request);
  } catch (error) { if (request === generation && error.code !== 'superseded') state('File refused: ' + error.message + (accepted ? ' The prior accepted inquiry is retained.' : ''), 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('example').addEventListener('click', async () => {
  const request = startFile('Opening all 24 authored original observations across three receivers, with the change declared after original interval 8…');
  try {
    const { makeManySkyExample } = await import('./shade-heat-many-example.js');
    if (request !== generation) return;
    const raw = makeManySkyExample();
    const next = await computation.compute({ operation: 'prepare', originals: raw.readings,
      query: { bins: 4, splitAfterInterval: 8, sharingSource: raw.query.sharingSource } });
    if (request === generation) receive(next);
  } catch (error) { if (request === generation && error.code !== 'superseded') state('Example refused: ' + error.message, 'file-refused'); }
  finally { if (request === generation) { reading = false; controls(); } }
});
$('export').addEventListener('click', () => {
  if (!accepted || pending()) return;
  const text = JSON.stringify(accepted.investigation); checkShadeHeatBytes(new Blob([text]).size);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), link = node('a');
  link.href = url; link.download = 'experimental-earth-many-original-reading-inputs.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function chooseTime(index, witnessId = null) {
  if (!accepted || !Number.isInteger(index) || index < 0 || index >= accepted.report.pointwiseCourse.length) return;
  selectedTime = index;
  if (witnessId !== null && accepted.report.witnesses.some(w => w.id === witnessId)) selectedWitness = witnessId;
  $('time-select').value = String(index); $('time-slider').value = String(index);
  if ($('witness-select')) $('witness-select').value = String(selectedWitness);
  drawTime(); drawPlots(); if (witnessId !== null) drawWitness();
}
function rangeText(range) { return compact(range.lower.differenceC.lower) + ' to ' + compact(range.upper.differenceC.upper); }
function exactText(value) { return value.exact.numerator + ' / ' + value.exact.denominator; }
function drawTime() {
  const context = accepted, row = accepted.report.pointwiseCourse[selectedTime], host = $('time-detail'); host.replaceChildren();
  for (const key of Object.keys(host.dataset)) delete host.dataset[key];
  Object.assign(host.dataset, { index: String(row.index), utc: row.utc, minute: String(row.minute), thermalMinute: String(row.thermalMinute) });
  host.append(node('h3', (row.index ? 'After original interval ' + row.index : 'Original initial state') + ' · ' + row.utc),
    node('p', 'Approximate proposal minus existing temperature at ' + point(accepted.investigation.readings[0]) + '. Negative means cooler; positive means warmer.'));
  const prior=accepted.report.firstThree.pointwiseCourse[selectedTime], comparison=node('section');comparison.className='many-evidence-comparison';comparison.id='many-evidence-comparison';
  comparison.append(node('h4','What the remaining original readings change'),node('p','Reference: the first three original records. Complete result: every unchanged original band. Ranges below are approximate model differences in °C.'));
  const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
  const width=range=>profileFraction(sub(fraction(range.upper.differenceC),fraction(range.lower.differenceC)));
  comparison.append(table('Same original time and comparison point', ['Component','First three readings','All original readings','Width before / after'],stores.map(([field,title])=>{
    if(prior.ranges)comparison.dataset[field+'Before']=String(width(prior.ranges[field]).upper);
    if(row.ranges)comparison.dataset[field+'After']=String(width(row.ranges[field]).upper);
    const change=node('p',title+' width: '+(prior.ranges?compact(width(prior.ranges[field]).upper)+' °C':'no reference range')+' → '+(row.ranges?compact(width(row.ranges[field]).upper)+' °C':'no compatible range')+'.');change.className='many-width-change';comparison.append(change);
    return [title,prior.ranges?rangeText(prior.ranges[field]):'No shared profile',row.ranges?rangeText(row.ranges[field]):'No shared profile',
      (prior.ranges?compact(width(prior.ranges[field]).upper):'none')+' / '+(row.ranges?compact(width(row.ranges[field]).upper):'none')];
  })));host.append(comparison);
  if (!row.ranges) { const note = node('p', 'No compatible shared profile under the complete original record. This original time has no reported range.'); note.className = 'empty-family'; host.append(note); return; }
  const grid = node('div'); grid.className = 'range-grid';
  for (const [field, title] of stores) {
    const range = row.ranges[field], card = node('section'); card.className = 'range-card'; card.append(node('h4', title));
    const value = node('strong'); value.append(node('span', compact(range.lower.differenceC.lower)), Object.assign(node('span', 'to'), { className: 'range-to' }), node('span', compact(range.upper.differenceC.upper) + ' °C')); card.append(value);
    for (const bound of ['lower', 'upper']) {
      host.dataset[field + (bound === 'lower' ? 'Lower' : 'Upper')] = String(range[bound].differenceC[bound]);
      const button = node('button', bound === 'lower' ? 'Inspect minimum profile' : 'Inspect maximum profile'); button.type = 'button'; Object.assign(button.dataset, { store: field, bound, witness: String(range[bound].witnessId) });
      button.addEventListener('click', () => { if (accepted === context) chooseTime(row.index, range[bound].witnessId); }); card.append(button);
    }
    grid.append(card);
  }
  host.append(grid);
  if (selectedWitness !== null) {
    const witness = accepted.report.witnesses.find(w => w.id === selectedWitness), values = courseWitnessDifferences(witness)[row.index];
    const exact = node('details'); exact.append(node('summary', 'Exact range endpoints and this profile at the selected time'));
    for (const [field, title] of stores) for (const bound of ['lower', 'upper']) exact.append(node('p', title + ' ' + bound + ' range endpoint: ' + exactText(row.ranges[field][bound].differenceC)
      + ' °C. Selected profile ' + witness.id + ' endpoint: ' + exactText(values.differenceC[field][bound]) + ' °C.'));
    exact.append(node('p', 'Original elapsed minutes: ' + row.minute + '. Accumulated thermal minutes: ' + row.thermalMinute + '. These clocks are retained separately.')); host.append(exact);
  }
}
const svgNode = (tag, attributes = {}, text = '') => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value)); el.textContent = text; return el;
};
function drawPlots() {
  const r = accepted.report, host = $('plots'); host.replaceChildren();
  if (r.compatibility !== 'compatible') return;
  const witness = r.witnesses.find(w => w.id === selectedWitness), trace = courseWitnessDifferences(witness);
  for (const [field, title] of stores) {
    const figure = node('figure'); figure.className = 'many-plot'; figure.dataset.store = field; figure.append(node('h3', title));
    const svg = svgNode('svg', { viewBox: '0 0 430 280', role: 'img', 'aria-label': title + ', paired temperature ranges at original interval ends; selected shared profile ' + witness.id + '. Exact values are available below.' });
    svg.append(svgNode('title', {}, title + ' · proposal minus existing, °C'), svgNode('desc', {}, 'Pale blue whiskers are the first-three-reading ranges. Green whiskers are all-record pointwise ranges. Orange markers use one shared profile at every original time. The dashed line marks the declared sky change. No connecting curve or values between original times are asserted.'));
    const low = Math.min(0, ...r.firstThree.pointwiseCourse.map(row => row.ranges[field].lower.differenceC.lower));
    const high = Math.max(0, ...r.firstThree.pointwiseCourse.map(row => row.ranges[field].upper.differenceC.upper));
    const pad = Math.max((high - low) * .1, .05), minimum = low - pad, maximum = high + pad;
    const x = minute => 66 + 344 * minute / r.pointwiseCourse.at(-1).minute;
    const y = value => 224 - 190 * (value - minimum) / (maximum - minimum);
    const tick = value => Math.abs(value) < .001 && value !== 0 ? value.toExponential(1) : String(Number(value.toFixed(2)));
    for (let index = 0; index <= 4; index++) {
      const value = minimum + (maximum - minimum) * index / 4;
      svg.append(svgNode('line', { x1: 66, x2: 410, y1: y(value), y2: y(value), stroke: '#e2e9e3' }),
        svgNode('text', { x: 57, y: y(value) + 5, 'text-anchor': 'end', fill: '#506c69', 'font-size': 15 }, tick(value)));
    }
    svg.append(svgNode('text', { x: 13, y: 20, fill: '#506c69', 'font-size': 15 }, 'Δ °C'),
      svgNode('line', { x1: 66, x2: 410, y1: y(0), y2: y(0), stroke: '#708f86', 'stroke-width': 1.3 }),
      svgNode('line', { x1: x(r.pointwiseCourse[r.query.splitAfterInterval].minute), x2: x(r.pointwiseCourse[r.query.splitAfterInterval].minute), y1: 29, y2: 229, stroke: '#8b6b93', 'stroke-dasharray': '5 5', 'stroke-width': 1.4 }),
      svgNode('line', { x1: x(r.pointwiseCourse[selectedTime].minute), x2: x(r.pointwiseCourse[selectedTime].minute), y1: 29, y2: 229, stroke: '#c2d6d0', 'stroke-width': 7, opacity: .6 }));
    for (const row of r.pointwiseCourse) {
      const range = row.ranges[field], px = x(row.minute), a = range.lower.differenceC.lower, b = range.upper.differenceC.upper;
      const prior=r.firstThree.pointwiseCourse[row.index].ranges[field];
      const priorGroup=svgNode('g',{'data-prior-index':row.index,'data-prior-lower':prior.lower.differenceC.lower,'data-prior-upper':prior.upper.differenceC.upper});
      priorGroup.append(svgNode('line',{x1:px,x2:px,y1:y(prior.lower.differenceC.lower),y2:y(prior.upper.differenceC.upper),stroke:'#9aafc5','stroke-width':8,opacity:.55}));svg.append(priorGroup);
      const group = svgNode('g', { 'data-index': row.index, 'data-lower': a, 'data-upper': b, 'data-lower-witness': range.lower.witnessId, 'data-upper-witness': range.upper.witnessId });
      group.append(svgNode('title', {}, row.utc + ': ' + rangeText(range) + ' °C'),
        svgNode('line', { x1: px, x2: px, y1: y(a), y2: y(b), stroke: '#377b68', 'stroke-width': 3 }),
        svgNode('line', { x1: px - 5, x2: px + 5, y1: y(a), y2: y(a), stroke: '#377b68', 'stroke-width': 2 }),
        svgNode('line', { x1: px - 5, x2: px + 5, y1: y(b), y2: y(b), stroke: '#377b68', 'stroke-width': 2 })); svg.append(group);
      for (const bound of ['lower', 'upper']) {
        const value = trace[row.index].differenceC[field][bound][bound];
        const marker = svgNode('circle', { cx: px, cy: y(value), r: bound === 'lower' ? 2.4 : 1.5, fill: bound === 'lower' ? '#ad5c18' : '#fff5e8', stroke: '#ad5c18', 'stroke-width': 1.1,
          'data-profile': witness.id, 'data-index': row.index, 'data-bound': bound, 'data-value': value });
        marker.append(svgNode('title', {}, 'Profile ' + witness.id + ', ' + row.utc + ', ' + bound + ': ' + signed(value) + ' °C')); svg.append(marker);
      }
    }
    const last = r.pointwiseCourse.at(-1), labels = [r.pointwiseCourse[0], last];
    const change = r.pointwiseCourse[r.query.splitAfterInterval]; if (change.minute / last.minute > .22 && change.minute / last.minute < .78) labels.splice(1, 0, change);
    for (const row of labels) svg.append(svgNode('text', { x: x(row.minute), y: 251, fill: '#506c69', 'font-size': 15, 'text-anchor': row.index === 0 ? 'start' : row.index === last.index ? 'end' : 'middle' }, timeText(row.utc)));
    figure.append(svg, node('figcaption', 'Original UTC · ' + r.pointwiseCourse[0].utc.slice(0, 10) + (last.utc.slice(0, 10) === r.pointwiseCourse[0].utc.slice(0, 10) ? '' : ' to ' + last.utc.slice(0, 10)) + '. Narrow ranges can be smaller than a marker; inspect their values below.')); host.append(figure);
  }
}
function drawWitness() {
  const r = accepted.report, host = $('witness'); if (!host) return;
  drawManyWitness(host, { report: r, readings: accepted.investigation.readings, witnessId: selectedWitness, prefix: 'course' });
  const witness = r.witnesses.find(w => w.id === selectedWitness), trace = courseWitnessDifferences(witness);
  const details = node('details'); details.className = 'many-replay'; details.append(node('summary', 'Follow this one profile through every original time'));
  details.append(node('p', 'Every row below uses the same early and late profiles. Additive differences use exact fractions before outward display. Original thermal differences are separately calculated numerical endpoints, and may differ slightly.'));
  const rows = trace.map(row => [row.utc,
    ...stores.flatMap(([field]) => [compact(row.differenceC[field].lower.lower) + ' / ' + compact(row.differenceC[field].upper.upper),
      compact(row.originalDifferenceC[field].lower) + ' / ' + compact(row.originalDifferenceC[field].upper)])]);
  const values = table('Selected profile ' + witness.id + ' · paired lower / upper endpoints in °C', ['Original UTC', 'Surface · additive', 'Surface · original replay', 'Lower store · additive', 'Lower store · original replay'], rows);
  values.classList.add('many-values'); details.append(values);
  const receivers = node('details'); receivers.append(node('summary', 'Original temperatures at all loaded original records and every retained time'));
  witness.originalReplays.forEach((replay, index) => receivers.append(table('Original replay at ' + point(accepted.investigation.readings[replay.representativeReadingIndex]) + ' · lower / upper °C',
    ['Original UTC', 'Existing surface', 'Proposal surface', 'Existing lower store', 'Proposal lower store'], replay.originalCourse.map(row => [row.utc,
      ...stores.flatMap(([field]) => ['existing', 'proposal'].map(target => String(row.originalC[target].lower[field]) + ' / ' + String(row.originalC[target].upper[field])))]))));
  details.append(receivers); host.append(details);
}
function draw() {
  const context = accepted, r = accepted.report, host = $('results'); host.hidden = false; host.replaceChildren();
  Object.assign(host.dataset, { status: r.compatibility, cell: String(r.cellIndex), split: String(r.query.splitAfterInterval), points: String(r.pointwiseCourse.length), basis: String(r.work.executedBasisCourses), courses: String(r.work.executedThermalCourses), witnesses: r.witnesses.map(w => w.id).join(','), records:String(r.readings.length), uniqueSources:String(r.work.uniqueSources) });
  const intro = node('div'); intro.className = 'many-intro'; const text = node('div');
  text.append(node('p', '03 / Read the original time course')); text.firstChild.className = 'eyebrow';
  text.append(node('h2', r.compatibility === 'compatible' ? 'How the complete record changes the original course' : 'No shared profile at this declared boundary'),
    node('p', 'Comparison point ' + point(accepted.investigation.readings[0]) + '. Original course ends: ' + r.finalUtc + '. Declared sky change: ' + r.splitUtc + '.'));
  text.append(node('p', r.readings.length + ' original bands across ' + r.work.uniqueSources + ' complete receiver sources. ' + r.rangeChanges.narrowed + ' component/time ranges narrowed and ' + r.rangeChanges.unchanged + ' stayed unchanged where the complete family is feasible.'));
  const note = node('p', 'Pale blue ranges use the first three readings. Green ranges use every loaded record, each optimized separately at one original time. Different extremes can use different profiles; the collection of bounds is not asserted to be one possible course. Orange markers follow one selected shared profile across every original time.'); note.className = 'many-notice'; text.append(note);
  const location = node('details'); location.className='many-identities'; location.append(node('summary', 'Inspect all ' + r.readings.length + ' original reading identities'), table('Original reading identities', ['Record', 'Point', 'Original UTC', 'Component'], r.readings.map((reading,index)=>[index+1,point(accepted.investigation.readings[index]),reading.utc,reading.store==='surfaceC'?'Surface':'Lower store']))); intro.append(text);host.append(intro,location);
  const counts = node('div'); counts.className = 'many-counts';
  for (const [value, title] of [[r.pointwiseCourse.length, 'original times'], [r.readings.length, 'admitted original records'], [r.witnesses.length, 'displayed whole-course profiles']]) { const item = node('span'); item.append(node('strong', String(value)), document.createTextNode(' ' + title)); counts.append(item); } host.append(counts);
  const plots = node('div'); plots.id = 'many-plots'; plots.className = 'many-plots'; host.append(plots);
  if (r.compatibility === 'compatible') {
    const legend = node('div'); legend.className = 'many-legend';
    for (const [className, label] of [['legend-prior', 'First three readings'], ['legend-range', 'All original readings'], ['legend-profile', 'Selected profile endpoints'], ['legend-change', 'Declared sky change']]) { const item = node('span'), symbol = node('i'); symbol.className = className; symbol.setAttribute('aria-hidden', 'true'); item.append(symbol, document.createTextNode(label)); legend.append(item); } host.append(legend);
  }
  const selection = node('div'); selection.className = 'many-selection';
  const label = node('label', 'Inspect an original time'), select = node('select'); select.id = 'many-time-select';
  r.pointwiseCourse.forEach(row => { const option = node('option', timeText(row.utc) + ' UTC · ' + (row.index ? 'original interval ' + row.index : 'initial state')); option.value = String(row.index); select.append(option); }); select.value = String(selectedTime);
  select.addEventListener('input', () => { if (accepted === context) chooseTime(Number(select.value)); }); label.append(select);
  const sliderLabel = node('label', 'Move through original interval ends'), slider = node('input'); slider.id = 'many-time-slider'; slider.type = 'range'; slider.min = '0'; slider.max = String(r.intervalCount); slider.step = '1'; slider.value = String(selectedTime);
  slider.addEventListener('input', () => { if (accepted === context) chooseTime(Number(slider.value)); }); sliderLabel.append(slider); selection.append(label, sliderLabel); host.append(selection);
  const detail = node('div'); detail.id = 'many-time-detail'; host.append(detail);
  if (r.compatibility === 'compatible') {
    const witnessLabel = node('label', 'Keep one shared profile across the whole course'); witnessLabel.className = 'witness-label'; const witnesses = node('select'); witnesses.id = 'many-witness-select';
    for (const witness of r.witnesses) { const option = node('option', 'Shared profile ' + witness.id + ' · one of the displayed extrema'); option.value = String(witness.id); witnesses.append(option); } witnesses.value = String(selectedWitness);
    witnesses.addEventListener('input', () => { if (accepted !== context) return; const id = Number(witnesses.value); if (!r.witnesses.some(w => w.id === id)) return; selectedWitness = id; drawTime(); drawPlots(); drawWitness(); }); witnessLabel.append(witnesses); host.append(witnessLabel);
    const witnessHost = node('div'); witnessHost.id = 'many-witness'; host.append(witnessHost);
  }
  const all = node('details'); all.append(node('summary', 'Every original time and its pointwise range'));
  all.append(table('Original times retained without interpolation · paired °C', ['Original UTC', 'Source minutes', 'Thermal minutes', 'Ground surface range', 'Lower store range'],
    r.pointwiseCourse.map(row => [row.utc, row.minute, row.thermalMinute, ...stores.map(([field]) => row.ranges ? rangeText(row.ranges[field]) : 'No compatible profile')]))); host.append(all);
  const work = node('details'); work.append(node('summary', 'Complete work, numerical checks and scope'),
    node('p', r.work.executedBasisCourses + ' complete basis courses and ' + r.work.executedWitnessCourses + ' witness courses executed across ' + r.intervalCount + ' original intervals. The whole inquiry reserved ' + r.work.reservedThermalCourses + ' thermal courses before execution.'),
    node('p', r.work.actualReplayEndpointRows + ' receiver-time witness rows retained. All original pair courses and displayed witnesses were checked at every original interval end against the ' + r.numericalEvidence.consistencyScreenC + ' °C consistency screen.'),
    node('p', 'The complete record and first-three reference used ' + r.work.linearPivots + ' exact pivots and ' + r.work.linearRationalOperations + ' counted rational operations. Every returned objective has an original-inequality optimality certificate; an empty family has an exact incompatibility certificate.'), node('p', r.numericalEvidence.scope), node('p', r.semantics)); host.append(work);
  const proof=node('details');proof.append(node('summary','Exact certificates for this complete record'));
  proof.append(node('p','These fractions certify the admitted additive model. Coordinates are early bins1–3 then late bins1–3, with bin0 the exact complement. Inequalities retain both simplex sums and every original upper/lower band in evidence order. Lower range bounds maximize the negated objective. Numerical thermal replay is checked separately.'));
  const code=node('pre',JSON.stringify({coordinateOrder:r.exactEvidence.coordinateOrder,constraintOrder:r.exactEvidence.constraintOrder,all:r.exactEvidence.all,firstThree:r.exactEvidence.firstThree},null,2));proof.append(code);host.append(proof);
  drawTime(); drawPlots(); drawWitness();
}
drawSources(); controls();
for (const id of ['example', 'originals', 'reopen', 'split', 'sharing']) $(id).disabled = false;

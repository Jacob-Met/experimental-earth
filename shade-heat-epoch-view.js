const node = (tag, text = '') => { const element = document.createElement(tag); element.textContent = text; return element; };
const number = value => value !== 0 && Math.abs(value) < .000001 ? value.toExponential(5)
  : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 8 });
const signed = value => (value > 0 ? '+' : '') + number(value);
const stores = [['surfaceC', 'Ground surface'], ['subsurfaceC', 'Lower heat store']];
const point = input => {
  const p = input.source.project, i = input.query.reading.cellIndex;
  return String.fromCharCode(65 + i % p.width) + (Math.floor(i / p.width) + 1);
};
function table(caption, headings, rows) {
  const wrap = node('div'); wrap.className = 'table-wrap'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', caption);
  const el = node('table'); el.append(node('caption', caption)); const head = node('thead'), hr = node('tr');
  headings.forEach(text => { const th = node('th', text); th.scope = 'col'; hr.append(th); }); head.append(hr); el.append(head);
  const body = node('tbody'); rows.forEach(row => { const tr = node('tr'); row.forEach(text => tr.append(node('td', String(text)))); body.append(tr); }); el.append(body); wrap.append(el); return wrap;
}
function locationFigure(readings) {
  const [first, second] = readings, p = first.source.project, ns = 'http://www.w3.org/2000/svg';
  const figure = node('figure'); figure.className = 'site-figure';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + p.width * 24 + ' ' + p.height * 24); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Original grid: comparison point ' + point(first) + ', second observation at ' + point(second)
    + (readings.length === 3 ? ', additional observation at ' + point(readings[2]) : ''));
  for (let i = 0; i < p.width * p.height; i++) {
    const rect = document.createElementNS(ns, 'rect'); rect.setAttribute('x', i % p.width * 24); rect.setAttribute('y', Math.floor(i / p.width) * 24);
    rect.setAttribute('width', 24); rect.setAttribute('height', 24); rect.setAttribute('fill', '#f3f5ed'); rect.setAttribute('stroke', '#cddbd0'); svg.append(rect);
    const existing = p.solarStudy.existing.some(column => column.cellIndex === i), proposal = p.solarStudy.proposal.some(column => column.cellIndex === i);
    if (existing || proposal) { rect.setAttribute('fill', existing ? '#c7d2c1' : '#f0d4a7'); const title = document.createElementNS(ns, 'title'); title.textContent = (existing ? 'Existing mapped column' : 'Proposed mapped column') + (existing && proposal ? ' and proposed mapped column' : ''); rect.append(title); }
  }
  readings.forEach((input, index) => {
    const i = input.query.reading.cellIndex, circle = document.createElementNS(ns, 'circle'); circle.setAttribute('cx', i % p.width * 24 + 12); circle.setAttribute('cy', Math.floor(i / p.width) * 24 + 12); circle.setAttribute('r', 9); circle.setAttribute('fill', ['#205b4e', '#356aa0', '#805a92'][index]); svg.append(circle);
    const label = document.createElementNS(ns, 'text'); label.setAttribute('x', i % p.width * 24 + 12); label.setAttribute('y', Math.floor(i / p.width) * 24 + 16); label.setAttribute('font-size', 12); label.setAttribute('font-weight', 700); label.setAttribute('text-anchor', 'middle'); label.setAttribute('fill', '#fff'); label.textContent = String(index + 1); svg.append(label);
  });
  figure.append(svg, node('figcaption', '1 · comparison ' + point(first) + '   2 · observation ' + point(second)
    + (readings.length === 3 ? '   3 · added reading ' + point(readings[2]) : '')
    + '. Original mapped columns: gray-green existing, sand proposed. ' + p.weather.cellSizeM + ' m cells.'));
  return figure;
}
function phaseFigure(witness) {
  const wrap = node('div'); wrap.className = 'phase-grid';
  const percent = value => value !== 0 && Math.abs(value) < .0001 ? value.toExponential(3)
    : value.toLocaleString('en-US', { maximumSignificantDigits: 6 });
  witness.phaseProfiles.forEach((weights, phase) => {
    const figure = node('figure'); figure.className = 'phase-profile';
    figure.append(node('figcaption', phase ? 'After the declared change' : 'Before the declared change'));
    figure.dataset.phase = String(phase); figure.dataset.weights = JSON.stringify(weights.map(w => w.lower));
    weights.forEach((weight, bin) => {
      const row = node('div'); row.className = 'profile-row';
      row.append(node('span', bin * 90 + '–' + (bin + 1) * 90 + '°'));
      const track = node('span'), fill = node('span'); track.className = 'profile-track'; fill.className = 'profile-fill';
      fill.style.width = weight.lower * 100 + '%'; track.append(fill);
      row.append(track, node('span', '≈ ' + percent(weight.lower * 100) + '%')); figure.append(row);
    });
    wrap.append(figure);
  });
  return wrap;
}
function drawEpochWitness(host, { report: r, readings, witnessId, prefix = 'epoch' }) {
  const w = r.witnesses.find(value => value.id === witnessId);
  if (!w) throw Error('The selected witness does not belong to this boundary');
  host.replaceChildren();
  host.dataset.witness = String(w.id); host.dataset.support = w.support.join(',');
  host.append(node('h3', 'One early profile, one late profile'),
    node('p', 'These same two profiles supply ' + (readings.length === 3 ? 'all three original receivers' : 'both original receivers')
      + ' and both designs. Headings follow the original grid; the change occurs at ' + r.splitUtc + '.'), phaseFigure(w));
  host.append(table('Exact additive model · approximate temperatures in °C', ['Saved point', 'Calculated existing surface', 'Original band'],
    r.readings.map((reading, i) => [point(readings[i]), number(w.observedC[i].lower),
      String(reading.temperatureC) + ' ± ' + String(reading.halfWidthC)])));
  const outside = w.originalReplays.some(p => Object.values(p.originalObservationEndpointStatus).includes('outside-original-band'));
  const notice = node('p', outside
    ? 'An original thermal replay endpoint is outside its original band. The exact additive model remains compatible; the replay is a separate numerical result.'
    : 'The separately replayed original observation endpoints are within their original bands for this witness. This is a numerical check, not physical validation.');
  notice.id = prefix + '-replay-note'; notice.className = outside ? 'replay-note outside' : 'replay-note'; notice.dataset.replay = outside ? 'outside-original-band' : 'within-original-band'; host.append(notice);
  host.append(table('Original thermal replay · normalized approximate profile weights', ['Point', 'Existing surface · lower / upper °C', 'Original band status'],
    w.originalReplays.map((replay, i) => [point(readings[i]),
      String(replay.originalFinalC.existing.lower.surfaceC) + ' / ' + String(replay.originalFinalC.existing.upper.surfaceC),
      Object.values(replay.originalObservationEndpointStatus).every(x => x === 'within-original-band') ? 'within original band' : 'outside original band'])));
  host.append(node('p', 'Largest absolute replay discrepancy from this additive witness: ≤ ' + number(w.maximumReplayResidualC.upper)
    + ' °C. This encloses the computed discrepancy; it is not a solver error bound.'));
  host.append(table('Additive final temperatures at comparison point ' + point(readings[0]) + ' · approximately °C',
    ['Design', 'Ground surface · lower / upper', 'Lower store · lower / upper'], ['existing', 'proposal'].map(target =>
      [target === 'existing' ? 'Existing' : 'Proposal', ...stores.map(([field]) => number(w.finalC[target].lower[field].lower)
        + ' / ' + number(w.finalC[target].upper[field].upper))])));
  const exact = node('details'); exact.append(node('summary', 'Exact epoch fractions and separately normalized replay weights'));
  w.phaseProfiles.forEach((phase, i) => {
    exact.append(node('h4', i ? 'Late profile' : 'Early profile'));
    phase.forEach((weight, bin) => exact.append(node('p', 'Bin ' + (bin + 1) + ': ' + weight.exact.numerator + ' / '
      + weight.exact.denominator + '. Outward display [' + weight.lower + ', ' + weight.upper + '].')));
    exact.append(node('p', 'Replay weights: ' + w.approximateProfiles[i].weights.join(', ') + '. Mass before normalization: '
      + w.approximateProfiles[i].preNormalizationMass + '.'));
  });
  exact.append(node('p', 'The exact masses in each epoch sum to one. Joint-mixture coupling is only an internal representation; every additive consequence equals the product of these exact marginal profiles.'));
  host.append(exact);
}

export { node, number, signed, point, table, locationFigure, phaseFigure, drawEpochWitness };

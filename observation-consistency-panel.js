import { observationConsistency } from './observation-consistency.js';

/** Additive selected-cell evidence check, independent of model predictions. */
export function renderObservationConsistency(project, scenario, cellIndex) {
  const report = observationConsistency(project.observations);
  const groups = report.groups.filter(g => g.scenario === scenario && g.cellIndex === cellIndex);
  const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
  const f = n => Number(n).toLocaleString('en-US', { maximumSignificantDigits: 8 });
  const section = document.createElement('section');section.className = 'observation-consistency';
  section.append(node('h4', 'Do simultaneous readings agree with each other?'));
  section.append(node('p', 'This check includes every retained evidence role at this cell and scenario, independently of the map role filter and all model predictions. Only exactly equal recorded times are compared. Assigned cells are not verified physical co-location; variation within a cell can also explain differing readings.'));
  if (!groups.length) {
    section.append(node('p', 'No repeated exact-time readings at this cell and scenario. Evidence consistency is untested here.'));
    return section;
  }
  for (const group of groups) {
    const details = document.createElement('details');
    const status = group.status === 'disjoint' ? `Disjoint bands · ${f(group.gapMm)} mm gap` :
      group.status === 'roundoff-contact' ? 'Near contact within numerical guard; no exact common interval' :
      `Common declared band ${f(group.commonBandMm[0])}–${f(group.commonBandMm[1])} mm`;
    details.append(node('summary', `${group.minute} min · ${group.readings.length} readings · ${status}`));
    if (group.status === 'disjoint') {
      const [low, high] = group.witness.map(index => group.readings.find(r => r.index === index));
      details.append(node('p', `Reading ${low.index + 1} ends at ${f(low.upperMm)} mm; reading ${high.index + 1} starts at ${f(high.lowerMm)} mm. Their bands cannot describe one depth simultaneously under the declared tolerances. Neither reading is identified as wrong.`));
    }
    if (group.status === 'roundoff-contact') details.append(node('p', `Raw gap ${group.gapMm} mm; floating-point guard ${group.numericalGuardMm} mm. This is numerical ambiguity, not extra measurement tolerance.`));
    // Exact interval marks make a conflicting pair visible without averaging.
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const low = Math.min(...group.readings.map(r => r.lowerMm));
    const high = Math.max(...group.readings.map(r => r.upperMm));
    const plotHigh = low + Math.max(1, high - low);
    const span = plotHigh - low;
    const xx = value => 68 + (value - low) / span * 350;
    const height = 34 + group.readings.length * 24;
    svg.setAttribute('viewBox', `0 0 450 ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Declared depth intervals on one common millimeter scale; individual readings remain separate');
    svg.style.width = '100%'; svg.style.maxWidth = '600px';
    const mark = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); for (const [key,value] of Object.entries(attrs)) n.setAttribute(key, value); if (text !== undefined) n.textContent = text; svg.append(n); };
    mark('text', {x:68,y:14,'font-size':11}, `${f(low)} mm`);
    mark('text', {x:418,y:14,'font-size':11,'text-anchor':'end'}, `${f(plotHigh)} mm`);
    group.readings.forEach((row, i) => {
      const y = 32 + i * 24;
      const color = group.witness?.includes(row.index) ? '#9b361f' : '#315b4a';
      mark('text', {x:2,y:y+4,'font-size':11}, `#${row.index+1}`);
      mark('line', {x1:xx(row.lowerMm),x2:xx(row.upperMm),y1:y,y2:y,stroke:color,'stroke-width':4});
      mark('circle', {cx:xx(row.lowerMm),cy:y,r:3,fill:color});
      mark('circle', {cx:xx(row.upperMm),cy:y,r:3,fill:color});
    });
    details.append(svg);
    for (const row of group.readings) {
      const r = row.reading;
      const role = { calibration:'Calibration', challenge:'Held aside', unassigned:'Notebook only' }[r.use || 'unassigned'];
      details.append(node('p', `Reading ${row.index + 1}: ${f(r.depthMm)} ± ${f(r.uncertaintyMm)} mm; ${role}; source: ${r.source}`));
      if (r.tableSource) details.append(node('p', `Original table ${r.tableSource.fileName}, line ${r.tableSource.line}: ${r.tableSource.depthValue} ± ${r.tableSource.uncertaintyValue} ${r.tableSource.unit}`));
    }
    section.append(details);
  }
  section.append(node('p', report.limitation));
  return section;
}

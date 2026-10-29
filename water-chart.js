import { modelNumber } from './number-format.js';

// Layout changes only: every original sample remains in its original series.
export function waterChartLayout(series, { durationMinutes, stormMinutes }, width, textWidth) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('A positive chart width and event duration are required');
  }
  const height = 232, top = 28, bottom = 32, right = 12;
  let maximum = 1;
  for (const samples of series) for (const sample of samples) maximum = Math.max(maximum, sample.storedLiters);
  const labels = Array.from({ length: 5 }, (_, i) => modelNumber(maximum * i / 4));
  const left = Math.ceil(Math.max(...labels.map(textWidth))) + 20;
  const plotWidth = width - left - right;
  if (plotWidth <= 0) throw new Error('The chart is too narrow to display its numeric labels');
  const x = minute => left + plotWidth * minute / durationMinutes;
  const y = value => top + (height - top - bottom) * (1 - value / maximum);
  const grid = labels.map((label, i) => ({ label, value: maximum * i / 4, y: y(maximum * i / 4) }));
  let ticks;
  for (const count of [5, 3, 2]) {
    const candidate = Array.from({ length: count }, (_, i) => {
      const minute = durationMinutes * i / (count - 1), label = `${modelNumber(minute)} min`;
      const at = x(minute), size = textWidth(label), anchor = i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle';
      const start = anchor === 'start' ? at : anchor === 'end' ? at - size : at - size / 2;
      return { minute, label, x: at, anchor, start, end: start + size };
    });
    ticks = candidate;
    if (candidate.every((tick, i) => i === 0 || tick.start - candidate[i - 1].end >= 12)) break;
  }
  const stormX = x(stormMinutes), stormLabel = 'rain stops';
  const stormLabelX = Math.max(left, Math.min(stormX + 5, width - right - textWidth(stormLabel)));
  const paths = series.map(samples => samples.map((sample, i) =>
    `${i ? 'L' : 'M'}${x(sample.minute).toFixed(2)},${y(sample.storedLiters).toFixed(2)}`).join(' '));
  return { width, height, left, right, top, bottom, maximum, grid, ticks, paths, stormX, stormLabel, stormLabelX };
}

/** Own the last accepted comparison, including its original event times. */
export function createWaterChart(svg) {
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  let accepted = null, renderedWidth = null;
  function draw() {
    if (!accepted) return;
    const width = svg.getBoundingClientRect().width;
    // A hidden investigation has no drawable width. ResizeObserver redraws it
    // when it is shown, using this same accepted comparison rather than a draft.
    if (width <= 0) return;
    context.font = `12px ${getComputedStyle(svg).fontFamily}`;
    const layout = waterChartLayout(accepted.series, accepted.weather, width, label => context.measureText(label).width);
    renderedWidth = width;
    svg.setAttribute('viewBox', `0 0 ${width} ${layout.height}`);
    const grid = layout.grid.map(tick =>
      `<line x1="${layout.left}" y1="${tick.y}" x2="${width - layout.right}" y2="${tick.y}" stroke="#e8efec" stroke-width="1"/><text data-axis="water" x="${layout.left - 8}" y="${tick.y + 4}" text-anchor="end">${tick.label}</text>`).join('');
    const paths = layout.paths.map((path, i) =>
      `<path data-series="${i ? 'proposal' : 'existing'}" d="${path}" fill="none" stroke="${i ? '#248c7a' : '#cc8965'}" stroke-width="3.5" stroke-linejoin="round"/>`).join('');
    const times = layout.ticks.map(tick =>
      `<text data-axis="time" x="${tick.x}" y="${layout.height - 8}" text-anchor="${tick.anchor}">${tick.label}</text>`).join('');
    svg.innerHTML = `${grid}<line x1="${layout.stormX}" y1="${layout.top}" x2="${layout.stormX}" y2="${layout.height - layout.bottom}" stroke="#a4b9ae" stroke-dasharray="4 5"/><text x="${layout.stormLabelX}" y="15">${layout.stormLabel}</text>${paths}${times}`;
  }
  const observer = new ResizeObserver(() => {
    const width = svg.getBoundingClientRect().width;
    if (width > 0 && width !== renderedWidth) draw();
  });
  observer.observe(svg);
  return {
    update(comparison, weather) {
      accepted = {
        series: [comparison.existing, comparison.proposal].map(result => result.snapshots.map(({ minute, storedLiters }) => ({ minute, storedLiters }))),
        weather: { durationMinutes: weather.durationMinutes, stormMinutes: weather.stormMinutes },
      };
      draw();
    },
    disconnect() { observer.disconnect(); },
  };
}

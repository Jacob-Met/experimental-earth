import test from 'node:test';
import assert from 'node:assert/strict';
import { waterChartLayout } from '../water-chart.js';

const measure = text => text.length * 7.5;
const series = maximum => [
  [{ minute: 0, storedLiters: 0 }, { minute: 360, storedLiters: maximum }, { minute: 720, storedLiters: maximum / 2 }],
  [{ minute: 0, storedLiters: 0 }, { minute: 360, storedLiters: maximum / 2 }, { minute: 720, storedLiters: 0 }],
];
test('ordinary and large labels fit narrow/desktop gutters and endpoint ticks do not collide', () => {
  for (const width of [288, 332, 970]) for (const maximum of [0, 12.34, 17_280_000_000]) {
    const layout = waterChartLayout(series(maximum), { durationMinutes: 720, stormMinutes: 720 }, width, measure);
    for (const tick of layout.grid) assert.ok(layout.left - 8 - measure(tick.label) >= 12);
    assert.equal(layout.ticks[0].anchor, 'start'); assert.equal(layout.ticks.at(-1).anchor, 'end');
    assert.equal(layout.ticks[0].minute, 0); assert.equal(layout.ticks.at(-1).minute, 720);
    for (const [i, tick] of layout.ticks.entries()) {
      assert.ok(tick.start >= 0 && tick.end <= width);
      if (i) assert.ok(tick.start - layout.ticks[i - 1].end >= 12);
    }
    assert.ok(layout.stormLabelX >= 0 && layout.stormLabelX + measure(layout.stormLabel) <= width);
  }
});
test('all721 native samples remain in both paths without mutating the accepted series', () => {
  const data = [0, 1].map(k => Array.from({ length: 721 }, (_, minute) => ({ minute, storedLiters: (minute * 13 + k * 37) % 101 })));
  const before = structuredClone(data), layout = waterChartLayout(data, { durationMinutes: 720, stormMinutes: 360 }, 332, measure);
  for (const [i, path] of layout.paths.entries()) {
    const points = path.match(/[ML][0-9.]+,[0-9.]+/g); assert.equal(points.length, 721);
    for (let j = 0; j < points.length; ++j) {
      const [x, y] = points[j].slice(1).split(',').map(Number);
      const actualMinute = (x - layout.left) / (layout.width - layout.left - layout.right) * 720;
      const actualWater = (1 - (y - layout.top) / (layout.height - layout.top - layout.bottom)) * 100;
      assert.ok(Math.abs(actualMinute - j) < .03);
      assert.ok(Math.abs(actualWater - data[i][j].storedLiters) < .004);
    }
  }
  assert.deepEqual(data, before);
});
test('dry histories keep a finite zero baseline and fractional final times stay explicit', () => {
  const data = [[{ minute: 0, storedLiters: 0 }, { minute: 5.5, storedLiters: 0 }]];
  const layout = waterChartLayout(data, { durationMinutes: 5.5, stormMinutes: 0 }, 332, measure);
  assert.equal(layout.maximum, 1); assert.equal(layout.grid[0].label, '0');
  assert.equal(layout.ticks.at(-1).label, '5.5 min');
  assert.ok(!layout.paths[0].includes('NaN')); assert.equal(layout.stormX, layout.left);
});

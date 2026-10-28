// Consumes complete maintained sampling reports; no solar or thermal recomputation.
export function pairedShadeCooling(report, minute, store = 'surfaceC') {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1440) throw Error('Choose a common integer minute from 0 to 1440');
  if (!['surfaceC', 'subsurfaceC'].includes(store)) throw Error('Choose surface or lower-store temperature');
  const name = store === 'surfaceC' ? 'surface' : 'subsurface';
  const subtract = (e, p) => ({ lowerC: e[0] - p[1], upperC: e[1] - p[0] });
  return report.courses.map(course => {
    const values = target => ['lower', 'upper'].map(bound => course.targets[target][bound]);
    const e = values('existing'), p = values('proposal');
    const at = courses => courses.map(c => {
      const point = c.trajectory.find(row => row.minute === minute);
      if (!point || !Number.isFinite(point[store])) throw Error('Complete common-minute values are required');
      return point[store];
    });
    return { solarStepMinutes: course.solarStepMinutes, minute, store,
      cooling: subtract(at(e), at(p)),
      meanCooling: subtract(e.map(c => c.means[store]), p.map(c => c.means[store])),
      separatePeakDifference: subtract(e.map(c => c[name].maximumC), p.map(c => c[name].maximumC)) };
  });
}

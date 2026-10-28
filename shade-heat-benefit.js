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

/** Complete integer-minute sample extrema, not continuous-time extrema. */
export function greatestSampledCooling(report, store = 'surfaceC') {
  if (!['surfaceC', 'subsurfaceC'].includes(store)) throw Error('Choose surface or lower-store temperature');
  if (!Array.isArray(report?.courses) || report.courses.length !== 3 ||
      new Set(report.courses.map(c => c.solarStepMinutes)).size !== 3 ||
      report.courses.some(c => ![60,30,15].includes(c.solarStepMinutes))) throw Error('All three solar grids are required');
  const indexed = report.courses.map(course => {
    const values = target => ['lower','upper'].map(bound => {
      const points = new Map();
      for (const row of course.targets[target][bound].trajectory) {
        if (!Number.isFinite(row.minute)) throw Error('Finite sample times are required');
        if (!Number.isInteger(row.minute)) continue;
        if (row.minute < 0 || row.minute > 1440 || points.has(row.minute) || !Number.isFinite(row[store]))
          throw Error('Unique finite common-minute samples are required');
        points.set(row.minute,row[store]);
      }
      if (points.size !== 1441) throw Error('All 1441 common-minute samples are required');
      return points;
    });
    return {course, e:values('existing'), p:values('proposal')};
  });
  return indexed.map(({course,e,p}) => {
    const lower={coolingC:-Infinity,minute:0},upper={coolingC:-Infinity,minute:0};
    for(let minute=0;minute<=1440;minute++){
      const lo=e[0].get(minute)-p[1].get(minute),hi=e[1].get(minute)-p[0].get(minute);
      if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi)throw Error('Ordered finite cooling ranges are required');
      if(lo>lower.coolingC)Object.assign(lower,{coolingC:lo,minute});
      if(hi>upper.coolingC)Object.assign(upper,{coolingC:hi,minute});
    }
    return {solarStepMinutes:course.solarStepMinutes,store,sampleCount:1441,lower,upper};
  });
}

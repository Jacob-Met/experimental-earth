import { checkCoolingWindow, normalizeCoolingWindow } from './shade-heat-window.js';

export function normalizeCoolingSearch(input) {
  const keys = ['availabilityFromMinute', 'availabilityToMinute', 'endpointSpanMinutes', 'thresholdC', 'store'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== keys.length || !keys.every(key => Object.hasOwn(input, key))) {
    throw Error('Declare availability, endpoint span, cooling threshold and heat store only');
  }
  normalizeCoolingWindow({ fromMinute: input.availabilityFromMinute, toMinute: input.availabilityToMinute,
    thresholdC: input.thresholdC, store: input.store });
  if (!Number.isInteger(input.endpointSpanMinutes) || input.endpointSpanMinutes < 0 ||
      input.endpointSpanMinutes > input.availabilityToMinute - input.availabilityFromMinute) {
    throw Error('Declare an integer endpoint span from zero through the available minute range');
  }
  return { ...input };
}

/** O(retained trajectory rows + eligible starts); never executes solar or thermal physics. */
export function searchCoolingWindows(report, input) {
  const query = normalizeCoolingSearch(input);
  const checked = checkCoolingWindow(report, { fromMinute: query.availabilityFromMinute,
    toMinute: query.availabilityToMinute, thresholdC: query.thresholdC, store: query.store });
  const sampleCount = query.endpointSpanMinutes + 1;
  const courses = checked.courses.map(course => {
    const samples = course.samples, n = samples.length;
    const failures = Array(n + 1).fill(0), ambiguities = Array(n + 1).fill(0);
    const nextFailure = Array(n + 1).fill(n), nextAmbiguous = Array(n + 1).fill(n);
    for (let i = 0; i < n; i++) {
      failures[i + 1] = failures[i] + Number(samples[i].state === 'failed');
      ambiguities[i + 1] = ambiguities[i] + Number(samples[i].state === 'ambiguous');
    }
    for (let i = n - 1; i >= 0; i--) {
      nextFailure[i] = samples[i].state === 'failed' ? i : nextFailure[i + 1];
      nextAmbiguous[i] = samples[i].state === 'ambiguous' ? i : nextAmbiguous[i + 1];
    }
    const earlierStarts = [];
    let firstSupported = null;
    for (let start = 0; start + sampleCount <= n; start++) {
      const end = start + sampleCount;
      const failed = failures[end] - failures[start], ambiguous = ambiguities[end] - ambiguities[start];
      const row = { fromMinute: samples[start].minute, toMinute: samples[end - 1].minute,
        state: failed ? 'refuted' : ambiguous ? 'unresolved' : 'supported',
        counts: { supported: sampleCount - failed - ambiguous, failed, ambiguous },
        firstFailure: failed ? samples[nextFailure[start]] : null,
        firstAmbiguous: ambiguous ? samples[nextAmbiguous[start]] : null };
      if (row.state === 'supported') { firstSupported = row; break; }
      earlierStarts.push(row);
    }
    const firstUnresolved = earlierStarts.find(row => row.state === 'unresolved') ?? null;
    return { solarStepMinutes: course.solarStepMinutes,
      state: firstSupported ? 'supported-window-found' : firstUnresolved ? 'unresolved-starts-remain' : 'all-starts-refuted',
      firstSupported, firstUnresolved, earlierStarts,
      earlierCounts: { refuted: earlierStarts.filter(row => row.state === 'refuted').length,
        unresolved: earlierStarts.filter(row => row.state === 'unresolved').length } };
  });
  return { query, sampleCount, eligibleStartCount: checked.sampleCount - query.endpointSpanMinutes, courses };
}

import { makeThirdReceiverExample } from './shade-heat-third-example.js';

// Reuse the unchanged authored original readings. Only the desired limits differ.
export function makeJointCourseExample(feasible = false) {
  const original = makeThirdReceiverExample();
  const primary = original.readings.find(reading => reading.query.reading.cellIndex === 7);
  return { readings: [primary, ...original.readings.filter(reading => reading !== primary)],
    query: { bins: 4, splitAfterInterval: 8, sharingSource: original.query.sharingSource,
      limits: [{ originalIndex: 8, store: 'surfaceC', maximumDifferenceC: -0.010676 },
        { originalIndex: 10, store: 'surfaceC', maximumDifferenceC: feasible ? -2.4641 : -2.464896 }],
      limitSource: 'Authored desired cooling limits at the original D2 surface at 08:00 and 09:00. These illustrative goals are not observations or physical recommendations.' } };
}

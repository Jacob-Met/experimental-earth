import { pressureBatchExample } from './pressure-batches-example.js';
import { PRESSURE_INITIAL_RANGE_SCHEMA } from './pressure-initial-range.js';

export function pressureInitialRangeExample() {
  const study = structuredClone(pressureBatchExample);
  study.title = 'A nominal dry start conceals an initial-water ambiguity';
  study.place = 'Authored mathematical control; no acquired place';
  study.source = 'Fictional beta-one observations from one shared initial amount of 1 L. This example is not field evidence.';
  study.protocol.initialSurface.source = 'Nominal zero starting inventory in an authored control; a separate range is explicitly offered.';
  study.readings = [
    { id: 'Early calibration', minute: 15, phase: 'no-addition', volume: 3 - .1 * Math.sqrt(150), uncertainty: .03,
      unit: 'L', role: 'calibration', source: 'Authored beta-one closed form with initial 1 L, the declared first 2 L batch and fictional ±0.03 L band.' },
    { id: 'Later held-aside reading', minute: 45, phase: 'no-addition', volume: 3 - .1 * Math.sqrt(450), uncertainty: .03,
      unit: 'L', role: 'challenge', source: 'Authored beta-one value from the same initial 1 L, not a separately fitted starting amount. Fictional ±0.03 L band.' },
  ];
  return { schema: PRESSURE_INITIAL_RANGE_SCHEMA, study,
    initialWater: { lower: 0, upper: 1.2, unit: 'L', source: 'Authored range that contains the concealed mathematical initial amount; not measured uncertainty.' },
    resolution: { volume: .001, unit: 'mL' } };
}

export function pressureInitialRangeConflictExample() {
  const study = structuredClone(pressureBatchExample);
  study.title = 'Each reading can fit, but the starting amounts disagree';
  study.place = 'Authored mathematical control; no acquired place';
  study.source = 'Two decreasing fictional readings constructed from different beta-one starting amounts. A slower constant-rate alternative is also offered.';
  study.protocol.areaM2 = 1;
  study.protocol.areaSource = 'Authored unit area for independent closed-form inversion.';
  study.protocol.durationMinutes = 120;
  study.protocol.initialSurface = { volume: 1, unit: 'L', source: 'Authored nominal starting amount, retained inside the separately offered range.' };
  study.protocol.additions = [{ id: 'Later original batch', minute: 120, volume: 1, unit: 'mL', source: 'Authored future batch; it cannot change earlier readings.' }];
  study.hypotheses = [
    { id: 'Pressure endpoint', conductivityMmHr: 1, capillaryDriveMm: 0, moistureDeficit: 1,
      initialCumulativeMm: 1, source: 'Authored beta-one endpoint with K=1 mm/h and F0=1 mm; not estimated field properties.' },
    { id: 'Slow head-neglected control', conductivityMmHr: .075, capillaryDriveMm: 0, moistureDeficit: 0,
      initialCumulativeMm: 1, source: 'Offered authored constant-rate mathematical alternative; not a field-calibrated explanation.' },
  ];
  study.readings = [
    { id: 'First original reading', minute: 30, phase: 'no-addition', volume: 2 - Math.sqrt(3), uncertainty: .01,
      unit: 'L', role: 'calibration', source: 'Fictional beta-one value from initial 1 L with declared ±0.01 L band.' },
    { id: 'Second original reading', minute: 60, phase: 'no-addition', volume: 2.8 - Math.sqrt(6.6), uncertainty: .01,
      unit: 'L', role: 'calibration', source: 'Fictional beta-one value from a different initial 1.8 L, deliberately testing the need for one shared amount. Declared ±0.01 L band.' },
  ];
  return { schema: PRESSURE_INITIAL_RANGE_SCHEMA, study,
    initialWater: { lower: .2, upper: 2, unit: 'L', source: 'Authored comparison range containing the nominal starting amount and both separately fitting amounts.' },
    resolution: { volume: .001, unit: 'mL' } };
}

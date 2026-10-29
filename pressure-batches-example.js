// Explicitly authored equation controls, not acquired field observations.
import { PRESSURE_BATCH_SCHEMA } from './pressure-batches.js';
export const pressureBatchExample = {
  schema: PRESSURE_BATCH_SCHEMA,
  title: 'Authored two-batch pressure comparison',
  place: 'Fictional local soil test over0.1m²',
  source: 'Authored mathematical control. No physical measurements were acquired for this example.',
  protocol: {
    areaM2: .1, areaSource: 'Authored fixed0.1m² area', durationMinutes: 120,
    initialSurface: { volume: 0, unit: 'L', source: 'Authored empty surface at minute zero, before the first batch' },
    instantaneousBatches: true, noOtherSupply: true, noOtherLoss: true,
    assumptionsSource: 'Authored ideal instantaneous additions; homogeneous sharp front, fixed area, no rain, evaporation, leakage or lateral loss. No drying or recovery reset.',
    additions: [
      { id: 'First batch', minute: 0, volume: 2, unit: 'L', source: 'Authored2L jump at minute zero' },
      { id: 'Second batch', minute: 60, volume: 2000, unit: 'mL', source: 'Authored2000mL jump at minute60; original unit retained' },
    ],
  },
  hypotheses: [
    { id: 'Head neglected', conductivityMmHr: 10, capillaryDriveMm: 0, moistureDeficit: 0, initialCumulativeMm: 0,
      source: 'Authored constant-rate endpoint control, K10/A0/deficit0, initially zero cumulative infiltration' },
    { id: 'Pressure endpoint', conductivityMmHr: 10, capillaryDriveMm: 0, moistureDeficit: 1, initialCumulativeMm: 0,
      source: 'Authored beta1 mathematical endpoint for an independent square-root check; not an estimated field moisture deficit' },
  ],
  readings: [
    { id: 'Quarter hour', minute: 15, phase: 'no-addition', volume: 1, uncertainty: .1, unit: 'L', role: 'calibration',
      source: 'Authored beta1 analytical control: sqrt(2×10×20×0.25)=10mm infiltrated,1L remains. Declared fictional±0.1L.' },
    { id: 'Before second batch', minute: 60, phase: 'before', volume: 0, uncertainty: .05, unit: 'L', role: 'challenge',
      source: 'Authored analytical depletion at60min; fictional±0.05L, not a sensor accuracy claim' },
    { id: 'After second batch', minute: 60, phase: 'after', volume: 2000, uncertainty: 50, unit: 'mL', role: 'challenge',
      source: 'Authored immediate post-addition inventory; no infiltration occurs during the ideal zero-time jump' },
    { id: 'Two hours', minute: 120, phase: 'no-addition', volume: (40 - Math.sqrt(1200)) * .1, uncertainty: .05, unit: 'L', role: 'challenge',
      source: 'Authored beta1 analytical carry: F=sqrt(20²+2×10×40×1), not a reset front. Fictional±0.05L.' },
  ],
};

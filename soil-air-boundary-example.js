import { SOIL_AIR_SCHEMA, SOIL_AIR_ASSUMPTIONS } from './soil-air-boundary.js';

export function soilAirBoundaryExample() {
  return {
    schema: SOIL_AIR_SCHEMA,
    title: 'Authored column: a water front beyond the closed-air limit',
    column: { depth: 400, initialFront: 5, unit: 'mm',
      source: 'Authored uniform 400 mm column with an explicitly chosen 5 mm initial front. This is not an observed initial state from a published experiment.' },
    boundary: { pondingHead: 50, atmosphericHead: 10330, unit: 'mm',
      source: 'Authored constant 50 mm ponding and 10330 mm water-equivalent atmospheric absolute pressure. No measured atmospheric pressure or replenishment history is asserted.' },
    target: { front: 300, unit: 'mm', source: 'Authored prospective target at 300 mm; no measured front or timestamp.' },
    hypotheses: [
      { id: 'Zero capillary drive', capillaryHead: 0, unit: 'mm', source: 'Authored mathematical control with zero suction.' },
      { id: '50 mm capillary head', capillaryHead: 50, unit: 'mm', source: 'Explicit hypothetical capillary head; not a fitted or measured soil property.' },
      { id: '200 mm capillary head', capillaryHead: 200, unit: 'mm', source: 'A separate hypothetical capillary head to inspect dependence on this missing property.' },
    ],
    assumptions: Object.fromEntries(SOIL_AIR_ASSUMPTIONS.map(key => [key, true])),
  };
}

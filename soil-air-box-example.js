import { SOIL_AIR_BOX_SCHEMA, SOIL_AIR_BOX_ASSUMPTIONS } from './soil-air-box.js';
export function makeSoilAirBoxExample() {
  const row = (lower, upper, source) => ({ lower, upper, unit: 'mm', source });
  return {
    schema: SOIL_AIR_BOX_SCHEMA,
    title: 'Authored column: does every offered condition require gas release?',
    parameters: {
      columnDepth: row(395, 405, 'Authored packed-depth range; no measured uncertainty is asserted.'),
      initialFront: row(5, 50, 'Authored initial-front range, independently combined with all other ranges.'),
      pondingHead: row(45, 55, 'Authored constant positive ponding-head range.'),
      capillaryHead: row(0, 1000, 'Explicitly offered capillary-head range; not fitted.'),
      atmosphericHead: row(10000, 10600, 'Authored ambient absolute gas pressure as water head.'),
      targetFront: row(250, 350, 'Authored target depths inside every offered packed column.'),
    },
    assumptions: Object.fromEntries(SOIL_AIR_BOX_ASSUMPTIONS.map(key => [key, true])),
  };
}

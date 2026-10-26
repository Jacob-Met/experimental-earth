import {makeExample} from '../core.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy, evaluateHeatColumnTarget} from '../heat-column.js';
import {prepareHeatColumnEvidence, authoredHeatColumnEvidenceExample} from '../heat-column-evidence.js';
import {planHeatColumnQuestion} from '../heat-column-question.js';
export function project() {
  const p = makeExample();
  const top = { capacityJm2K: 20000, exchangeWm2K: 10, absorptivity: .8, initialC: 20, source: 'Authored surface reference' };
  p.surfaceHeatStudy = prepareSurfaceHeatStudy(p, { cellIndex: 0, existing: top, proposal: { ...top, absorptivity: .4 },
    schedule: [{ minutes: 60, incidentWm2: 700, reservoirC: 20, source: 'Authored pulse' },
      { minutes: 360, incidentWm2: 0, reservoirC: 20, source: 'Authored dark interval' }] });
  const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20, source: 'Authored lower reference' };
  p.heatColumnStudy = prepareHeatColumnStudy(p, { existing: lower, proposal: lower });
  p.heatColumnEvidence = prepareHeatColumnEvidence(p, authoredHeatColumnEvidenceExample(p));
  return p;
}

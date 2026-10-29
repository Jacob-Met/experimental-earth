import { sampleShadeHeatForcing, mappedSkyHorizontalIrradiance } from './shade-heat.js';
import { evaluateHeatColumnTarget } from './heat-column.js';

const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'], TAU = 2 * Math.PI;

function binAtStart(angle, bins, step) {
  // Use the same explicit cut comparisons as the maintained sky integrator.
  // A midpoint or angle/step quotient can round a narrow sector into its neighbour.
  for (let i = 1; i < bins; i++) if (angle < i * step) return i - 1;
  return bins - 1;
}

function binTransmissions(skyline, bins) {
  const step = TAU / bins;
  const classified = skyline.arcs.map(arc => {
    const bin = binAtStart(arc.headingStartRad, bins, step);
    if (arc.headingStartRad < bin * step || arc.headingEndRad > (bin + 1) * step)
      throw Error('A continuous sky sector crosses an unresolved profile boundary');
    return { arc, bin };
  });
  return Array.from({ length: bins }, (_, bin) => {
    let integral = 0, correction = 0;
    // Include zero contributions in the original arc order, matching a complete
    // maintained one-hot integration without repeating its geometry work.
    for (const entry of classified) {
      const value = entry.bin === bin ? entry.arc.projectedIntegral : 0;
      const adjusted = value - correction, total = integral + adjusted;
      correction = (total - integral) - adjusted; integral = total;
    }
    const rawTransmission = integral / step;
    if (!(rawTransmission >= 0 && rawTransmission <= 1 + 1e-14))
      throw Error('A one-bin continuous sky integral is outside its supported range');
    return { transmission: Math.min(1, rawTransmission), rawTransmission,
      transmissionClamped: rawTransmission > 1, projectedIntegral: integral };
  });
}

const geometryDiagnostics = skyline => ({
  activeColumns: skyline.activeColumns, angularSectors: skyline.angularSectors,
  collapsedSectors: skyline.collapsedSectors, omittedAngularWidthRad: skyline.omittedAngularWidthRad,
  estimatedFaceTests: skyline.estimatedFaceTests,
});

// Internal adapter: callers admit complete original sources and shared work first.
// Static and two-epoch inquiries share these same original geometry and course paths.
export function sampleProfileBasisGeometry(source, bins) {
  if (![4, 8, 16].includes(bins)) throw Error('Unsupported common profile partition');
  const { project, declaration } = source;
  // A positive nonuniform scaffold requests every profile cut. Only its original
  // unweighted arc integrals, direct-ray status and weather are reused below.
  // It is never saved as an authored declaration or used as a thermal result.
  const sampled = sampleShadeHeatForcing(project, { ...declaration, diffuseSky: {
    method: 'weighted-continuous-columns', azimuthWeights: Array.from({ length: bins }, (_, i) => 1 + i % 2),
  } });
  const transmissions = {}, diagnostics = {};
  for (const target of targets) {
    const skyline = sampled.diffuseSky[target];
    transmissions[target] = { lower: binTransmissions(skyline.maximumRoofs, bins),
      upper: binTransmissions(skyline.minimumRoofs, bins) };
    diagnostics[target] = { maximumRoofs: geometryDiagnostics(skyline.maximumRoofs),
      minimumRoofs: geometryDiagnostics(skyline.minimumRoofs) };
  }
  return { sampled, transmissions, diagnostics };
}

export function evaluateProfileThermalCourse(source, geometry, transmissionsFor, label, refusalPrefix) {
  const final = {};
  for (const target of targets) {
    final[target] = {};
    for (const bound of bounds) {
      try {
        const study = structuredClone(source.project.heatColumnStudy);
        study.heatStudy.schedule = geometry.sampled.intervals.map((row, index) => ({
          minutes: row.toMinute - row.fromMinute,
          incidentWm2: mappedSkyHorizontalIrradiance(row[target].status, row.elevationDeg,
            row.weather.directNormalWm2, row.weather.diffuseHorizontalWm2,
            transmissionsFor(target, row, index))[bound],
          reservoirC: row.weather.reservoirC,
          source: label + '; original midpoint ' + row.sampleUtc,
        }));
        const value = evaluateHeatColumnTarget(study, target).summary.final;
        final[target][bound] = { minute: value.minute,
          surfaceC: value.surfaceC, subsurfaceC: value.subsurfaceC };
      } catch (error) {
        throw Error(refusalPrefix + ', ' + target + ' ' + bound + ': ' + error.message
          + '. No partial profile range is accepted.');
      }
    }
  }
  return final;
}

import { makeExample } from './core.js';
import { prepareSolarStudy } from './solar-occlusion.js';
import { prepareSurfaceHeatStudy } from './surface-heat.js';
import { prepareHeatColumnStudy } from './heat-column.js';

/** An explicitly authored, isolated control. Loading it never edits the site. */
export function makeShadeHeatExample() {
  const project = makeExample();
  project.title = 'Authored courtyard · morning shade';
  project.source = 'Invented flat courtyard and constant weather for a software experiment; no site measurement';
  project.width = 4; project.height = 4; project.selectedIndex = 5;
  project.weather.cellSizeM = 2; project.observations = [];
  project.existing = Array.from({ length: 16 }, () => ({ surface: 'sealed', elevationM: 0,
    provenance: 'Authored level two-metre grid cell' }));
  project.proposal = structuredClone(project.existing);
  project.solarStudy = prepareSolarStudy(project, { headingDeg: 0, elevationDeg: 45,
    sunSource: 'Original illustrative direction; the dated coupling computes its own sun positions',
    existing: [], proposal: [{ cellIndex: 6, heightMinM: 3, heightMaxM: 3,
      source: 'Authored opaque three-metre column immediately east of the investigated ground cell' }] });
  const surface = { absorptivity: .8, capacityJm2K: 20000, exchangeWm2K: 10, initialC: 20,
    source: 'Authored uniform surface properties, equal in both scenarios' };
  const lower = { capacityJm2K: 80000, conductanceWm2K: 20, initialC: 20,
    source: 'Authored insulated lower heat store; capacity is not a measured depth' };
  project.surfaceHeatStudy = prepareSurfaceHeatStudy(project, { cellIndex: 5,
    existing: surface, proposal: surface, schedule: [{ minutes: 60, incidentWm2: 0, reservoirC: 20,
      source: 'Original independent thermal declaration; coupled forcing is derived separately' }] });
  project.heatColumnStudy = prepareHeatColumnStudy(project, { existing: lower, proposal: lower });
  const declaration = { path: { latitudeDeg: 51.5, longitudeDeg: -.1, gridColumnBearingDeg: 90,
    locationSource: 'Authored London-like coordinate for this invented example',
    orientationSource: 'Authored east-right, south-down grid',
    startUtc: '2026-06-21T04:00:00Z', endUtc: '2026-06-21T12:00:00Z', stepMinutes: 30 },
  directNormalWm2: 700, diffuseHorizontalWm2: 80, reservoirC: 20,
  weatherSource: 'Authored constant direct-normal and diffuse-horizontal irradiance and reservoir temperature; not acquired weather' };
  return { project, declaration };
}

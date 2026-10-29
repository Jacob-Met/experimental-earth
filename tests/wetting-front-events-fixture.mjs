import { makeExample } from '../core.js';

export function makeWettingFrontEventsFixture() {
  const first = makeExample();
  first.width = first.height = 2; first.selectedIndex = 0;
  first.existing = Array.from({ length: 4 }, () => ({
    elevationM: 0, surface: 'turf', provenance: 'Authored mathematical control; not field observations',
  }));
  first.proposal = structuredClone(first.existing);
  Object.assign(first.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  first.wettingFrontStudy = { target: 'existing', surface: 'turf',
    basis: 'Two authored mechanisms that agree at the first final depth',
    hypotheses: [{ conductivityMmHr: 10, capillaryDriveMm: 20 },
      { conductivityMmHr: 24.595279111565403, capillaryDriveMm: 0 }] };
  first.observations = [{ cellIndex: 0, minute: 60, depthMm: 5.404720888434597,
    uncertaintyMm: 0.02, scenario: 'existing', use: 'calibration',
    source: '<img src=x onerror="window.eventInjection=1"> Authored first-event control' }];
  const second = structuredClone(first);
  second.weather.rainMmHr = 60;
  second.observations = [{ cellIndex: 0, minute: 60, depthMm: 33.392524218346,
    uncertaintyMm: 0.02, scenario: 'existing', use: 'challenge',
    source: 'Independent authored second-event depth; never used for calibration' }];
  return { first, second, study: structuredClone(first.wettingFrontStudy),
    references: { calibration: 'Authored event 1', challenge: 'Authored event 2' },
    initialConditions: { basis: 'Explicit authored starts; no soil moisture recovery inferred',
      challengeDrivesMm: [20, 0] } };
}

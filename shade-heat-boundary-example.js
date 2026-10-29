import { makeEpochSkyExample } from './shade-heat-epoch-example.js';
import { SKY_BOUNDARY_KIND, SKY_BOUNDARY_MODEL } from './shade-heat-epoch-evidence.js';
export function makeSkyBoundaryExample() {
  const original = makeEpochSkyExample();
  return { kind: SKY_BOUNDARY_KIND, model: { ...SKY_BOUNDARY_MODEL }, readings: original.readings,
    query: { bins: 4, splitAfterIntervals: Array.from({ length: 15 }, (_, i) => i + 1),
      sharingSource: 'Authored shared courtyard forcing for both original points and designs; compare each explicitly offered original interval boundary as a separate two-epoch hypothesis. These authored inputs do not identify a measured sky or change time.' } };
}

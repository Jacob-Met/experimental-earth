import {fixture} from './wetting-front-refinement-fixture.mjs';
export function unequalBands(delta=1){const {p,q}=fixture();p.observations[0].uncertaintyMm=.001;for(const o of p.observations.slice(1)){o.depthMm+=delta;o.uncertaintyMm=delta+1;}return {p,q};}

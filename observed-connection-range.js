import {inspectObservedConnectivity} from './observed-connectivity.js';
import {minimumPondingConnection} from './ponding-connectivity.js';

/** Bounds on the smallest connection threshold under original supplied bands.
 * Unknown cells have lower bound zero and no finite upper bound. The finite
 * sentinel below is ordering-only and is never reported as a depth bound.
 */
export function inspectObservedConnectionRange(project, query) {
 const ledger=inspectObservedConnectivity(project,query);
 const base={ledger,possibleThresholdMm:null,supportedThresholdMm:null,possiblePath:[],supportedPath:[]};
 if(['conflicting-bands','roundoff-contact','disconnected-footprint'].includes(ledger.status)) return {...base,status:ledger.status};
 const {cells}=ledger,q=ledger.query;
 const lower=cells.map(c=>c.lowerMm??0);
 const possible=minimumPondingConnection(lower,project.width,project.height,q);
 const finiteUpper=cells.filter(c=>Number.isFinite(c.upperMm)).map(c=>c.upperMm);
 const sentinel=Math.max(0,...finiteUpper)+1;
 const upper=cells.map(c=>c.upperMm??sentinel);
 const supported=minimumPondingConnection(upper,project.width,project.height,q);
 const bounded=supported.bottleneckMm<sentinel;
 return {...base,status:bounded?'bounded':'no-finite-supported-threshold',possibleThresholdMm:possible.bottleneckMm,possiblePath:possible.path,supportedThresholdMm:bounded?supported.bottleneckMm:null,supportedPath:bounded?supported.path:[],unmeasuredIndices:q.allowedIndices.filter(i=>cells[i].status==='unmeasured')};
}

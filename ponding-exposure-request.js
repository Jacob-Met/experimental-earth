import {pondingExposure} from './ponding-exposure.js';

/** A bounded projection of the maintained full-grid exposure diagnostic. */
export function validateExposureRequest(cellCount,request) {
 if(request==null)return null;
 if(!Number.isInteger(cellCount)||cellCount<1||!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(k=>!['thresholdMm','cellIndices'].includes(k)))throw Error('Invalid exposure selection');
 if(!Number.isFinite(request.thresholdMm)||request.thresholdMm<=0||request.thresholdMm>1000)throw Error('Choose an exposure threshold greater than 0 and at most 1000 mm');
 const cells=request.cellIndices;
 if(!Array.isArray(cells)||!cells.length||cells.length>12||!Array.from({length:cells.length},(_,i)=>Object.hasOwn(cells,i)).every(Boolean)||new Set(cells).size!==cells.length||cells.some(i=>!Number.isInteger(i)||i<0||i>=cellCount))throw Error('Choose 1–12 distinct exposure cells inside the project');
 return {thresholdMm:request.thresholdMm,cellIndices:[...cells].sort((a,b)=>a-b)};
}
export function selectPondingExposure(result,request) {
 const selected=validateExposureRequest(result?.snapshots?.[0]?.depthsMm?.length,request);
 if(!selected)throw Error('Declare an exposure selection');
 const all=pondingExposure(result,selected.thresholdMm);
 return selected.cellIndices.map(i=>all[i]);
}

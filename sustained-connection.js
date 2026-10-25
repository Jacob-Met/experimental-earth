import {minimumPondingConnection,validateConnectivityQuestion,CONNECTIVITY_WORK_LIMIT} from './ponding-connectivity.js';
import {snapshotDepths} from './ponding-exposure.js';

/** One fixed depth-only connection throughout an explicit interpolated window.
 * A piecewise-linear cell history attains its maximum at a window endpoint or
 * an interior snapshot. Minimizing the maximum of these cell maxima therefore
 * retains the same path for the whole window; it never splices moving paths.
 */
export function compareSustainedConnections(results,width,height,question,window) {
  const q=validateConnectivityQuestion(question,width,height),n=width*height;
  const {startMinute,endMinute}=window??{};
  if(!Number.isFinite(startMinute)||!Number.isFinite(endMinute)||startMinute<0||endMinute<=startMinute)throw Error('Declare a positive-duration modeled window.');
  const a=results?.existing?.snapshots,b=results?.proposal?.snapshots;
  if(!Array.isArray(a)||a.length<2||!Array.isArray(b)||b.length!==a.length)throw Error('Aligned original solver snapshots are required.');
  if(2*a.length*n+2*n*Math.ceil(Math.log2(n+1))>CONNECTIVITY_WORK_LIMIT)throw Error('The complete sustained connection exceeds its work limit.');
  // Validate both complete inputs before evaluating either scenario.
  for(const list of [a,b])for(let i=0;i<list.length;i++){
    const s=list[i];
    if(!Number.isFinite(s?.minute)||s.minute<0||(i&&s.minute<=list[i-1].minute)||s.minute!==a[i]?.minute||!Array.isArray(s.depthsMm)||s.depthsMm.length!==n||Array.from(s.depthsMm).some(d=>!Number.isFinite(d)||d<0))throw Error('Invalid or unaligned original solver snapshots.');
  }
  if(startMinute<a[0].minute||endMinute>a.at(-1).minute)throw Error('The complete window must lie inside the modeled event.');
  function evaluate(result){
    const maxima=snapshotDepths(result,startMinute),peakMinutes=Array(n).fill(startMinute);
    const points=result.snapshots.filter(s=>s.minute>startMinute&&s.minute<endMinute);
    points.push({minute:endMinute,depthsMm:snapshotDepths(result,endMinute)});
    for(const s of points)for(let i=0;i<n;i++)if(s.depthsMm[i]>maxima[i]){maxima[i]=s.depthsMm[i];peakMinutes[i]=s.minute;}
    const connection=minimumPondingConnection(maxima,width,height,q);
    return {...connection,pathPeaks:connection.path.map(cellIndex=>({cellIndex,depthMm:maxima[cellIndex],minute:peakMinutes[cellIndex]}))};
  }
  return {question:q,window:{startMinute,endMinute},existing:evaluate(results.existing),proposal:evaluate(results.proposal),
    basis:'One fixed edge-adjacent path under linear interpolation of original solver snapshots; not a timed traversal, physical access or between-step solver guarantee.'};
}

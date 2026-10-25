/** Closed interval algebra for continuous piecewise-linear model courses.
 * No convex hull or rounding merges disconnected feasible components. */
export function intersectIntervals(left,right){
 const out=[];let i=0,j=0;
 while(i<left.length&&j<right.length){
  const lo=Math.max(left[i][0],right[j][0]),hi=Math.min(left[i][1],right[j][1]);
  if(lo<=hi)out.push([lo,hi]);
  if(left[i][1]<right[j][1])i++;else j++;
 }
 return mergeIntervals(out);
}
export function mergeIntervals(intervals){
 const sorted=intervals.map(x=>x.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),out=[];
 for(const [lo,hi]of sorted){if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo>hi)throw Error('Finite ordered closed intervals required');const last=out.at(-1);if(last&&lo<=last[1])last[1]=Math.max(last[1],hi);else out.push([lo,hi]);}
 return out;
}
/** Exactly solve a supplied band on each linear segment, clipped to a time domain. */
export function feasibleReadingTimes(snapshots,cellIndex,lowerMm,upperMm,startMinute,endMinute){
 if(!Array.isArray(snapshots)||snapshots.length<2||!Number.isInteger(cellIndex)||cellIndex<0||!Number.isFinite(lowerMm)||!Number.isFinite(upperMm)||lowerMm>upperMm||!Number.isFinite(startMinute)||!Number.isFinite(endMinute)||startMinute>endMinute)throw Error('Invalid bounded reading-time question');
 const pieces=[];
 for(let i=0;i<snapshots.length;i++){
  const s=snapshots[i];if(!Number.isFinite(s.minute)||!Number.isFinite(s.depthsMm?.[cellIndex])||(i&&s.minute<=snapshots[i-1].minute))throw Error('Finite strictly ordered snapshot course required');
 }
 if(startMinute<snapshots[0].minute||endMinute>snapshots.at(-1).minute)throw Error('Question outside retained modeled course');
 for(let i=1;i<snapshots.length;i++){
  const a=snapshots[i-1],b=snapshots[i],lo=Math.max(startMinute,a.minute),hi=Math.min(endMinute,b.minute);if(lo>hi)continue;
  const ya=a.depthsMm[cellIndex],yb=b.depthsMm[cellIndex],slope=(yb-ya)/(b.minute-a.minute);
  if(slope===0){if(ya>=lowerMm&&ya<=upperMm)pieces.push([lo,hi]);continue;}
  const crossing1=a.minute+(lowerMm-ya)/slope,crossing2=a.minute+(upperMm-ya)/slope;
  const left=Math.max(lo,Math.min(crossing1,crossing2)),right=Math.min(hi,Math.max(crossing1,crossing2));if(left<=right)pieces.push([left,right]);
 }
 return mergeIntervals(pieces);
}

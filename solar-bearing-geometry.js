// Finite angular geometry for the declared ground-column model. These are
// engineering-screened sufficient envelopes, not certified transcendental bounds.
export const BEARING_ANGLE_FRINGE_DEG=1e-7;
const deg=180/Math.PI,wrap=a=>((a%360)+360)%360;
const finite=n=>typeof n==='number'&&Number.isFinite(n);

function admitRectangle(rect){
  if(!Array.isArray(rect)||rect.length!==4||!rect.every(finite))throw Error('Use four finite rectangle bounds.');
  const [x0,x1,y0,y1]=rect;
  if(x0>x1||y0>y1||rect.some(x=>Math.abs(x)>5000))throw Error('Rectangle bounds exceed this retained-site geometry.');
  const nearest=Math.hypot(Math.max(x0,0,-x1),Math.max(y0,0,-y1));
  // Other cells in the admitted site are separated from a ground centre by at
  // least 0.125m before micrometre padding. Do not generalize to origin-containing
  // rectangles, whose angular image can be a full circle.
  if(nearest<.01)throw Error('The angular rectangle must remain separated from the ground centre.');
  return nearest;
}

function pointArc(points){
  const angles=points.map(([x,y])=>wrap(Math.atan2(y,x)*deg)).sort((a,b)=>a-b);
  if(!angles.length)return null;
  let largest=-1,index=0;
  for(let i=0;i<angles.length;i++){
    const gap=(i+1<angles.length?angles[i+1]:angles[0]+360)-angles[i];
    if(gap>largest){largest=gap;index=i;}
  }
  const start=angles[(index+1)%angles.length],span=360-largest;
  if(!finite(start)||!finite(span)||span<0||span>=180)throw Error('The angular image could not be admitted as one separated convex arc.');
  return {startDeg:start,endDeg:start+span};
}

/** Angular image of rectangle intersected with an origin-centred radial disk.
 * The caller supplies already enlarged or eroded geometry. Ambiguous clipping
 * expands the outer envelope to the full rectangle and empties the inner one.
 */
export function rectangleDiskHeadingArc(rect,radius,side){
  const nearest=admitRectangle(rect);
  if(!finite(radius)||radius<0||radius>100000||!['inner','outer'].includes(side))throw Error('Invalid radial reach or envelope side.');
  const [x0,x1,y0,y1]=rect,corners=[[x0,y0],[x0,y1],[x1,y0],[x1,y1]];
  const screen=128*Number.EPSILON*Math.max(1,radius,...rect.map(Math.abs));
  const fallback=reason=>({arc:side==='outer'?pointArc(corners):null,fallback:reason,radialScreenM:screen});
  if(nearest>radius+screen)return {arc:null,fallback:null,radialScreenM:screen};
  if(Math.abs(nearest-radius)<=screen)return fallback('near radial tangency');
  const points=[];let ambiguous=false;
  for(const point of corners){
    const distance=Math.hypot(...point);
    if(Math.abs(distance-radius)<=screen)ambiguous=true;
    if(distance<radius-screen)points.push(point);
  }
  const edge=(fixed,low,high,vertical)=>{
    const separation=radius-Math.abs(fixed);
    if(separation < -screen)return;
    if(Math.abs(separation)<=screen){ambiguous=true;return;}
    // Factored form avoids catastrophic subtraction near tangency.
    const product=separation*(radius+Math.abs(fixed));
    if(!(product>0)||!finite(product)){ambiguous=true;return;}
    const ordinate=Math.sqrt(product);
    for(const moving of [-ordinate,ordinate]){
      if(Math.abs(moving-low)<=screen||Math.abs(moving-high)<=screen){ambiguous=true;continue;}
      if(moving>low+screen&&moving<high-screen)points.push(vertical?[fixed,moving]:[moving,fixed]);
    }
  };
  for(const x of [x0,x1])edge(x,y0,y1,true);
  for(const y of [y0,y1])edge(y,x0,x1,false);
  if(ambiguous)return fallback('ambiguous circle/corner/edge boundary');
  if(!points.length)return fallback('unresolved empty event list');
  return {arc:pointArc(points),fallback:null,radialScreenM:screen};
}

/** Reverse heading to true bearing and clip all circular lifts to one explicit
 * unwrapped bearing interval. Endpoints of these envelopes are closed. */
export function headingArcBearings(arc,azimuthDeg,domain,side){
  if(!arc)return [];
  if(!finite(arc.startDeg)||!finite(arc.endDeg)||arc.startDeg<0||arc.startDeg>=360
    ||arc.endDeg<arc.startDeg||arc.endDeg-arc.startDeg>=180)throw Error('Invalid computed heading arc.');
  if(!finite(azimuthDeg)||azimuthDeg<0||azimuthDeg>=360||!Array.isArray(domain)||domain.length!==2
    ||!domain.every(finite)||domain[0]>domain[1]||domain[1]-domain[0]>360
    ||domain[0]<-360||domain[1]>720||!['inner','outer'].includes(side))throw Error('Invalid unwrapped bearing domain.');
  const fringe=side==='outer'?BEARING_ANGLE_FRINGE_DEG:-BEARING_ANGLE_FRINGE_DEG;
  const start=azimuthDeg-arc.endDeg-fringe,end=azimuthDeg-arc.startDeg+fringe;
  if(start>end)return [];
  const result=[];
  for(let k=Math.floor((domain[0]-end)/360);k<=Math.ceil((domain[1]-start)/360);k++){
    const lo=Math.max(domain[0],start+360*k),hi=Math.min(domain[1],end+360*k);
    if(lo<=hi)result.push([lo,hi]);
  }
  return result;
}

export function unionBearingIntervals(input){
  const sorted=input.map(r=>{
    if(!Array.isArray(r)||r.length!==2||!r.every(finite)||r[0]>r[1])throw Error('Invalid bearing interval.');
    return [...r];
  }).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const merged=[];
  for(const next of sorted){
    const last=merged.at(-1);
    // No numerical tolerance may bridge a positive gap and invent coverage.
    if(last&&next[0]<=last[1])last[1]=Math.max(last[1],next[1]);else merged.push(next);
  }
  return merged;
}

export function bearingDomainCovered(intervals,domain){
  return unionBearingIntervals(intervals).some(([lo,hi])=>lo<=domain[0]&&hi>=domain[1]);
}

/** Interior witnesses from envelope gaps; these do not establish a range. */
export function bearingGapWitness(intervals,domain){
  const merged=unionBearingIntervals(intervals);let start=domain[0];
  for(const [lo,hi]of merged){
    if(hi<domain[0]||lo>domain[1])continue;
    if(lo>start)return (start+Math.min(lo,domain[1]))/2;
    start=Math.max(start,hi);
  }
  return start<domain[1]?(start+domain[1])/2:merged.length===0?domain[0]:null;
}

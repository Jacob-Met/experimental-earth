import {validateRainGauge} from './rain-gauge-evidence.js';
import {DEPTH_UNITS} from './observation-units.js';
import {gaugeRational as Q} from './rain-gauge-consistency.js';
/** Feasibility of original totals under any nonnegative rain history.
 * Cumulative rainfall is nondecreasing; each original interval supplies a
 * lower/upper difference constraint. No storm support, soil fit or profile is inferred.
 */
export function rainfallHistoryConsistency(project,gauge){
 const original=validateRainGauge(project,gauge),rows=original.readings.map((reading,index)=>({reading,index})).filter(e=>e.reading.use==='calibration');
 if(!rows.length)return {status:'no-calibration',witness:[],vertices:0,relaxations:0};
 const times=[...new Set(rows.flatMap(e=>[e.reading.startMinute,e.reading.endMinute]))].sort((a,b)=>a-b),edges=[];
 for(let i=1;i<times.length;i++)edges.push({from:i,to:i-1,weight:Q.zero,index:null});
 for(const {reading:r,index}of rows){const a=times.indexOf(r.startMinute),b=times.indexOf(r.endMinute),unit=Q.from(DEPTH_UNITS[r.unit]),d=Q.mul(Q.from(r.depth),unit),u=Q.mul(Q.from(r.uncertainty),unit),raw=Q.sub(d,u),lower=Q.cmp(raw,Q.zero)>0?raw:Q.zero,upper=Q.add(d,u);edges.push({from:a,to:b,weight:upper,index},{from:b,to:a,weight:Q.sub(Q.zero,lower),index});}
 const distance=times.map(()=>Q.zero),previous=times.map(()=>null);let changed=-1,relaxations=0;
 for(let round=0;round<times.length;round++){changed=-1;for(const edge of edges){relaxations++;const candidate=Q.add(distance[edge.from],edge.weight);if(Q.cmp(candidate,distance[edge.to])<0){distance[edge.to]=candidate;previous[edge.to]=edge;changed=edge.to;}}if(changed<0)break;}
 let witness=[];
 if(changed>=0){let cursor=changed;for(let i=0;i<times.length;i++)cursor=previous[cursor].from;const start=cursor,indices=new Set();do{const edge=previous[cursor];if(edge.index!==null)indices.add(edge.index);cursor=edge.from;}while(cursor!==start);witness=[...indices].sort((a,b)=>a-b).map(index=>({index,reading:original.readings[index]}));}
 return {status:changed<0?'nonnegative-history-compatible':'interval-totals-inconsistent',witness,vertices:times.length,relaxations,maxRelaxations:times.length*edges.length,
 meaning:'Calibration interval totals only, with original nominal uncertainty and units. Tests existence of any nonnegative rainfall history over the recorded intervals; ignores the constant storm cutoff deliberately. No unique rainfall profile, intensity bound, soil fit, physical validation or verified association follows. Held-aside readings never constrain this feasibility result.'};
}

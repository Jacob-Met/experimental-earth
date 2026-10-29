import{advanceNode}from'./profile-node.js';
import{advanceFinite}from'./finite-profile-node.js';
export function advanceGraph(initial,elevation,edges,boundaries,hours,mobility,outlet,rain,rates,budget,receivers){
 const dense=(xs,test)=>Array.isArray(xs)&&Array.from({length:xs.length},(_,i)=>Object.hasOwn(xs,i)&&test(xs[i])).every(Boolean),finite=x=>Number.isFinite(x),positive=x=>finite(x)&&x>=0;
 if(!dense(initial,positive)||initial.length<1||initial.length>576)throw Error('Profile graph initial bounds');
 const n=initial.length;
 if(!dense(elevation,finite)||elevation.length!==n||!dense(rates,positive)||rates.length!==n||!Array.isArray(edges)||edges.length>1152||!Array.isArray(boundaries)||boundaries.length>96||![mobility,outlet,rain].every(positive)||!finite(hours)||hours<=0||!budget||!Number.isSafeInteger(budget.used)||!Number.isSafeInteger(budget.limit)||budget.used<0||budget.limit<budget.used||budget.limit>3000000)throw Error('Profile graph bounds');
 const index=x=>Number.isInteger(x)&&x>=0&&x<n,seenEdges=new Set(),seenBoundaries=new Set();
 if(!dense(edges,e=>{if(!e||!index(e.a)||!index(e.b)||e.a===e.b)return false;const key=[e.a,e.b].sort((a,b)=>a-b).join(':');if(seenEdges.has(key))return false;seenEdges.add(key);return true;}))throw Error('Profile graph edge bounds');
 if(!dense(boundaries,b=>{if(!dense(b,Number.isInteger)||b.length!==2||!index(b[0])||b[1]<1||b[1]>2||seenBoundaries.has(b[0]))return false;seenBoundaries.add(b[0]);return true;}))throw Error('Profile graph boundary bounds');
 const inventory=initial.reduce((a,b)=>a+b,0)+rain*hours*n;if(!finite(inventory)||!initial.every((w,i)=>finite(w+elevation[i])))throw Error('Profile graph nonfinite inventory or head');
 if(!dense(receivers,r=>r===null||(r&&[r.capacityMm,r.storedMm,r.drainagePerHour].every(positive)&&r.storedMm<=r.capacityMm))||receivers.length!==n)throw Error('Finite graph receiver bounds');
 const stores=receivers.map(r=>r?.storedMm??0);if(!Number.isFinite(stores.reduce((a,b)=>a+b,inventory)))throw Error('Finite graph inventory overflow');let drained=0,receiverAbsorbed=0;
 const heads=initial.map((w,i)=>w+elevation[i]),links=Array.from({length:n},()=>[]),incoming=Array.from({length:n},()=>[]),water=initial.slice(),peak=initial.slice();let absorbed=0,exit=0;
 function charge(n){budget.used+=n;if(budget.used>budget.limit)throw Error('Profile graph work bound exceeded');}charge(n+edges.length+boundaries.length);
 for(const e of edges){if(e.crestMm!==null)throw Error('Crests unsupported by profile research model');const d=heads[e.a]-heads[e.b];if(Math.abs(d)<1e-12)continue;const src=d>0?e.a:e.b,dst=d>0?e.b:e.a;links[src].push({dst,rate:Math.abs(d)*mobility});}
 for(const [src,count]of boundaries)links[src].push({dst:-1,rate:(initial[src]+10)*outlet*count});
 if(links.some(list=>list.some(e=>!positive(e.rate))||!finite(list.reduce((sum,e)=>sum+e.rate,0))))throw Error('Profile graph nonfinite request');
 const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>heads[b]-heads[a]||a-b);
 for(const i of order){const profiles=incoming[i];if(profiles.length>4096)throw Error('Profile event population bound');const times=[...new Set([0,hours,...profiles.flatMap(p=>[p.start,p.end])])].sort((a,b)=>a-b),requested=links[i].reduce((a,e)=>a+e.rate,0);charge(profiles.length+times.length);
  for(let j=1;j<times.length;j++){const start=times[j-1],end=times[j];if(!(end>start))throw Error('Unresolved positive profile interval');charge(profiles.length+links[i].length+1);const rate=rain+profiles.reduce((s,p)=>s+(p.start<=start&&p.end>=end?p.rate:0),0),r=receivers[i]?advanceFinite({waterMm:water[i],storedMm:stores[i],capacityMm:receivers[i].capacityMm,drainagePerHour:receivers[i].drainagePerHour,arrivalMmHr:rate,uptakeMmHr:rates[i],outflowMmHr:requested,hours:end-start}):advanceNode({waterMm:water[i],arrivalMmHr:rate,uptakeMmHr:rates[i],outflowMmHr:requested,hours:end-start});if(receivers[i]){stores[i]=r.storedMm;drained+=r.drainedMm;receiverAbsorbed+=r.absorbedMm;charge(r.events);}water[i]=r.waterMm;peak[i]=Math.max(peak[i],water[i]);absorbed+=r.absorbedMm;
   for(const e of links[i]){const share=requested?e.rate/requested:0;if(e.dst<0){exit+=r.outMm*share;continue;}for(const s of r.segments??[]){const q={start:s.start===0?start:start+s.start,end:s.end===end-start?end:start+s.end,rate:s.rate*share};if(q.rate>0){if(!(q.end>q.start))throw Error('Unrepresentable positive outflow profile');incoming[e.dst].push(q);if(incoming[e.dst].length>4096)throw Error('Profile event population bound');}}}
  }
 }
 const supplied=initial.reduce((a,b)=>a+b,0)+rain*hours*n,balance=supplied-absorbed-exit-water.reduce((a,b)=>a+b,0);if(![absorbed,exit,...water,balance,drained,receiverAbsorbed,...stores].every(Number.isFinite)||Math.abs(balance)>1e-8*Math.max(1,supplied))throw Error('Profile graph balance refusal');return{water,peak,absorbed,exit,balance,stores,drained,receiverAbsorbed};
}

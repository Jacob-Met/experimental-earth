import {parseUptakeOutcome,receiveUptakeOutcome} from './ponded-uptake-outcome.js';
import {serializeAreaOffers} from './ponded-area-offers.js';
import {compareUptakeArea} from './ponded-uptake-area.js';
const intersect=(a,b)=>a&&b?[Math.max(a[0],b[0]),Math.min(a[1],b[1])]:null;
const present=a=>a&&a[0]<=a[1];
export function compareActualCourse(sources){
 if(!Array.isArray(sources)||sources.length<1||sources.length>99)throw Error('Supply 1–99 complete saved actual outcomes.');
 const raw=sources.map(x=>typeof x==='string'?x:JSON.stringify(x));if(raw.reduce((n,x)=>n+new TextEncoder().encode(x).length,0)>2000000)throw Error('Complete outcome sources exceed2000000bytes.');
 const admitted=raw.map(parseUptakeOutcome);
 const first=admitted[0].design,{study,area,offer}=first,identity=serializeAreaOffers(study,area,offer);
 if(study.readings.length+admitted.length>100)throw Error('Original and actual rows together exceed the maintained 100-reading bound.');
 for(const x of admitted)if(serializeAreaOffers(x.design.study,x.design.area,x.design.offer)!==identity)throw Error('Every outcome must retain exactly the same original study, area and offered-reading design.');
 const ordered=[...admitted].sort((a,b)=>a.actual.minute-b.actual.minute);
 for(let i=1;i<ordered.length;i++)if(ordered[i].actual.minute===ordered[i-1].actual.minute)throw Error('Duplicate actual time: select one original reading record for each offered instant.');
 const individual=ordered.map(x=>receiveUptakeOutcome(study,area,offer,x.actual));
 const original=compareUptakeArea(study,area);
 const complete=compareUptakeArea({...study,readings:[...study.readings,...ordered.map(x=>({...x.actual,role:'challenge'}))]},area);
 const candidates=original.candidates.map((c,i)=>{
  const rows=complete.candidates[i].challenges.slice(-ordered.length);
  let outer=c.possibleAreaM2,inner=c.interiorAreaM2;
  for(const r of rows){outer=intersect(outer,r.possibleAreaM2);inner=intersect(inner,r.interiorAreaM2);}
  const status=c.support==='need-calibration'?'need-calibration':c.support==='excluded'?'originally-excluded':!present(outer)?'jointly-contradicted':present(inner)&&(area.lowM2===area.highM2||inner[0]<inner[1])?'common-area-supported':'numerical-boundary';
  return {id:c.id,originalCalibrationSupport:c.support,originalCalibrationAreaM2:c.possibleAreaM2,individualStatuses:rows.map(r=>({minute:r.minute,status:r.status})),status,commonChallengeAreaM2:present(outer)?outer:null,commonInteriorAreaM2:present(inner)?inner:null};
 });
 return {candidates,individual,actualMinutes:ordered.map(x=>x.actual.minute),qualification:'One unchanged original test area must explain every selected actual follow-up jointly. Challenge intersections do not refit, replace or narrow the retained calibration area. Supported interiors remain engineering arithmetic, not physical validation. Every selected original outcome is included; no subset is chosen.'};
}
export function serializeActualCourse(sources){compareActualCourse(sources);const admitted=sources.map(x=>parseUptakeOutcome(typeof x==='string'?x:JSON.stringify(x)));const text=JSON.stringify({schema:'experimental-earth-uptake-course/1',outcomes:admitted},null,2);if(new TextEncoder().encode(text).length>2000000)throw Error('Complete original outcome course exceeds 2000000 bytes.');return text;}
export function parseActualCourse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>2000000)throw Error('Choose a complete outcome course up to2000000bytes.');const x=JSON.parse(text);if(x.schema!=='experimental-earth-uptake-course/1')throw Error('Wrong actual-course source format.');return JSON.parse(serializeActualCourse(x.outcomes));}

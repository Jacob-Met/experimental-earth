import {readFile,writeFile} from 'node:fs/promises';
import {fixture} from '../tests/root-zone-course-fixture.mjs';
import {compareRootCourse} from '../root-zone-course.js';
const source=JSON.parse(await readFile(new URL('../research/usda-er2-original-pair.json',import.meta.url),'utf8'));
const input=fixture(1),rows=[source.events.DRY.filter(r=>Number(r.raw.Time)<=40),source.events.WET.filter(r=>Number(r.raw.Time)<=14)];
for(const [i,event]of input.events.entries()){
 const retained=rows[i];if(!retained.every(r=>r.raw.Precipitation==='74'&&r.raw['Run-on']==='0'))throw Error('Original sample premise changed');
 const minutes=Number(retained.at(-1).raw.Time);event.project.weather.rainMmHr=Number(retained[0].raw.Precipitation);event.project.weather.stormMinutes=event.project.weather.durationMinutes=minutes;
 event.project.title='USDA ER2 '+(i?'WET':'DRY')+' sample-conditioned hypothetical garden';
 event.reference=(i?'WET':'DRY')+' original lines '+retained[0].sourceLine+'–'+retained.at(-1).sourceLine+'; uniform forcing between samples assumed';
 event.surfaceResetSource='Hypothetical initially dry garden, not reconstruction of USDA plot state. No surface-water carryover. Gap is authored, not a recorded interval between original experiments.';
}
input.associationSource='Rain-rate values and time span derived from USDA ER2 retained source SHA256 '+source.sourceSha256+'. Constant rain between samples is declared. Garden, root stores, gaps and demands are hypothetical; no observed infiltration, rooted water or causal intervention result is asserted.';
const spaced=compareRootCourse(input);const adjacent=structuredClone(input);adjacent.events[1].gapDays=0;adjacent.schedule[0].durationDays+=1;const together=compareRootCourse(adjacent);
const receipt={meaning:'Original precipitation sample-conditioned model experiment, not a reconstructed measured root-water course',originalSourceSha256:source.sourceSha256,originalRows:rows,input,spaced:spaced.existing.final,adjacent:together.existing.final};
console.log(JSON.stringify(receipt,null,2));
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(receipt,null,2));

import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseHourlyBytes,selectCourse} from './intake.mjs';
import {makeExample,validateProject} from '../../core.js';
import {prepareSurfaceHeatStudy} from '../../surface-heat.js';
import {prepareHeatColumnStudy} from '../../heat-column.js';
import {prepareHeatColumnEvidence,compareHeatColumnEvidence} from '../../heat-column-evidence.js';
import {serializePortableProject} from '../../project-portability.js';
export function buildNoaaExample() {
 const receipt=JSON.parse(readFileSync(new URL('./source-receipt.json',import.meta.url),'utf8'));
 const source=receipt.sources.find(s=>s.file==='CRNH0203-2025-AZ_Tucson_11_W.txt');
 const intake=parseHourlyBytes(readFileSync(new URL('./tucson-hourly-excerpt.txt',import.meta.url)),{sourceUrl:source.url,expectedSha256:receipt.excerpt.sha256});
 if(intake.rows.length!==9 || receipt.excerpt.sourceLineNumbers.join(',')!=='16,17,18,19,20,21,22,23,24') throw Error('Unexpected excerpt selection');
 const course=selectCourse(intake,{firstLine:1,count:9,correctionType:'C',initialState:{timeUtc:'2025-01-01T15:00:00.000Z',surfaceC:20,lowerC:20,assumption:'Illustrative instantaneous point states of 20 C each; neither measured nor derived from hourly means.'}});
 const p=makeExample(); p.title='NOAA Tucson hourly means · illustrative unfitted column';
 p.existing[0].provenance='Illustrative model cell associated with NOAA Tucson hourly source for a declared exercise; no station terrain or physical column was measured.';
 p.proposal[0].provenance=p.existing[0].provenance;
 const top={capacityJm2K:20000,exchangeWm2K:10,absorptivity:.8,initialC:20,source:'Authored illustrative C1=20000 J/(m² K), h=10 W/(m² K), alpha=0.8; point initial surface20 C at2025-01-01T15:00Z. Not fitted or calibrated.'};
 const schedule=course.rows.map((r,i)=>({minutes:60,incidentWm2:r.numbers.SOLARAD.value,reservoirC:r.numbers.T_HR_AVG.value,source:`NOAA Tucson source line ${i+16}; UTC (${r.intervalStartUtc}, ${r.intervalEndUtc}]; SOLARAD=${r.raw.SOLARAD} W/m² flag${r.raw.SOLARAD_FLAG}, T_HR_AVG=${r.raw.T_HR_AVG} C. Hourly means assumed constant within hour; source receipt accompanies project.`}));
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:top,proposal:{...top},schedule});
 const lower={capacityJm2K:80000,conductanceWm2K:20,initialC:20,source:'Authored reference lower store; point initial20 C at2025-01-01T15:00Z. Not a measured depth temperature or fitted property.'};
 p.heatColumnStudy=prepareHeatColumnStudy(p,{existing:lower,proposal:{...lower}});
 p.heatColumnEvidence=prepareHeatColumnEvidence(p,{target:'existing',associationSource:'NOAA Tucson WBAN '+course.rows[0].raw.WBANNO+' hourly surface means, literal parent lines16–24; see accompanying byte/SHA receipt. Illustrative cell and initial point states20 C each; hourly forcing assumed constant. Fixed alternatives are not fitted. Supplied ±0.5 C is an authored comparison band, not instrument uncertainty. First3 calibration and next6 challenge are labels, not independent held-out validation.',hypotheses:[60000,80000,160000].map(capacityJm2K=>({label:`Lower capacity ${capacityJm2K} J/(m² K)`,capacityJm2K,conductanceWm2K:20,source:'Offered illustrative capacity with fixed g=20 W/(m² K); selected before comparison, not fitted to NOAA readings.'})),readings:course.rows.map((r,i)=>({aggregation:'interval-mean',fromMinute:i*60,minute:(i+1)*60,temperatureC:r.numbers.SUR_TEMP.value,halfWidthC:.5,use:i<3?'calibration':'challenge',source:`NOAA Tucson parent line${i+16}; UTC (${r.intervalStartUtc}, ${r.intervalEndUtc}]; SUR_TEMP=${r.raw.SUR_TEMP} C, type${r.raw.SUR_TEMP_TYPE}, flag${r.raw.SUR_TEMP_FLAG}. Supplied ±0.5 C is illustrative, not NOAA uncertainty; source bytes and SHA in receipt.`}))});
 validateProject(p); return {project:p,course,intake,receipt,report:compareHeatColumnEvidence(p)};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const result=buildNoaaExample();
 writeFileSync(new URL('./project.json',import.meta.url),serializePortableProject(result.project)+'\n');
 process.stdout.write(JSON.stringify({source:{parentUrl:result.course.source.url,parentSha256:result.receipt.sources[2].sha256,excerptSha256:result.course.source.sha256,parentLineNumbers:result.receipt.excerpt.sourceLineNumbers},rows:result.intake.rows.length,status:result.report.status,candidates:result.report.candidates.map(c=>({label:c.label,calibration:c.calibration,challenge:c.challenge}))},null,2)+'\n');
}

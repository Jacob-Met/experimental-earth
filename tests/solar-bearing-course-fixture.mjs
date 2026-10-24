import {makeExample} from '../core.js';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {sunPathPosition} from '../solar-path.js';

export function bearingCourseFixture(){
  const project=makeExample();project.width=4;project.height=2;project.selectedIndex=0;project.weather.cellSizeM=2;
  project.existing=Array.from({length:8},()=>({surface:'turf',elevationM:0,provenance:'Authored common-bearing course'}));
  project.proposal=structuredClone(project.existing);
  project.solarStudy=prepareSolarStudy(project,{headingDeg:0,elevationDeg:45,sunSource:'Original retained direction',existing:[],proposal:[{cellIndex:2,heightMinM:10,heightMaxM:10,source:'Authored C1 opaque column'}]});
  const center=sunPathPosition('2026-06-21T08:00:00Z',51.5,-.1,0).azimuthDeg;
  return {project,declaration:{latitudeDeg:51.5,longitudeDeg:-.1,gridColumnBearingDeg:center,locationSource:'Authored London control',orientationSource:'Authored alignment at08:00 UTC',startUtc:'2026-06-21T06:00:00Z',endUtc:'2026-06-21T10:00:00Z',stepMinutes:30},settings:{cellIndex:0,halfWidthDeg:90,basis:'Explicit illustrative common-bearing range'}};
}

import { LONGWAVE_HEAT_SCHEMA } from '../longwave-heat.js';

export function longwavePortabilityFixture({multibyte=false,escaped=false}={}) {
  const char=escaped?'\ud800':multibyte?'場':'x';
  const context={width:2,height:2,cellSizeM:1,source:char.repeat(multibyte||escaped?19000:20),cellIndex:0,
    existing:{surface:'sealed',elevationM:0,provenance:'authored'},proposal:{surface:'sealed',elevationM:0,provenance:'authored'}};
  if(multibyte||escaped)context.source=char.repeat(20000-JSON.stringify({...context,source:''}).length);
  // JSON permits escaped lone surrogates. A decoded context string can contain
  // them literally; the outer portable JSON must account for re-escaping them.
  let contextJson=JSON.stringify(context);
  if(escaped)contextJson=contextJson.replaceAll('\\ud800','\ud800');
  const layer={capacityJm2K:48000,exchangeWm2K:5,absorptivity:.65,initialC:30,source:char.repeat(600)};
  return {schema:LONGWAVE_HEAT_SCHEMA,exchangeBasis:'excludes-longwave',heatStudy:{schema:'experimental-earth-surface-heat/1',model:'uniform-layer-forced-linear-exchange',cellIndex:0,contextJson,
    existing:layer,proposal:{...layer},schedule:Array.from({length:24},()=>({minutes:1,incidentWm2:0,reservoirC:20,source:char.repeat(400)}))},
    existing:{emissivity:.9,source:char.repeat(600)},proposal:{emissivity:.9,source:char.repeat(600)},
    radiationSchedule:Array.from({length:24},()=>({skyC:-10,source:char.repeat(600)}))};
}

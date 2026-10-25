import {coolingExample} from './evaporative-cooling-example.js';
import {RECHARGE_COOLING_SCHEMA} from './recharge-cooling.js';
export function rechargeCoolingExample(){
 const {project,study:cooling}=coolingExample();
 project.title='Fictional courtyard — cooling while rain arrives';
 project.weather.rainMmHr=.75;project.weather.stormMinutes=240;project.weather.durationMinutes=240;
 return {project,study:{schema:RECHARGE_COOLING_SCHEMA,cooling,
  clockSource:'Authored common clock: thermal minute zero is rain-event start. Native five-minute infiltration is distributed uniformly within each interval. The same four-hour rain is held until minute 240 only in the comparison; this is not observed timing.'}};
}

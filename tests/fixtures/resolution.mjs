import {makeExample} from '../../core.js';
export function bandFlip() {
 const p=makeExample();p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};
 p.observations=[{cellIndex:7,minute:60,depthMm:7,uncertaintyMm:.2,scenario:'existing',use:'calibration',source:'authored numerical-resolution control, not a measurement'}];return p;
}
export function rankingFlip() {const p=bandFlip();p.observations[0].depthMm=9.5;p.observations[0].uncertaintyMm=4;return p;}
export function noFlow() {
 const p=makeExample();p.width=2;p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'analytic no-flow fixture'}));p.proposal=structuredClone(p.existing);
 p.weather={...p.weather,rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0};
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[0,10,20]};
 p.observations=[{cellIndex:0,minute:17.3,depthMm:20*17.3/60,uncertaintyMm:.01,scenario:'existing',use:'calibration',source:'analytic linear rainfall control, not a measurement'}];return p;
}
export function challengeFlip() {
 const p=bandFlip();p.observations[0].use='challenge';
 p.observations.unshift({...p.observations[0],minute:0,depthMm:0,uncertaintyMm:0,use:'calibration',source:'uninformative zero-initial-condition control, not a measurement'});return p;
}
export function rainStopInterpolationFlip() {
 const p=noFlow();p.weather.stormMinutes=7;p.weather.durationMinutes=10;
 p.observations[0].minute=6;p.observations[0].depthMm=2;p.observations[0].uncertaintyMm=.05;return p;
}

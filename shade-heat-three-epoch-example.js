import {makeManySkyExample} from './shade-heat-many-example.js';

// Fixed authored complete original course, zero-based bins1/2/3 and original
//07:00/09:00 changes. Numerical control, not field observations. Values are
// retained here and never fitted or regenerated when a user opens the example.
const temperatures=[
  26.38944689941117,
  26.39995097682589,
  26.168026334165262,
  22.052182695114478,
  21.3960548760837,
  23.32447427220958,
  23.127022065084798,
  26.1590460617306,
  22.693238070866528,
  22.309800314498464,
  25.53932533660891,
  25.173202487729643,
  26.189038921477653,
  26.188997204689738,
  24.29676895146193,
  23.404941025835715,
  26.256391724352422,
  26.195302123908395,
  26.38495771036193,
  25.171941122193832,
  24.649536522227717,
  26.376038173606645,
  26.365845039585096,
  26.39993012283189
];
export function makeThreeEpochSkyExample(){
  const prior=makeManySkyExample();
  const readings=prior.readings.map((input,index)=>({...input,query:{...input.query,reading:{...input.query.reading,
    temperatureC:temperatures[index],halfWidthC:.001,
    source:'Authored complete original three-epoch course, zero-based bins1/2/3 with07:00/09:00 UTC changes; numerical control, not field observations.'}}}));
  return {readings,query:{bins:4,splitAfterIntervals:[6,10],
    sharingSource:'Authored unchanged original site, forcing and receiver thermal declarations: three common sky profiles separated at original07:00 and09:00 UTC. No measured sky history claim.'}};
}

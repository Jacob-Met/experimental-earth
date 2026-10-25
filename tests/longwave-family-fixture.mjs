import {evidenceFixture} from './longwave-heat-evidence-fixture.mjs';
import {LONGWAVE_FAMILY_SCHEMA} from '../longwave-heat-evidence.js';
export function familyFixture(){
 const {input,project}=evidenceFixture();input.schema=LONGWAVE_FAMILY_SCHEMA;input.evidence.schema='experimental-earth-surface-heat-evidence/2';input.evidence.energyQuantity='absorbed-input';
 input.evidence.readings=[{minute:30,temperatureC:31.541027020429883,halfWidthC:.05,use:'calibration',source:'Authored baseline temperature control, not acquired'}];
 input.evidence.energyReadings=[{fromMinute:0,toMinute:60,energyJm2:860000,halfWidthJm2:10000,use:'challenge',source:'Separately authored absorbed-energy control, not derived from temperature'}];
 input.evidence.hypotheses.push({...input.evidence.hypotheses[0],label:'C slower',capacityJm2K:80000});
 input.radiativeHypotheses=[{label:'B',emissivity:.9,source:'Authored common coefficient scale'},{label:'C slower',emissivity:.45,source:'Authored fixed emissivity'},{label:'A',emissivity:.45,source:'Authored reference emissivity'}];project.surfaceHeatEvidence=structuredClone(input.evidence);return {input,project};
}
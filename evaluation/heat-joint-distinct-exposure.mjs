import assert from 'node:assert/strict';
import {transferProject,transferHeader} from '../tests/heat-column-transfer-fixture.mjs';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy} from '../heat-column.js';
import {prepareHeatColumnTransfer,compareHeatColumnTransfer} from '../heat-column-transfer.js';
const original=transferProject();
function exposure(index,candidateIndex){
 const p=transferProject(true);p.title='Authored independent exposure '+index;
 const top={...p.surfaceHeatStudy.existing,initialC:48+index*3};
 p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,{cellIndex:0,existing:top,proposal:{...top,absorptivity:.4},schedule:[{minutes:27,incidentWm2:35*index,reservoirC:10+index,source:'Authored separate first forcing'},{minutes:33,incidentWm2:160+index*40,reservoirC:16+index,source:'Authored separate second forcing'}]});
 const lower={...p.heatColumnStudy.lowerLayers.existing,initialC:31+index};delete p.heatColumnStudy;p.heatColumnStudy=prepareHeatColumnStudy(p,{existing:lower,proposal:lower});
 const file={name:'authored-'+index+'.csv',text:transferHeader+'\n15,,instant,30,100,C,challenge,Authored probe only\n45,30,interval-mean,30,100,C,challenge,Authored probe only\n'};
 const b=prepareHeatColumnTransfer(original,p,file,'Authored unchanged-material declaration; no acquired data');
 const predictions=compareHeatColumnTransfer(b).candidates[candidateIndex].challenge.rows.map(x=>x.predictionC);
 b.readingFile.text=transferHeader+`\n15,,instant,${predictions[0]},0.01,C,challenge,Authored generated control\n45,30,interval-mean,${predictions[1]},0.01,C,challenge,Authored generated control\n`;
 return b;
}
const bundles=[exposure(1,1),exposure(2,2),exposure(3,1)];
const snapshots=JSON.stringify(bundles),results=bundles.map(compareHeatColumnTransfer);
const labels=results[0].originalSurvivingLabels;
function common(indices){return labels.filter(label=>indices.every(i=>results[i].transferLabels.includes(label)));}
const conflicts=[];
for(let mask=1;mask<1<<results.length;mask++){
 const indices=results.map((_,i)=>i).filter(i=>mask&(1<<i));
 if(common(indices).length===0&&!conflicts.some(c=>c.every(i=>indices.includes(i))))conflicts.push(indices);
}
assert.ok(results.every(r=>r.transferLabels.length===1));assert.deepEqual(common([0,1,2]),[]);assert.deepEqual(common([0,2]),[labels[1]]);assert.deepEqual(conflicts,[[0,1],[1,2]]);assert.equal(JSON.stringify(bundles),snapshots);
console.log(JSON.stringify({kind:'Authored software/model probe, not independent physical data',originalRetained:labels,perExposure:results.map(r=>r.transferLabels),jointRetained:common([0,1,2]),minimalConflicts:conflicts,matchingExposureControl:common([0,2]),sourcesUnchanged:true},null,2));

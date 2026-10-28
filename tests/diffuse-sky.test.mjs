import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy } from '../solar-occlusion.js';
import { compareDiffuseSkyAt, normalizeDiffuseSky } from '../diffuse-sky.js';

function flat(width=5,height=5) {
 const {project:p}=makeShadeHeatExample();
 delete p.heatColumnStudy;delete p.surfaceHeatStudy;delete p.solarStudy;
 p.width=width;p.height=height;p.selectedIndex=Math.floor(height/2)*width+Math.floor(width/2);
 p.existing=Array.from({length:width*height},()=>({surface:'sealed',elevationM:0,provenance:'Independent authored level grid'}));
 p.proposal=structuredClone(p.existing);p.observations=[];
 p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Authored direction',existing:[],proposal:[]});
 return p;
}
const feature=(cellIndex,heightMinM,heightMaxM=heightMinM)=>({cellIndex,heightMinM,heightMaxM,source:'Independent authored wall'});
function wall(low,high=low){const p=flat();p.solarStudy.proposal=[3,8,13,18,23].map(i=>feature(i,low,high));return p;}
function exactWallTransmission(height){
 const d=1,halfWidth=5,a=Math.atan(halfWidth/d),s=Math.hypot(d,height);
 return 1-(a-d/s*Math.atan(d*Math.tan(a)/s))/Math.PI;
}
const close=(a,b,tol=1e-12)=>assert.ok(Math.abs(a-b)<=tol, a+' differs from '+b);

test('clear sky and a high complete surrounding wall give independently known unit and zero sampled transmission',()=>{
 const p=flat(3,3),before=JSON.stringify(p);let r=compareDiffuseSkyAt(p,4);
 assert.deepEqual(r.existing.transmission,[1,1]);assert.deepEqual(r.proposal.transmission,[1,1]);
 assert.equal(JSON.stringify(p),before);assert.equal(r.sampleCount,512);
 p.solarStudy.proposal=Array.from({length:9},(_,i)=>i).filter(i=>i!==4).map(i=>feature(i,50));
 r=compareDiffuseSkyAt(p,4);
 assert.deepEqual(r.proposal.transmission,[0,0]);assert.equal(r.proposal.counts.blocked,512);
 assert.deepEqual(r.existing.transmission,[1,1]);
});

test('finite vertical wall matches an independent continuous angular integral and per-direction plane intersections',()=>{
 for(const height of [.25,1,2,6]){
  const p=wall(height),r=compareDiffuseSkyAt(p,12,{azimuthSamples:64,elevationBands:32});
  close(r.proposal.transmission[0],exactWallTransmission(height),.012);
  for(const row of r.directions){
   const a=row.headingDeg*Math.PI/180,e=row.elevationDeg*Math.PI/180;
   const dx=Math.cos(e)*Math.cos(a),dy=Math.cos(e)*Math.sin(a),dz=Math.sin(e);
   const blocked=dx>0&&Math.abs(dy/dx)<5&&dz/dx<height;
   if(row.proposal.status!=='grazing')assert.equal(row.proposal.status,blocked?'blocked':'no-mapped-blocker');
  }
 }
});

test('uncertain heights enclose every tested exact-height sampled model and quarter rotations preserve weights',()=>{
 const p=wall(.5,3),before=JSON.stringify(p),envelope=compareDiffuseSkyAt(p,12);
 assert.ok(envelope.proposal.ambiguousDirections>0);
 for(const height of [.5,.7,1.4,2.1,3]){
  const exact=compareDiffuseSkyAt(wall(height),12);
  assert.ok(exact.proposal.transmission[0]>=envelope.proposal.transmission[0]);
  assert.ok(exact.proposal.transmission[1]<=envelope.proposal.transmission[1]);
 }
 const rotated=wall(.5,3);
 rotated.solarStudy.proposal=rotated.solarStudy.proposal.map(f=>({...f,cellIndex:3*5+(4-Math.floor(f.cellIndex/5))}));
 const turned=compareDiffuseSkyAt(rotated,12);
 assert.deepEqual(turned.proposal.transmission,envelope.proposal.transmission);
 assert.deepEqual(turned.proposal.counts,envelope.proposal.counts);
 assert.equal(JSON.stringify(p),before);
});

test('mapped grazing contributes an unresolved weight instead of false clear or blocked certainty',()=>{
 const p=wall(Math.SQRT2),r=compareDiffuseSkyAt(p,12,{azimuthSamples:4,elevationBands:1});
 assert.ok(r.proposal.counts.grazing>0);
 assert.ok(r.proposal.transmission[0]<r.proposal.transmission[1]);
});

test('source admission, footprints and sampling work limits refuse unsupported investigations',()=>{
 const p=flat();
 for(const input of [{},{azimuthSamples:6,elevationBands:2},{azimuthSamples:128,elevationBands:64},
  {azimuthSamples:32,elevationBands:0},{azimuthSamples:NaN,elevationBands:16},{azimuthSamples:32,elevationBands:16,result:1}]){
  assert.throws(()=>normalizeDiffuseSky(input));
 }
 assert.throws(()=>compareDiffuseSkyAt(p,-1));
 p.solarStudy.proposal=[feature(12,1)];assert.throws(()=>compareDiffuseSkyAt(p,12),/footprint/);
 p.solarStudy.proposal=[];p.existing[0].elevationM=.1;
 assert.deepEqual(compareDiffuseSkyAt(p,12),{status:'context-changed'});
 delete p.solarStudy;assert.deepEqual(compareDiffuseSkyAt(p,12),{status:'no-study'});
});

test('a nonbinary sampling count does not manufacture uncertain transmission from subtraction rounding',()=>{
 const r=compareDiffuseSkyAt(wall(2.37),12,{azimuthSamples:12,elevationBands:3});
 assert.equal(r.proposal.ambiguousDirections,0);assert.equal(r.proposal.counts.blocked,12);
 assert.equal(r.proposal.transmission[0],r.proposal.transmission[1]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy, compareSolarOcclusion, compareSolarOcclusionAt } from '../solar-occlusion.js';

function site(width=4,height=4){
  const {project}=makeShadeHeatExample();
  delete project.heatColumnStudy; delete project.surfaceHeatStudy; delete project.solarStudy;
  project.width=width; project.height=height; project.selectedIndex=0;
  project.existing=Array.from({length:width*height},()=>({surface:'sealed',elevationM:0,provenance:'Independent authored flat grid'}));
  project.proposal=structuredClone(project.existing); project.observations=[];
  return project;
}
function study(project,{headingDeg=0,elevationDeg=45,existing=[],proposal=[]}={}){
  project.solarStudy=prepareSolarStudy(project,{headingDeg,elevationDeg,sunSource:'Independent authored direction',existing,proposal});
  return project;
}
const column=(cellIndex,heightMinM,heightMaxM=heightMinM)=>({cellIndex,heightMinM,heightMaxM,source:'Independent authored opaque column'});

test('selected-point geometry has independently known clear, blocked, uncertain, grazing and footprint cases',()=>{
  for(const [low,high,status] of [[.5,.5,'no-mapped-blocker'],[2,2,'blocked'],[.5,2,'height-dependent'],[1,1,'grazing']]){
    const p=study(site(),{proposal:[column(6,low,high)]}), before=structuredClone(p);
    const result=compareSolarOcclusionAt(p,5);
    assert.equal(result.existing.status,'no-mapped-blocker'); assert.equal(result.proposal.status,status);
    if(status!=='no-mapped-blocker')assert.equal(result.proposal.witness.cellIndex,6);
    assert.deepEqual(result.changes,status==='no-mapped-blocker'?[]:[{cellIndex:5,existing:'no-mapped-blocker',proposal:status}]);
    assert.deepEqual(p,before);
    assert.equal(compareSolarOcclusionAt(p,6).proposal.status,'footprint');
  }
  const turned=study(site(),{headingDeg:180,proposal:[column(6,2)]});
  assert.equal(compareSolarOcclusionAt(turned,5).proposal.status,'no-mapped-blocker');
  const terrain=site(); terrain.proposal[6].elevationM=2; study(terrain);
  const result=compareSolarOcclusionAt(terrain,5);
  assert.equal(result.proposal.status,'blocked'); assert.equal(result.proposal.witness.kind,'declared terrain');
});

test('selected-point samples preserve complete-map outputs and witnesses across different source grids',()=>{
  for(const [width,height] of [[2,3],[5,4],[8,6]])for(const [headingDeg,elevationDeg] of [[0,45],[35,20],[90,1],[183,70],[315,35]]){
    const p=site(width,height),count=width*height;
    for(let i=0;i<count;i++){
      p.existing[i].elevationM=(i*7%11)/10; p.proposal[i].elevationM=(i*13%17)/10;
    }
    study(p,{headingDeg,elevationDeg,existing:[column(0,1)],proposal:[column(count-1,.3,2)]});
    const before=structuredClone(p),all=compareSolarOcclusion(p);
    for(let cellIndex=0;cellIndex<count;cellIndex++){
      const one=compareSolarOcclusionAt(p,cellIndex);
      assert.equal(one.cellIndex,cellIndex); assert.deepEqual(one.existing,all.existing[cellIndex]);
      assert.deepEqual(one.proposal,all.proposal[cellIndex]); assert.deepEqual(one.direction,all.direction);
      assert.equal(one.epsilonM,all.epsilonM); assert.equal(one.semantics,all.semantics);
      assert.deepEqual(one.changes,all.changes.filter(row=>row.cellIndex===cellIndex));
    }
    assert.deepEqual(p,before);
  }
});

test('single-point admission preserves absent and stale source states and rejects invalid original cells',()=>{
  const p=site();
  assert.deepEqual(compareSolarOcclusionAt(p,0),{status:'no-study'});
  study(p); p.existing[0].elevationM+=.1;
  assert.deepEqual(compareSolarOcclusionAt(p,0),{status:'context-changed'});
  for(const value of [undefined,null,-1,16,.5,NaN,Infinity,'0']){
    assert.throws(()=>compareSolarOcclusionAt(study(site()),value),/integer|outside/);
  }
});

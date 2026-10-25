import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeExample, validateProject, compare } from '../core.js';
import { parseTerrainRaster, previewTerrainRaster, applyTerrainRasterPreview } from '../terrain-raster-import.js';
import { previewTerrainTable, applyTerrainPreview } from '../terrain-import.js';
import { solarContext } from '../solar-occlusion-contract.js';

const source = 'ncols 4\nnrows 3\nxllcorner 100\nyllcorner 200\ncellsize 2\nnodata_value -9999\n100 101 102 103\n104 105 106 107\n108 109 110 111\n';
const options = { fileName: 'original.asc', source: 'Authored asymmetric original grid', coordinateReference: 'Authored Cartesian metres', horizontalUnit: 'm', verticalUnit: 'm', row: 2, column: 2, referenceValue: 105 };
const site = () => {
  const p = makeExample(); p.width = p.height = 2; p.existing = p.existing.slice(0, 4); p.proposal = p.proposal.slice(0, 4); p.selectedIndex = 0; return p;
};

test('selected original cells preserve independent corner-center coordinates, source lines and exact file identity', async () => {
  const p = site(), saved = structuredClone(p), preview = await previewTerrainRaster(source, p, options);
  assert.deepEqual(preview.cells.map(c => c.elevationM), [0, 1, 4, 5]);
  assert.deepEqual(preview.cells.map(c => [c.rasterSource.row, c.rasterSource.column, c.rasterSource.x, c.rasterSource.y, c.rasterSource.line]),
    [[2,2,103,203,8], [2,3,105,203,8], [3,2,103,201,9], [3,3,105,201,9]]);
  assert.equal(preview.sha256, createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(p, saved);
  assert.equal(preview.cells[0].terrainSource, undefined, 'absence of raster uncertainty must not become a survey interval');
  const centered = source.replace('xllcorner 100', 'xllcenter 101').replace('yllcorner 200', 'yllcenter 201');
  const cv = await previewTerrainRaster(centered, p, options);
  assert.deepEqual(cv.cells.map(c => [c.rasterSource.x,c.rasterSource.y]), preview.cells.map(c => [c.rasterSource.x,c.rasterSource.y]));
});

test('ASCII data wrapping and CRLF do not change raster order; original line and bytes remain source-specific', async () => {
  const wrapped = source.replace('100 101 102 103\n104 105 106 107\n108 109 110 111', '100\n101 102 103 104 105\n106 107 108 109 110 111').replaceAll('\n', '\r\n');
  const a = await previewTerrainRaster(source, site(), options), b = await previewTerrainRaster(wrapped, site(), options);
  assert.deepEqual(a.cells.map(c => c.elevationM), b.cells.map(c => c.elevationM));
  assert.notEqual(a.sha256, b.sha256);
  assert.deepEqual(b.cells.map(c => c.rasterSource.line), [8,9,9,9]);
});

test('explicit unit conversion and source-derived local zero retain physical differences', async () => {
  const cm = source.replace('cellsize 2', 'cellsize 200');
  const a = await previewTerrainRaster(cm, site(), {...options, horizontalUnit: 'cm', verticalUnit: 'cm', referenceValue: null});
  assert.deepEqual(a.cells.map(c => c.elevationM), [0,.01,.04,.05]);
  assert.equal(a.cells[0].rasterSource.referenceValue, 105);
  assert.match(a.datum, /row 2, column 2/);
  await assert.rejects(previewTerrainRaster(source, site(), {...options, horizontalUnit:'degrees'}), /units/);
  await assert.rejects(previewTerrainRaster(source, site(), {...options, horizontalUnit:'cm'}), /spacing/);
});

test('NoData outside the selected source window is retained as missing and selected missing terrain refuses atomically', async () => {
  const outside = source.replace('100 101', '-9999 101');
  assert.equal((await previewTerrainRaster(outside, site(), options)).cells.length, 4);
  await assert.rejects(previewTerrainRaster(source.replace('105 106','-9999 106'), site(), options), /NoData/);
  await assert.rejects(previewTerrainRaster(source.replace('105 106','-9999 106'), site(), {...options,referenceValue:null}), /NoData/);
  const implicit = source.replace('nodata_value -9999\n','').replace('105 106','-9999 106');
  await assert.rejects(previewTerrainRaster(implicit, site(), options), /NoData/);
});

test('malformed headers, missing/extra samples and nonfinite values cannot produce terrain', () => {
  for (const bad of [source.replace('ncols 4','ncols 4\nncols 4'), source.replace('ncols 4','ncols 4.5'), source.replace('nrows 3','nrows 2000000'), source.replace('yllcorner','yllcenter'), source.replace('cellsize 2','cellsize 0'), source.replace('111\n',''), source+'112', source.replace('105 106','NaN 106'), source.replace('105 106','1e999 106'), source.replace('105 106','105,106'), '\ufeff'+source]) {
    assert.throws(() => parseTerrainRaster(bad));
  }
});

test('invalid crops and too-large local relief refuse without modifying the source site', async () => {
  const p=site(), before=JSON.stringify(p);
  for (const patch of [{row:0},{column:4},{row:3},{column:1.5},{referenceValue:Infinity},{referenceValue:0},{source:''},{coordinateReference:''}]) {
    await assert.rejects(previewTerrainRaster(source,p,{...options,...patch}));
  }
  assert.equal(JSON.stringify(p),before);
});

test('apply changes actual maintained rain behavior, preserves other content and reopens original samples', async () => {
  const p=site(), before=compare(p), preview=await previewTerrainRaster(source,p,options);
  const next=applyTerrainRasterPreview(p,preview,'existing');
  assert.deepEqual(next.proposal,p.proposal);assert.deepEqual(next.observations,p.observations);
  assert.deepEqual(next.existing.map(c=>c.surface),p.existing.map(c=>c.surface));
  const received=validateProject(JSON.parse(JSON.stringify(next))), after=compare(received);
  assert.notDeepEqual(after.existing.peakDepthMm,before.existing.peakDepthMm);
  assert.equal(after.existing.rainLiters,before.existing.rainLiters);
  assert.ok(Math.abs(after.existing.massErrorLiters)<1e-6);
  const both=applyTerrainRasterPreview(p,preview,'both');
  assert.deepEqual(both.existing.map(c=>c.elevationM),both.proposal.map(c=>c.elevationM));
  assert.deepEqual(both.proposal.map(c=>c.surface),p.proposal.map(c=>c.surface));
  assert.notEqual(both.existing[0].rasterSource,both.proposal[0].rasterSource);
});

test('stale previews including mutation during digest cannot overwrite a changed site', async () => {
  const p=site(), pending=previewTerrainRaster(source,p,options);p.title='Changed while digest pending';
  const preview=await pending;
  assert.throws(()=>applyTerrainRasterPreview(p,preview,'existing'),/changed/);
  assert.throws(()=>applyTerrainRasterPreview(site(),preview,'missing'),/Choose/);
});

test('reopening refuses inconsistent sample, coordinate, unit, spacing and source identities', async () => {
  const original=applyTerrainRasterPreview(site(),await previewTerrainRaster(source,site(),options),'existing');
  for(const mutate of [p=>p.existing[0].elevationM+=1,p=>p.weather.cellSizeM=3,p=>p.existing[0].rasterSource.x+=1,p=>p.existing[0].rasterSource.row=0,p=>p.existing[0].rasterSource.sha256='wrong',p=>p.existing[0].rasterSource.originalValue=-9999,p=>p.existing[0].rasterSource.verticalUnit='feet',p=>p.existing[0].rasterSource.header.cellSize=0]) {
    const p=structuredClone(original);mutate(p);assert.throws(()=>validateProject(p));
  }
});

test('survey and raster replacements retire each other while solar evidence includes original raster custody', async () => {
  const p=site(), raster=applyTerrainRasterPreview(p,await previewTerrainRaster(source,p,options),'existing');
  const csv='cell,elevation,uncertainty,unit,source\nA1,0,.1,m,Survey\nB1,1,.1,m,Survey\nA2,4,.1,m,Survey\nB2,5,.1,m,Survey';
  const surveyed=applyTerrainPreview(raster,previewTerrainTable(csv,raster,{fileName:'survey.csv',datum:'local',cellSizeM:2}),'existing');
  assert.equal(surveyed.existing[0].rasterSource,undefined);assert.ok(surveyed.existing[0].terrainSource);
  const back=applyTerrainRasterPreview(surveyed,await previewTerrainRaster(source,surveyed,options),'existing');
  assert.equal(back.existing[0].terrainSource,undefined);assert.ok(back.existing[0].rasterSource);
  const changed=structuredClone(back);changed.existing[0].rasterSource.sha256='a'.repeat(64);
  assert.notEqual(solarContext(back),solarContext(changed));
});

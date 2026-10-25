import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??`/tmp/earth-raster-${randomUUID()}`;
const raw='ncols 10\nnrows 8\nxllcorner 100\nyllcorner 200\ncellsize 2\nnodata_value -9999\n'+Array.from({length:8},(_,r)=>Array.from({length:10},(_,c)=>(1000+r*.1+c*.01).toFixed(2)).join(' ')).join('\n')+'\n';
const checks=[];
const result=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async ({send,evaluate,baseUrl,exceptions,sandbox})=>{
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:baseUrl});
  const wait=async(expression,label)=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await delay(75);}throw Error(`Timed out: ${label}`);};
  await wait("document.querySelectorAll('#existing-grid .cell').length===48",'maintained site');
  const getSite=async()=>JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  const original=await getSite();
  await evaluate("document.getElementById('terrain-raster-import').open=true");
  const upload=async(text,name='original.asc')=>{
    await evaluate(`(()=>{const e=document.getElementById('raster-file'),d=new DataTransfer();d.items.add(new File([${JSON.stringify(text)}],${JSON.stringify(name)},{type:'text/plain'}));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait("!document.getElementById('raster-preview-button').disabled || document.getElementById('raster-file-status').textContent.includes('refused')",'file decode');
  };
  const configure=async()=>evaluate("for(const [id,value] of Object.entries({'source':'Authored asymmetric source raster','crs':'Authored metric coordinate reference','horizontal':'m','vertical':'m','row':'2','column':'2','reference':'','target':'both'})){const e=document.getElementById('raster-'+id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}");
  const preview=async()=>{await evaluate("document.getElementById('raster-preview-button').click()");await wait("!document.getElementById('raster-apply').disabled || document.getElementById('raster-status').textContent.includes('refused')",'preview');};
  await upload(raw);await configure();await preview();
  assert.equal(await evaluate("document.querySelectorAll('#raster-preview li').length"),48);
  assert.deepEqual(await getSite(),original);
  assert.match(await evaluate("document.getElementById('raster-status').textContent"),/uncertainty remains unspecified/);
  checks.push('original raster dimensions and selected 48-source-sample preview without mutation');

  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate("document.getElementById('terrain-raster-import').scrollIntoView({block:'start',behavior:'instant'})");
  await delay(100);
  assert.ok(await evaluate("Math.abs(document.getElementById('terrain-raster-import').getBoundingClientRect().top)<30"));
  await writeFile(runDirectory+'/desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("document.getElementById('raster-preview').focus({preventScroll:true});document.getElementById('raster-preview').scrollIntoView({block:'center',behavior:'instant'})");
  assert.equal(await evaluate("document.activeElement.id"),'raster-preview');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'PageDown',code:'PageDown',windowsVirtualKeyCode:34});
  await delay(100);
  const dimensions=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert.ok(dimensions.scroll<=dimensions.width+1);
  assert.ok(await evaluate("document.getElementById('raster-preview').getBoundingClientRect().top>=0 && document.getElementById('raster-preview').getBoundingClientRect().bottom<=innerHeight"));
  await writeFile(runDirectory+'/narrow.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  checks.push('desktop and 390px rendered preview with keyboard focus and no horizontal overflow');

  await evaluate("document.getElementById('raster-apply').click()");
  let received=await getSite();
  assert.equal(received.existing[0].elevationM,0);assert.ok(Math.abs(received.existing[47].elevationM-.57)<1e-10);
  assert.deepEqual(received.existing.map(c=>c.elevationM),received.proposal.map(c=>c.elevationM));
  assert.deepEqual(received.existing.map(c=>c.surface),original.existing.map(c=>c.surface));
  assert.deepEqual(received.proposal.map(c=>c.surface),original.proposal.map(c=>c.surface));
  assert.equal(received.existing[47].rasterSource.row,7);assert.equal(received.existing[47].rasterSource.column,9);
  assert.equal(received.existing[47].rasterSource.x,117);assert.equal(received.existing[47].rasterSource.y,203);
  assert.equal(received.existing[0].terrainSource,undefined);
  await evaluate("document.querySelector('#existing-grid .cell').click()");
  assert.match(await evaluate("document.getElementById('terrain-origin').textContent"),/original row 2, column 2/);
  assert.match(await evaluate("document.getElementById('terrain-origin').textContent"),/uncertainty is not supplied/);
  received=await getSite();
  checks.push('apply both grids, preserve distinct surfaces, inspect source sample and unknown uncertainty');

  const downloads=runDirectory+'/downloads';await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await evaluate("document.getElementById('export').click()");
  let files=[];for(let i=0;i<50;i++){files=(await readdir(downloads)).filter(n=>n.endsWith('.json'));if(files.length)break;await delay(100);}
  assert.equal(files.length,1);const exported=await readFile(downloads+'/'+files[0],'utf8');assert.deepEqual(JSON.parse(exported),received);
  await evaluate("document.getElementById('reset').click()");
  await evaluate(`(()=>{const e=document.getElementById('import'),d=new DataTransfer();d.items.add(new File([${JSON.stringify(exported)}],'saved-raster-site.json',{type:'application/json'}));e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).existing[0].rasterSource!==undefined",'downloaded project reopen');
  assert.deepEqual(await getSite(),received);
  await send('Page.reload',{ignoreCache:true});await wait("document.querySelectorAll('#existing-grid .cell').length===48",'reload');assert.deepEqual(await getSite(),received);
  checks.push('actual exported project download, fresh import and reload retain every original raster sample');

  await upload('\ufeff'+raw,'bom-prefixed.asc');
  assert.match(await evaluate("document.getElementById('raster-file-status').textContent"),/refused.*ASCII/);
  assert.equal(await evaluate("document.getElementById('raster-preview-button').disabled"),true);
  assert.deepEqual(await getSite(),received);
  checks.push('original BOM bytes cannot be silently stripped before source identity is recorded');

  await upload(raw.replace('1000.11 1000.12','-9999 1000.12'));await configure();await preview();
  assert.match(await evaluate("document.getElementById('raster-status').textContent"),/NoData/);assert.deepEqual(await getSite(),received);
  await upload(raw);await configure();await preview();
  await evaluate("document.getElementById('project-title').value='Changed site';document.getElementById('project-title').dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.getElementById('raster-apply').disabled"),true);
  await configure();await preview();await evaluate("document.getElementById('raster-column').value='3';document.getElementById('raster-column').dispatchEvent(new Event('input'))");
  assert.equal(await evaluate("document.getElementById('raster-apply').disabled"),true);
  checks.push('selected missing source refuses and changed site or crop retires prior preview');

  await evaluate("document.querySelector('[data-brush=raise]').click();document.querySelector('#existing-grid .cell').click()");
  received=await getSite();assert.equal(received.existing[0].rasterSource,undefined);assert.equal(received.existing[0].elevationM,.025);
  assert.ok(received.existing[1].rasterSource);assert.ok(received.proposal[0].rasterSource);
  checks.push('ordinary height editing retires only the modified original sample');
  const measured=await readFile(new URL('../examples/usgs-ds684-window/elevation.asc',import.meta.url),'utf8');
  await evaluate("document.getElementById('reset').click()");
  await upload(measured,'usgs-ds684-window.asc');
  await evaluate("for(const [id,value] of Object.entries({'source':'USGS Data Series 684 DEM 1; original window rows 4–9, columns 4800–4807; elevation NAVD88','crs':'NAD83 / UTM zone 10N','horizontal':'m','vertical':'m','row':'1','column':'1','reference':'','target':'both'})){const e=document.getElementById('raster-'+id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}");
  await preview();assert.equal(await evaluate("document.querySelectorAll('#raster-preview li').length"),48);
  await evaluate("document.getElementById('raster-apply').click()");
  const realSite=await getSite();assert.equal(realSite.existing[0].rasterSource.originalValue,106.2994);
  assert.equal(realSite.existing[47].rasterSource.originalValue,98.31876);
  assert.ok(Math.abs(realSite.existing[47].elevationM+7.98064)<1e-10);
  assert.equal(realSite.existing[0].rasterSource.x,546082);assert.equal(realSite.existing[0].rasterSource.y,4154246);
  await writeFile(runDirectory+'/usgs-received-project.json',JSON.stringify(realSite,null,2)+'\n');
  checks.push('public USGS source-derived window through ordinary file import and actual maintained terrain model');
  assert.deepEqual(exceptions,[]);
  const receipt={status:'PASS',checks,dimensions,sandbox};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2)+'\n');return receipt;
});
console.log(JSON.stringify(result,null,2));

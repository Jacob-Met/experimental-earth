import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY || root+'.browser-repreview-'+randomUUID();
await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN || '/usr/bin/chromium'},async({evaluate,exceptions,send})=>{
 const wait=async expression=>{for(let i=0;i<100;i++){
  try {if(await evaluate(expression))return;}catch(error){
   if(!/Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context/i.test(String(error)))throw error;
  }
  await delay(100);
 }throw Error('Timed out: '+expression);};
 if(process.env.EARTH_RECEIVING_URL) {
  const target=new URL(process.env.EARTH_RECEIVING_URL);
  assert.equal(target.protocol,'http:');assert.equal(target.hostname,'127.0.0.1');
  assert.ok(target.port && Number(target.port)>0,'Explicit loopback port required');
  assert.equal(target.username,'');assert.equal(target.password,'');
  assert.equal(target.pathname,'/');assert.equal(target.search,'');assert.equal(target.hash,'');
  const previousTimeOrigin=await evaluate('performance.timeOrigin');
  await send('Page.navigate',{url:target.href});
  await wait(`performance.timeOrigin!==${previousTimeOrigin} && location.href===${JSON.stringify(target.href)} && document.readyState==='complete'`);
 }
 await wait(`!!document.querySelector('#investigation-navigation')`);
 const receivingOrigin=await evaluate('location.origin');
 await evaluate(`window.q=id=>document.getElementById(id);window.stored=()=>localStorage.getItem('experimental-earth-site-v1');window.setMap=value=>{q('observation-station-map').value=value;q('observation-station-map').dispatchEvent(new Event('input',{bubbles:true}));};window.upload=(name,body,defer=false)=>{const file=new File([body],name,{type:'text/csv'});if(defer)file.arrayBuffer=()=>new Promise(resolve=>window.pendingFiles[name]=()=>resolve(new TextEncoder().encode(body).buffer));const transfer=new DataTransfer();transfer.items.add(file);q('observation-table-file').files=transfer.files;q('observation-table-file').dispatchEvent(new Event('change',{bubbles:true}));};window.pendingFiles={};q('reset').click();window.before=stored();`);
 const chooseAll = async () => {
  await wait("q('observation-table-preview').children.length===1");
  assert.equal(await evaluate("document.querySelectorAll('input[data-observation-line]:checked').length"),0);
  assert.equal(await evaluate("q('append-observation-table').disabled"),true);
  await evaluate("q('select-all-observation-rows').click()");
  await wait("!q('append-observation-table').disabled");
 };
 const csv='station,minute,depth,uncertainty,unit,source,scenario,use\neast,15,1,.1,cm,logger,existing,calibration';
 const mapping=JSON.stringify({source:'Independent receiving placement',entries:[{station:'east',cell:'B2'}]});
 await evaluate(`setMap('{');upload('original.csv',${JSON.stringify(csv)});`);
 await wait(`q('observation-table-status').textContent.startsWith('Import refused')`);
 await evaluate(`setMap(${JSON.stringify(mapping)})`);
 const retryPresent=await evaluate(`!!q('preview-observation-table')`);
 if(process.env.BASELINE_EXPECT_MISSING_REPREVIEW==='1'){
  assert.equal(retryPresent,false);assert.equal(await evaluate(`q('append-observation-table').disabled && stored()===before`),true);
  await writeFile(runDirectory+'/repreview.json',JSON.stringify({receivingOrigin,baselineMissingRetry:true,existingNotebookPreserved:true}));return;
 }
 assert.equal(retryPresent,true,'Corrected mapping must offer retry without reselecting CSV');
 await evaluate(`q('preview-observation-table').click()`);
 await chooseAll();
 assert.equal(await evaluate(`stored()===before`),true,'Preview must not mutate notebook');
 assert.match(await evaluate(`q('observation-table-preview').textContent`),/B2.*10 ± 1 mm/);
 for(const width of [1440,390]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:1600,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('[aria-labelledby="observation-import-title"] details').open=true;document.querySelector('[aria-labelledby="observation-import-title"]').scrollIntoView({behavior:'instant',block:'start'});`);
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'No horizontal overflow at '+width);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(runDirectory+'/repreview-'+width+'.png',Buffer.from(screenshot.data,'base64'));
 }
 await send('Emulation.clearDeviceMetricsOverride');
 await evaluate(`setMap(${JSON.stringify(mapping)})`);
 assert.equal(await evaluate(`q('append-observation-table').disabled`),true);
 await evaluate(`q('preview-observation-table').click()`);await chooseAll();
 await evaluate(`q('append-observation-table').click();q('append-observation-table').click()`);
 const observations=await evaluate(`JSON.parse(stored()).observations`);
 assert.equal(observations.length,1);assert.equal(observations[0].tableSource.fileName,'original.csv');assert.equal(observations[0].tableSource.stationValue,'east');assert.equal(observations[0].depthMm,10);
 assert.equal(await evaluate(`q('preview-observation-table').disabled && q('append-observation-table').disabled`),true,'Commit retires actionable source and choices');
 assert.equal(await evaluate(`document.querySelectorAll('input[data-observation-line]:checked').length`),0);
 assert.equal(await evaluate(`!q('download-observation-csv').disabled && !q('save-observation-source').disabled`),true,'Complete original remains available for download');
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:runDirectory});
 await evaluate(`q('export').click()`);
 let portable;
 for(let i=0;i<100;i++){try{portable=await readFile(runDirectory+'/experimental-earth-site.json','utf8');break;}catch(error){if(error.code!=='ENOENT')throw error;await delay(100);}}
 assert.ok(portable,'Actual export download completed');
 await evaluate(`q('reset').click();const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(portable)}],'experimental-earth-site.json',{type:'application/json'}));q('import').files=dt.files;q('import').dispatchEvent(new Event('change',{bubbles:true}));`);
 await wait(`JSON.parse(stored()).observations.length===1`);
 assert.deepEqual(await evaluate(`JSON.parse(stored()).observations`),observations,'Downloaded portable JSON preserves original imported provenance on reopen');
 await evaluate(`upload('broken.csv','bad,header');`);await wait(`q('observation-table-status').textContent.startsWith('Import refused')`);
 await evaluate(`q('preview-observation-table').click()`);await delay(50);
 assert.equal(await evaluate(`q('append-observation-table').disabled && JSON.parse(stored()).observations.length===1`),true,'Invalid replacement must not revive original source');
 const cell='cell,minute,depth,uncertainty,unit,source\nA1,20,2,.1,mm,ordering';
 await evaluate(`setMap('');upload('late-A.csv',${JSON.stringify(cell)},true);upload('latest-B.csv',${JSON.stringify(cell)},true);pendingFiles['latest-B.csv']();`);
 await chooseAll();
 await evaluate(`pendingFiles['late-A.csv']()`);await delay(50);
 assert.equal(await evaluate(`document.querySelectorAll('input[data-observation-line]:checked').length`),1,'Late prior source must not clear newer choice');
 assert.match(await evaluate(`q('observation-table-status').textContent`),/latest-B.csv/);
 await evaluate(`setMap('');q('preview-observation-table').click()`);await chooseAll();
 assert.match(await evaluate(`q('observation-table-status').textContent`),/latest-B.csv/,'Retained retry source is latest intent');
 await evaluate(`q('reset').click()`);
 assert.equal(await evaluate(`q('preview-observation-table').disabled && q('append-observation-table').disabled`),true,'External project refresh forgets source');
 assert.deepEqual(exceptions,[]);
 await writeFile(runDirectory+'/repreview.json',JSON.stringify({receivingOrigin,desktopAnd390ActualScreenshots:true,portableDownloadAndReopen:true,correctedMappingSameFile:true,previewReadOnly:true,appendOnceOriginalProvenance:true,mappingEditInvalidates:true,invalidReplacementPreservesNotebook:true,latestSelectionWins:true,externalRefreshForgetsSource:true,exceptions},null,2));
});

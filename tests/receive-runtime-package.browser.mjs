// Node 22+, Linux; uses unchanged maintained session/sandbox adapters.
// Args: PACKAGE_URL SUPPORT_DIRECTORY NEW_RUN_DIRECTORY
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readdir, readFile, rm} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const [urlArg, supportArg, runArg] = process.argv.slice(2);
assert(urlArg && supportArg && runArg, 'PACKAGE_URL SUPPORT_DIRECTORY NEW_RUN_DIRECTORY required');
const product = new URL(urlArg);
assert.equal(product.protocol, 'http:');
assert.equal(product.hostname, '127.0.0.1');
assert.equal(product.pathname, '/');
const runDirectory = resolve(runArg);
const {withBrowserSession} = await import(pathToFileURL(resolve(supportArg, 'browser-session.mjs')));
const bootstrap = await mkdtemp(join(tmpdir(), 'earth-browser-bootstrap-'));
await writeFile(join(bootstrap, 'index.html'), '<!doctype html><title>Receiving bootstrap</title>');
const checks = [];
try {
  const result = await withBrowserSession({root:bootstrap,
    chromeBin:process.env.CHROME_BIN ?? '/opt/google/chrome/chrome', runDirectory}, async session => {
    const {send,evaluate,exceptions} = session;
    await send('Runtime.enable'); await send('Page.enable');
    async function wait(expression) {
      const deadline=Date.now()+20000;
      while(Date.now()<deadline) {
        session.signal.throwIfAborted();
        try { if(await evaluate(expression))return; }
        catch(e) {if(!/Execution context was destroyed|Cannot find context|Cannot find default execution context/.test(String(e)))throw e;}
        await delay(100);
      }
      throw Error('Readiness timed out: '+expression);
    }
    async function location(path='/') {
      assert.equal(await evaluate('location.href'), new URL(path,product).href);
    }
    async function navigate(path='/', app=false) {
      const expected=new URL(path,product).href;
      const previous=await evaluate('performance.timeOrigin');
      await send('Page.navigate',{url:expected});
      await wait(`performance.timeOrigin!==${previous} && location.href===${JSON.stringify(expected)} && document.readyState==='complete'`);
      if(app)await wait(`!!document.querySelector('#investigation-navigation') && document.querySelectorAll('#existing-grid .cell').length===48`);
      await location(path);
    }
    async function shot(name) {
      await location();
      const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      await writeFile(join(runDirectory,name),Buffer.from(image.data,'base64'));
    }
    await navigate('/',true);
    assert.equal(await evaluate(`document.querySelectorAll('#proposal-grid .cell').length`),48);
    assert.equal(await evaluate(`document.querySelectorAll('.metric').length`),6);
    assert.equal(await evaluate(`document.querySelectorAll('#chart path').length`),2);
    checks.push('Actual package origin: mounted 96 cells, six metrics, two chart curves');
    const originalMetrics=await evaluate(`[...document.querySelectorAll('.metric')].map(e=>e.textContent)`);
    await evaluate(`document.querySelector('[data-brush="garden"]').click();document.querySelector('#proposal-grid .cell').click();document.querySelector('#rain').value='47';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))`);
    assert.equal(await evaluate(`document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')`),true);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('experimental-earth-site-v1')).weather.rainMmHr`),47);
    assert.match(await evaluate(`document.querySelector('#balance').textContent`),/Mass balance/);
    await wait(`JSON.stringify([...document.querySelectorAll('.metric')].map(e=>e.textContent))!==${JSON.stringify(JSON.stringify(originalMetrics))}`);
    const editedMetrics=await evaluate(`[...document.querySelectorAll('.metric')].map(e=>e.textContent)`);
    checks.push('Garden proposal and rain edit recomputed with visible mass balance');
    const downloads=join(runDirectory,'downloads');await mkdir(downloads);
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    // Exact current index.html/app.js action, labelled "Export project ↗".
    assert.equal(await evaluate(`document.querySelectorAll('#export').length`),1);
    await evaluate(`document.querySelector('#export').click()`);
    let files=[];
    for(let n=0;n<100;n++){files=(await readdir(downloads)).filter(f=>!f.endsWith('.crdownload'));if(files.length===1)break;await delay(100);}
    assert.equal(files.length,1,'real browser download must complete');
    const downloaded=join(downloads,files[0]);
    const raw=await readFile(downloaded,'utf8');
    const project=JSON.parse(raw);
    assert.equal(project.proposal[0].surface,'garden');
    assert.equal(project.weather.rainMmHr,47);
    await location();
    // This profile is exclusively owned by this receiving run. Clear only the
    // exact package origin and reload before importing the actual saved file.
    // This qualifies a fresh workspace in the same profile, not a new profile.
    await evaluate('localStorage.clear()');
    await navigate('/',true);
    assert.equal(await evaluate(`document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Turf')`),true);
    assert.notEqual(await evaluate(`Number(document.querySelector('#rain').value)`),47);
    const document=await send('DOM.getDocument');
    const input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#import'});
    assert(input.nodeId);
    await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[downloaded]});
    await wait(`document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')`);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('experimental-earth-site-v1')).weather.rainMmHr`),47);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.metric')].map(e=>e.textContent)`),editedMetrics,
      'Fresh workspace import recomputes the exported comparison');
    checks.push('Real Export JSON download reopened through native file input after clearing package-origin storage and loading a fresh workspace in the same owned profile');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await shot('package-desktop.png');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await delay(200);
    const dimensions=await evaluate(`({inner:innerWidth,scroll:document.documentElement.scrollWidth})`);
    assert(dimensions.scroll<=dimensions.inner+1,JSON.stringify(dimensions));
    await shot('package-narrow.png');
    checks.push('Desktop and 390px screenshots; narrow viewport no horizontal overflow');
    const nested=['vendor/chronos/exact-halfplanes.mjs','vendor/suncalc/index.js','research/usda-er2-rate-comparison.json','examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt','docs/SOIL_BAND_FEASIBILITY.md','docs/SOIL_PARAMETER_REFINEMENT.md'];
    for(const path of nested){const response=await evaluate(`fetch(${JSON.stringify(new URL(path,product).href)}).then(async r=>({status:r.status,bytes:(await r.arrayBuffer()).byteLength}))`);assert.equal(response.status,200,path);assert(response.bytes>0,path);}
    checks.push('Six nested browser resources fetched from actual package server');
    for(const path of ['noaa-hourly.html','ponded-uptake.html','rate-events.html']) {
      await navigate(path);
      assert((await evaluate('document.body.innerText')).trim().length>30,path);
    }
    checks.push('Four maintained HTML entries loaded; secondary interactions not qualified');
    await navigate('/',true);
    assert.equal(await evaluate(`document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')`),true);
    assert.deepEqual(exceptions,[]);
    return {checks,productUrl:product.href,bootstrapUrl:session.baseUrl,dimensions,
      downloadedFile:downloaded,exceptions,sandbox:session.sandbox,sandboxPath:session.sandboxPath,
      limits:['No physical validation','Secondary examples load/resources only','No exhaustive CDP network event capture','Import recovery uses fresh workspace in same owned browser profile, not a second profile']};
  });
  const receipt={status:'PASS',...result.value,session:result.receipt};
  await writeFile(join(runDirectory,'package-receiving.json'),JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt,null,2));
} catch(error) {
  console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null},null,2));
  process.exitCode=1;
} finally {await rm(bootstrap,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';

// Place in tests/ of the exact maintained checkout. Baseline and candidate use
// identical admission, native HTTP entrypoint, input controls and assertions.
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??resolve(root,'.browser-run-first-use-'+randomUUID());
const checks=[];
function externalEntrypoint(value){
  if(!value)return null;
  const url=new URL(value);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('BROWSER_ENTRY_URL must be a credential-free loopback HTTP root URL');
  return url.href;
}
function causes(error){
  const result=[],seen=new Set();
  for(let current=error;current&&result.length<6&&!seen.has(current);current=current.cause){
    seen.add(current);result.push({name:String(current.name??'Error').slice(0,100),message:String(current.message??current).slice(0,2000)});
  }
  return result;
}
try {
  const requestedEntry=externalEntrypoint(process.env.BROWSER_ENTRY_URL);
  await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome'},async session=>{
    const {send,evaluate,baseUrl,exceptions}=session;
    await send('Page.enable');await send('Runtime.enable');await send('DOM.enable');
    const entryUrl=requestedEntry??baseUrl;
    if(requestedEntry)await send('Page.navigate',{url:entryUrl});
    async function until(expression,label){for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+label);}
    async function click(selector){
      const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing/disabled click target');e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden click target');return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
    }
    async function shot(name){await delay(100);const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(runDirectory,name),Buffer.from(data,'base64'));}
    async function field(id,value){await evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);}
    const saved=()=>evaluate("localStorage.getItem('experimental-earth-site-v1')");
    const temps=()=>evaluate("({existing:Number(document.getElementById('shade-inspect').dataset.existingLower),proposal:Number(document.getElementById('shade-inspect').dataset.proposalUpper)})");
    await until("document.querySelectorAll('#existing-grid .cell').length===48 && !!document.getElementById('shade-example') && !!document.getElementById('investigation-search')",'assembled application');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('scrollTo(0,0)');await shot('first-visit-desktop.png');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate('scrollTo(0,0)');await shot('first-visit-390.png');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'entrypoint has no horizontal page overflow');
    if(process.env.FIRST_USE_GUIDE==='required'){
      const target=await evaluate("(()=>{const e=document.getElementById('first-investigation-open');if(!e)return null;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,hit:hit===e||e.contains(hit)}})()");
      assert.ok(target&&target.left>=0&&target.right<=target.width&&target.top>=0&&target.bottom<=target.height,'initial 390px guide CTA fully in viewport');
      assert.equal(target.hit,true,'initial guide CTA centre cannot be intercepted by fixed navigation');
      checks.push('Initial 390px guide action is fully visible and receives pointer hit without fixed overlay interception');
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const original=await saved();assert.ok(original,'fresh example retained');
    assert.match(await evaluate("document.querySelector('[aria-label=\"Model status\"]').textContent"),/Conceptual model.*not a real-site forecast/s);
    // Candidate-only contract; require it explicitly so missing delivery fails.
    if(process.env.FIRST_USE_GUIDE==='required'){
      assert.ok(await evaluate("!!document.getElementById('first-investigation-open')"),'guide delivered');
      assert.equal(await evaluate("document.getElementById('first-investigation-steps').open"),false);
      assert.equal(await evaluate("getComputedStyle(document.getElementById('first-investigation')).backgroundColor"),'rgb(237, 245, 239)','dedicated stylesheet delivered and applied');
      await click('#first-investigation-steps > summary');
      assert.equal(await saved(),original,'expanding instructions preserves source');
      await evaluate("document.getElementById('first-investigation').scrollIntoView({block:'start',behavior:'instant'})");await shot('guide-expanded-desktop.png');
      await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
      await evaluate("document.getElementById('first-investigation').scrollIntoView({block:'start',behavior:'instant'})");await shot('guide-expanded-390.png');
      assert.ok(await evaluate("(()=>{const e=document.getElementById('first-investigation');return e.scrollWidth<=e.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1})()"));
      await click('#first-investigation-open');
      await until("location.hash==='#shade-heat' && document.activeElement.closest('section.panel')?.id==='shade-heat'",'guide native link and focus');
      await shot('guide-destination-390.png');
      assert.equal(await saved(),original);
      assert.equal(await evaluate("document.getElementById('shade-results').children.length"),0,'navigation cannot silently run/replace an investigation');
      checks.push('Delivered guide and stylesheet, expandable instructions, native destination/focus, exact source preservation without auto-running');
      await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    }
    // Discover a mounted real workbench through the existing native-link path.
    await field('investigation-search','shade change');
    await click('#investigation-results a[href="#shade-heat"]');
    await until("location.hash==='#shade-heat' && document.activeElement.closest('section.panel')?.id==='shade-heat'",'native navigation and keyboard focus');
    await shot('investigation-destination-desktop.png');
    await click('#shade-example');
    await until("document.getElementById('shade-status').dataset.state==='compared'",'authored example');
    assert.equal(await saved(),original,'isolated example must not replace active site');
    assert.match(await evaluate("document.getElementById('shade-basis').textContent"),/Isolated authored example/);
    const baseline=await temps();assert.ok(Number.isFinite(baseline.existing)&&Number.isFinite(baseline.proposal));assert.ok(baseline.proposal<baseline.existing-10);
    checks.push('Actual root entrypoint, native investigation link, authored comparison and exact active-site preservation');
    await evaluate("document.getElementById('shade-results').scrollIntoView({block:'start',behavior:'instant'})");await shot('authored-result-desktop.png');
    await click('#shade-sources > summary');
    assert.equal(await evaluate("document.getElementById('shade-sources').open"),true);
    const sources=await evaluate("document.getElementById('shade-sources').innerText");
    assert.match(sources,/Invented flat courtyard.*no site measurement/);
    assert.match(sources,/Authored constant direct-normal.*not acquired weather/);
    assert.match(sources,/Authored uniform surface properties, equal in both scenarios/);
    assert.match(sources,/Authored insulated lower heat store; capacity is not a measured depth/);
    await evaluate("document.getElementById('shade-sources').scrollIntoView({block:'start',behavior:'instant'})");await shot('authored-sources-desktop.png');
    assert.equal(await saved(),original);
    checks.push('Promised source panel opens via pointer and visibly retains authored geometry, weather, equal materials and lower-store limitations');
    await click('#shade-settings > summary');
    await field('shade-directNormalWm2',0);
    assert.equal(await evaluate("document.getElementById('shade-results').children.length"),0,'changed assumptions retire result');
    assert.equal(await evaluate("document.getElementById('shade-export').disabled"),true,'stale result cannot be exported');
    await click('#shade-run');await until("document.getElementById('shade-status').dataset.state==='compared'",'zero direct-beam control');
    const zero=await temps();assert.ok(Math.abs(zero.existing-zero.proposal)<1e-8,'same material without direct beam removes shade effect');
    const zeroCourse=await evaluate(`(()=>{const rows=[];for(const store of ['surfaceC','subsurfaceC']){const select=document.getElementById('shade-store');select.value=store;select.dispatchEvent(new Event('change'));const slider=document.getElementById('shade-time');for(let i=0;i<=Number(slider.max);i++){slider.value=i;slider.dispatchEvent(new Event('input'));const p=document.getElementById('shade-inspect');rows.push({store,index:i,existing:Number(p.dataset.existingLower),proposal:Number(p.dataset.proposalUpper)});}}return rows;})()`);
    assert.ok(zeroCourse.length>2);
    for(const row of zeroCourse)assert.ok(Number.isFinite(row.existing)&&Number.isFinite(row.proposal)&&Math.abs(row.existing-row.proposal)<1e-8,'zero beam same courses at '+row.store+'/'+row.index);
    await evaluate("(()=>{const e=document.getElementById('shade-store');e.value='surfaceC';e.dispatchEvent(new Event('change'))})()");
    assert.equal(await saved(),original);
    checks.push('Independent zero-beam negative control removes shade contrast, input change retires stale result');
    await click('#shade-example');await until("document.getElementById('shade-status').dataset.state==='compared'",'restored authored example');
    const expectedSummary=await evaluate("document.getElementById('shade-summary').textContent");
    const downloads=resolve(runDirectory,'downloads');await mkdir(downloads);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    await click('#shade-export');let filename;
    for(let i=0;i<100;i++){filename=(await readdir(downloads)).find(n=>n.endsWith('.json'));if(filename)break;await delay(100);}
    assert.ok(filename,'actual browser download completed');const file=resolve(downloads,filename);const envelope=JSON.parse(await readFile(file,'utf8'));
    assert.equal(Object.hasOwn(envelope,'report'),false);assert.ok(envelope.project,'separate investigation contains source project');
    // Keep a distinct user workspace through reload and independent reopen.
    await field('project-title','Retained user workspace — independent receiving');
    await evaluate("document.getElementById('project-title').dispatchEvent(new Event('change',{bubbles:true}))");
    const retained=await saved();assert.notEqual(retained,original);
    await send('Page.navigate',{url:entryUrl});await until("!!document.getElementById('shade-import') && document.querySelectorAll('#existing-grid .cell').length===48",'returning workspace');
    assert.equal(await saved(),retained);await evaluate('scrollTo(0,0)');await shot('returning-workspace-desktop.png');
    async function importFile(path){const {root:dom}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:dom.nodeId,selector:'#shade-import'});await send('DOM.setFileInputFiles',{nodeId,files:[path]});}
    await importFile(file);await until("document.getElementById('shade-status').dataset.state==='compared'",'downloaded investigation recomputed');
    assert.equal(await saved(),retained,'reopen cannot overwrite distinct active workspace');
    assert.equal(await evaluate("document.getElementById('shade-summary').textContent"),expectedSummary);
    const bad=resolve(runDirectory,'forged-verdict.json');await writeFile(bad,JSON.stringify({...envelope,report:{maximumC:-999}}));
    await importFile(bad);await until("document.getElementById('shade-status').dataset.state==='file-refused'",'forged verdict refused');
    assert.equal(await evaluate("document.getElementById('shade-summary').textContent"),expectedSummary);assert.equal(await saved(),retained);
    checks.push('Downloaded raw investigation independently reopens after reload, preserves distinct working site, refuses forged verdict transactionally');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate("document.getElementById('shade-results').scrollIntoView({block:'start',behavior:'instant'})");await shot('reopened-result-390.png');
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    assert.deepEqual(exceptions,[]);
    await writeFile(resolve(runDirectory,'first-use-receipt.json'),JSON.stringify({status:'passed',checks,entryUrl,sandbox:session.sandbox,visualReview:'pending independent image inspection'},null,2));
  });
  console.log(JSON.stringify({status:'passed',checks,runDirectory}));
}catch(error){console.error(JSON.stringify({status:'failed',causes:causes(error),checks,runDirectory}));process.exitCode=1;}

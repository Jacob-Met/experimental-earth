import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
const root = new URL('../', import.meta.url).pathname;
const chromeBin = process.env.CHROME_BIN ?? (
  process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/chromium');
const port = 18765;
const debugPort = 18766;
const baseUrl = `http://127.0.0.1:${port}/`;
const profile = root + '.chrome-receiving-profile';
mkdirSync(profile,{recursive:true});
const server = spawn(process.env.PYTHON_BIN ?? 'python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const chrome = spawn(chromeBin,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-gpu',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,baseUrl],{stdio:'ignore'});
let ws;
const pending = new Map();
let serial = 0;
const exceptions = [];
const report = [];
try {
  let endpoint;
  for (let n=0;n<50;n++) {
    await delay(200);
    try {
      const response=await fetch(`http://127.0.0.1:${debugPort}/json`);
      const tabs=await response.json();
      const tab=tabs.find(t=>t.type==='page' && t.url.startsWith(baseUrl));
      if(tab){endpoint=tab.webSocketDebuggerUrl;break;}
    } catch {}
  }
  assert.ok(endpoint,'Chrome CDP page did not start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=ev=>{
    const msg=JSON.parse(ev.data);
    if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.text);
    if(msg.id && pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
  };
  function send(method,params={}){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
  async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;}
  await send('Runtime.enable'); await send('Page.enable');
  for(let n=0;n<30;n++){if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===48)break;await delay(120);}
  assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"),48);
  assert.equal(await evaluate("document.querySelectorAll('#proposal-grid .cell').length"),48);
  assert.equal(await evaluate("document.querySelectorAll('.metric').length"),6);
  assert.equal(await evaluate("document.querySelectorAll('#chart path').length"),2);
  const infiltration=await evaluate("Array.from(document.querySelectorAll('.metric')).find(e=>e.textContent.includes('Water infiltrated')).textContent");
  assert.ok(infiltration.includes('more'),'infiltration gain must be labeled more, not less');
  report.push('initial 96 cells, six metrics and two live chart curves');
  await evaluate("document.querySelector('[data-brush=\"garden\"]').click();document.querySelector('#proposal-grid .cell').click()");
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"),true);
  await evaluate("document.querySelector('[data-brush=\"inspect\"]').click();document.querySelector('#obs-minute').value='60';document.querySelector('#obs-depth').value='14';document.querySelector('#obs-uncertainty').value='3';document.querySelector('#obs-source').value='fictional ruler check';document.querySelector('#observe-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelectorAll('.observation').length"),1);
  const saved=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  assert.ok(saved.includes('fictional ruler check'));
  const parsed=JSON.parse(saved);
  assert.equal(parsed.proposal[0].surface,'garden');
  assert.equal(parsed.observations.length,1);
  report.push('brush edit, sourced field observation, local-save');
  await send('Page.reload',{ignoreCache:true});
  await delay(500);
  assert.equal(await evaluate("document.querySelectorAll('.observation').length"),1);
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"),true);
  await evaluate("document.querySelector('#copy-existing').click()");
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Turf')"),true);
  await evaluate(`(async()=>{const original=${JSON.stringify(saved)};const input=document.querySelector('#import');const file=new File([original],'site.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,200));})()`);
  assert.equal(await evaluate("document.querySelector('#proposal-grid .cell').getAttribute('aria-label').includes('Rain garden')"),true);
  report.push('reload durability, scenario reset, portable JSON import');
  await evaluate("document.querySelector('#suggest').click()");
  assert.equal(await evaluate("document.querySelector('[data-brush=\"inspect\"]').getAttribute('aria-pressed')"),'true');
  await evaluate("document.querySelector('#rain').value='47';document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))");
  const last=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  assert.equal(last.weather.rainMmHr,47);
  const residual=await evaluate("document.querySelector('#balance').textContent");
  assert.ok(residual.includes('Mass balance'));
  report.push('sensitivity suggestion and parameter-change recomputation');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await delay(250);
  const dims=await evaluate("({inner:innerWidth,scroll:document.documentElement.scrollWidth,grids:document.querySelectorAll('.cell').length})");
  assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));
  assert.equal(dims.grids,96);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  writeFileSync(root + 'browser-mobile-390.png',Buffer.from(shot.data,'base64'));
  report.push('390px mobile layout no horizontal overflow');
  assert.deepEqual(exceptions,[]);
  console.log(JSON.stringify({status:'PASS',browser:chromeBin,checks:report,exceptions,dimensions:dims},null,2));
} catch(e) {
  console.error(JSON.stringify({status:'FAIL',error:String(e),checks:report,exceptions},null,2));
  process.exitCode=1;
} finally {
  if(ws)ws.close();
  chrome.kill('SIGTERM');
  server.kill('SIGTERM');
}

import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY || root+'.row-custody-'+randomUUID();
const chromeBin=process.env.CHROME_BIN || '/opt/google/chrome/chrome';
const js=JSON.stringify, fileName='custody-original.csv';
const original='\uFEFF'+[
 'station,minute,depth,uncertainty,unit,source,scenario,use',
 ' east ,15,1,.1,cm,"custody',
 'multiline",existing,calibration',
 ' east ,45,2,.1,cm,unselected-original-row,existing,calibration',
 ' east ,60,3,.1,cm,another-original-row,existing,calibration',
].join('\r\n')+'\r\n';
const mapText='\n  {\n    "source": "Independent custody placement",\n    "entries": [{"station":"east","cell":"B2"}]\n  }\n\n';
const originalBytes=Buffer.from(original,'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const reports=[];
let savedProject, sourceText;
async function controls(session,directory) {
 const {evaluate,send}=session;
 async function wait(expression) {
  for(let i=0;i<100;i++) {
   try {if(await evaluate(expression))return;}catch(error) {
    if(!/Execution context was destroyed|Cannot find context with specified id|Cannot find default execution context/i.test(String(error)))throw error;
   }
   await delay(100);
  }
  throw Error('Timed out: '+expression);
 }
 async function install() {
  await wait("document.readyState==='complete' && !!document.getElementById('observation-source-file')");
  await evaluate("window.q=id=>document.getElementById(id);window.stored=()=>localStorage.getItem('experimental-earth-site-v1');");
 }
 await install();
 if(process.env.EARTH_RECEIVING_URL) {
  const target=new URL(process.env.EARTH_RECEIVING_URL);
  assert.equal(target.protocol,'http:');assert.equal(target.hostname,'127.0.0.1');
  assert.ok(target.port && Number(target.port)>0);assert.equal(target.username,'');assert.equal(target.password,'');
  assert.equal(target.pathname,'/');assert.equal(target.search,'');assert.equal(target.hash,'');
  const prior=await evaluate('performance.timeOrigin');await send('Page.navigate',{url:target.href});
  await wait(`performance.timeOrigin!==${prior} && document.readyState==='complete'`);await install();
 }
 const click=id=>evaluate(`q(${js(id)}).click()`);
 const stored=()=>evaluate('stored()');
 const project=async()=>JSON.parse(await stored());
 const choices=()=>evaluate("Array.from(document.querySelectorAll('input[data-observation-line]:checked'),e=>Number(e.dataset.observationLine))");
 const lines=()=>evaluate("Array.from(document.querySelectorAll('input[data-observation-line]'),e=>Number(e.dataset.observationLine))");
 const setMap=text=>evaluate(`q('observation-station-map').value=${js(text)};q('observation-station-map').dispatchEvent(new Event('input',{bubbles:true}));`);
 async function upload(id,text,name,type) {
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${js(text)}],${js(name)},{type:${js(type)}}));q(${js(id)}).files=dt.files;q(${js(id)}).dispatchEvent(new Event('change',{bubbles:true}));})()`);
 }
 async function importProject(p) {
  await upload('import',JSON.stringify(p),'custody-project.json','application/json');
  await wait(`JSON.stringify(JSON.parse(stored()).observations)===${js(JSON.stringify(p.observations))}`);
  assert.deepEqual((await project()).observations,p.observations);
 }
 async function source(text) {
  await upload('observation-source-file',text,'custody-saved-source.json','application/json');
  await wait("q('observation-table-status').textContent.startsWith('Original table and supplied map restored')");
  assert.equal(await evaluate("q('observation-station-map').value"),mapText);
  assert.deepEqual(await lines(),[]);assert.deepEqual(await choices(),[]);
  assert.equal(await evaluate("q('append-observation-table').disabled"),true);
 }
 async function preview() {
  await click('preview-observation-table');
  await wait("JSON.stringify(Array.from(document.querySelectorAll('input[data-observation-line]'),e=>Number(e.dataset.observationLine)))==='[2,4,5]'");
  assert.deepEqual(await choices(),[]);
 }
 async function choose(line) {await evaluate(`document.querySelector('input[data-observation-line="${line}"]').click()`);}
 async function append(count) {
  await click('append-observation-table');await wait(`JSON.parse(stored()).observations.length===${count}`);
 }
 async function download(button,name,slot) {
  const directoryForDownload=join(directory,slot);await mkdir(directoryForDownload);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directoryForDownload});await click(button);
  for(let i=0;i<100;i++) {
   try {return await readFile(join(directoryForDownload,name));}catch(error){if(error.code!=='ENOENT')throw error;}
   await delay(100);
  }
  throw Error('Actual download missing: '+name);
 }
 return {wait,install,click,stored,project,choices,lines,setMap,upload,importProject,source,preview,choose,append,download};
}
await withBrowserSession({root,runDirectory,chromeBin},async session=>{
 const c=await controls(session,runDirectory), {evaluate,send,exceptions,sandbox}=session;
 await c.click('reset');const p=await c.project();p.observations=[];await c.importProject(p);
 await c.setMap(mapText);await c.upload('observation-table-file',original,fileName,'text/csv');
 await c.wait("JSON.stringify(Array.from(document.querySelectorAll('input[data-observation-line]'),e=>Number(e.dataset.observationLine)))==='[2,4,5]'");
 assert.deepEqual(await c.choices(),[]);await c.choose(2);await c.append(1);savedProject=await c.project();
 const first=savedProject.observations[0];
 assert.equal(first.tableSource.line,2);assert.equal(first.tableSource.fileName,fileName);
 assert.equal(first.tableSource.stationValue,' east ');assert.equal(first.tableSource.depthValue,'1');
 assert.equal(first.tableSource.stationMapping.cell,'B2');assert.deepEqual(await c.choices(),[]);
 assert.equal(await evaluate("q('append-observation-table').disabled && q('preview-observation-table').disabled"),true);
 assert.equal(await evaluate("!q('download-observation-csv').disabled && !q('save-observation-source').disabled"),true);
 await c.setMap(' \n{"source":"later editor edit","entries":[]}\n ');
 const raw=await c.download('download-observation-csv',fileName,'raw-after-subset');assert.deepEqual(raw,originalBytes);
 const packet=await c.download('save-observation-source','experimental-earth-observation-source.json','source-after-subset');
 sourceText=packet.toString('utf8');const saved=JSON.parse(sourceText);
 assert.equal(saved.format,'experimental-earth-observation-source/1');
 assert.equal(saved.table.fileName,fileName);assert.equal(saved.table.byteLength,originalBytes.length);
 assert.equal(saved.table.sha256,sha(originalBytes));assert.equal(saved.stationMapText,mapText);
 assert.deepEqual(Buffer.from(saved.table.base64,'base64'),originalBytes);
 reports.push('Subset line2 commit retains every BOM/CRLF/multiline original byte and exact untrimmed used map despite a later editor edit.');
 const before=await c.stored(), prior=await evaluate('performance.timeOrigin');
 await send('Page.reload',{ignoreCache:true});await c.wait(`performance.timeOrigin!==${prior} && document.readyState==='complete'`);await c.install();
 assert.equal(await c.stored(),before);assert.deepEqual(await c.choices(),[]);
 await c.source(sourceText);assert.equal(await c.stored(),before);
 await c.preview();await c.choose(4);await c.append(2);
 assert.deepEqual((await c.project()).observations.map(o=>o.tableSource.line),[2,4]);
 assert.deepEqual((await c.project()).observations.map(o=>o.tableSource.fileName),[fileName,fileName]);
 reports.push('Reload and source restoration add no readings or choices; explicit line4 append succeeds beside the retained line2 duplicate.');
 assert.deepEqual(exceptions,[]);
 await writeFile(join(runDirectory,'custody.json'),JSON.stringify({checks:reports,sandbox,exceptions,originalBytes:originalBytes.length,originalSha256:sha(originalBytes)},null,2));
});
const freshDirectory=runDirectory+'-fresh';
await withBrowserSession({root,runDirectory:freshDirectory,chromeBin},async session=>{
 const c=await controls(session,freshDirectory), {evaluate,exceptions,sandbox}=session;
 assert.deepEqual(await c.choices(),[]);await c.importProject(savedProject);
 const before=await c.stored();await c.source(sourceText);assert.equal(await c.stored(),before);
 await c.preview();await c.choose(4);await c.append(2);
 const rows=(await c.project()).observations;
 assert.deepEqual(rows.map(o=>o.tableSource.line),[2,4]);
 assert.deepEqual(rows.map(o=>o.tableSource.fileName),[fileName,fileName]);
 assert.equal(rows[1].tableSource.depthValue,'2');assert.equal(rows[1].tableSource.stationValue,' east ');
 reports.push('A genuinely fresh browser receives the separate project and source bundle, requires explicit choices, and adds only previously unselected line4.');
 await c.source(sourceText);await c.preview();await c.choose(5);
 const preserved=await c.stored();
 await c.upload('observation-table-file','x'.repeat(128001),'oversized-replacement.csv','text/csv');
 await c.wait("q('observation-table-status').textContent.startsWith('Import refused')");
 assert.equal(await c.stored(),preserved);assert.deepEqual(await c.choices(),[]);assert.deepEqual(await c.lines(),[]);
 assert.equal(await evaluate("q('preview-observation-table').disabled && q('append-observation-table').disabled"),true);
 await c.setMap('{"source":"later invalid map"}');await c.click('preview-observation-table');await c.click('append-observation-table');
 assert.equal(await c.stored(),preserved);
 assert.deepEqual(await c.download('download-observation-csv',fileName,'failed-replacement-original'),originalBytes);
 reports.push('Oversized replacement retires an actual prior line5 choice and leaves complete prior source download-only; later map edits cannot revive it.');
 assert.deepEqual(exceptions,[]);
 await writeFile(join(freshDirectory,'custody.json'),JSON.stringify({checks:reports,sandbox,exceptions,originalSha256:sha(originalBytes)},null,2));
});
console.log(JSON.stringify({checks:reports,runDirectory,freshDirectory}));

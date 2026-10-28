// Run through the estate owner; no product or packaging implementation changes.
// Args: PACKAGE_URL EXPORTED_PROJECT NEW_RUN_DIRECTORY SUPPORT_DIRECTORY OLD_SESSION_JSON
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const [urlArg,exportArg,runArg,supportArg,oldSessionArg]=process.argv.slice(2);
assert(urlArg&&exportArg&&runArg&&supportArg&&oldSessionArg,'PACKAGE_URL EXPORTED_PROJECT NEW_RUN_DIRECTORY SUPPORT_DIRECTORY OLD_SESSION_JSON required');
const product=new URL(urlArg);
assert.equal(product.protocol,'http:');assert.equal(product.hostname,'127.0.0.1');assert.equal(product.pathname,'/');assert.equal(product.search,'');assert.equal(product.hash,'');
assert.equal(product.username,'');assert.equal(product.password,'');assert(Number.isInteger(Number(product.port))&&Number(product.port)>0,'Explicit positive package port required');
const exportedPath=resolve(exportArg),runDirectory=resolve(runArg);
const bytes=await readFile(exportedPath),expected=JSON.parse(bytes.toString('utf8'));
assert(Array.isArray(expected.observations)&&expected.observations.length>0,'Use the actual exported observation-bearing project');
const old=JSON.parse(await readFile(resolve(oldSessionArg),'utf8'));
assert.equal(old.status,'course-completed');assert.equal(old.cleanup?.directChildExited,true);
assert(old.profileDirectory);assert.notEqual(resolve(old.profileDirectory),join(runDirectory,'profile'));
const {withBrowserSession}=await import(pathToFileURL(resolve(supportArg,'browser-session.mjs')));
const bootstrap=await mkdtemp(join(tmpdir(),'earth-fresh-profile-bootstrap-'));
await writeFile(join(bootstrap,'index.html'),'<!doctype html><title>Fresh receiving bootstrap</title>');
try{
 const result=await withBrowserSession({root:bootstrap,runDirectory,chromeBin:process.env.CHROME_BIN||'/opt/google/chrome/chrome'},async session=>{
  const {send,evaluate,exceptions}=session;
  assert(session.profileDirectory,'Session owner must expose the actual profile directory');
  assert.notEqual(resolve(session.profileDirectory),resolve(old.profileDirectory),'New session must use a different profile');
  await send('Runtime.enable');await send('Page.enable');
  // Capture storage before app.js can initialize/persist its default project.
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin===${JSON.stringify(product.origin)})window.__earthInitialStorage=localStorage.getItem('experimental-earth-site-v1');`});
  const wait=async expression=>{for(let i=0;i<200;i++){session.signal.throwIfAborted();try{if(await evaluate(expression))return;}catch(e){if(!/Execution context was destroyed|Cannot find context|Cannot find default execution context/.test(String(e)))throw e;}await delay(100);}throw Error('Timed out: '+expression);};
  const navigate=async()=>{const prior=await evaluate('performance.timeOrigin');await send('Page.navigate',{url:product.href});await wait(`performance.timeOrigin!==${prior} && location.href===${JSON.stringify(product.href)} && document.readyState==='complete' && !!document.querySelector('#investigation-navigation')`);};
  await navigate();
  assert.equal(await evaluate('window.__earthInitialStorage'),null,'Brand-new profile must have no stored project before app initialization');
  assert.equal(await evaluate(`document.querySelector('#preview-observation-table').disabled && document.querySelector('#append-observation-table').disabled && document.querySelector('#observation-table-selected').hidden && document.querySelector('#observation-table-preview').children.length===0`),true,'Fresh profile must have no transient CSV selection before import');
  const document=await send('DOM.getDocument');
  const input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#import'});assert(input.nodeId);
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[exportedPath]});
  await wait(`JSON.stringify(JSON.parse(localStorage.getItem('experimental-earth-site-v1')).observations)===${JSON.stringify(JSON.stringify(expected.observations))}`);
  async function inspect(){
   assert.equal(await evaluate('location.href'),product.href);
   const actual=await evaluate(`JSON.parse(localStorage.getItem('experimental-earth-site-v1'))`);
   assert.deepEqual(actual,expected,'Entire authored project and evidence must survive native file import');
   assert.equal(await evaluate(`document.querySelectorAll('#observation-list .observation').length`),expected.observations.length);
   const notebook=await evaluate(`document.querySelector('#observation-list').textContent`);
   for(const observation of expected.observations)assert(notebook.includes(observation.source),'Rendered notebook retains supplied source');
   assert.equal(await evaluate(`document.querySelector('#preview-observation-table').disabled && document.querySelector('#append-observation-table').disabled && document.querySelector('#observation-table-selected').hidden && document.querySelector('#observation-table-preview').children.length===0`),true,'Saved observations must not restore transient CSV selection or preview');
   return notebook;
  }
  const notebook=await inspect();await navigate();await inspect();
  assert.deepEqual(JSON.parse(await evaluate('window.__earthInitialStorage')).observations,expected.observations,'Reload must start with the imported persisted observations');
  assert.deepEqual(exceptions,[]);
  return {productUrl:product.href,bootstrapUrl:session.baseUrl,initialProjectStorage:null,exportedPath,exportedSha256:createHash('sha256').update(bytes).digest('hex'),oldSessionPath:resolve(oldSessionArg),oldProfileDirectory:old.profileDirectory,newProfileDirectory:session.profileDirectory,oldSessionFinishedAt:old.finishedAt,observationCount:expected.observations.length,exactObservationsAndProvenance:true,authoredSiteWeatherProposalPreserved:true,renderedNotebook:notebook,transientCsvNotRestored:true,reloadPersistence:true,exceptions,sandbox:session.sandbox,limits:['Same machine and browser version; distinct owned profiles','No physical measurement validation']};
 });
 await writeFile(join(runDirectory,'fresh-profile-receiving.json'),JSON.stringify({status:'PASS',...result.value,session:result.receipt},null,2));
}finally{await rm(bootstrap,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request} from 'node:http';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??resolve(root,'.browser-run-local-server-'+randomUUID());
const chromeBin=process.env.CHROME_BIN??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':'/usr/bin/chromium');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const evidence={status:'failed',assets:[],checks:[]};
let child,cwd,launcherLog='';
async function stopChild(){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  child.kill('SIGTERM');
  for(let i=0;i<50&&child.exitCode===null&&child.signalCode===null;i++)await delay(100);
  if(child.exitCode===null&&child.signalCode===null){
    child.kill('SIGKILL');
    for(let i=0;i<50&&child.exitCode===null&&child.signalCode===null;i++)await delay(100);
    assert.ok(child.exitCode!==null||child.signalCode!==null,'owned launcher must exit');
  }
}
function fetchAsset(url){
  return new Promise((resolveResult,reject)=>{
    const req=request(url,res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('error',reject);res.on('end',()=>resolveResult({status:res.statusCode,mime:res.headers['content-type'],body:Buffer.concat(chunks)}));});
    const timeout=setTimeout(()=>req.destroy(Error('Asset request exceeded 10 seconds')),10000);
    req.on('close',()=>clearTimeout(timeout));req.on('error',reject);req.end();
  });
}
try{
  await mkdir(runDirectory,{recursive:true});
  cwd=await mkdtemp(join(tmpdir(),'earth-normal-server-cwd-'));
  const launcher=join(root,'serve.py');
  evidence.launcher={command:['python3','-u',launcher,'--port','0'],cwd,sha256:hash(await readFile(launcher))};
  let launchError;
  child=spawn('python3',['-u',launcher,'--port','0'],{cwd,stdio:['ignore','pipe','pipe']});
  child.on('error',error=>{launchError=error;});
  let stdout='';child.stdout.on('data',b=>{stdout+=b;launcherLog+=b;});child.stderr.on('data',b=>{launcherLog+=b;});
  let entryUrl;
  for(let i=0;i<200;i++){
    if(launchError)throw launchError;
    const match=stdout.match(/^Serving Experimental Earth at (http:\/\/127\.0\.0\.1:(\d+)\/)\r?$/m);
    if(match){assert.ok(Number(match[2])>0&&Number(match[2])<=65535);entryUrl=match[1];break;}
    assert.equal(child.exitCode,null,'launcher exited before announcing its URL');await delay(100);
  }
  assert.ok(entryUrl,'launcher must announce allocated loopback port within 20 seconds');evidence.entryUrl=entryUrl;
  for(const name of ['event-graph.mjs','fill-event-graph.mjs','crest-event-graph.mjs']){
    const expected=await readFile(join(root,name)),actual=await fetchAsset(new URL(name,entryUrl));
    evidence.assets.push({name,status:actual.status,mime:actual.mime,expectedSha256:hash(expected),actualSha256:hash(actual.body),bytes:actual.body.length});
    assert.equal(actual.status,200,name);assert.equal(actual.mime,'text/javascript; charset=utf-8',name);assert.deepEqual(actual.body,expected,name);
  }
  await withBrowserSession({root,runDirectory:join(runDirectory,'browser'),chromeBin},async session=>{
    const {send,evaluate,exceptions}=session;
    evidence.sandbox=session.sandbox;
    evidence.sandboxPath=session.sandboxPath;
    await send('Page.enable');await send('Runtime.enable');
    const origin=new URL(entryUrl).origin;
    const snapshot=()=>evaluate(`({href:location.href,origin:location.origin,path:location.pathname,timeOrigin:performance.timeOrigin,ready:document.readyState,existing:document.querySelectorAll('#existing-grid .cell').length,proposal:document.querySelectorAll('#proposal-grid .cell').length,metrics:document.querySelectorAll('.metric').length,curves:document.querySelectorAll('#chart path').length,navigation:!!document.querySelector('#investigation-navigation'),comparison:document.querySelector('#rain-comparison-status')?.dataset.state})`);
    async function ready(previous){
      let state;
      for(let i=0;i<200;i++){
        session.signal.throwIfAborted();
        try{
          state=await snapshot();
          if(state.origin===origin&&state.path==='/'&&state.timeOrigin!==previous&&state.ready==='complete'&&state.existing===48&&state.proposal===48&&state.metrics===6&&state.curves===2&&state.navigation&&state.comparison==='ready')return state;
        }catch(error){if(!/Execution context was destroyed|Cannot find context with specified id/i.test(String(error?.message??error)))throw error;}
        await delay(100);
      }
      throw Error('Ordinary launcher document did not become ready: '+JSON.stringify(state));
    }
    evidence.initialPreviousTimeOrigin=await evaluate('performance.timeOrigin');
    await send('Page.navigate',{url:entryUrl});evidence.initial=await ready(evidence.initialPreviousTimeOrigin);
    const storageKey='experimental-earth-site-v1';
    const before=await evaluate(`localStorage.getItem('${storageKey}')`);assert.ok(before);
    const title='Ordinary launcher native source edit';
    assert.equal(await evaluate("(()=>{const e=document.getElementById('project-title');e.scrollIntoView({block:'center',behavior:'instant'});e.focus();return document.activeElement===e&&!e.disabled&&!e.closest('[inert]')})()"),true);
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65,nativeVirtualKeyCode:65});
    await send('Input.insertText',{text:title});
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9});
    let saved,editReady=false;
    for(let i=0;i<100;i++){
      session.signal.throwIfAborted();
      saved=await evaluate(`localStorage.getItem('${storageKey}')`);
      const state=await snapshot();
      if(saved&&JSON.parse(saved).title===title&&state.comparison==='ready'){
        evidence.postEdit=state;editReady=true;break;
      }
      await delay(100);
    }
    assert.equal(editReady,true,'native title edit must reach a saved, ready comparison within 10 seconds');
    assert.equal(evidence.postEdit.comparison,'ready');
    assert.deepEqual(JSON.parse(saved),{...JSON.parse(before),title},'native edit preserves every other source field');
    const previous=await evaluate('performance.timeOrigin');
    await send('Page.reload',{ignoreCache:true});evidence.returningPreviousTimeOrigin=previous;evidence.returning=await ready(previous);
    assert.equal(await evaluate(`localStorage.getItem('${storageKey}')`),saved,'real reload retains exact accepted source');
    assert.equal(await evaluate("document.getElementById('project-title').value"),title);
    assert.deepEqual(exceptions,[]);evidence.exceptions=[...exceptions];
    evidence.checks.push('Ordinary launcher from unrelated cwd serves all three exact JavaScript modules','New intended-origin document renders 96 cells, six metrics, two curves and investigation navigation','Native title edit preserves source and survives genuine reload with ready comparison');
  });
  evidence.status='passed';
}catch(error){evidence.error={name:error.name,message:error.message};process.exitCode=1;}
finally{
  try{await stopChild();}catch(error){evidence.status='failed';evidence.cleanupError=String(error);process.exitCode=1;}
  if(cwd)await rm(cwd,{recursive:true,force:true});
  await mkdir(runDirectory,{recursive:true});await writeFile(join(runDirectory,'launcher.log'),launcherLog);
  await writeFile(join(runDirectory,'local-server-receipt.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}

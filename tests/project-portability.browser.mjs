import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const chromeBin=process.env.CHROME_BIN??'/opt/google/chrome/chrome';
const runDirectory=process.env.BROWSER_RUN_DIRECTORY??(root+'.browser-run-'+randomUUID());
let checks=[], exceptions=[];
try {
  const result=await withBrowserSession({root,chromeBin,runDirectory},async session=>{
    const {send,evaluate,baseUrl}=session;exceptions=session.exceptions;
    await send('Runtime.enable');await send('Page.enable');
    await send('Page.navigate',{url:baseUrl});
    for(let i=0;i<35;i++){
      await delay(130);
      try{if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===48)break;}catch{}
    }
    assert.equal(await evaluate("document.querySelectorAll('#existing-grid .cell').length"),48);
    await evaluate('localStorage.clear()');await send('Page.reload',{ignoreCache:true});
    for(let i=0;i<30;i++){
      await delay(100);try{if(await evaluate("document.querySelectorAll('#existing-grid .cell').length")===48)break;}catch{}
    }
    const prepared=await evaluate(`(()=>{
      const p=JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
      p.width=24;p.height=24;p.selectedIndex=0;p.title='Source-rich 24x24 original';
      const t={kind:'supplied-elevation-table/1',fileName:'F'.repeat(200),line:2,datum:'D'.repeat(160),source:'S'.repeat(240),unit:'m',elevationValue:0,uncertaintyValue:0,cellSizeM:p.weather.cellSizeM};
      const c={elevationM:0,surface:'turf',provenance:'P'.repeat(240),terrainSource:t};
      p.existing=Array.from({length:576},(_,i)=>({...c,terrainSource:{...t,line:i+2}}));p.proposal=structuredClone(p.existing);
      window.__richProject=p;
      const text=JSON.stringify(p), file=new File([text],'authored-site.json',{type:'application/json'});
      const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      return {bytes:file.size,originalTitle:p.title};
    })()`);
    assert.ok(prepared.bytes>1_000_000&&prepared.bytes<4*1024*1024,JSON.stringify(prepared));
    for(let n=0;n<45;n++){
      await delay(100);
      if(await evaluate("JSON.parse(localStorage.getItem('experimental-earth-site-v1')).width")===24)break;
    }
    const afterImport=await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('experimental-earth-site-v1'));return {width:p.width,title:p.title,source:p.proposal[575].terrainSource.source,line:p.proposal[575].terrainSource.line,grids:document.querySelectorAll('#existing-grid .cell').length};})()`);
    assert.deepEqual({width:afterImport.width,title:afterImport.title,line:afterImport.line,grids:afterImport.grids},{width:24,title:prepared.originalTitle,line:577,grids:576});
    assert.equal(afterImport.source,'S'.repeat(240));checks.push('actual browser imports originally too-large validated 24x24 source-rich project');

    const downloaded=await evaluate(`(async()=>{
      const original=URL.createObjectURL;let blob;
      URL.createObjectURL=function(candidate){blob=candidate;return original.call(this,candidate);};
      let didClick=false;const oldClick=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){if(this.download==='experimental-earth-site.json')didClick=true;return oldClick.call(this);};
      try {
        document.querySelector('#export').click();
        const text=await blob.text(),p=JSON.parse(text);
        return {clicked:didClick,bytes:blob.size,title:p.title,lastSource:p.proposal[575].terrainSource.source,lastLine:p.proposal[575].terrainSource.line};
      }finally{URL.createObjectURL=original;HTMLAnchorElement.prototype.click=oldClick;}
    })()`);
    assert.equal(downloaded.clicked,true);assert.ok(downloaded.bytes>1_000_000);assert.equal(downloaded.title,prepared.originalTitle);assert.equal(downloaded.lastLine,577);assert.equal(downloaded.lastSource,'S'.repeat(240));checks.push('actual user-triggered exported download contains complete source, 1.38MB, re-openable by same import bound');

    const stale=await evaluate(`(async()=>{
      const previous=File.prototype.text;let finish;
      File.prototype.text=function(){return new Promise(resolve=>{finish=()=>resolve(JSON.stringify(window.__richProject));});};
      try {
        const input=document.querySelector('#import'),dt=new DataTransfer();dt.items.add(new File(['{}'],'delayed.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
        if(!finish)throw Error('Read did not begin');
        document.querySelector('#reset').click();finish();await new Promise(r=>setTimeout(r,150));
        const saved=JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
        return {width:saved.width,title:saved.title,toast:document.querySelector('#toast').textContent};
      }finally{File.prototype.text=previous;}
    })()`);
    assert.equal(stale.width,8);assert.ok(stale.title.includes('fictional'));assert.match(stale.toast,/Import refused: Workspace changed while reading/);checks.push('delayed import cannot overwrite a newer reset/project revision');

    const rejected=await evaluate(`(async()=>{
      const before=localStorage.getItem('experimental-earth-site-v1'),p=JSON.parse(before);
      p.extra='🙂'.repeat(1_100_000);
      const input=document.querySelector('#import'),dt=new DataTransfer();const file=new File([JSON.stringify(p)],'oversized.json');dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      return {size:file.size,preserved:before===localStorage.getItem('experimental-earth-site-v1'),toast:document.querySelector('#toast').textContent};
    })()`);
    assert.ok(rejected.size>4*1024*1024);assert.equal(rejected.preserved,true);assert.match(rejected.toast,/Import refused: Project file exceeds 4 MiB limit/);checks.push('oversize input refused without replacing workspace');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(120);
    const dims=await evaluate('({inner:innerWidth,scroll:document.documentElement.scrollWidth,grids:document.querySelectorAll(".cell").length})');
    assert.ok(dims.scroll<=dims.inner+1,JSON.stringify(dims));assert.equal(dims.grids,96);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    writeFileSync(session.runDirectory+'/project-portability-mobile.png',Buffer.from(shot.data,'base64'));
    checks.push('390px baseline layout remains usable');
    assert.deepEqual(exceptions,[]);
    return {checks,dimensions:dims,sandbox:session.sandbox,sandboxPath:session.sandboxPath,exceptions};
  });
  console.log(JSON.stringify({status:'PASS',...result.value,session:result.receipt},null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,exceptions,receiptPath:error.receipt?.receiptFile??null},null,2));process.exitCode=1;}

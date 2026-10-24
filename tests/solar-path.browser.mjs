import {withBrowserSession} from './support/browser-session.mjs';
import {receiveSunPath} from './solar-path.receiving.mjs';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.SUN_PATH_RECEIPT_DIR?resolve(process.env.SUN_PATH_RECEIPT_DIR):await mkdtemp(join(tmpdir(),'earth-sun-path-'));
await mkdir(output,{recursive:true});const report=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
const pending=['app.js','index.html','styles.css','rain-trace.css','tests/solar-path.browser.mjs'],seen=new Set(),sourceHashes={};
while(pending.length){
  const path=pending.pop();if(seen.has(path))continue;seen.add(path);
  const absolute=resolve(root,path);if(!absolute.startsWith(root))throw Error('Dependency escaped source root');
  const bytes=await readFile(absolute);sourceHashes[path]=createHash('sha256').update(bytes).digest('hex');
  if(!/\.(js|mjs)$/.test(path))continue;
  for(const match of bytes.toString('utf8').matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)){
    if(match[1].startsWith('.'))pending.push(relative(root,resolve(dirname(absolute),match[1])));
  }
}
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN,runDirectory:join(output,'browser-session')},async session=>{
  const {evaluate,send,exceptions}=session;await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  for(let i=0;i<100;i++){try{if(await evaluate("!!document.querySelector('#sun-path-run')"))break;}catch{}await delay(50);}
  let failure=null;try{await receiveSunPath({evaluate,send,delay,report});}catch(error){failure=error;}
  for(const[name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await delay(80);
    for(const[part,selector]of [['controls','#solar-path'],['results','#sun-path-results']]){
      const clip=await evaluate(`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.max(1,Math.min(r.height,1500)),scale:1}})()`);
      const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(join(output,name+'-'+part+'.png'),Buffer.from(png.data,'base64'));
    }
  }
  const receipt={passed:!failure&&!exceptions.length,report,exceptions,sandboxAdmitted:session.sandbox.admitted,browser:session.sandbox.browser.product,
    executable:process.env.CHROME_BIN,sourceHashes,failure:failure?String(failure.stack):null};
  await writeFile(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({passed:receipt.passed,output,checks:report.length,sandboxAdmitted:receipt.sandboxAdmitted}));
  if(failure)throw failure;if(exceptions.length)throw Error('Browser page exceptions');
});

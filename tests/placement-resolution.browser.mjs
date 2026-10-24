import {withBrowserSession} from './support/browser-session.mjs';
import {receivePlacementResolution} from './placement-resolution.receiving.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const output=process.env.PLACEMENT_RESOLUTION_RECEIPT_DIR?resolve(process.env.PLACEMENT_RESOLUTION_RECEIPT_DIR):await mkdtemp(join(tmpdir(),'earth-placement-resolution-'));
await mkdir(output,{recursive:true});
const report=[],delay=ms=>new Promise(r=>setTimeout(r,ms));
await withBrowserSession({root:new URL('../',import.meta.url).pathname,chromeBin:process.env.CHROME_BIN,runDirectory:join(output,'browser-session')},async session=>{
 for(let i=0;i<100;i++){if(await session.evaluate("!!document.querySelector('#placement-run')"))break;await delay(50);}
 let failure=null;
 try {await receivePlacementResolution({...session,delay,report});}catch(error){failure=error;}
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await session.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await delay(80);
  const clip=await session.evaluate("(()=>{const r=document.querySelector('#placement-search').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
  const png=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
  await writeFile(join(output,name+'.png'),Buffer.from(png.data,'base64'));
 }
 const receipt={passed:!failure&&!session.exceptions.length,report,exceptions:session.exceptions,sandboxAdmitted:session.sandbox.admitted,sandboxPath:session.sandboxPath,browser:session.sandbox.browser.product,failure:failure?String(failure.stack):null};
 await writeFile(join(output,'browser-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:receipt.passed,output,checks:report.length}));
 if(failure)throw failure;if(session.exceptions.length)throw Error(JSON.stringify(session.exceptions));
});

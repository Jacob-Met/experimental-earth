import {withBrowserSession} from './support/browser-session.mjs';
import {receiveRateEvents} from './rate-events.receiving.mjs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.rate-events-'+randomUUID(),report=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN||'/usr/bin/google-chrome-stable',runDirectory},async session=>{
  await session.send('Runtime.enable');await session.send('Page.enable');
  for(let i=0;i<40;i++){try{if(await session.evaluate("!!document.querySelector('a[href=\"./rate-events.html\"]')"))break;}catch{}await delay(100);}
  assert.equal(await session.evaluate("!!document.querySelector('a[href=\"./rate-events.html\"]')"),true);
  await session.evaluate("document.querySelector('a[href=\"./rate-events.html\"]').click()");
  for(let i=0;i<40;i++){try{if(await session.evaluate("!!document.querySelector('#compare')"))break;}catch{}await delay(100);}
  await receiveRateEvents({...session,delay,report,artifactDirectory:runDirectory,pairPath:root+'research/usda-er2-original-pair.json'});
  assert.deepEqual(session.exceptions,[]);
  const shot=await session.send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/narrow.png',Buffer.from(shot.data,'base64'));
});
console.log(JSON.stringify({report,runDirectory}));

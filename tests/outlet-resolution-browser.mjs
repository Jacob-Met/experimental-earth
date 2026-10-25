import { withBrowserSession } from './support/browser-session.mjs';
import { receiveOutletResolution } from './outlet-resolution.receiving.mjs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=root+'.outlet-resolution-'+randomUUID();
const report=[];
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN||'/usr/bin/google-chrome-stable',runDirectory},async session=>{
 await session.send('Runtime.enable');await session.send('Page.enable');
 for(let i=0;i<40;i++){try{if(await session.evaluate("!!document.querySelector('#outlet-resolution')"))break;}catch{}await delay(150);}
 await receiveOutletResolution({...session,delay,report,artifactDirectory:runDirectory});
 assert.deepEqual(session.exceptions,[]);
 await session.evaluate("document.querySelector('#outlet-resolution').click();document.querySelector('#outlet-resolution-results details').open=true;document.querySelector('#outlet-resolution').scrollIntoView({block:'start',behavior:'instant'})");
 const shot=await session.send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/narrow.png',Buffer.from(shot.data,'base64'));
});
console.log(JSON.stringify({report,runDirectory}));

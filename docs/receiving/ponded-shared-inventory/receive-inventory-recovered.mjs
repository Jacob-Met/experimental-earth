import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {receiveInChromium} from '/tmp/hamon-69d25c99168e-tools/chromium-receive.mjs';
import {receiveSharedInventory} from './tests/ponded-shared-inventory.receiving.mjs';
const [url,outputDirectory]=process.argv.slice(2);
const checkpoint=JSON.parse(await readFile(new URL('./recovery-checkpoint.json',import.meta.url),'utf8'));
for(const f of checkpoint.files){const bytes=await readFile(new URL(f.path,import.meta.url));if(createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Candidate source changed: '+f.path);}
const sourceIdentity={baseCommit:checkpoint.baseCommit,baseTree:checkpoint.baseTree,recovery:checkpoint.recovery,files:checkpoint.files.map(({path,sha256,gitBlob,bytes})=>({path,sha256,gitBlob,bytes})),unchangedDependency:checkpoint.unchangedDependency};
const result=await receiveInChromium({url,outputDirectory,sourceIdentity,receive:async session=>{
 await session.wait("typeof document.querySelector('#inventory-run')?.onclick==='function'");
 const captures=await receiveSharedInventory(session);
 return Object.fromEntries(captures.screenshots.map(shot=>['inventory-'+shot.width,shot]));
}});
console.log(JSON.stringify({status:result.status,checks:result.checks.length,outputDirectory,exceptions:result.exceptions.length}));

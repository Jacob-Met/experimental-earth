// Install into tests/ beside the maintained support/ directory; run only through Renpo.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {withBrowserSession} from './support/browser-session.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runDirectory=process.env.BROWSER_RUN_DIRECTORY || root+'.browser-heldback-'+randomUUID();
await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN || '/usr/bin/chromium'},async({evaluate,exceptions})=>{
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error('Timed out: '+expression);};
 await wait(`!!document.querySelector('#investigation-navigation')`);
 await evaluate(`window.q=id=>document.getElementById(id);window.stored=()=>localStorage.getItem('experimental-earth-site-v1');window.setMap=value=>{q('observation-station-map').value=value;q('observation-station-map').dispatchEvent(new Event('input',{bubbles:true}));};window.pendingFiles={};window.upload=(name,body,defer=false)=>{const file=new File([body],name,{type:'text/csv'});if(defer)file.arrayBuffer=()=>new Promise(resolve=>pendingFiles[name]=()=>resolve(new TextEncoder().encode(body).buffer));const transfer=new DataTransfer();transfer.items.add(file);q('observation-table-file').files=transfer.files;q('observation-table-file').dispatchEvent(new Event('change',{bubbles:true}));};q('reset').click();window.before=stored();`);
 const csv='\uFEFFstation,minute,depth,uncertainty,unit,source,scenario,use\r\n" east ",15,01.20,.1,cm,"logger\r\nsecond line",existing,calibration';
 const mapping=cell=>JSON.stringify({source:'Held-back declared placement',entries:[{station:'east',cell}]});
 await evaluate(`setMap(${JSON.stringify(mapping('A1'))});upload('retained-original.csv',${JSON.stringify(csv)},true);setMap(${JSON.stringify(mapping('B2'))});pendingFiles['retained-original.csv']();`);
 await wait(`!q('preview-observation-table').disabled`);
 assert.equal(await evaluate(`q('append-observation-table').disabled && q('observation-table-preview').children.length===0 && stored()===before`),true,'Changing mapping while loading must not auto-preview or alter notebook');
 await evaluate(`q('preview-observation-table').click()`);
 await wait(`!q('append-observation-table').disabled`);
 assert.match(await evaluate(`q('observation-table-preview').textContent`),/B2.*12 ± 1 mm/);
 assert.equal(await evaluate(`stored()===before`),true,'Explicit preview is read-only');
 await evaluate(`q('append-observation-table').click()`);
 const observations=await evaluate(`JSON.parse(stored()).observations`);
 assert.equal(observations.length,1);
 assert.equal(observations[0].tableSource.fileName,'retained-original.csv');
 assert.equal(observations[0].tableSource.line,2);
 assert.equal(observations[0].tableSource.depthValue,'01.20');
 assert.equal(observations[0].tableSource.stationValue,' east ');
 assert.equal(observations[0].tableSource.stationMapping.cell,'B2');
 assert.equal(observations[0].source,'logger\nsecond line');
 // A real application reset must invalidate an outstanding File read, not just its current preview.
 await evaluate(`upload('forgotten.csv',${JSON.stringify(csv)},true);q('reset').click();window.afterReset=stored();pendingFiles['forgotten.csv']();`);
 await delay(100);
 assert.equal(await evaluate(`q('preview-observation-table').disabled && q('append-observation-table').disabled && q('observation-table-selected').hidden && stored()===afterReset`),true,'Reset must prevent pending source from becoming actionable');
 await evaluate(`setMap(${JSON.stringify(mapping('B2'))});q('preview-observation-table').click()`);
 assert.equal(await evaluate(`q('append-observation-table').disabled && stored()===afterReset`),true,'Mapping changes cannot revive source forgotten by reset');
 // Independently replace a valid cached source with each kind of invalid file.
 for(const [name,bodyExpression] of [['oversized.csv',`'x'.repeat(128001)`],['invalid-utf8.csv',`new Uint8Array([0xc3,0x28])`]]){
  await evaluate(`upload('valid-before-replacement.csv',${JSON.stringify(csv)})`);
  await wait(`!q('append-observation-table').disabled`);
  await evaluate(`window.beforeReplacement=stored();upload(${JSON.stringify(name)},${bodyExpression})`);
  await wait(`q('observation-table-status').textContent.startsWith('Import refused')`);
  assert.equal(await evaluate(`q('preview-observation-table').disabled && q('append-observation-table').disabled && q('observation-table-selected').hidden`),true,name+' must retire cached previous file');
  await evaluate(`setMap(${JSON.stringify(mapping('A1'))});q('preview-observation-table').click();q('append-observation-table').click()`);
  assert.equal(await evaluate(`stored()===beforeReplacement && q('append-observation-table').disabled`),true,name+' must not revive previous observations');
 }
 assert.deepEqual(exceptions,[]);
 await writeFile(runDirectory+'/heldback.json',JSON.stringify({mappingDuringReadRequiresExplicitPreview:true,currentMappingAndOriginalProvenance:true,resetDuringReadForgetsSource:true,oversizeReplacementForgetsSource:true,invalidUtf8ReplacementForgetsSource:true,exceptions},null,2));
});

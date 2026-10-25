import assert from 'node:assert/strict';
import {writeFile,readFile,access} from 'node:fs/promises';
import {makeExample} from '../core.js';
export async function receiveOutletTable({evaluate,send,delay,report,artifactDirectory}){
 const original=makeExample();await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(original))})`);await send('Page.reload',{ignoreCache:true});await delay(500);
 await evaluate("document.querySelector('#outlet-entry').open=true;document.querySelector('#outlet-table-entry').open=true;document.querySelector('#outlet-event').value='Authored CSV receiving event';document.querySelector('#outlet-collection').value='Declared complete boundary control';document.querySelector('#outlet-coverage').checked=true;document.querySelector('#outlet-rates').value='0,0.1,0.2'");
 const csv='start_minute,end_minute,volume,uncertainty,unit,source,use\n7,37,16000,500,mL,"Original, multiline\ncollection source",calibration\n37,60,.0264,.001,m3,Second original source,challenge';
 const file=artifactDirectory+'/original-collections.csv';await writeFile(file,csv);const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#outlet-table-file'});await send('DOM.setFileInputFiles',{nodeId,files:[file]});
 await evaluate("document.querySelector('#outlet-table-preview').focus()");await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 for(let i=0;i<30;i++){if(await evaluate("!document.querySelector('#outlet-table-commit').disabled"))break;await delay(100);}
 assert.equal(await evaluate("document.querySelectorAll('#outlet-table-results p').length"),2);assert.equal(await evaluate("document.querySelectorAll('#outlet-readings .observation').length"),0);
 await evaluate("document.querySelector('#outlet-table-commit').click();document.querySelector('#outlet-compare').click()");
 const saved=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.equal(saved.outletEvidence.readings.length,2);assert.equal(saved.outletEvidence.readings[1].tableSource.line,4);assert.equal(saved.outletEvidence.readings[1].tableSource.volumeValue,'.0264');assert.equal(saved.outletEvidence.readings[0].volume,16000);assert.deepEqual(saved.weather,original.weather);assert.equal(await evaluate("document.querySelectorAll('[data-outlet-rate]').length"),3);
 await evaluate("document.querySelector('#outlet-table-preview').click()");await delay(100);assert.ok(await evaluate("document.querySelector('#outlet-table-status').textContent.includes('already retained')"));assert.equal(await evaluate("document.querySelector('#outlet-table-commit').disabled"),true);
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:artifactDirectory});await evaluate("document.querySelector('#export').click()");const exportedPath=artifactDirectory+'/experimental-earth-site.json';for(let i=0;i<30;i++){try{await access(exportedPath);break;}catch{await delay(100);}}
 const exported=JSON.parse(await readFile(exportedPath,'utf8'));assert.deepEqual(exported.outletEvidence,saved.outletEvidence);
 // Change the accepted event first so equality cannot pass without an actual reopen.
 await evaluate(`document.querySelector('#rain').value=${original.weather.rainMmHr+1};document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))`);
 assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).weather.rainMmHr,original.weather.rainMmHr+1);
 // Reopen actual downloaded bytes through the ordinary file input.
 const doc=await send('DOM.getDocument');const imported=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#import'});await send('DOM.setFileInputFiles',{nodeId:imported.nodeId,files:[exportedPath]});await delay(300);
 assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).weather.rainMmHr,original.weather.rainMmHr);
 assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).outletEvidence,saved.outletEvidence);
 assert.ok(await evaluate("document.querySelector('#outlet-readings').textContent.includes('original-collections.csv, line 4')"));
 // Delay File.text to prove a changed candidate draft cannot revive an old preview.
 await evaluate("globalThis.originalFileText=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{globalThis.finishCollectionRead=()=>resolve('start_minute,end_minute,volume,uncertainty,unit,source\\n0,5,1,0,L,Delayed source')})};document.querySelector('#outlet-table-preview').click()");
 await evaluate("document.querySelector('#outlet-rates').value='0,0.3';document.querySelector('#outlet-rates').dispatchEvent(new Event('input'));globalThis.finishCollectionRead();File.prototype.text=globalThis.originalFileText");await delay(100);assert.equal(await evaluate("document.querySelector('#outlet-table-commit').disabled"),true);assert.equal(await evaluate("document.querySelectorAll('#outlet-table-results p').length"),0);
 // A changed observed event also cancels an unfinished source read.
 await evaluate("File.prototype.text=function(){return new Promise(resolve=>{globalThis.finishCollectionRead=()=>resolve('start_minute,end_minute,volume,uncertainty,unit,source\\n0,5,1,0,L,Delayed source')})};document.querySelector('#outlet-table-preview').click()");
 await evaluate(`document.querySelector('#rain').value=${original.weather.rainMmHr+1};document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}));globalThis.finishCollectionRead();File.prototype.text=globalThis.originalFileText`);await delay(100);
 assert.equal(await evaluate("document.querySelector('#outlet-table-commit').disabled"),true);assert.equal(await evaluate("document.querySelectorAll('#outlet-table-results p').length"),0);
 await evaluate(`document.querySelector('#rain').value=${original.weather.rainMmHr};document.querySelector('#rain').dispatchEvent(new Event('change',{bubbles:true}))`);
 assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).outletEvidence,saved.outletEvidence);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('#outlet-table-entry').open=true;document.querySelector('#outlet-table-entry').scrollIntoView({block:'start',behavior:'instant'})");
 const layout=await evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})");assert.ok(Math.abs(layout.width-390)<=1&&layout.scroll<=391,JSON.stringify(layout));
 const rows=await evaluate("[...document.querySelectorAll('#outlet-readings .observation')].map(row=>{const button=row.querySelector('button'),r=document.createRange();r.selectNodeContents(button);const text=[...row.querySelectorAll('small')].map(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,display:getComputedStyle(e).display}));return {width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height,lines:r.getClientRects().length,text};})");
 assert.equal(rows.length,2);
 for(const row of rows){assert.ok(row.width>=64&&row.height<48&&row.lines===1,JSON.stringify(row));assert.equal(row.text.length,2);assert.equal(row.text[0].display,'block');assert.equal(row.text[1].display,'block');assert.ok(row.text[1].top>=row.text[0].bottom+2,JSON.stringify(row));}
 await evaluate("document.querySelector('#outlet-readings').scrollIntoView({block:'start',behavior:'instant'})");
 report.push('outlet CSV: real file keyboard preview, atomic commit, original units/physical lines, hypotheses, duplicate refusal, actual download/reopen, delayed-read invalidation, strict390');
}

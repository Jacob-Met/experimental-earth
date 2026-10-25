import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { makeExample } from '../core.js';
import { appendOutletReading } from '../outlet-evidence.js';
export async function receiveOutletResolution({evaluate,send,delay,report,artifactDirectory}) {
 let p=makeExample(); p.weather.stepMinutes=5;
 p=appendOutletReading(p,{target:'existing',eventRef:'Authored resolution control',collectionSource:'Declared complete boundary, not field acquisition',coverage:'all-modeled-edges',ratesPerHour:[0,0.1,0.2]}, {startMinute:7,endMinute:37,volume:16,uncertainty:1,unit:'L',source:'Authored interval control',use:'calibration'});
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);
 await send('Page.reload',{ignoreCache:true});await delay(500);
 await evaluate("document.querySelector('#outlet-rates').value='0,0.2,0.4';document.querySelector('#outlet-rates').dispatchEvent(new Event('input'));globalThis.resolutionClicks=0;document.querySelector('#outlet-resolution').addEventListener('click',()=>globalThis.resolutionClicks++);document.querySelector('#outlet-resolution').focus()");
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 assert.equal(await evaluate('globalThis.resolutionClicks'),1,'Enter must activate the actual button');
 assert.equal(await evaluate("document.querySelectorAll('#outlet-resolution-results details').length"),3);
 assert.ok(await evaluate("document.querySelector('#outlet-resolution-results').textContent.includes('Authored interval control')"));
 const saved=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
 assert.deepEqual(saved.outletEvidence.ratesPerHour,[0,0.2,0.4]);assert.deepEqual(saved.outletEvidence.readings,p.outletEvidence.readings);assert.deepEqual(saved.weather,p.weather);
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:artifactDirectory});
 await evaluate("document.querySelector('#export').click()");
 const path=artifactDirectory+'/experimental-earth-site.json';for(let i=0;i<30;i++){try{await access(path);break;}catch{await delay(100);}}
 const exported=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(exported.outletEvidence,saved.outletEvidence);
 await evaluate(`(()=>{const input=document.querySelector('#import'),transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(JSON.stringify(exported))}],'resolution-reopen.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(350);
 assert.equal(await evaluate("document.querySelector('#outlet-resolution-results').textContent"),'');
 await evaluate("document.querySelector('#outlet-resolution').click()");
 assert.equal(await evaluate("document.querySelectorAll('#outlet-resolution-results details').length"),3);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate("document.querySelectorAll('#outlet-resolution-results details').forEach(d=>d.open=true)");
 const layout=await evaluate("({innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,panel:document.querySelector('#outlet-evidence-panel').getBoundingClientRect().toJSON(),ancestors:(()=>{const a=[];for(let e=document.querySelector('#outlet-evidence-panel');e;e=e.parentElement)a.push({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,columns:getComputedStyle(e).gridTemplateColumns});return a;})(),documentOverflow:[...document.querySelectorAll('body *')].filter(e=>!e.children.length&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().right>391).slice(0,20).map(e=>({tag:e.tagName,id:e.id,class:e.className,parent:e.parentElement?.id||e.parentElement?.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,80)})),overflow:[...document.querySelectorAll('#outlet-evidence-panel *')].filter(e=>e.getBoundingClientRect().right>391).slice(0,12).map(e=>({tag:e.tagName,id:e.id,right:e.getBoundingClientRect().right,text:e.textContent.slice(0,100)}))})");
 assert.ok(Math.abs(layout.innerWidth-390)<=1,JSON.stringify(layout));
 assert.ok(layout.scroll<=391,JSON.stringify(layout));
 await evaluate("document.querySelector('#outlet-rates').dispatchEvent(new Event('input'))");
 assert.equal(await evaluate("document.querySelector('#outlet-resolution-results').textContent"),'');
 report.push('outlet resolution: keyboard calculation, original-source custody, edited-rate download/import replay, narrow layout and draft invalidation');
}

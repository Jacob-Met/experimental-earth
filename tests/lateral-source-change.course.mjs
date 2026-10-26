/** Complementary ordinary-app receiving: saved exposure changes model output. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {withBrowserSession} from './support/browser-session.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runDirectory=process.env.BROWSER_RUN_DIRECTORY;
if(!runDirectory)throw Error('Provide a fresh BROWSER_RUN_DIRECTORY');
const report={status:'FAIL',scope:'Authored declared-model application integration; no physical validation',checks:[]};
await withBrowserSession({root,chromeBin:process.env.CHROME_BIN||'/opt/google/chrome/chrome',runDirectory},async({evaluate,send,exceptions})=>{
 await send('Runtime.enable');await send('Page.enable');await send('Page.reload',{ignoreCache:true});
 for(let n=0;n<100;n++){if(await evaluate("Boolean(document.getElementById('lateral-form'))"))break;await new Promise(r=>setTimeout(r,50));}
 assert.equal(await evaluate("Boolean(document.getElementById('lateral-form'))"),true);
 await evaluate("document.getElementById('heat-example').click();document.getElementById('heat-form').requestSubmit();document.getElementById('lateral-example').click();document.getElementById('lateral-form').requestSubmit()");
 const before=await evaluate("({status:document.getElementById('lateral-status').textContent,output:JSON.parse(document.querySelector('#lateral-results details pre').textContent)})");
 assert.match(before.status,/Compared original inputs/);
 await evaluate("document.getElementById('heat-schedule').value='minutes,incident_w_m2,reservoir_c,source\\n17,350,19,Independent new heating\\n23,0,14,Independent new cooling';document.getElementById('heat-schedule').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('heat-form').requestSubmit()");
 assert.equal(await evaluate("document.getElementById('lateral-results').textContent"),'');
 assert.equal(await evaluate("document.getElementById('lateral-export').disabled"),true);
 report.checks.push('Saving changed exposure refreshes the ordinary mounted lateral panel and invalidates stale output/download');
 await evaluate("document.getElementById('lateral-form').requestSubmit()");
 const after=await evaluate("({status:document.getElementById('lateral-status').textContent,output:JSON.parse(document.querySelector('#lateral-results details pre').textContent),workspace:JSON.parse(localStorage.getItem('experimental-earth-site-v1'))})");
 assert.match(after.status,/Compared original inputs/);
 assert.equal(after.workspace.surfaceHeatStudy.schedule.length,2);
 assert.equal(after.workspace.surfaceHeatStudy.schedule[0].minutes,17);
 assert.notDeepEqual(before.output.existing.temperaturesC,after.output.existing.temperaturesC);
 assert.notDeepEqual(before.output.proposal.temperaturesC,after.output.proposal.temperaturesC);
 report.checks.push('New saved heating/cooling exposure produces different visible temperatures for both plans without reloading app');
 await evaluate("document.getElementById('heat-clear').click()");
 assert.equal(await evaluate("document.getElementById('lateral-run').disabled&&document.getElementById('lateral-export').disabled"),true);
 assert.equal(await evaluate("document.getElementById('lateral-results').textContent"),'');
 report.checks.push('Removing saved heat source prevents comparison or export of the previous result');
 assert.deepEqual(exceptions,[]);report.status='PASS';report.before=before.output;report.after=after.output;
 await writeFile(resolve(runDirectory,'source-change-receipt.json'),JSON.stringify(report,null,2));
});
console.log(JSON.stringify(report,null,2));

import {DEFAULT_STUDY} from './study-contract.js';
import {
 buildClockReceipt,parseClockReceipt,serializeClockReceipt,
 checkClockReceiptBytes,CLOCK_RECEIPT_LIMITS
} from './clock-receipt.js';

function drawComparison(container,receipt,{reopened=false}={}){
 container.replaceChildren();
 const add=text=>{const p=document.createElement('p');p.textContent=text;container.append(p);};
 const {project,reason,study,comparison}=receipt;
 add(reopened
  ? 'Recomputed from the file’s included authored project. The current workspace was not replaced.'
  : 'Live comparison of declared clock alternatives; source observations remain unchanged.');
 add('Study project: '+project.title+'. Timing hypothesis source: '+reason);
 add(`Scenario: ${study.target}; surface: ${study.surface}; rates: ${study.ratesMmHr.join(', ')} mm/h.`);
 for(const row of comparison.offsets){
  if(!row.comparison){
   add(`${row.offsetMinutes} min: refused; shifted readings ${row.outsideReadingIndices.map(i=>i+1).join(', ')} leave the modeled time window. No readings were dropped.`);
   continue;
  }
  const c=row.comparison;
  add(`${row.offsetMinutes} min: ${c.status}. Calibration-compatible rates: ${c.compatibleRatesMmHr.join(', ')||'none'} mm/h. Rates remaining after ${c.counts.challenge} held-aside checks: ${c.survivingRatesMmHr.join(', ')||'none'} mm/h.`);
 }
 add(comparison.semantics);
 add(CLOCK_RECEIPT_LIMITS);
}

export function mountClockPanel({getProject,notice}){
 const section=document.createElement('section');section.className='panel';section.id='clock-study';
 section.innerHTML=`<h2>Does the event clock change the evidence?</h2>
 <p>Test a common timing offset for assigned depth readings. Positive offsets sample later in the modeled storm. The original readings and model clock stay unchanged.</p>
 <label>Offsets in minutes (include 0)<input id="clock-offsets" value="-5, 0, 5" maxlength="120"></label>
 <label>Reason for these timing hypotheses<input id="clock-reason" maxlength="200" placeholder="For example: recorder clock checked against storm start"></label>
 <button id="compare-clock" type="button">Compare timing hypotheses</button>
 <button id="download-clock" type="button" disabled>Download independent clock diagnostic JSON</button>
 <label>Reopen a saved clock diagnostic without importing its site
 <input id="clock-import" type="file" accept=".json,application/json"></label>
 <div id="clock-results" aria-live="polite"></div>
 <div id="clock-replay" aria-live="polite"></div>
 <p class="mini-note">A diagnostic includes the entire authored project and its original observation source descriptions. Review before sharing. Reopening recomputes its conclusions but cannot authenticate field evidence.</p>`;
 document.querySelector('main').append(section);
 const results=section.querySelector('#clock-results');
 const replay=section.querySelector('#clock-replay');
 const download=section.querySelector('#download-clock');
 const importInput=section.querySelector('#clock-import');
 let activeReceipt=null,revision=0,importSerial=0;
 const discard=()=>{revision++;activeReceipt=null;download.disabled=true;results.replaceChildren();};
 const refresh=()=>{discard();replay.replaceChildren();};
 for(const input of section.querySelectorAll('#clock-offsets,#clock-reason')){
  input.addEventListener('input',discard);
 }
 section.querySelector('#compare-clock').addEventListener('click',()=>{
  discard();
  try{
   const reason=section.querySelector('#clock-reason').value;
   const values=section.querySelector('#clock-offsets').value.split(',').map(v=>v.trim()===''?NaN:Number(v));
   const project=getProject(),study=project.infiltrationStudy??DEFAULT_STUDY;
   const receipt=buildClockReceipt(project,values,reason,study);
   drawComparison(results,receipt);
   activeReceipt=receipt;download.disabled=false;
  }catch(error){results.textContent=error.message;notice(error.message);}
 });
 download.addEventListener('click',()=>{
  if(!activeReceipt)return;
  try{
   const text=serializeClockReceipt(activeReceipt);
   const blob=new Blob([text],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');
   link.href=url;link.download='experimental-earth-clock-diagnostic.json';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),500);
   notice('Clock diagnostic downloaded with all authored observations and source descriptions.');
  }catch(error){discard();results.textContent='Diagnostic export refused: '+error.message;notice(error.message);}
 });
 importInput.addEventListener('change',async()=>{
  const file=importInput.files?.[0];if(!file)return;
  const startedRevision=revision,serial=++importSerial;
  replay.replaceChildren();
  try{
   checkClockReceiptBytes(file.size);
   const receipt=parseClockReceipt(await file.text());
   if(startedRevision!==revision||serial!==importSerial)throw Error('Workspace or clock hypotheses changed while reopening diagnostic');
   drawComparison(replay,receipt,{reopened:true});
   notice('Clock diagnostic independently recomputed. Current workspace unchanged.');
  }catch(error){
   if(startedRevision===revision&&serial===importSerial){replay.textContent='Diagnostic refused: '+error.message;notice(error.message);}
  }finally{if(serial===importSerial)importInput.value='';}
 });
 return {refresh};
}

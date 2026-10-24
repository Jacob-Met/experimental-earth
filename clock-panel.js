import {compareClockOffsets} from './clock-study.js';
import {DEFAULT_STUDY} from './study-contract.js';
export function mountClockPanel({getProject,notice}) {
 const section=document.createElement('section');section.className='panel';section.id='clock-study';
 section.innerHTML='<h2>Does the event clock change the evidence?</h2><p>Test a common timing offset for assigned depth readings. Positive offsets sample later in the modeled storm. The original readings and model clock stay unchanged.</p><label>Offsets in minutes (include 0)<input id="clock-offsets" value="-5, 0, 5" maxlength="120"></label><label>Reason for these timing hypotheses<input id="clock-reason" maxlength="200" placeholder="For example: recorder clock checked against storm start"></label><button id="compare-clock" type="button">Compare timing hypotheses</button><div id="clock-results" aria-live="polite"></div>';
 document.querySelector('main').append(section);const output=section.querySelector('#clock-results');
 const refresh=()=>{output.replaceChildren();};
 section.querySelectorAll('input').forEach(i=>i.addEventListener('input',refresh));
 section.querySelector('button').addEventListener('click',()=>{
  refresh();try{
   const reason=section.querySelector('#clock-reason').value.trim();if(!reason)throw Error('Describe why these timing offsets are being considered.');
   const values=section.querySelector('#clock-offsets').value.split(',').map(v=>v.trim()===''?NaN:Number(v));
   const p=getProject(),study=p.infiltrationStudy??DEFAULT_STUDY,r=compareClockOffsets(p,values,study);
   const add=text=>{const el=document.createElement('p');el.textContent=text;output.append(el);};
   add('Timing hypothesis source: '+reason);add(`Scenario: ${study.target}; surface: ${study.surface}; rates: ${study.ratesMmHr.join(', ')} mm/h.`);
   if(r.status==='need-assigned-readings'){add('Assign calibration or held-aside depth readings before comparing their timing.');return;}
   for(const row of r.offsets){if(!row.comparison){add(`${row.offsetMinutes} min: refused; shifted readings ${row.outsideReadingIndices.map(i=>i+1).join(', ')} leave the modeled time window. No readings were dropped.`);continue;}
    const c=row.comparison;add(`${row.offsetMinutes} min: ${c.status}. Calibration-compatible rates: ${c.compatibleRatesMmHr.join(', ')||'none'} mm/h. Rates remaining after ${c.counts.challenge} held-aside checks: ${c.survivingRatesMmHr.join(', ')||'none'} mm/h.`);
   }
   add(r.semantics);add('Offsets and their reason are session-only diagnostic settings. A favorable offset does not establish the true event clock or validate the model.');
  }catch(error){output.textContent=error.message;notice(error.message);}
 });
 return {refresh};
}

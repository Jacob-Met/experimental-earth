import {explainCommonClockConflict} from './common-clock-conflict.js';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const preview=x=>String(Number(x.toPrecision(4)));
const bands=rows=>rows.map(([a,b])=>a===b?`≈{${preview(a)}}`:`≈[${preview(a)}, ${preview(b)}]`).join(' ∪ ');
function exactBounds(parent,label,rows){
 const details=el('details');details.className='clock-conflict-exact';details.append(el('summary',`Exact retained numeric bounds — ${label}`));
 const values=el('pre',JSON.stringify(rows));values.className='clock-conflict-exact-values';values.style.whiteSpace='pre-wrap';values.style.overflowWrap='anywhere';details.append(values);parent.append(details);
}

function render(parent,result){
 if(result.status==='work-limit'){parent.append(el('p',`Conflict explanation not resolved: bounded search would require up to ${result.estimatedIntervalScans} interval scan steps, above ${result.maxIntervalScans}. The complete common-clock outcomes above remain available.`));return;}
 if(result.status==='no-assigned-readings'){parent.append(el('p','No calibration readings were supplied. A held-aside contradiction cannot be interpreted as a challenge to calibrated support.'));return;}
 if(result.status==='compatible'){parent.append(el('p','At least one offered rate has common offset support for these original readings.'));return;}
 const names={
  'reading-outside-declared-event-support':'One reading lies outside modeled-event support throughout the declared clock range.',
  'single-reading-excludes-offered-models':'One reading has no depth-compatible offset under any offered rate.',
  'incompatible-shared-clock-constraints':'These original readings cannot share a clock offset under any offered rate.'
 };
 parent.append(el('p',names[result.classification]));
 parent.append(el('p',`Conflict sources: ${result.witnessReadingIndices.map(i=>'#'+(i+1)).join(', ')}. Considered sources: ${result.consideredReadingIndices.map(i=>'#'+(i+1)).join(', ')}.`));
 parent.append(el('p','Approximate previews (≈) use four significant digits. They are not certificates: distinct endpoints or tiny disconnected gaps can look identical after rounding. Open the exact retained numeric bounds to inspect every component.'));
 parent.append(el('p','This is an irreducible subset: each listed source is necessary to this particular contradiction. It is not necessarily the smallest subset. Readings outside it remain part of the full evidence above.'));
 const list=el('ol');
 for(const w of result.witness){
  const r=w.reading,li=el('li');li.append(el('p',`Source #${w.index+1} — ${r.use}; cell ${r.cellIndex+1}; original minute ${r.minute}; ${r.depthMm} ± ${r.uncertaintyMm} mm. Source: ${r.source}`));
  for(const c of w.individual){
   li.append(el('p',`${c.rateMmHr} mm/h: ${c.intervals.length?'this reading alone admits offsets '+bands(c.intervals)+' minutes':'no admitted offset'}${c.status==='outside-modeled-window'?' (outside modeled-event support)':''}.`));
   exactBounds(li,`${c.rateMmHr} mm/h, source #${w.index+1}`,c.intervals);
  }
  const a=w.removalReopens;
  li.append(el('p',`Logical removal check for source #${w.index+1}: the remaining conflict subset admits ${a.rateMmHr} mm/h at offset ≈${preview(a.offsetMinutes)} minutes, within ${bands([a.interval])}. This is a witness of necessity, not permission to discard the reading or a fit of the complete ledger.`));
  exactBounds(li,`removal of source #${w.index+1}`,w.removalSupport);
  const selected=el('details');selected.className='clock-conflict-exact';selected.append(el('summary',`Exact retained removal witness — source #${w.index+1}`));const raw=el('pre',JSON.stringify(a));raw.className='clock-conflict-exact-values';raw.style.whiteSpace='pre-wrap';raw.style.overflowWrap='anywhere';selected.append(raw);li.append(selected);list.append(li);
 }
 parent.append(list);
 const possible=result.independentPossibilities.filter(r=>r.everyReadingIndividuallyPossible).map(r=>r.rateMmHr);
 parent.append(el('p',possible.length?`Every considered reading is individually possible at ${possible.join(', ')} mm/h, but their required offsets cannot all agree. Independent acquisition-time errors could therefore differ from a shared clock error; this result does not authenticate either explanation.`:'No offered rate makes every considered reading individually possible within the declared range. A shared clock shift alone cannot resolve this set.'));
 parent.append(el('p','The contradiction is conditional on the offered rates, declared range, event support, original tolerance bands and retained numerical trajectories. It cannot identify which reading, clock assumption, hydraulic parameter or physical model is wrong.'));
}
export function mountClockConflictExplanation(container,comparison){
 const section=el('section');section.className='common-clock-conflict';section.append(el('h4','Which original constraints prevent a common clock?'));
 const button=el('button','Explain original-source conflicts');button.type='button';button.className='common-clock-explain';const output=el('div');output.className='common-clock-conflict-output';output.setAttribute('aria-live','polite');section.append(button,output);container.append(section);
 button.onclick=()=>{output.replaceChildren();try{
  const calibration=explainCommonClockConflict(comparison,{phase:'calibration'});output.append(el('h5','Calibration constraints'));render(output,calibration);
  if(calibration.status==='compatible'){
   output.append(el('h5','Held-aside challenge against calibration support'));
   if(comparison.candidates[0].readings.some(r=>r.reading.use==='challenge'))render(output,explainCommonClockConflict(comparison,{phase:'all'}));else output.append(el('p','No held-aside readings were supplied.'));
  }else if(calibration.status==='conflict')output.append(el('p','Calibration already has no common support across the offered rates. Held-aside readings are retained above; they are not used to select this calibration conflict.'));
 }catch(error){output.textContent=error.message;}};
}

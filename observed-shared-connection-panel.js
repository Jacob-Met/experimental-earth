import {inspectSharedObservedConnection,exportSharedObservedConnection,reopenSharedObservedConnection} from './observed-shared-connection.js';
import {parseConnectivityCells} from './ponding-connectivity.js';
import {checkProjectFileBytes} from './project-portability.js';

export function mountSharedObservedConnection({getProject}){
 const panel=document.createElement('section');panel.id='shared-observed-connection';panel.className='panel';panel.style.minWidth='0';
 panel.innerHTML=`<h2>Do the same cells connect across observed visits?</h2>
 <p>Inspect one shared connection at 2–16 exact numeric-notebook times. A different connection at each visit does not establish a common path. Missing observations remain unknown; nothing is inferred between visits.</p>
 <form data-form><div class="input-pair"><label>Observed scenario<select data-scenario><option value="existing">Existing</option><option value="proposal">Proposal</option></select></label><label>Exact minutes, separated by commas<input data-minutes value="10,20" maxlength="400" required></label></div>
 <div class="input-pair"><label>Start cell<input data-start value="A2" maxlength="3" required></label><label>End cell<input data-end value="C2" maxlength="3" required></label></div>
 <label>Depth threshold (mm)<input data-threshold type="number" min="0.000001" max="1000" step="any" value="5" required></label>
 <label>Offered cells (ALL or cell labels)<textarea data-footprint rows="2" maxlength="3000" style="box-sizing:border-box;width:100%">ALL</textarea></label>
 <button>Inspect shared observed connection</button></form>
 <p data-error role="alert"></p><p data-source></p><div data-result aria-live="polite" style="overflow-wrap:anywhere"></div>
 <button data-export type="button" disabled>Download original notebook and visits</button>
 <label>Reopen a shared observed connection<input data-import type="file" accept="application/json,.json"></label>
 <p class="mini-note">Conditional on the original numeric bands and their declared scenario, event, grid location and clocks. Roles remain visible. No one-sided evidence, simulated fill, between-visit continuity, physical access, probabilities or measurement accuracy are inferred. Reopening uses an isolated original project without replacing the working site.</p>`;
 document.getElementById('observed-connectivity').after(panel);
 const $=s=>panel.querySelector(s),name=(i,p)=>String.fromCharCode(65+i%p.width)+(Math.floor(i/p.width)+1);
 let source=null,report=null,context=null,serial=0;
 const clear=(message='')=>{source=null;report=null;$('[data-result]').replaceChildren();$('[data-source]').textContent=message;$('[data-error]').textContent='';$('[data-export]').disabled=true;};
 function render(p,r,label){
  source=structuredClone(p);report=r;context=JSON.stringify(getProject());const target=$('[data-result]');target.replaceChildren();
  $('[data-source]').textContent=`${label}: ${p.title}. ${r.query.minutes.join(', ')} exact minutes; ${r.usedReadingIndices.length} original numeric rows used.`;
  const messages={'band-supported':'One shared connection is supported by the declared bands at every selected visit.','band-excluded':'Every offered connection has a cell whose original lower band exceeds the threshold at a selected visit.','unresolved':'The original bands do not settle whether one connection meets the threshold at every selected visit.','conflicting-bands':'Contradictory original bands withhold a shared-connection conclusion.','roundoff-contact':'Numerical contact between original bands withholds a conclusion.','disconnected-footprint':'The endpoints are disconnected inside the offered footprint, independently of depths.'};
  const heading=document.createElement('h3');heading.textContent=messages[r.status];target.append(heading);
  const add=text=>{const line=document.createElement('p');line.textContent=text;target.append(line);};
  for(const ledger of r.ledgers)add(`At ${ledger.query.minute} min alone: ${ledger.status.replaceAll('-',' ')}${ledger.path.length?' via '+ledger.path.map(i=>name(i,p)).join(' → '):''}. ${ledger.usedReadingIndices.length} matching rows; ${ledger.excludedReadings} outside this exact scenario, time or footprint.`);
  if(r.path.length)add(`${r.status==='band-supported'?'Supported shared path':'Unresolved candidate path'}: ${r.path.map(i=>name(i,p)).join(' → ')}.`);
  for(const i of r.boundary??[])add(`Blocking boundary cell ${name(i,p)}: ${r.cells[i].visits.filter(v=>v.status==='above').map(v=>`${v.minute} min, lower band ${v.lowerMm} mm`).join('; ')}.`);
  if(r.unresolvedPairs?.length)add('Unresolved candidate cell/visit pairs: '+r.unresolvedPairs.map(x=>`${name(x.cellIndex,p)} at ${x.minute} min`).join('; ')+'.');
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Inspect retained original numeric rows and roles';details.append(summary);
  for(const index of r.usedReadingIndices){const o=p.observations[index],line=document.createElement('p');line.textContent=`Row ${index+1}: ${name(o.cellIndex,p)}, ${o.scenario}, ${o.minute} min, ${o.depthMm} ± ${o.uncertaintyMm} mm; role ${o.use??'unassigned'}; source ${o.source}.`;const raw=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=line.textContent;pre.textContent=JSON.stringify(o,null,2);pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';raw.append(summary,pre);details.append(raw);}
  target.append(details);$('[data-export]').disabled=false;
 }
 function fromForm(p){
  const one=s=>{const cells=parseConnectivityCells($(s).value,p.width,p.height);if(cells.length!==1)throw Error('Declare exactly one cell at each endpoint.');return cells[0];};
  const tokens=$('[data-minutes]').value.trim().split(/[\s,;]+/);if(tokens.some(t=>!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)))throw Error('Enter explicit nonnegative minute values.');
  return {scenario:$('[data-scenario]').value,minutes:tokens.map(Number),thresholdMm:Number($('[data-threshold]').value),startIndex:one('[data-start]'),endIndex:one('[data-end]'),allowedIndices:parseConnectivityCells($('[data-footprint]').value,p.width,p.height)};
 }
 $('[data-form]').addEventListener('submit',e=>{e.preventDefault();serial++;clear();try{const p=getProject();render(p,inspectSharedObservedConnection(p,fromForm(p)),'Current working notebook');}catch(e){$('[data-error]').textContent=e.message;}});
 $('[data-form]').addEventListener('input',()=>{serial++;clear('Question changed. Inspect again.');});
 $('[data-export]').addEventListener('click',()=>{try{if(!report)throw Error('Inspect a shared connection first.');const text=exportSharedObservedConnection(source,report.query),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='earth-shared-observed-connection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('[data-error]').textContent=e.message;}});
 $('[data-import]').addEventListener('change',async()=>{const token=++serial,file=$('[data-import]').files[0],original=JSON.stringify(getProject());if(!file)return;clear();try{checkProjectFileBytes(file.size);const text=await file.text();if(token!==serial||original!==JSON.stringify(getProject()))return;const reopened=reopenSharedObservedConnection(text);render(reopened.project,reopened.report,'Reopened isolated original notebook');const q=reopened.report.query;for(const [selector,value] of [['[data-scenario]',q.scenario],['[data-minutes]',q.minutes.join(',')],['[data-threshold]',q.thresholdMm],['[data-start]',name(q.startIndex,reopened.project)],['[data-end]',name(q.endIndex,reopened.project)],['[data-footprint]',q.allowedIndices.map(i=>name(i,reopened.project)).join(' ')]])$(selector).value=value;}catch(e){if(token===serial)$('[data-error]').textContent=e.message;}finally{if(token===serial)$('[data-import]').value='';}});
 return {refresh(){serial++;if(report&&context!==JSON.stringify(getProject()))clear('Working notebook changed. Inspect again or reopen the original.');}};
}

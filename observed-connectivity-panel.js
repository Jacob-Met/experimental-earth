import {inspectObservedConnectivity,exportObservedConnection,reopenObservedConnection} from './observed-connectivity.js';
import {inspectObservedConnectionRange} from './observed-connection-range.js';
import {parseConnectivityCells} from './ponding-connectivity.js';
import {checkProjectFileBytes} from './project-portability.js';

export function mountObservedConnectivity({getProject}){
 const panel=document.createElement('section');panel.id='observed-connectivity';panel.className='panel';panel.style.minWidth='0';
 panel.innerHTML=`<div class="section-heading"><div><span class="eyebrow">CONNECT ORIGINAL READINGS</span><h2>What do the notebook bands establish?</h2></div></div>
 <p>Inspect simultaneous depth readings for one exact scenario and minute. Unmeasured cells stay unknown; simulated depths never fill the gaps.</p>
 <form id="observed-connection-form"><div class="input-pair">
 <label class="input-label">Observed scenario<select id="observed-connection-scenario"><option value="existing">Existing</option><option value="proposal">Proposal</option></select></label>
 <label class="input-label">Exact notebook minute<input id="observed-connection-minute" type="number" min="0" max="720" step="any" value="15" required></label></div>
 <div class="input-pair"><label class="input-label">Start cell<input id="observed-connection-start" value="A2" maxlength="3" required></label><label class="input-label">End cell<input id="observed-connection-end" value="C2" maxlength="3" required></label></div>
 <label class="input-label">Depth threshold (mm)<input id="observed-connection-threshold" type="number" min="0.000001" max="1000" step="any" value="10" required></label>
 <label class="input-label">Offered footprint (ALL or cell labels)<textarea id="observed-connection-footprint" maxlength="3000" rows="2" style="width:100%;font:inherit">ALL</textarea></label>
 <button type="submit">Inspect original notebook bands</button></form>
 <p class="mini-note">Bands are supplied tolerances, not verified truth or probabilities. This assumes the same declared scenario, time and grid cell refer to the same event and location. Roles remain visible; no calibration or held-out score is computed.</p>
 <p id="observed-connection-error" role="alert"></p><p id="observed-connection-source"></p>
 <div id="observed-connection-results" hidden><h3 id="observed-connection-status" aria-live="polite"></h3><p id="observed-connection-witness" style="overflow-wrap:anywhere"></p><p id="observed-connection-unknown" style="overflow-wrap:anywhere"></p>
 <p id="observed-connection-range" style="overflow-wrap:anywhere"></p><details><summary>Inspect every offered cell and original source</summary><div id="observed-connection-ledger"></div></details>
 <button id="observed-connection-export" class="subtle" type="button">Download original notebook and question</button></div>
 <label class="input-label">Reopen an evidence connection investigation<input id="observed-connection-import" type="file" accept=".json,application/json"></label>
 <p class="mini-note">This establishes only a conditional depth-band relation on a grid. It does not establish walkability, physical access, safety, travel time or permission to intervene. Reopening uses an isolated original project and never replaces the working site.</p>`;
 document.getElementById('ponding-connectivity').after(panel);
 const $=id=>panel.querySelector('#'+id),label=(i,p)=>String.fromCharCode(65+i%p.width)+(Math.floor(i/p.width)+1),number=v=>Number(v.toPrecision(8)).toLocaleString('en-US',{maximumSignificantDigits:8});
 let source=null,report=null,context=null,serial=0;
 function clear(message=''){source=null;report=null;$('observed-connection-results').hidden=true;$('observed-connection-source').textContent=message;$('observed-connection-ledger').replaceChildren();$('observed-connection-error').textContent='';}
 function display(project,next,basis){
  source=structuredClone(project);report=next;context=JSON.stringify(getProject());
  $('observed-connection-source').textContent=`${basis}: ${project.title}. ${next.usedReadingIndices.length} matching original readings; ${next.excludedReadings} excluded by exact scenario, time or footprint. Original site source: ${project.source??'not supplied'}.`;
  const statuses={'band-supported':'The supplied bands support a connection.','unresolved':'The connection remains unresolved.','band-excluded':'Above-threshold bands separate the endpoints.','conflicting-bands':'Repeated bands conflict; no whole-footprint conclusion.','roundoff-contact':'Repeated bands have unresolved numerical contact.','disconnected-footprint':'The offered footprint is geometrically disconnected.'};
  $('observed-connection-status').textContent=statuses[next.status];
  $('observed-connection-witness').textContent=next.status==='band-supported'?`Every cell on this path has a common upper band at or below ${number(next.query.thresholdMm)} mm: ${next.path.map(i=>label(i,project)).join(' → ')}.`:next.status==='unresolved'?`This merely possible path still depends on unresolved cells: ${next.path.map(i=>label(i,project)).join(' → ')}.`:next.status==='band-excluded'?`Every offered connection meets at least one of these above-threshold cells: ${next.boundary.map(i=>label(i,project)).join(', ')}. Each has a common lower band strictly above ${number(next.query.thresholdMm)} mm.`:['conflicting-bands','roundoff-contact'].includes(next.status)?'Inspect the original repeated-band diagnostic below. No reading was removed or corrected.':'Even an entirely dry offered footprint has no edge-adjacent connection between these endpoints.';
  $('observed-connection-unknown').textContent=next.status==='unresolved'?`Unresolved cells on that possible path: ${next.unresolvedIndices.map(i=>label(i,project)+' ('+(next.cells[i].status==='unmeasured'?'unmeasured':'band spans threshold')+')').join(', ')}. This is not a ranked measurement recommendation.`:'';
  const range=inspectObservedConnectionRange(project,next.query);
  $('observed-connection-range').textContent=range.possibleThresholdMm===null
   ? 'Threshold range withheld: resolve the source-band or footprint condition above first.'
   : `Across all depths consistent with only these original bands, the smallest connection threshold can be as low as ${String(range.possibleThresholdMm)} mm. `+(range.supportedThresholdMm===null
    ? 'No finite threshold is supported for every completion: every offered path needs at least one unmeasured cell. No maximum depth is assigned to those cells.'
    : `A threshold of ${String(range.supportedThresholdMm)} mm supports a connection for every such completion. This endpoint is attained by the supplied upper bands. Supported witness: ${range.supportedPath.map(i=>label(i,project)).join(' → ')}.`)+` Lower-band witness: ${range.possiblePath.map(i=>label(i,project)).join(' → ')}. These are tight bounds under the supplied bands alone, not probabilities, verified measurements or physical access. Correlations not supplied here may narrow the range.`;
  const ledger=$('observed-connection-ledger');ledger.replaceChildren();
  for(const i of next.query.allowedIndices){const cell=next.cells[i],section=document.createElement('div');section.style.cssText='border-top:1px solid #dce5df;padding:10px 0;overflow-wrap:anywhere';const title=document.createElement('strong');title.textContent=label(i,project)+': '+cell.status.replaceAll('-',' ')+(cell.lowerMm!==null&&cell.lowerMm!==undefined?` · common band [${number(cell.lowerMm)}, ${number(cell.upperMm)}] mm`:'');section.append(title);
   if(cell.conflict){const p=document.createElement('p');p.textContent=`Repeated-band ${cell.conflict.status}; reported gap ${String(cell.conflict.gapMm)} mm, separate numerical guard ${String(cell.conflict.numericalGuardMm)} mm. Original reading indices ${cell.conflict.readings.map(r=>r.index+1).join(', ')}.`;section.append(p);}
   for(const {index,reading} of cell.readings){const p=document.createElement('p');p.textContent=`Reading ${index+1}: ${number(reading.depthMm)} ± ${number(reading.uncertaintyMm)} mm; ${reading.scenario}, minute ${number(reading.minute)}; role ${reading.use??'unassigned'}. Source: ${reading.source}`;section.append(p);}if(!cell.readings.length){const p=document.createElement('p');p.textContent='No matching original reading. This cell remains unknown.';section.append(p);}ledger.append(section);
  }
  $('observed-connection-results').hidden=false;
 }
 function formQuery(p){const endpoint=id=>{const a=parseConnectivityCells($(id).value,p.width,p.height);if(a.length!==1)throw Error('Each endpoint must name exactly one cell.');return a[0];};return {scenario:$('observed-connection-scenario').value,minute:Number($('observed-connection-minute').value),thresholdMm:Number($('observed-connection-threshold').value),startIndex:endpoint('observed-connection-start'),endIndex:endpoint('observed-connection-end'),allowedIndices:parseConnectivityCells($('observed-connection-footprint').value,p.width,p.height)};}
 function setForm(p,q){$('observed-connection-scenario').value=q.scenario;$('observed-connection-minute').value=q.minute;$('observed-connection-threshold').value=q.thresholdMm;$('observed-connection-start').value=label(q.startIndex,p);$('observed-connection-end').value=label(q.endIndex,p);$('observed-connection-footprint').value=q.allowedIndices.map(i=>label(i,p)).join(' ');}
 $('observed-connection-form').addEventListener('submit',event=>{event.preventDefault();serial++;clear();try{const p=getProject();display(p,inspectObservedConnectivity(p,formQuery(p)),'Current working notebook');}catch(error){$('observed-connection-error').textContent=error.message;}});
 $('observed-connection-form').addEventListener('input',()=>{serial++;clear('Question changed. Inspect again to recompute from original readings.');});
 $('observed-connection-export').addEventListener('click',()=>{try{if(!report)throw Error('Inspect a notebook question first.');const text=exportObservedConnection(source,report.query),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='earth-observed-connection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){$('observed-connection-error').textContent=error.message;}});
 $('observed-connection-import').addEventListener('change',async()=>{const token=++serial,file=$('observed-connection-import').files[0],original=JSON.stringify(getProject());if(!file)return;clear();try{checkProjectFileBytes(file.size);const text=await file.text();if(token!==serial||original!==JSON.stringify(getProject()))return;const reopened=reopenObservedConnection(text);display(reopened.project,reopened.report,'Reopened isolated original notebook');setForm(reopened.project,reopened.report.query);}catch(error){if(token===serial)$('observed-connection-error').textContent=error.message;}finally{if(token===serial)$('observed-connection-import').value='';}});
 return {refresh(){serial++;if(report&&context!==JSON.stringify(getProject()))clear('Working notebook or site changed. Inspect again or reopen the original investigation.');}};
}


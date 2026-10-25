import { compareSharedGround } from './terrain-shared-ground.js';
import { renderSharedGround } from './terrain-shared-ground-view.js';
const name=(i,w)=>`${String.fromCharCode(65+i%w)}${Math.floor(i/w)+1}`;
export function mountSharedGround({host,getProject}){
 const section=document.createElement('details');section.id='shared-ground-panel';
 section.innerHTML=`<summary>Investigate a shared ground-height error across a supplied footprint</summary>
 <h3>What if these supplied heights share one ground error?</h3>
 <p>Select the cells explicitly and describe why you want to inspect a common additive offset. A shared filename, datum label or adjacency does not establish shared error. Absolute crests and unselected terrain stay fixed; this is not a datum conversion.</p>
 <form id="shared-ground-form">
 <div><button type="button" id="shared-ground-all" class="subtle">Select all supplied cells</button> <button type="button" id="shared-ground-none" class="subtle">Clear selection</button></div>
 <details><summary>Inspect or change the footprint: <span id="shared-ground-count">0 selected</span></summary><fieldset id="shared-ground-cells" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(66px,1fr));gap:8px;min-width:0"><legend>Selected supplied cells</legend></fieldset></details>
 <label class="input-label">Basis for the shared ground-error hypothesis <textarea id="shared-ground-basis" maxlength="1000" rows="3" placeholder="Describe this assumption; it is not inferred from the survey"></textarea></label>
 <label class="input-label">Shared error half-width (metres; blank uses the limiting supplied interval) <input id="shared-ground-width" type="number" step="any" placeholder="Use limiting supplied interval"></label>
 <label class="input-label">Common-offset samples <select id="shared-ground-count-choice"><option value="3">3 · low, central, high</option><option value="5">5 · include quarter points</option><option value="9">9 · finer interior samples</option><option value="17">17 · finest offered samples</option></select></label>
 <label style="display:flex;gap:10px;align-items:start;margin:16px 0"><input id="shared-ground-transfer" type="checkbox" style="width:18px;flex:0 0 18px;margin-top:4px">I assume the same additive ground error applies to every selected cell and transfers equally to each proposal cell, preserving all authored height changes. Absolute crests and unselected ground stay fixed.</label>
 <button id="shared-ground-run" type="submit" class="subtle">Compare shared ground-error samples</button></form>
 <p id="shared-ground-status" role="status" aria-live="polite"></p><div id="shared-ground-results"></div>`;
 section.style.minWidth='0';section.style.overflowWrap='anywhere';host.querySelector('#terrain-sensitivity-form').after(section);
 const $=id=>section.querySelector('#shared-ground-'+id);let fingerprint=null;
 const cells=()=>[...$('cells').querySelectorAll('input[type=checkbox]')];
 function clear(message='Select a supplied footprint, describe the basis and confirm the transfer assumption.',reset=false){$('results').replaceChildren();$('status').textContent=message;if(reset)$('transfer').checked=false;}
 function selection(){clear('Footprint changed; confirm every selected cell and recompute.',true);$('count').textContent=`${cells().filter(c=>c.checked).length} selected`;}
 function refresh(){const p=getProject(),next=JSON.stringify(p);if(next===fingerprint)return;fingerprint=next;
  $('cells').replaceChildren();const legend=document.createElement('legend');legend.textContent='Selected supplied cells';$('cells').append(legend);
  for(const[i,cell]of p.existing.entries())if(cell.terrainSource){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=String(i);input.id=`shared-ground-cell-${i}`;input.style.width='18px';input.style.marginRight='6px';label.style.whiteSpace='nowrap';label.style.minHeight='44px';label.style.display='flex';label.style.alignItems='center';label.append(input,document.createTextNode(name(i,p.width)));$('cells').append(label);input.addEventListener('change',selection);}
  $('basis').value='';$('width').value='';$('count').textContent='0 selected';$('run').disabled=!cells().length;clear('Project/source refreshed. Select the supplied footprint and declare its shared-error basis.',true);
 }
 $('all').addEventListener('click',()=>{for(const cell of cells())cell.checked=true;selection();});$('none').addEventListener('click',()=>{for(const cell of cells())cell.checked=false;selection();});
 $('basis').addEventListener('input',()=>clear('Shared-error basis changed; confirm and recompute.',true));
 $('width').addEventListener('input',()=>clear('Requested shared interval changed; recompute all samples.'));
 $('count-choice').addEventListener('change',()=>clear('Sample count changed; recompute the complete requested family.'));
 $('transfer').addEventListener('change',()=>clear('Transfer declaration changed; recompute to inspect results.'));
 $('form').addEventListener('submit',event=>{event.preventDefault();clear();try{
  const p=getProject();if(JSON.stringify(p)!==fingerprint){refresh();throw Error('Project changed; select and confirm its current sources');}
  const report=compareSharedGround(p,{cellIndices:cells().filter(c=>c.checked).map(c=>Number(c.value)),basis:$('basis').value,transferConfirmed:$('transfer').checked,sampleCount:Number($('count-choice').value),...($('width').value===''?{}:{halfWidthM:Number($('width').value)})});
  $('status').textContent=`${report.sampleCount} paired comparisons · ${report.cellIndices.length} selected cells · ${report.cellStepUpperBound.toLocaleString()} cell-steps.`;renderSharedGround($('results'),report,p.width);
 }catch(error){clear(`Comparison refused: ${error.message}`);}});
 return{refresh};
}

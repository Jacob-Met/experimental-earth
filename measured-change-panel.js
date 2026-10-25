import {mountPairedSeries} from './paired-series-panel.js';
import {mountMeasuredChangeEditor} from './measured-change-editor.js';
import {compareMeasuredChange,changeExample,validateChange} from './measured-change.js';
import {serializePortableProject,parsePortableProject,checkProjectFileBytes} from './project-portability.js';
export function mountMeasuredChange({getProject}) {
  const section=document.createElement('section');section.className='panel';section.id='measured-change';
  section.innerHTML=`<h2>Did the measured change differ from another place?</h2><p>Compare four original intervals at two common UTC times. A shared weather change can alter both places. The contrast below subtracts the comparison-place change from the treated-place change; it alone cannot establish a causal intervention effect.</p><button type="button" id="mc-example">Inspect fictional comparison</button><div id="mc-fields"></div><p>All four observations use the declared common unit and UTC times. Enter original lower/upper bounds and a source for each. Matching declarations do not verify comparability.</p><button type="button" id="mc-run">Compare original changes</button><button type="button" id="mc-save" disabled>Download original investigation</button><label class="file-label">Reopen original investigation<input id="mc-open" type="file" accept=".json,application/json"></label><div id="mc-result" role="status" aria-live="polite"></div><p>Arithmetic endpoints use floating-point values, not outward-rounded certified real bounds. The numerical guard applies to direction only. Bounds are supplied constraints, not confidence intervals. Their Cartesian combination assumes no additional shared-error constraint. A parallel untreated change is an assumption, not tested by one before/after pair. Ordinary project export does not include this temporary investigation; use its download button. Reopening preserves the active workspace.</p>`;
  document.querySelector('.workspace').append(section);
  const q=id=>section.querySelector('#mc-'+id),output=q('result');let accepted=null,revision=0;
  const retire=()=>{revision++;accepted=null;q('save').disabled=true;output.textContent='Inputs changed. Compare again.';};const editor=mountMeasuredChangeEditor(q('fields'),{changed:retire});
  function show(source,original) {
    const result=compareMeasuredChange(original);accepted={schema:'experimental-earth-measured-change-bundle/1',project:JSON.parse(serializePortableProject(source)),input:structuredClone(original)};
    output.replaceChildren();
    const line=text=>{const p=document.createElement('p');p.textContent=text;output.append(p);};
    line(`Original site context: ${source.title}. ${original.quantity} (${original.unit}).`);
    for(const [key,label] of [['treated','Treated-place change'],['comparison','Comparison-place change'],['contrast','Change contrast']])line(`${label}: ${result[key].lower} to ${result[key].upper} ${original.unit}.`);
    line(`Contrast direction: ${result.direction}. Numerical sign guard: ${result.numericalGuard} ${original.unit}; original bounds remain unchanged.`);
    line(`Association: ${original.association}`);line(`Parallel-change assumption: ${original.parallelChange}`);
    for(const key of ['treatedBefore','treatedAfter','comparisonBefore','comparisonAfter']) {const r=original[key];line(`${key}: ${r.place}, ${r.time}, ${r.lower}–${r.upper} ${r.unit}; ${r.source}`);}
    q('save').disabled=false;
  }
  q('example').onclick=()=>{editor.write(changeExample());retire();};
  q('run').onclick=()=>{retire();try{const original=editor.read();checkProjectFileBytes(new Blob([JSON.stringify(original)]).size);show(getProject(),validateChange(original));}catch(e){output.textContent=e.message;}};
  q('save').onclick=()=>{try{if(!accepted)throw Error('Compare first');const json=JSON.stringify(accepted,null,2);checkProjectFileBytes(new Blob([json]).size);const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='experimental-earth-measured-change.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){output.textContent=e.message;}};
  q('open').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;retire();const serial=revision;try{checkProjectFileBytes(file.size);const bundle=JSON.parse(await file.text());if(serial!==revision)return;if(bundle.schema!=='experimental-earth-measured-change-bundle/1')throw Error('Unsupported investigation');const source=parsePortableProject(JSON.stringify(bundle.project));validateChange(bundle.input);show(source,bundle.input);editor.write(bundle.input);}catch(e){if(serial===revision)output.textContent=e.message;}finally{event.target.value='';}};
  const series=mountPairedSeries({host:section,getProject,getAccepted:()=>accepted});
  return {refresh:()=>{retire();series.refresh();}};
}

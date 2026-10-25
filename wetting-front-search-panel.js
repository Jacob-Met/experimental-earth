import {mountSoilSearchResolution} from './wetting-front-search-resolution-panel.js';
import {SURFACES} from './core.js';
import {searchSoilParameters,soilSearchSelection,serializeSoilSearch,parseSoilSearch,SOIL_SEARCH_FILE_LIMIT} from './wetting-front-search.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const fmt=x=>Number(x).toLocaleString('en-US',{maximumSignificantDigits:6,notation:x!==0&&Math.abs(x)<.001?'scientific':'standard'});
/** Child of the maintained soil consumer; accepted source never changes during search. */
export function mountSoilSearch({host,getProject,setDraft}) {
  const section=node('details');section.id='soil-search';
  section.innerHTML=`<summary>Search soil parameters from recorded depths</summary>
  <p>Explore all pairs on a declared, evenly spaced K/A grid. Original calibration readings constrain the search; held-aside readings only challenge it. No tested pair is hidden.</p>
  <form id="soil-search-form"><div class="wf-fields">
  <label>Readings from<select name="target"><option value="existing">Existing site</option><option value="proposal">Proposed site</option></select></label>
  <label>Material<select name="surface"></select></label>
  <label>K minimum · mm/h<input name="kmin" type="number" min="0" max="2000" step="any" value="0" required></label>
  <label>K maximum · mm/h<input name="kmax" type="number" min="0" max="2000" step="any" value="30" required></label>
  <label>K values<input name="kcount" type="number" min="2" max="9" value="4" required></label>
  <label>A minimum · mm<input name="amin" type="number" min="0" max="5000" step="any" value="0" required></label>
  <label>A maximum · mm<input name="amax" type="number" min="0" max="5000" step="any" value="60" required></label>
  <label>A values<input name="acount" type="number" min="2" max="9" value="4" required></label></div>
  <label>Basis for the bounds<textarea name="basis" maxlength="400" required>Illustrative search bounds; not measured soil properties</textarea></label>
  <div class="wf-actions"><button type="submit">Search declared grid</button><button id="soil-search-save" type="button" disabled>Save original search</button></div></form>
  <p role="status" id="soil-search-status"></p><div id="soil-search-results"></div>
  <label>Reopen original search · JSON<input id="soil-search-import" type="file" accept=".json,application/json"></label>
  <p class="mini-note">Finite grid agreement does not establish a continuous solution, unique soil properties or field accuracy. A compatible boundary pair can indicate that useful alternatives lie outside the declared bounds. Refining or expanding the grid can change the conclusion. Other site, rain and timing assumptions remain fixed.</p>`;
  host.append(section);
  const form=section.querySelector('form'),field=name=>form.elements.namedItem(name);
  const status=section.querySelector('#soil-search-status'),results=section.querySelector('#soil-search-results'),save=section.querySelector('#soil-search-save');
  for(const [key,value] of Object.entries(SURFACES)){const o=node('option',value.label);o.value=key;field('surface').append(o);}field('surface').value='turf';
  let generation=0,retained=null;
  function clear(message='Source changed. Search again.'){generation++;retained=null;results.replaceChildren();save.disabled=true;status.textContent=message;}
  const number=name=>field(name).value.trim()===''?NaN:Number(field(name).value);
  function read(){return {target:field('target').value,surface:field('surface').value,basis:field('basis').value.trim(),conductivity:{min:number('kmin'),max:number('kmax'),count:number('kcount')},drive:{min:number('amin'),max:number('amax'),count:number('acount')}};}
  function show(project,query,report,replay=false){
    retained={project:structuredClone(project),query:structuredClone(query),report,replay,working:JSON.stringify(getProject())};save.disabled=false;
    results.replaceChildren();
    if(report.status==='need-calibration'||report.status==='surface-absent'){
      status.textContent=report.status==='need-calibration'?'Assign original depth readings to calibration for this scenario before fitting.':'This material is absent from the observed scenario.';return;
    }
    const compatible=report.candidates.filter(x=>x.calibration.compatible),boundary=compatible.filter(x=>x.boundary).length;
    status.textContent=`${report.candidates.length} tested pairs; ${compatible.length} agree with every calibration band; ${boundary} compatible pairs on the grid boundary. ${report.closestIds.length} closest calibration pairs (ties retained). ${report.status==='calibration-rejected'?'The closest fit is still contradicted.':''}`;
    results.append(node('p',`Observed ${query.target} site · ${SURFACES[query.surface].label}. K ${query.conductivity.min}–${query.conductivity.max} mm/h (${query.conductivity.count} values); A ${query.drive.min}–${query.drive.max} mm (${query.drive.count} values). Basis: ${query.basis}`));
    results.append(node('p',`${replay?'Recomputed saved source; working site unchanged. ':''}${report.counts.calibration} calibration and ${report.counts.challenge} held-aside readings. K/A bounds and evenly spaced sample counts are declared, not inferred. ${report.cellSteps} cell-steps.`));
    const wrap=node('div');wrap.className='wf-table';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Soil parameter search results; scroll horizontally for all columns');const table=node('table');table.style.minWidth='880px';table.style.tableLayout='fixed';table.style.overflowWrap='normal';table.innerHTML='<thead><tr><th scope="col">Select</th><th scope="col">K · mm/h</th><th scope="col">A · mm</th><th scope="col">Calibration RMSE · mm</th><th scope="col">Calibration bands</th><th scope="col">Held-aside bands</th><th scope="col">Grid boundary</th></tr></thead>';
    const tbody=node('tbody'),selected=new Set();
    report.candidates.forEach(row=>{const tr=node('tr'),td=node('td'),box=node('input');box.type='checkbox';box.disabled=replay;box.dataset.id=row.id;box.setAttribute('aria-label',`Select K ${row.conductivityMmHr}, A ${row.capillaryDriveMm}`);box.style.width='auto';box.addEventListener('change',()=>box.checked?selected.add(row.id):selected.delete(row.id));td.append(box);tr.append(td);
      [fmt(row.conductivityMmHr),fmt(row.capillaryDriveMm),fmt(row.calibration.rmseMm),`${row.calibration.withinCount}/${row.calibration.count}`,row.challenge.count?`${row.challenge.withinCount}/${row.challenge.count}`:'No readings',row.boundary?'Yes':'No'].forEach(x=>tr.append(node('td',x)));tbody.append(tr);
    });table.append(tbody);wrap.append(table);results.append(wrap);
    if(!replay){const prepare=node('button','Use selected pairs in comparison draft');prepare.type='button';prepare.id='soil-search-prepare';prepare.addEventListener('click',()=>{
      try{if(!retained||retained.working!==JSON.stringify(getProject()))throw Error('Source changed; search again');const draft=soilSearchSelection(report,[...selected]);setDraft(draft);status.textContent='Selected pairs copied to the comparison draft. Run Compare soil explanations to compare both sites; no material parameter was adopted.';}catch(e){status.textContent=e.message;}
    });results.append(prepare,node('p','Select 2–9 tested pairs explicitly. Unselected alternatives remain in this full search; selecting pairs is not evidence that other compatible pairs are false.'));}
    const evidence=node('details');evidence.append(node('summary','Inspect every original reading and residual'));
    for(const row of report.candidates){const d=node('details');d.append(node('summary',`K ${fmt(row.conductivityMmHr)}, A ${fmt(row.capillaryDriveMm)}`));
      for(const role of ['calibration','challenge'])for(const error of row[role].errors){const reading=project.observations[error.index];d.append(node('p',`${role}: cell ${reading.cellIndex}, minute ${reading.minute}; original ${reading.depthMm} ± ${reading.uncertaintyMm} mm; predicted ${error.depthMm} mm; observed − predicted ${error.residualMm} mm; ${error.withinBand?'inside':'outside'} band. ${error.method==='snapshot'?'Saved model time':`Interpolated ${error.beforeMinute}–${error.afterMinute} min`}. Source: ${reading.source}`));}evidence.append(d);
    }results.append(evidence);
    mountSoilSearchResolution({container:results,project,query,isCurrent:()=>retained?.report===report&&retained.working===JSON.stringify(getProject())});
  }
  form.addEventListener('input',()=>clear('Search inputs changed. Search again.'));
  form.addEventListener('submit',event=>{event.preventDefault();clear('Searching declared pairs…');const epoch=generation,signature=JSON.stringify(getProject());setTimeout(()=>{if(epoch!==generation)return;try{if(signature!==JSON.stringify(getProject()))throw Error('Source changed; search again');const p=structuredClone(getProject()),q=read();show(p,q,searchSoilParameters(p,q));}catch(e){status.textContent='Search refused: '+e.message;}},0);});
  save.addEventListener('click',()=>{try{if(!retained||retained.working!==JSON.stringify(getProject()))throw Error('Source changed; search again');const text=serializeSoilSearch(retained.project,retained.query),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download='experimental-earth-soil-search.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}catch(e){status.textContent=e.message;}});
  section.querySelector('#soil-search-import').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;const epoch=++generation,signature=JSON.stringify(getProject());try{if(file.size>SOIL_SEARCH_FILE_LIMIT)throw Error('Soil search exceeds 5 MiB');const text=await file.text();if(epoch!==generation||signature!==JSON.stringify(getProject()))return;const {project,query}=parseSoilSearch(text);show(project,query,searchSoilParameters(project,query),true);}catch(e){if(epoch===generation)status.textContent='Reopen refused: '+e.message;}finally{if(epoch===generation)event.target.value='';}});
  return {refresh:clear};
}

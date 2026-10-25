import {mountObservedStorageChange} from './observed-storage-change-panel.js';
import {observedStorage} from './observed-storage.js';

export function mountObservedStorage({host,getProject,getResults,getScenario,getRole}) {
  const section=document.createElement('section');section.id='observed-storage';
  section.innerHTML=`<h4>How much standing water do these readings represent?</h4>
    <p class="mini-note">Use depths recorded at exactly the same minute and scenario. A point reading only represents a whole grid cell under your explicit assumption; no unobserved cell is filled with a modeled depth.</p>
    <label class="input-label">Exact recorded minute<select id="storage-minute"></select></label>
    <label class="input-label">Why can these readings represent their entire grid cells?<input id="storage-basis" maxlength="500" type="text"></label>
    <button id="storage-run" type="button">Compare observed volume bounds</button>
    <div id="storage-result" role="status" aria-live="polite"></div>
    <p class="mini-note">This conditional inventory does not verify cell representativeness, event identity, measurement truth or independence. An aggregate overlap can hide opposing local errors. Inspect the individual readings above; overlap does not calibrate or validate the model. The declaration is an unsaved query; original readings remain in project export.</p>`;
  host.append(section);
  const change=mountObservedStorageChange({host,getProject,getResults,getScenario,getRole});
  const minute=section.querySelector('#storage-minute'),basis=section.querySelector('#storage-basis'),output=section.querySelector('#storage-result');
  const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
  const fmt=n=>Number(n).toLocaleString('en-US',{maximumSignificantDigits:7});
  let requested=false;
  function render() {
    output.replaceChildren();
    if(!requested){output.dataset.state='not-compared';output.textContent='Declare the spatial assumption, then compare. Scenario and evidence role follow the evidence map above.';return;}
    try {
      if(minute.value==='')throw Error('No readings match the selected scenario and role');
      const p=getProject(),r=observedStorage(p,getResults(),{scenario:getScenario(),role:getRole(),minute:Number(minute.value),basis:basis.value});
      output.dataset.state=r.status;
      output.append(node('p',`${r.readingCount} original readings; ${r.cells.length}/${r.totalCells} distinct cells at ${fmt(r.minute)} min. Cell area ${fmt(r.areaM2)} m². ${r.missingCells} cells unobserved.`));
      if(r.status==='contradictory')output.append(node('p','Original bands conflict at this exact time. No aggregate volume or model agreement is reported.'));
      else if(r.status==='no-readings')output.append(node('p','No matching readings; water volume remains unknown.'));
      else {
        output.append(node('p',`Observed footprint: ${fmt(r.observedLiters.lower)}–${fmt(r.observedLiters.upper)} L. Whole site: at least ${fmt(r.siteLiters.lower)} L; ${r.siteLiters.upper===null?'no finite upper bound from these readings':`at most ${fmt(r.siteLiters.upper)} L`}.`));
        output.append(node('p',`Authored model on the same observed footprint: ${fmt(r.model.footprintLiters)} L (${r.model.relation} aggregate band); whole modeled site: ${fmt(r.model.siteLiters)} L. ${r.model.method}, solver brackets ${fmt(r.model.beforeMinute)}–${fmt(r.model.afterMinute)} min.`));
        output.append(node('p',`Cell-representativeness declaration: ${r.basis}`));
        output.append(node('p',`Model comparison numerical guard: ${r.model.numericalGuardLiters} L. Original observation bands are not widened.`));
      }
      const details=node('details','');details.append(node('summary','Inspect original cell bands and sources'));
      for(const c of r.cells){
        const label=`${String.fromCharCode(65+c.cellIndex%p.width)}${Math.floor(c.cellIndex/p.width)+1}`;
        details.append(node('p',`${label}: ${c.contradictory?'contradictory bands':`${fmt(c.lowerMm)}–${fmt(c.upperMm)} mm; ${fmt(c.lowerMm*r.areaM2)}–${fmt(c.upperMm*r.areaM2)} L`}. Counted once.`));
        for(const x of c.readings)details.append(node('p',`Notebook row ${x.index+1}: ${fmt(x.reading.depthMm)} ± ${fmt(x.reading.uncertaintyMm)} mm; ${x.reading.use??'unassigned'}; ${x.reading.source}`));
      }
      output.append(details);
    } catch(error){output.dataset.state='error';output.textContent=error.message;}
  }
  function refresh(){
    change.refresh();
    const old=minute.value,p=getProject(),times=[...new Set(p.observations.filter(r=>r.scenario===getScenario()&&(getRole()==='all'||(r.use??'unassigned')===getRole())).map(r=>r.minute))].sort((a,b)=>a-b);
    minute.replaceChildren();
    for(const t of times){const option=node('option',`${fmt(t)} min`);option.value=String(t);minute.append(option);}
    if(times.some(t=>String(t)===old))minute.value=old;
    requested=false;render();
  }
  section.querySelector('#storage-run').addEventListener('click',()=>{requested=true;render();});
  minute.addEventListener('change',()=>{requested=false;render();});basis.addEventListener('input',()=>{requested=false;render();});
  return {refresh};
}


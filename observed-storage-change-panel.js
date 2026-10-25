import {observedStorageChange} from './observed-storage-change.js';
export function mountObservedStorageChange({host,getProject,getResults,getScenario,getRole}) {
  const section=document.createElement('section');section.id='observed-storage-change';
  section.innerHTML=`<h4>How did observed standing water change?</h4><p>Compare original bands at two exact times on cells observed at both times. A change does not establish its cause.</p><label>Earlier minute <select id="storage-change-start"></select></label><label>Later minute <select id="storage-change-end"></select></label><label>Why do readings represent entire cells in the same event? <input id="storage-change-basis" maxlength="500"></label><button id="storage-change-run" type="button">Compare observed change</button><div id="storage-change-result" role="status" aria-live="polite"></div>`;
  host.append(section);
  const start=section.querySelector('#storage-change-start'),end=section.querySelector('#storage-change-end'),basis=section.querySelector('#storage-change-basis'),out=section.querySelector('#storage-change-result');
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const fmt=n=>Number(n).toLocaleString('en-US',{maximumSignificantDigits:7});
  function retire(){out.dataset.state='not-compared';out.textContent='Choose two recorded times and declare their spatial and event basis. Original readings remain in ordinary project export; this query is unsaved.';}
  function refresh(){
    const p=getProject(),times=[...new Set(p.observations.filter(r=>r.scenario===getScenario()&&(getRole()==='all'||(r.use??'unassigned')===getRole())).map(r=>r.minute))].sort((a,b)=>a-b);
    for(const select of [start,end]){const old=select.value;select.replaceChildren();for(const t of times){const option=node('option',`${t} min`);option.value=String(t);select.append(option);}if(times.some(t=>String(t)===old))select.value=old;}
    if(times.length>1&&start.value===end.value)end.value=String(times.at(-1));retire();
  }
  section.querySelector('#storage-change-run').addEventListener('click',()=>{
    out.replaceChildren();try {
      if(start.value===''||end.value==='')throw Error('Two recorded times are required');
      const r=observedStorageChange(getProject(),getResults(),{scenario:getScenario(),role:getRole(),startMinute:Number(start.value),endMinute:Number(end.value),basis:basis.value});out.dataset.state=r.status;
      if(r.status!=='bounded'){out.textContent=r.status==='contradictory'?'Original bands conflict. No change aggregate is reported.':'No cell has matching original readings at both times; change remains unknown.';return;}
      out.append(node('p',`${r.cells.length}/${r.before.totalCells} cells observed at both times. After minus before: ${fmt(r.observedChangeLiters.lower)} to ${fmt(r.observedChangeLiters.upper)} L on this common footprint.`));
      out.append(node('p',r.siteChangeLiters?`Whole-site change: ${fmt(r.siteChangeLiters.lower)} to ${fmt(r.siteChangeLiters.upper)} L.`:'Whole-site change remains unknown: missing cells are not filled with modeled water.'));
      out.append(node('p',r.interpretation));
      const details=node('details','');details.append(node('summary','Inspect paired original sources'));
      for(const cell of r.cells){details.append(node('p',`Cell ${cell.cellIndex+1}: ${fmt(cell.lowerLiters)} to ${fmt(cell.upperLiters)} L change.`));for(const [label,part] of [['Earlier',cell.before],['Later',cell.after]])for(const row of part.readings)details.append(node('p',`${label}, notebook row ${row.index+1}: ${row.reading.depthMm} ± ${row.reading.uncertaintyMm} mm; ${row.reading.use??'unassigned'}; ${row.reading.source}`));}out.append(details);
    }catch(error){out.dataset.state='error';out.textContent=error.message;}
  });
  start.addEventListener('change',retire);end.addEventListener('change',retire);basis.addEventListener('input',retire);
  return {refresh};
}

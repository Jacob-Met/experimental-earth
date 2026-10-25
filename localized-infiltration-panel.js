import {compareLocalizedInfiltration,serializeLocalizedReceipt,reopenLocalizedReceipt} from './localized-infiltration.js';
import {SURFACES} from './core.js';
import {checkProjectFileBytes} from './project-portability.js';
export function mountLocalizedInfiltration({host,getProject}){
 const section=document.createElement('section');section.id='localized-infiltration';
 section.innerHTML=`<h4>Could one place absorb rain differently?</h4>
 <p>Compare each declared rate across the entire selected material with that rate at one explicitly selected cell. Every other cell in the localized alternative keeps its current material default. These alternatives can change both spatial pattern and total capacity. This tests an explicit spatial explanation; it does not locate or identify actual soil properties.</p>
 <label class="input-label">Observed scenario<select id="localized-scenario"><option value="existing">Existing</option><option value="proposal">Proposal</option></select></label>
 <label class="input-label">Cell with a possible local departure<input id="localized-cell" value="A1" maxlength="3"></label>
 <label class="input-label">Two to nine explicit rates (mm/h, comma separated)<input id="localized-rates" value="1, 8.5, 31" maxlength="100"></label>
 <label class="input-label">Why compare this local explanation?<input id="localized-basis" maxlength="500"></label>
 <p id="localized-defaults" class="mini-note"></p>
 <button id="localized-run" type="button">Compare uniform and localized rates</button>
 <button id="localized-export" type="button" disabled>Download original investigation</button>
 <label class="input-label">Reopen original investigation<input id="localized-import" type="file" accept=".json,application/json"></label>
 <p id="localized-status" role="status" aria-live="polite"></p><div id="localized-results"></div>
 <p class="mini-note">Only calibration readings determine ordering. Held-aside readings challenge fixed alternatives; they never choose a cell or rate. Missing local observations, a dry event or weak coupling can leave alternatives indistinguishable. A retained alternative is not proof of heterogeneity: geometry, forcing, timing, initial water and omitted physics can also explain disagreement. These rate alternatives retain the default unlimited receiving sink; separate closed-store investigations are not applied. No rate is adopted.</p>`;
 host.append(section);
 const $=id=>section.querySelector('#'+id),node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;},fmt=n=>n===null?'not available':Number(n).toLocaleString('en-US',{maximumSignificantDigits:7});
 $('localized-defaults').textContent='Outside the selected cell, localized alternatives retain '+Object.entries(SURFACES).map(([k,v])=>k+' '+v.infiltrationMmHr+' mm/h').join('; ')+'. Uniform alternatives replace every cell of the selected cell’s material.';
 let serial=0,lastSource='',report=null,source=null;
 function clear(message='Inputs changed; compare again.'){report=null;source=null;$('localized-export').disabled=true;$('localized-results').replaceChildren();$('localized-status').dataset.state='not-compared';$('localized-status').textContent=message;}
 function form(p){
  const match=/^([A-X])([1-9]|1[0-9]|2[0-4])$/.exec($('localized-cell').value.trim().toUpperCase());if(!match)throw Error('Enter a cell label such as A1');
  const x=match[1].charCodeAt(0)-65,y=Number(match[2])-1;if(x>=p.width||y>=p.height)throw Error('Selected cell lies outside this project');
  const tokens=$('localized-rates').value.split(',').map(s=>s.trim());if(tokens.some(s=>!s))throw Error('Enter each rate explicitly');
  return {target:$('localized-scenario').value,cellIndex:y*p.width+x,ratesMmHr:tokens.map(Number),basis:$('localized-basis').value};
 }
 function display(p,r,label){
  source=structuredClone(p);report=r;$('localized-export').disabled=false;
  $('localized-status').dataset.state=r.status;$('localized-status').textContent=label+': '+r.status+'. '+r.compatibleIds.length+' calibration-compatible; '+r.survivingIds.length+' retained after available held-aside readings. '+r.counts.calibration+' calibration / '+r.counts.challenge+' held aside / '+r.counts.ignored+' ignored.';
  const out=$('localized-results');out.replaceChildren();
  const cell=String.fromCharCode(65+r.query.cellIndex%p.width)+(Math.floor(r.query.cellIndex/p.width)+1);
  out.append(node('p',`Declared local cell ${cell}, material ${r.surface}, cell area ${fmt(r.cellAreaM2)} m²; basis: ${r.query.basis}. Full family ${r.candidates.length} alternatives; ${r.work.toLocaleString()} model cell-steps.`));
  if(!r.counts.challenge)out.append(node('p','No held-aside readings: remaining alternatives have not faced an independent challenge in this investigation.'));
  for(const c of r.candidates){
   const detail=node('details','');detail.dataset.candidateId=c.id;
   const compatibility=e=>e.compatible===null?'no assigned readings':e.compatible?'within every band':'outside at least one band';
   detail.append(node('summary',`${c.scope} ${fmt(c.rateMmHr)} mm/h · calibration: ${compatibility(c.calibration)} · held aside: ${compatibility(c.challenge)}`));
   detail.append(node('p',`${c.affectedCells} cell(s) receive this candidate rate; nominal whole-site capacity ${fmt(c.declaredCapacityLitersPerHour)} L/h (not actual uptake); calibration RMSE ${fmt(c.calibration.rmseMm)} mm. Absorbed ${fmt(c.absorbedLiters)} L, edge exit ${fmt(c.exitLiters)} L, final storage ${fmt(c.storedLiters)} L; water-account residual ${c.massErrorLiters} L.`));
   for(const [role,evidence] of [['calibration',c.calibration],['held aside',c.challenge]])for(const error of evidence.errors){
    const reading=r.readings.find(x=>x.index===error.index).reading;
    detail.append(node('p',`Notebook row ${error.index+1}, ${role}, ${fmt(reading.minute)} min: original ${fmt(reading.depthMm)} ± ${fmt(reading.uncertaintyMm)} mm; predicted ${fmt(error.depthMm)} mm; observed − predicted ${fmt(error.residualMm)} mm; ${error.withinBand?'within band':'outside band'}. ${error.method}, solver brackets ${fmt(error.beforeMinute)}–${fmt(error.afterMinute)} min. Source: ${reading.source}`));
   }
   out.append(detail);
  }
 }
 function invalidate(){serial++;clear();}
 for(const id of ['localized-scenario','localized-cell','localized-rates','localized-basis'])$(id).addEventListener('input',invalidate);
 $('localized-run').addEventListener('click',()=>{const token=++serial,p=structuredClone(getProject());let q;try{q=form(p);}catch(e){clear(e.message);$('localized-status').dataset.state='error';return;}
  const signature=JSON.stringify(getProject());clear('Comparing the complete declared family…');$('localized-run').disabled=true;
  setTimeout(()=>{try{if(token!==serial||signature!==JSON.stringify(getProject()))return;const r=compareLocalizedInfiltration(p,q);if(token===serial&&signature===JSON.stringify(getProject()))display(p,r,'Current original source');}catch(e){if(token===serial){clear(e.message);$('localized-status').dataset.state='error';}}finally{$('localized-run').disabled=false;}},20);
 });
 $('localized-export').addEventListener('click',()=>{try{if(!report||!source)throw Error('Compare or reopen an investigation first');const text=serializeLocalizedReceipt(source,report.query),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='earth-localized-infiltration.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('localized-status').textContent=e.message;$('localized-status').dataset.state='error';}});
 $('localized-import').addEventListener('change',async()=>{const token=++serial,file=$('localized-import').files[0],signature=JSON.stringify(getProject());if(!file)return;clear('Reading original investigation…');try{checkProjectFileBytes(file.size);const text=await file.text();if(token!==serial||signature!==JSON.stringify(getProject()))return;const loaded=reopenLocalizedReceipt(text);if(token===serial&&signature===JSON.stringify(getProject()))display(loaded.receipt.project,loaded.report,'Isolated reopened source (working project unchanged)');}catch(e){if(token===serial){clear(e.message);$('localized-status').dataset.state='error';}}finally{if(token===serial)$('localized-import').value='';}});
 return {refresh(){const signature=JSON.stringify(getProject());if(signature!==lastSource){lastSource=signature;serial++;clear('Source changed; compare the current original evidence or reopen an investigation.');}}};
}

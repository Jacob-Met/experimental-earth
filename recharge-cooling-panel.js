import {RECHARGE_COOLING_SCHEMA,RECHARGE_COOLING_MEANING,compareRechargeCooling,inspectRechargeCooling,serializeRechargeCooling,parseRechargeCooling} from './recharge-cooling.js';
import {COOLING_FILE_LIMIT} from './evaporative-cooling.js';
import {rechargeCoolingExample} from './recharge-cooling-example.js';
const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const fmt=n=>Number(n).toLocaleString('en-US',{maximumSignificantDigits:6});
const names={existing:'Existing place',proposal:'Proposed place'};
export function mountRechargeCooling({host,getCooling}){
 host.classList.add('rc-study');
 host.innerHTML='<h3>What changes when water arrives throughout the rain?</h3><p>Keep the same water, heat and plant-demand declarations, and explicitly align the heat clock with the beginning of the original rain event. Compare its native infiltration intervals with holding that water until the event ends.</p><div class="ec-actions"><button id="rc-use" type="button">Retain these water and heat declarations</button><button id="rc-example" type="button">Explore fictional during-rain example</button></div><p id="rc-source" class="ec-note"></p><form id="rc-form" hidden><label class="input-label">Source or hypothetical basis for thermal minute zero being the original rain-event start<textarea id="rc-clock" maxlength="600" rows="3" required></textarea></label><button id="rc-run" class="primary" type="submit">Compare when recharge arrives</button></form><p id="rc-status" role="status"></p><div id="rc-results"></div><div class="ec-actions"><button id="rc-save" type="button" disabled>Save original recharge-timing investigation</button><label class="input-label">Reopen original recharge-timing investigation<input id="rc-open" type="file" accept=".json,application/json"></label></div>';
 const $=id=>host.querySelector('#rc-'+id);let retained=null,accepted=null,generation=0,selected='existing',minute=0;
 const status=(message,state)=>{$('status').textContent=message;$('status').dataset.state=state;};
 function invalidate(message){generation++;accepted=null;$('save').disabled=true;$('results').replaceChildren();status(message,'draft');}
 function fill(bundle){
  retained=structuredClone(bundle);$('clock').value=bundle.study.clockSource;$('form').hidden=false;
  $('source').textContent='Retained original: '+bundle.project.title+' · rain event '+fmt(bundle.project.weather.durationMinutes)+' min · cell '+(bundle.study.cooling.heatColumn.heatStudy.cellIndex+1)+'. Water, thermal exposure and demand belong to this original source.';
 }
 function plot(result,side,field,label){
  const width=host.clientWidth<650?360:760,left=55,right=width-18;
  const chart=svg('svg',{viewBox:'0 0 '+width+' 220',role:'img','aria-label':label});chart.classList.add('ec-plot');
  const values=result.trajectory.flatMap(r=>[r[side].interval[field],r[side].latePulse[field]]),lo=Math.min(...values),hi=Math.max(...values);
  const span=Math.max(.1,hi-lo),bottom=field==='availableMm'?0:lo-.08*span,top=hi+.08*span;
  const x=t=>left+(right-left)*t/result.durationMinutes,y=v=>185-155*(v-bottom)/(top-bottom||1);
  for(let i=0;i<5;i++){const value=bottom+(top-bottom)*i/4;chart.append(svg('line',{x1:left,x2:right,y1:y(value),y2:y(value),stroke:'#dfe6dd'}));const label=svg('text',{x:left-7,y:y(value)+4,'text-anchor':'end','font-size':11,fill:'#4c5e53'});label.textContent=fmt(value);chart.append(label);}
  for(const[kind,color]of [['interval','#42714d'],['latePulse','#ae632c']]){
   const parts=[];result.trajectory.forEach((row,i)=>{
    if(field==='availableMm'&&kind==='latePulse'&&row.minute===result.eventMinutes&&result[side].latePulse.beforePulse)parts.push('L'+x(row.minute)+','+y(result[side].latePulse.beforePulse.availableMm));
    parts.push((i?'L':'M')+x(row.minute)+','+y(row[side][kind][field]));
   });
   chart.append(svg('path',{d:parts.join(' '),fill:'none',stroke:color,'stroke-width':2.5,...(kind==='latePulse'?{'stroke-dasharray':'7 4'}:{})}));
  }
  chart.append(svg('line',{x1:x(result.eventMinutes),x2:x(result.eventMinutes),y1:25,y2:185,stroke:'#68766c','stroke-dasharray':'2 4'}));
  for(const t of [...new Set([0,result.eventMinutes,result.durationMinutes])]){const label=svg('text',{x:x(t),y:207,'text-anchor':t===0?'start':t===result.durationMinutes?'end':'middle','font-size':11,fill:'#4c5e53'});label.textContent=fmt(t)+' min';chart.append(label);}
  return chart;
 }
 function draw(){
  if(!accepted)return;const {result}=accepted,row=inspectRechargeCooling(result,minute)[selected];
  $('plots').replaceChildren(el('h4','Thermal surface · °C'),plot(result,selected,'surfaceC','Original interval recharge and event-end pulse surface temperatures'),el('h4','Available rooted water · mm'),plot(result,selected,'availableMm','Original interval recharge and event-end pulse rooted water'));
  $('at').textContent=names[selected]+' at '+fmt(minute)+' minutes';$('at').dataset.minute=minute;
  $('minute').value=minute;$('range').value=minute;
  const body=$('account').tBodies[0];body.replaceChildren();
  const fields=[['rechargeMm','Rain admitted to roots so far · mm',1],['availableMm','Water available now · mm',1],['drainageMm','Root-store excess drainage · mm',1],['suppliedMm','Supplied plant transpiration · mm',1],['unmetMm','Unmet potential demand · mm',1],['surfaceC','Thermal surface · °C',1],['subsurfaceC','Lower heat store · °C',1],['surfaceMeanC','Mean surface since event start · °C',1],['inputJm2','Absorbed heat input · MJ/m²',1e6],['surfaceLossJm2','Latent loss from this surface · MJ/m²',1e6],['unmodeledLatentSupplyJm2','Latent energy from unresolved surroundings · MJ/m²',1e6],['exchangeOutJm2','Ambient exchange out · MJ/m²',1e6],['totalStoredJm2','Change in stored heat · MJ/m²',1e6],['waterResidualMm','Water accounting residual · mm',1],['latentResidualJm2','Independent water–latent residual · J/m²',1],['energyResidualJm2','Heat accounting residual · J/m²',1]];
  for(const[field,label,scale]of fields){const tr=el('tr'),th=el('th',label);th.scope='row';tr.dataset.quantity=field;tr.append(th);for(const kind of ['interval','latePulse']){const cell=el('td',fmt(row[kind][field]/scale));cell.dataset.value=row[kind][field];cell.dataset.kind=kind;tr.append(cell);}body.append(tr);}
  $('difference').textContent='Interval recharge minus event-end pulse at this time: '+fmt(row.differenceC)+' °C. The sign can change later as the remaining water and stored heat differ.';
 }
 function render(bundle,result){
  accepted={...structuredClone(bundle),result};minute=result.durationMinutes;selected='existing';const out=$('results');out.replaceChildren();
  const cards=el('div');cards.className='ec-pair';
  for(const side of ['existing','proposal']){const card=el('div');card.className='ec-card';card.append(el('strong',names[side]),el('p','Original native infiltration: '+fmt(result[side].originalRechargeMm)+' mm across '+result[side].originalIntervals.length+' intervals.'),el('p','At '+fmt(result.durationMinutes)+' min: '+fmt(result.final[side].interval.surfaceC)+' °C with interval recharge; '+fmt(result.final[side].latePulse.surfaceC)+' °C with the event-end pulse.'));cards.append(card);}out.append(cards);
  const controls=el('div');controls.className='ec-inspection rc-inspection';controls.innerHTML='<label class="input-label">Place to inspect<select id="rc-side"><option value="existing">Existing place</option><option value="proposal">Proposed place</option></select></label><label class="input-label">Minutes from original rain-event start<input id="rc-range" type="range" min="0" step=".1"></label><label class="input-label">Exact minute<input id="rc-minute" type="number" min="0" step="any"></label>';
  out.append(controls,el('p','Green solid: native interval recharge. Orange dashed: the same water held until event end. The vertical marker is event end. Curves join minute samples and original forcing boundaries; exact-time inspection does not interpolate those samples.'));
  const plots=el('div');plots.id='rc-plots';out.append(plots);const title=el('h4');title.id='rc-at';const difference=el('p');difference.id='rc-difference';out.append(title,difference);
  const scroll=el('div');scroll.className='ec-scroll';const table=el('table');table.id='rc-account';table.className='ec-table';table.innerHTML='<thead><tr><th scope="col">Original water and thermal account</th><th scope="col">Interval recharge</th><th scope="col">Event-end pulse</th></tr></thead><tbody></tbody>';scroll.append(table);out.append(scroll,el('p','At the event-end instant the pulse water is admitted to the rooted store immediately. Temperatures and earlier latent heat remain continuous; the pulse does not cool the past.'));
  const sources=el('details');sources.className='ec-sources';sources.append(el('summary','Retained original sources and clock association'),el('p',bundle.project.source??''),el('p',bundle.study.clockSource),el('p',bundle.study.cooling.associationSource),el('p',bundle.study.cooling.latentHeatSource));
  const c=bundle.study.cooling;for(const side of ['existing','proposal']){sources.append(el('p',names[side]+': '+c.roots[side].source+' Capacity '+fmt(result[side].interval.capacityMm)+' mm; initial '+fmt(result[side].interval.initialAvailableMm)+' mm; surface latent fraction '+fmt(c.surfaceLatentFraction[side])+'.'),el('p',c.heatColumn.heatStudy[side].source),el('p',c.heatColumn.lowerLayers[side].source));}
  let elapsed=0;c.heatColumn.heatStudy.schedule.forEach((f,i)=>{sources.append(el('p',fmt(elapsed)+'–'+fmt(elapsed+f.minutes)+' min: '+fmt(f.incidentWm2)+' W/m², ambient '+fmt(f.reservoirC)+' °C; demand '+fmt(c.demands[i].potentialTranspirationMmPerDay)+' mm/day. '+f.source+' '+c.demands[i].source));elapsed+=f.minutes;});out.append(sources,el('p',RECHARGE_COOLING_MEANING));
  $('side').onchange=()=>{selected=$('side').value;draw();};
  for(const id of ['range','minute']){$(id).max=result.durationMinutes;$(id).value=minute;$(id).addEventListener(id==='range'?'input':'change',()=>{const value=Number($(id).value);if($(id).value.trim()&&Number.isFinite(value)&&value>=0&&value<=result.durationMinutes){minute=value;draw();}});}
  $('save').disabled=false;draw();
 }
 $('use').onclick=()=>{invalidate('');const current=getCooling();if(!current){status('First compare and retain the water and heat declarations above.','draft');return;}fill({project:current.project,study:{schema:RECHARGE_COOLING_SCHEMA,cooling:current.study,clockSource:''}});status('Original declarations retained separately. Declare their common event-start clock.','draft');};
 $('example').onclick=()=>{invalidate('Fictional interval-recharge example loaded. Its timing is an authored assumption.');fill(rechargeCoolingExample());};
 $('clock').oninput=()=>invalidate('Clock association changed. Compare again.');
 $('form').onsubmit=e=>{e.preventDefault();generation++;try{const bundle={project:structuredClone(retained.project),study:{...structuredClone(retained.study),clockSource:$('clock').value}};render(bundle,compareRechargeCooling(bundle.project,bundle.study));status('Original interval recharge and event-end pulse recomputed under the same declared thermal clock.','computed');}catch(error){invalidate('');status(error.message,'refused');}};
 $('save').onclick=()=>{if(!accepted)return;const text=serializeRechargeCooling(accepted.project,accepted.study),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=el('a');a.href=url;a.download='experimental-earth-recharge-cooling-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('open').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const token=++generation;try{if(file.size>COOLING_FILE_LIMIT)throw Error('Recharge cooling file exceeds 5 MiB');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(token!==generation)return;const bundle=parseRechargeCooling(text),result=compareRechargeCooling(bundle.project,bundle.study);if(token!==generation)return;fill(bundle);render(bundle,result);status('Original recharge-timing investigation reopened and independently recomputed.','reopened');}catch(error){if(token===generation){accepted=null;$('results').replaceChildren();$('save').disabled=true;status('Reopen refused: '+error.message,'refused');}}finally{if(token===generation)e.target.value='';}};
 return {refresh(){ $('use').disabled=!getCooling();if(!retained)$('source').textContent='Retain original declarations above, open a saved investigation, or explore a separate fictional example.'; }};
}

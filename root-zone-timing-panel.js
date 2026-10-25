import {compareRootZoneTiming,rootZoneTimingAtDay,serializeRootZoneTiming,parseRootZoneTiming} from './root-zone-timing.js';
import {checkRootZoneFileBytes} from './root-zone-study.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const svg=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const fmt=n=>n!==0&&(Math.abs(n)<.0001||Math.abs(n)>1e7)?Number(n).toExponential(3):Number(n).toLocaleString('en-US',{maximumSignificantDigits:6});
export function mountRootZoneTiming({host,getInputs,installInputs,cancelParentPending}){
 const section=node('section');section.id='rz-timing';section.className='rz-factors';
 section.innerHTML='<span class="eyebrow">WATER / DURING AND AFTER THE EVENT</span><h3>Does the timing of recharge change the rooted-water account?</h3>'+
 '<p>Use the rooted-store and dry-period declarations above. Follow the original simulator’s infiltration totals, spread uniformly within each calculation interval. Compare the same total arriving as one pulse at event end. Both timing choices receive the same separately declared event transpiration.</p>'+
 '<form id="rzt-form"><div class="rz-pair"><label class="input-label">Potential transpiration during the complete event · mm/day<input id="rzt-demand" type="number" min="0" max="30" step="any" required></label>'+
 '<label class="input-label">Source or hypothetical basis for event demand<input id="rzt-source" type="text" maxlength="500" required></label></div>'+
 '<div class="rz-actions"><button id="rzt-example" type="button">Use hypothetical event demand</button><button id="rzt-run" type="submit" class="primary">Compare recharge timing</button></div></form>'+
 '<p class="rz-note">The source site starts with no surface water. Native interval timing is a numerical assumption, not a measured flux history. This comparison keeps the full rooted-store declaration and dry demand fixed. It does not feed rooted storage back into surface infiltration.</p>'+
 '<p id="rzt-status" role="status"></p><div id="rzt-results"></div>'+
 '<div class="rz-actions"><button id="rzt-save" type="button" disabled>Save original timing investigation</button><label class="input-label">Reopen timing investigation<input id="rzt-open" type="file" accept=".json,application/json"></label></div>';
 host.append(section);const $=id=>section.querySelector('#rzt-'+id);let accepted=null,generation=0,busy=false;
 const status=(text,state)=>{$('status').textContent=text;$('status').dataset.state=state;};
 function invalidate(message='Timing draft changed. Compare again.'){generation++;busy=false;accepted=null;$('results').replaceChildren();$('save').disabled=true;$('run').disabled=false;status(message,'draft');}
 function cancelPending(){const wasBusy=busy;generation++;busy=false;$('run').disabled=false;$('save').disabled=!accepted;if(wasBusy)status('Pending timing work retired by a newer source action.',accepted?'computed':'draft');}
 function readDemand(){if(!$('demand').value.trim())throw Error('Declare a separate event transpiration demand');return {potentialTranspirationMmPerDay:Number($('demand').value),source:$('source').value};}
 function fillDemand(d){$('demand').value=String(d.potentialTranspirationMmPerDay);$('source').value=d.source;}
 function install(input,report){accepted={...input,report};draw();$('save').disabled=false;}
 function inspect(){
  if(!accepted)return;const report=accepted.report,side=$('side').value,selected=report[side],day=Number($('day').value);
  const timed=rootZoneTimingAtDay(selected.interval,day),pulse=rootZoneTimingAtDay(selected.latePulse,day);
  $('range').value=String(day);
  $('at').textContent='Elapsed day '+fmt(day)+' from event start · '+(day<selected.interval.eventDays?'during the event':'dry period, '+fmt(day-selected.interval.eventDays)+' days after event end')+'.';
  $('account').replaceChildren();
  for(const [key,label]of [['rechargeMm','Recharge delivered by this time'],['drainageMm','Excess drainage by this time'],['potentialMm','Potential transpiration by this time'],['suppliedMm','Supplied transpiration by this time'],['unmetMm','Unmet transpiration demand'],['availableMm','Available rooted water'],['balanceErrorMm','Water-account residual']]){
   const row=node('tr'),th=node('th',label+' · mm');th.scope='row';row.dataset.quantity=key;row.append(th);
   for(const kind of ['interval','latePulse']){const value=(kind==='interval'?timed:pulse)[key],td=node('td',fmt(value));td.dataset.kind=kind;td.dataset.value=String(value);row.append(td);}$('account').append(row);
  }
  $('difference').textContent='Interval timing minus the matched end pulse: '+fmt(timed.availableMm-pulse.availableMm)+' mm available; '+fmt(timed.suppliedMm-pulse.suppliedMm)+' mm supplied transpiration; '+fmt(timed.drainageMm-pulse.drainageMm)+' mm drainage. Signs describe this declared model and are not a recommendation.';
  $('original').textContent=(side==='existing'?'Existing':'Proposed')+' original cell: '+selected.originalCell.surface+' · '+selected.originalCell.provenance+'. Complete native infiltration: '+fmt(selected.originalBudget.absorbedLiters)+' L / '+fmt(report.cellAreaM2)+' m². Rooted store: '+report.study[side].source+'. Event demand: '+report.demand.source;
  drawChart(selected,day);
 }
 function drawChart(selected,day){
  const chart=$('chart');chart.replaceChildren();const p=selected.interval,extent=$('extent').value==='event'?p.eventDays:p.totalDays;
  const xx=d=>60+600*d/extent,yy=v=>245-210*v/Math.max(1,p.capacityMm);
  for(let k=0;k<=4;k++){const v=p.capacityMm*k/4;chart.append(svg('line',{x1:60,x2:660,y1:yy(v),y2:yy(v),stroke:'#dce6df'}));const t=svg('text',{x:53,y:yy(v)+4,'text-anchor':'end'});t.textContent=fmt(v);chart.append(t);}
  for(const [kind,color,dash]of [['interval','#a65b26',''],['latePulse','#167c68','8 4']]){
   const profile=selected[kind],times=new Set([0,extent,p.eventDays]);
   for(const row of p.intervals)for(const minute of [row.startMinute,(row.startMinute+row.endMinute)/2,row.endMinute])if(minute/1440<=extent)times.add(minute/1440);
   if(extent>p.eventDays)for(let k=1;k<=80;k++)times.add(p.eventDays+(extent-p.eventDays)*k/80);
   const points=[];for(const d of [...times].filter(t=>t<=extent).sort((a,b)=>a-b)){
    if(kind==='latePulse'&&d===p.eventDays)points.push(xx(d)+','+yy(profile.eventBeforePulse.availableMm));
    points.push(xx(d)+','+yy(rootZoneTimingAtDay(profile,d).availableMm));
   }
   chart.append(svg('polyline',{points:points.join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':dash}));
  }
  if(p.eventDays<extent)chart.append(svg('line',{x1:xx(p.eventDays),x2:xx(p.eventDays),y1:25,y2:245,stroke:'#52685e','stroke-dasharray':'2 4'}));
  if(day<=extent)chart.append(svg('line',{x1:xx(day),x2:xx(day),y1:25,y2:245,stroke:'#243e34','stroke-width':1.5}));
  for(let k=0;k<=4;k++){const t=svg('text',{x:xx(extent*k/4),y:269,'text-anchor':'middle'});t.textContent=fmt($('extent').value==='event'?extent*1440*k/4:extent*k/4);chart.append(t);}
  const yl=svg('text',{x:12,y:18});yl.textContent='Available rooted water · mm';chart.append(yl);
  const xl=svg('text',{x:360,y:293,'text-anchor':'middle'});xl.textContent=$('extent').value==='event'?'Minutes from event start':'Days from event start';chart.append(xl);
 }
 function draw(){
  const r=accepted.report,total=r.existing.interval.totalDays,event=r.existing.interval.eventDays,host=$('results');host.replaceChildren();
  const controls=node('div');controls.className='rz-pair';controls.innerHTML='<label class="input-label">Original site case<select id="rzt-side"><option value="existing">Existing</option><option value="proposal">Proposed</option></select></label>'+
   '<label class="input-label">Graph window<select id="rzt-extent"><option value="event">During the complete event</option><option value="whole">Event and dry period</option></select></label>';host.append(controls);
  const fig=node('figure'),chart=svg('svg',{viewBox:'0 0 700 305',role:'img','aria-label':'Rooted water during original infiltration intervals compared with a matched pulse at event end'});chart.id='rzt-chart';fig.append(chart,node('figcaption','Solid amber: infiltration within native intervals. Dashed green: identical total delayed to event end, including its instantaneous jump. Both use the same event demand. Graph lines are display samples; the time inspector recomputes the declared solution.'));host.append(fig);
  const time=node('div');time.className='rz-time';time.innerHTML='<label class="input-label">Inspect elapsed day from event start<input id="rzt-day" type="number" min="0" step="any"></label><label class="input-label">Move through the entire course<input id="rzt-range" type="range" min="0"></label><button id="rzt-boundary" type="button">Inspect event end</button><p id="rzt-at" aria-live="polite"></p>';host.append(time);
  $('day').max=$('range').max=String(total);$('range').step=String(total/1000);$('day').value=String(event);
  const table=node('table');table.className='rz-table';table.id='rzt-table';table.innerHTML='<caption>Water account for the selected site and elapsed time</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Within native intervals</th><th scope="col">Matched end pulse</th></tr></thead><tbody id="rzt-account"></tbody>';host.append(table);
  const diff=node('p');diff.id='rzt-difference';host.append(diff);
  const detail=node('details');detail.append(node('summary','Original cell, declarations and every infiltration interval'));const original=node('p');original.id='rzt-original';detail.append(original);
  detail.append(node('p','The earlier whole-event pulse investigation assumes no transpiration during the event. A zero event-demand declaration recovers that profile; positive demand changes that assumption explicitly. No further rain, soil evaporation, irrigation or soil feedback is introduced.'));
  const intervals=node('pre');intervals.className='rz-timing-record';intervals.textContent=JSON.stringify({eventDemand:r.demand,existing:r.existing.interval.intervals.map(({startMinute,endMinute,rechargeMm})=>({startMinute,endMinute,rechargeMm})),proposal:r.proposal.interval.intervals.map(({startMinute,endMinute,rechargeMm})=>({startMinute,endMinute,rechargeMm}))},null,2);detail.append(intervals);host.append(detail);
  $('side').onchange=inspect;$('extent').onchange=inspect;
  $('range').oninput=()=>{$('day').value=$('range').value;inspect();};
  $('day').onchange=()=>{const d=Number($('day').value);if($('day').value.trim()&&Number.isFinite(d)&&d>=0&&d<=total)inspect();};
  $('boundary').onclick=()=>{$('day').value=String(event);inspect();};inspect();
 }
 $('form').oninput=()=>invalidate();
 $('example').onclick=()=>{fillDemand({potentialTranspirationMmPerDay:12,source:'Hypothetical constant event transpiration of 12 mm/day; no soil evaporation or field calibration.'});invalidate();};
 $('form').onsubmit=e=>{
  e.preventDefault();let input;try{input={...getInputs(),demand:readDemand()};}catch(error){status(error.message,'refused');return;}
  cancelParentPending();const token=++generation;busy=true;$('run').disabled=true;$('save').disabled=true;status('Computing original interval infiltration and both timing choices…','pending');
  setTimeout(()=>{if(token!==generation)return;try{const report=compareRootZoneTiming(input.project,input.study,input.demand);install(input,report);status('Timing comparison recomputed from original inputs. Active site unchanged.','computed');}
   catch(error){accepted=null;$('results').replaceChildren();status(error.message,'refused');}
   finally{if(token===generation){busy=false;$('run').disabled=false;$('save').disabled=!accepted;}}},10);
 };
 $('save').onclick=()=>{if(!accepted||busy)return;try{const text=serializeRootZoneTiming(accepted.project,accepted.study,accepted.demand),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download='experimental-earth-root-zone-timing.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){status(error.message,'refused');}};
 $('open').onchange=async()=>{
  const file=$('open').files?.[0];if(!file)return;cancelParentPending();const token=++generation;busy=true;$('run').disabled=true;$('save').disabled=true;status('Checking original timing investigation…','opening');
  try{checkRootZoneFileBytes(file.size);const bytes=await file.arrayBuffer();if(token!==generation)return;
   const input=parseRootZoneTiming(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),report=compareRootZoneTiming(input.project,input.study,input.demand);
   if(token!==generation)return;installInputs(input.project,input.study);fillDemand(input.demand);install(input,report);status('Recomputed original timing investigation. Active site unchanged.','reopened');
  }catch(error){if(token===generation)status(error.message+' Previous accepted comparison retained.','refused');}
  finally{if(token===generation){busy=false;$('run').disabled=false;$('save').disabled=!accepted;$('open').value='';}}
 };
 status('Declare the event demand, then compare the rooted-store inputs above.','draft');return {invalidate,cancelPending};
}

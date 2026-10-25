import {mountRootZoneTiming} from './root-zone-timing-panel.js';
import {serializeRootZoneInvestigation, parseRootZoneInvestigation, checkRootZoneFileBytes, ROOT_ZONE_MEANING} from './root-zone-study.js';
import {rootZoneAtDay} from './root-zone.js';
import {compareRootZoneFactors} from './root-zone-factors.js';
import {mountRootZoneFactors} from './root-zone-factors-panel.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const svg=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const fmt=n=>n!==0 && (Math.abs(n)<0.0001 || Math.abs(n)>=1e7) ? Number(n).toExponential(3) : Number(n).toLocaleString('en-US',{maximumSignificantDigits:5});
const name=(p,i)=>String.fromCharCode(65+i%p.width)+(Math.floor(i/p.width)+1);
const sides=['existing','proposal'];
const fields=[['fieldCapacity','Water fraction at field capacity · m³/m³',0,1],['wiltingPoint','Water fraction at wilting point · m³/m³',0,1],
 ['rootDepthM','Rooting depth · m',.001,10],['initialAvailableMm','Available water before recharge · mm',0,10000],['depletionFraction','Fraction depleted before demand is reduced · 0–1',0,1]];
export function mountRootZone({getProject}) {
 const link=node('link');link.rel='stylesheet';link.href=new URL('./root-zone.css',import.meta.url);document.head.append(link);
 const panel=node('section');panel.id='root-zone';panel.className='panel study';
 panel.innerHTML='<span class="eyebrow">WATER / AFTER THE RAIN</span><h2>How long does water remain available to roots?</h2>'+
  '<p>Follow the water that enters the ground at one modeled cell into a declared rooted soil store. Compare the two places through the same dry spell.</p>'+
  '<p id="rz-place" class="rz-note"></p><div class="rz-actions"><button id="rz-current" type="button">Use current site</button><button id="rz-example" type="button">Load fictional soil and dry-spell draft</button></div>'+
  '<form id="rz-form"><label class="input-label">Cell in this original site<select id="rz-cell"></select></label>'+
  '<label class="input-label">Why does this cell’s modeled infiltration supply the rooted soil?<textarea id="rz-association" rows="2" maxlength="500" required></textarea></label>'+
  '<div class="rz-pair">'+sides.map(side=>'<fieldset><legend>'+ (side==='existing'?'Existing rooted store':'Proposed rooted store')+'</legend>'+
   fields.map(([key,label,min,max])=>'<label class="input-label">'+label+'<input id="rz-'+side+'-'+key+'" type="number" min="'+min+'" max="'+max+'" step="any" required></label>').join('')+
   '<label class="input-label">Source or hypothetical basis for these properties<textarea id="rz-'+side+'-source" rows="2" maxlength="500" required></textarea></label></fieldset>').join('')+'</div>'+
  '<h3>Dry-period transpiration demand</h3><p class="rz-note">Intervals follow one another after the complete modeled event. Both stores receive the same demand. Enter potential plant transpiration, excluding soil evaporation.</p>'+
  '<div id="rz-schedule"></div><button id="rz-add" type="button">Add dry interval</button>'+
  '<p id="rz-meaning" class="rz-note"></p><button id="rz-run" type="submit" class="primary">Compare rooted stores</button></form>'+
  '<p id="rz-status" role="status"></p><div id="rz-results"></div>'+
  '<div class="rz-actions"><button id="rz-save" type="button" disabled>Save original investigation</button><label class="input-label">Reopen original investigation<input id="rz-open" type="file" accept=".json,application/json"></label></div>';
 document.querySelector('.observations').before(panel);
 const $=id=>panel.querySelector('#rz-'+id);
 $('meaning').textContent=ROOT_ZONE_MEANING;
 let opened=null,accepted=null,generation=0,busy=false,key='',factorInspector=null,timingPanel=null;
 const source=()=>opened??getProject();
 function setStatus(text,state){$('status').textContent=text;$('status').dataset.state=state;}
 function invalidate(message,preserveTiming=false){if(!preserveTiming)timingPanel?.invalidate(message);generation++;busy=false;accepted=null;factorInspector=null;$('results').replaceChildren();$('save').disabled=true;$('run').disabled=false;setStatus(message,'draft');}
 function numbers(id){const s=$(id).value;if(!s.trim())throw Error('Enter every declared property and interval');const n=Number(s);if(!Number.isFinite(n))throw Error('Enter finite numeric declarations');return n;}
 function addInterval(row={}){
  const box=node('fieldset');box.className='rz-interval';
  box.innerHTML='<legend>Dry interval</legend><label class="input-label">Duration · days<input data-rz-days type="number" min=".001" max="366" step="any" required></label>'+
   '<label class="input-label">Potential transpiration · mm/day<input data-rz-demand type="number" min="0" max="30" step="any" required></label>'+
   '<label class="input-label">Source or hypothetical basis<input data-rz-source type="text" maxlength="500" required></label><button data-rz-remove type="button" class="subtle">Remove interval</button>';
  box.querySelector('[data-rz-days]').value=row.durationDays??'';
  box.querySelector('[data-rz-demand]').value=row.potentialTranspirationMmPerDay??'';
  box.querySelector('[data-rz-source]').value=row.source??'';
  box.querySelector('button').onclick=()=>{box.remove();renumber();invalidate('Dry-period draft changed. Compare again.');};
  $('schedule').append(box);renumber();
 }
 function renumber(){const rows=[...$('schedule').children];rows.forEach((r,i)=>r.querySelector('legend').textContent='Interval '+(i+1));$('add').disabled=rows.length>=60;}
 function fill(study){
  $('cell').value=String(study.cellIndex);$('association').value=study.associationSource;
  for(const side of sides){for(const [f]of fields)$(side+'-'+f).value=study[side][f];$(side+'-source').value=study[side].source;}
  $('schedule').replaceChildren();study.schedule.forEach(addInterval);
 }
 function readStudy(){
  const study={schema:'experimental-earth-root-zone-study/1',cellIndex:numbers('cell'),
   rechargeBasis:'modeled-event-infiltration-pulse',associationSource:$('association').value,schedule:[]};
  for(const side of sides){study[side]={source:$(side+'-source').value};for(const [f]of fields)study[side][f]=numbers(side+'-'+f);}
  for(const box of $('schedule').children){const get=sel=>{const s=box.querySelector(sel).value;if(!s.trim())throw Error('Complete every dry interval');return s;};
   study.schedule.push({durationDays:Number(get('[data-rz-days]')),potentialTranspirationMmPerDay:Number(get('[data-rz-demand]')),source:get('[data-rz-source]')});}
  return study;
 }
 function refresh(){
  const p=source(),next=JSON.stringify(p);
  if(next!==key){key=next;const old=$('cell').value;
   $('cell').replaceChildren(...p.existing.map((_,i)=>{const o=node('option',name(p,i));o.value=String(i);return o;}));
   $('cell').value=Number(old)<p.existing.length&&old!==''?old:String(p.selectedIndex??0);
   invalidate('Original site changed. Compare against this source before saving.');}
  $('place').textContent=(opened?'Reopened original site: ':'Current site: ')+p.title+' · '+p.width+' × '+p.height+' cells. The active site is never replaced by this investigation.';
 }
 function inspect(day){
  if(!accepted)return;const r=accepted.report;
  $('day-number').value=String(day);$('day-range').value=String(day);
  const host=$('at-day');host.replaceChildren(node('h4','Day '+fmt(day)+' after the modeled event'));
  for(const side of sides){const row=rootZoneAtDay(r[side],day),p=node('p',(side==='existing'?'Existing':'Proposed')+': '+fmt(row.availableMm)+' mm available; '+fmt(row.suppliedMm)+' mm supplied transpiration; '+fmt(row.unmetMm)+' mm unmet demand.');
   p.dataset.side=side;p.dataset.available=String(row.availableMm);host.append(p);}
  factorInspector?.(day);
 }
 function draw(){
  const {project:p,report:r}=accepted,host=$('results');factorInspector=null;host.replaceChildren();
  host.append(node('h3',name(p,r.cellIndex)+' · '+fmt(r.existing.totalDays)+' dry days'));
  host.append(node('p','Recharge uses the paired site maps’ default constant surface infiltration capacities over the complete '+fmt(p.weather.durationMinutes)+'-minute event. It does not adopt a separately investigated soil hypothesis.'));
  const figure=node('figure'),chart=svg('svg',{viewBox:'0 0 700 300',role:'img','aria-label':'Available rooted-soil water in millimetres over dry days, existing solid amber and proposed dashed green; dotted lines show each demand-reduction threshold'});
  chart.id='rz-chart';const duration=r.existing.totalDays,max=Math.max(r.existing.capacityMm,r.proposal.capacityMm);
  const xx=d=>65+600*d/duration,yy=v=>245-215*v/Math.max(1,max);
  for(let i=0;i<=4;i++){const val=max*i/4;chart.append(svg('line',{x1:65,x2:665,y1:yy(val),y2:yy(val),stroke:'#dce6df'}));const t=svg('text',{x:57,y:yy(val)+4,'text-anchor':'end'});t.textContent=fmt(val);chart.append(t);}
  const samples=new Set(Array.from({length:81},(_,i)=>duration*i/80));
  for(const side of sides){r[side].snapshots.forEach(s=>samples.add(s.day));if(r[side].firstLimitedDay!==null)samples.add(r[side].firstLimitedDay);}
  for(const [index,side]of sides.entries()){
   const color=index?'#167c68':'#a65b26',attrs={points:[...samples].sort((a,b)=>a-b).map(d=>xx(d)+','+yy(rootZoneAtDay(r[side],d).availableMm)).join(' '),fill:'none',stroke:color,'stroke-width':3};
   if(index)attrs['stroke-dasharray']='9 4';chart.append(svg('polyline',attrs));
   chart.append(svg('line',{x1:65,x2:665,y1:yy(r[side].stressThresholdMm),y2:yy(r[side].stressThresholdMm),stroke:color,'stroke-dasharray':'2 5'}));
  }
  const yl=svg('text',{x:12,y:18});yl.textContent='Available water · mm';chart.append(yl);
  for(let i=0;i<=4;i++){const t=svg('text',{x:xx(duration*i/4),y:269,'text-anchor':'middle'});t.textContent=fmt(duration*i/4);chart.append(t);}
  const xl=svg('text',{x:365,y:292,'text-anchor':'middle'});xl.textContent='Dry days after the modeled event';chart.append(xl);
  figure.append(chart,node('figcaption','Solid amber: existing · dashed green: proposed. Dotted thresholds mark where positive transpiration demand begins to be reduced. Available water excludes the water held below the declared wilting point.'));host.append(figure);
  const time=node('div');time.className='rz-time';time.innerHTML='<label class="input-label">Inspect dry day<input id="rz-day-number" type="number" min="0" step="any"></label><label class="input-label">Move through dry days<input id="rz-day-range" type="range" min="0"></label><div id="rz-at-day" aria-live="polite"></div>';host.append(time);
  $('day-number').max=$('day-range').max=String(duration);$('day-range').step=String(duration/1000);
  $('day-range').oninput=()=>inspect(Number($('day-range').value));
  $('day-number').onchange=()=>{const v=Number($('day-number').value);if($('day-number').value.trim()&&Number.isFinite(v)&&v>=0&&v<=duration)inspect(v);};
  const table=node('table');table.id='rz-summary';table.className='rz-table';const caption=node('caption','Whole dry-period water account · millimetres over the original '+fmt(r.cellAreaM2)+' m² cell');
  const head=node('thead'),hr=node('tr');for(const title of ['Quantity','Existing','Proposed']){const th=node('th',title);th.scope='col';hr.append(th);}head.append(hr);table.append(caption,head);
  const body=node('tbody');
  for(const [key,label]of [['capacityMm','Declared available capacity'],['initialAvailableMm','Available before recharge'],['rechargeMm','Modeled event infiltration'],['retainedRechargeMm','Recharge retained in store'],['drainageMm','Immediate excess drainage'],['suppliedMm','Supplied transpiration'],['unmetMm','Unmet transpiration demand'],['availableMm','Available at dry-period end'],['demandLimitedDays','Days with reduced demand supply'],['balanceErrorMm','Water-account residual · mm']]){
   const tr=node('tr');tr.dataset.quantity=key;const th=node('th',label);th.scope='row';tr.append(th);for(const side of sides){const td=node('td',fmt(r[side][key]));td.dataset.side=side;td.dataset.value=String(r[side][key]);tr.append(td);}body.append(tr);
  }table.append(body);host.append(table);
  factorInspector=mountRootZoneFactors(host,r);
  const detail=node('details');detail.append(node('summary','Original source, assumptions and each dry interval'));
  detail.append(node('p','Association: '+r.study.associationSource),node('p','Original storm: '+p.weather.rainMmHr+' mm/hour for '+p.weather.stormMinutes+' minutes; modeled for '+p.weather.durationMinutes+' minutes at '+p.weather.stepMinutes+'-minute calculation intervals.'));
  for(const side of sides){detail.append(node('h4',side==='existing'?'Existing':'Proposed'),node('p','Cell: '+r[side].originalCell.surface+'; '+r[side].originalCell.provenance),
   node('p','Rooted store: '+r.study[side].source),node('p','Original model infiltration: '+fmt(r[side].originalBudget.absorbedLiters)+' litres / '+fmt(r.cellAreaM2)+' m². First demand-limited instant: '+(r[side].firstLimitedDay===null?'none in this declared dry period':'day '+fmt(r[side].firstLimitedDay))+'.'));
   for(const row of r[side].intervals)detail.append(node('p','Day '+fmt(row.startDay)+'–'+fmt(row.endDay)+': demand '+fmt(row.forcing.potentialTranspirationMmPerDay)+' mm/day; supplied '+fmt(row.suppliedMm)+' mm; remaining '+fmt(row.availableMm)+' mm. '+row.forcing.source));
  }host.append(detail);inspect(duration);
 }
 function install(project,study,report){accepted={project,study,report};draw();$('save').disabled=false;}
 $('form').addEventListener('input',()=>invalidate('Draft changed. Compare again before saving.'));
 $('add').onclick=()=>{addInterval();invalidate('Dry-period draft changed. Complete every interval and compare.');};
 $('example').onclick=()=>{const i=Number($('cell').value),base={fieldCapacity:.3,wiltingPoint:.12,initialAvailableMm:10,depletionFraction:.5};
  fill({cellIndex:i,associationSource:'Fictional association: all modeled infiltration enters the declared rooted store as one pulse; no transpiration is modeled during the storm.',
   existing:{...base,rootDepthM:.25,source:'Authored shallow rooted soil; all properties are hypothetical.'},
   proposal:{...base,rootDepthM:.6,source:'Authored deeper rooted soil; no property inferred from surface labels.'},
   schedule:[{durationDays:7,potentialTranspirationMmPerDay:4,source:'Authored seven dry days at 4 mm/day plant transpiration.'},
    {durationDays:7,potentialTranspirationMmPerDay:5,source:'Authored seven dry days at 5 mm/day; no soil evaporation.'}]});
  invalidate('Fictional draft loaded. Review its assumptions, then compare.');};
 $('current').onclick=()=>{opened=null;key='';refresh();};
 $('form').onsubmit=event=>{
  event.preventDefault();let p,study;
  try{p=structuredClone(source());study=readStudy();}catch(e){setStatus(e.message,'refused');return;}
  const token=++generation;busy=true;$('run').disabled=true;$('save').disabled=true;setStatus('Computing original infiltration and both rooted stores…','pending');
  setTimeout(()=>{if(token!==generation)return;try{const report=compareRootZoneFactors(p,study);install(p,study,report);setStatus('Both stores compared from the original inputs. No site or soil hypothesis was adopted.','computed');}
   catch(e){accepted=null;$('results').replaceChildren();setStatus(e.message,'refused');}
   finally{if(token===generation){busy=false;$('run').disabled=false;$('save').disabled=!accepted;}}},10);
 };
 $('save').onclick=()=>{if(!accepted||busy)return;try{const text=serializeRootZoneInvestigation(accepted.project,accepted.study),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download='experimental-earth-root-zone.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setStatus(e.message,'refused');}};
 $('open').onchange=async()=>{
  const file=$('open').files?.[0];if(!file)return;timingPanel?.cancelPending();const token=++generation;busy=true;$('run').disabled=true;$('save').disabled=true;setStatus('Checking original investigation…','opening');
  try{checkRootZoneFileBytes(file.size);const bytes=await file.arrayBuffer();if(token!==generation)return;
   const original=parseRootZoneInvestigation(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   const report=compareRootZoneFactors(original.project,original.study);if(token!==generation)return;
   opened=original.project;key=JSON.stringify(opened);
   $('cell').replaceChildren(...opened.existing.map((_,i)=>{const o=node('option',name(opened,i));o.value=String(i);return o;}));
   timingPanel?.invalidate('Original rooted-store inputs changed. Compare timing again.');fill(original.study);install(opened,original.study,report);refresh();setStatus('Recomputed from the file’s original site and declarations. Active site unchanged.','reopened');
  }catch(e){if(token===generation)setStatus(e.message+' Previous accepted comparison retained.','refused');}
  finally{if(token===generation){busy=false;$('run').disabled=false;$('save').disabled=!accepted;$('open').value='';}}
 };
 timingPanel=mountRootZoneTiming({host:panel,cancelParentPending:()=>{const wasBusy=busy;generation++;busy=false;$('run').disabled=false;$('save').disabled=!accepted;if(wasBusy)setStatus('Pending root-store work retired by a newer timing action.',accepted?'computed':'draft');},getInputs:()=>({project:structuredClone(source()),study:readStudy()}),installInputs:(project,study)=>{opened=project;key=JSON.stringify(project);$('cell').replaceChildren(...opened.existing.map((_,i)=>{const o=node('option',name(opened,i));o.value=String(i);return o;}));fill(study);invalidate('Original rooted-store draft restored from timing investigation. Compare the earlier pulse profile separately.',true);refresh();}});
 addInterval();refresh();return {refresh};
}


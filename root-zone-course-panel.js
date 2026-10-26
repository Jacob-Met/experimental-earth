import {compareRootCourse,rootCourseAtDay,serializeRootCourse,parseRootCourse,ROOT_COURSE_SCHEMA,ROOT_COURSE_FILE_LIMIT,ROOT_COURSE_MEANING} from './root-zone-course.js';
import {parsePortableProject,checkProjectFileBytes} from './project-portability.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const fmt=n=>n!==0&&(Math.abs(n)<0.0001||Math.abs(n)>=1e7)?Number(n).toExponential(3):Number(n).toLocaleString('en-US',{maximumSignificantDigits:6});
const svg=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
export function mountRootZoneCourse({host,getInputs,getProject}){
 const style=node('link');style.rel='stylesheet';style.href=new URL('./root-zone-course.css',import.meta.url);document.head.append(style);
 const panel=node('section');panel.id='rz-course';panel.className='rz-factors';
 panel.innerHTML='<span class="eyebrow">WATER / BETWEEN RAIN EVENTS</span><h3>What remains when the next rain arrives?</h3><p>Retain the rooted stores and final dry schedule above, then add original rain-event projects in chronological order. The rooted inventory carries forward, including transpiration and overflow, instead of restarting at each event.</p><p class="rz-note" id="rzc-meaning"></p><div class="rz-actions"><button id="rzc-start" type="button">Start from rooted draft and current event</button><button id="rzc-add" type="button" disabled>Add current event copy</button><label class="input-label">Add original site-event JSON<input id="rzc-event-file" type="file" accept=".json,application/json" disabled></label></div><p id="rzc-source"></p><div id="rzc-events"></div><div class="rz-actions"><button id="rzc-run" type="button" disabled>Compare continuous rooted course</button><button id="rzc-save" type="button" disabled>Save original event course</button><label class="input-label">Reopen original event course<input id="rzc-open" type="file" accept=".json,application/json"></label></div><p id="rzc-status" role="status"></p><div id="rzc-results"></div>';
 host.append(panel);const $=id=>panel.querySelector('#rzc-'+id);$('meaning').textContent=ROOT_COURSE_MEANING;
 let input=null,report=null,generation=0;
 const status=s=>$('status').textContent=s;
 function retire(message){generation++;report=null;$('results').replaceChildren();$('save').disabled=true;$('run').disabled=!input;status(message);}
 function fillEvents(){
  $('events').replaceChildren();if(!input)return;
  $('source').textContent='Retained cell '+input.cellIndex+' and rooted declarations are independent of later edits above. '+input.associationSource+' Final dry period: '+input.schedule.map(x=>fmt(x.durationDays)+' days at '+fmt(x.potentialTranspirationMmPerDay)+' mm/day').join('; ')+'.';
  input.events.forEach((event,i)=>{
   const box=node('fieldset');box.append(node('legend','Event '+(i+1)+' · '+event.project.title));
   const weather=event.project.weather;box.append(node('p','Original rain '+fmt(weather.rainMmHr)+' mm/h for '+fmt(weather.stormMinutes)+' minutes; complete surface course '+fmt(weather.durationMinutes)+' minutes. Source observations: '+event.project.observations.length+'.'));
   const field=(label,value,onchange,type='text')=>{const l=node('label',label);l.className='input-label';const el=node('input');el.type=type;el.value=String(value);if(type==='number'){el.min='0';el.step='any';}else el.maxLength=500;el.oninput=()=>{onchange(type==='number'?(el.value.trim()?Number(el.value):NaN):el.value);retire('Event declarations changed. Recompute the entire course.');};l.append(el);box.append(l);};
   field('Course reference (identify hypothetical copies explicitly)',event.reference,x=>event.reference=x);
   field('Dry days before this event',event.gapDays,x=>event.gapDays=x,'number');
   field('Gap transpiration · mm/day',event.gapDemand.potentialTranspirationMmPerDay,x=>event.gapDemand.potentialTranspirationMmPerDay=x,'number');
   field('Gap-demand source',event.gapDemand.source,x=>event.gapDemand.source=x);
   field('Event transpiration · mm/day',event.eventDemand.potentialTranspirationMmPerDay,x=>event.eventDemand.potentialTranspirationMmPerDay=x,'number');
   field('Event-demand source',event.eventDemand.source,x=>event.eventDemand.source=x);
   field('Why is this original event surface initially dry?',event.surfaceResetSource,x=>event.surfaceResetSource=x);
   const remove=node('button','Remove event');remove.type='button';remove.onclick=()=>{input.events.splice(i,1);fillEvents();retire('Event removed. Recompute.');};box.append(remove);$('events').append(box);
  });
  $('add').disabled=$('event-file').disabled=input.events.length>=12;$('run').disabled=false;
 }
 function add(project,name){
  if(input.events.length>=12)throw Error('A course admits at most12events');
  const n=input.events.length+1;
  input.events.push({reference:name||'Hypothetical event copy '+n,project:structuredClone(project),gapDays:0,gapDemand:{potentialTranspirationMmPerDay:0,source:''},eventDemand:{potentialTranspirationMmPerDay:0,source:''},surfaceResetSource:''});
  fillEvents();retire('Original event retained. Declare its preceding gap, demand sources and dry-surface basis.');
 }
 $('start').onclick=()=>{try{const {project,study}=getInputs();input={schema:ROOT_COURSE_SCHEMA,cellIndex:study.cellIndex,associationSource:study.associationSource,existing:structuredClone(study.existing),proposal:structuredClone(study.proposal),schedule:structuredClone(study.schedule),events:[]};add(project);}catch(e){status(e.message);}};
 $('add').onclick=()=>{try{add(getProject());}catch(e){status(e.message);}};
 async function readFile(which,course){
  const file=$(which).files?.[0];if(!file)return;const token=++generation;
  try{if(course){if(file.size>ROOT_COURSE_FILE_LIMIT)throw Error('Original course exceeds16MiB');}else checkProjectFileBytes(file.size);
   const bytes=await file.arrayBuffer();if(token!==generation)return;const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(course){const original=parseRootCourse(text),computed=compareRootCourse(original);if(token!==generation)return;input=original;fillEvents();report=computed;draw();$('save').disabled=false;status('Original course reopened and fully recomputed. Active site unchanged.');}
   else{if(!input)throw Error('Start a rooted course first');add(parsePortableProject(text),file.name+' · entry '+(input.events.length+1));}
  }catch(e){if(token===generation)status(e.message+' Previous retained source remains available.');}
  finally{if(token===generation)$(which).value='';}
 }
 $('event-file').onchange=()=>readFile('event-file',false);$('open').onchange=()=>readFile('open',true);
 $('run').onclick=()=>{retire('Computing every original event and carried rooted-water account…');const token=generation;$('run').disabled=true;setTimeout(()=>{if(token!==generation)return;try{report=compareRootCourse(input);draw();$('save').disabled=false;status('Complete source-bound course computed. Root water persists across all events.');}catch(e){status(e.message);}finally{if(token===generation)$('run').disabled=false;}},10);};
 function draw(){
  const host=$('results');host.replaceChildren();const total=report.existing.final.day;
  host.append(node('h4',input.events.length+' original event entries · '+fmt(total)+' elapsed days'));
  const chart=svg('svg',{viewBox:'0 0 700 270',role:'img','aria-label':'Continuous available root water across original rainfall events and declared dry gaps'});
  const max=Math.max(report.existing.capacityMm,report.proposal.capacityMm),xx=d=>55+620*d/total,yy=v=>225-200*v/Math.max(1,max);
  for(let i=0;i<=4;i++){const v=max*i/4;chart.append(svg('line',{x1:55,x2:675,y1:yy(v),y2:yy(v),stroke:'#dce6df'}));const text=svg('text',{x:48,y:yy(v)+4,'text-anchor':'end'});text.textContent=fmt(v);chart.append(text);}
  for(const [side,color,dash]of [['existing','#a65b26',''],['proposal','#167c68','8 4']]){
   const p=report[side],times=new Set(Array.from({length:161},(_,i)=>total*i/160));for(const s of p.segments){times.add(s.startDay);times.add(s.endDay);}
   chart.append(svg('polyline',{points:[...times].sort((a,b)=>a-b).map(d=>xx(d)+','+yy(rootCourseAtDay(p,Math.min(d,p.final.day)).availableMm)).join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-dasharray':dash}));
  }
  for(const e of report.existing.events)chart.append(svg('line',{x1:xx(e.startDay),x2:xx(e.startDay),y1:15,y2:225,stroke:'#667d72','stroke-dasharray':'2 3'}));
  const label=svg('text',{x:350,y:258,'text-anchor':'middle'});label.textContent='Elapsed days 0–'+fmt(total)+' · available rooted water, mm';chart.append(label);host.append(chart,node('p','Solid amber: existing; dashed green: proposal. Vertical marks: event starts. Curves are display samples; inspection evaluates the declared solution.'));
  const l=node('label','Inspect elapsed day');l.className='input-label';const time=node('input');time.id='rzc-day';time.type='number';time.min='0';time.max=String(total);time.step='any';time.value=String(total);l.append(time);host.append(l);
  const table=node('table');table.className='rz-table';table.innerHTML='<caption>Cumulative water account · mm</caption><thead><tr><th>Quantity</th><th>Existing</th><th>Proposal</th><th>Proposal − existing</th></tr></thead>';const body=node('tbody');table.append(body);host.append(table);
  const inspect=()=>{const day=Number(time.value);if(!time.value.trim()||day<0||day>total||!Number.isFinite(day))return;const a=rootCourseAtDay(report.existing,day),b=rootCourseAtDay(report.proposal,Math.min(day,report.proposal.final.day));body.replaceChildren();for(const k of ['availableMm','rechargeMm','drainageMm','suppliedMm','unmetMm','potentialMm','balanceErrorMm']){const row=node('tr');row.dataset.quantity=k;row.append(node('th',({availableMm:'Available rooted water',rechargeMm:'Delivered recharge',drainageMm:'Excess drainage',suppliedMm:'Supplied transpiration',unmetMm:'Unmet demand',potentialMm:'Potential transpiration',balanceErrorMm:'Water-account residual'})[k]));for(const v of [a[k],b[k],b[k]-a[k]]){const cell=node('td',fmt(v));cell.dataset.value=String(v);row.append(cell);}body.append(row);}};time.oninput=inspect;inspect();
  const detail=node('details');detail.append(node('summary','Original event boundaries, retained surface water and source budgets'));
  for(const side of ['existing','proposal'])for(const e of report[side].events)detail.append(node('p',side+' · '+e.reference+' · days '+fmt(e.startDay)+'–'+fmt(e.endDay)+': rooted inventory '+fmt(e.before.availableMm)+'→'+fmt(e.after.availableMm)+' mm; original cell infiltration '+fmt(e.original.rechargeMm)+' mm. Surface water left at event end: '+fmt(e.originalFinalSurfaceLiters)+' L across the site; this inventory is not carried into another event.'));
  const pre=node('pre');pre.className='rz-timing-record';pre.textContent=JSON.stringify({associationSource:input.associationSource,existing:input.existing,proposal:input.proposal,events:report.existing.events.map(e=>({reference:e.reference,intervals:e.original.intervals})),schedule:input.schedule},null,2);detail.append(pre);host.append(detail);
 }
 $('save').onclick=()=>{if(!report)return;try{const text=serializeRootCourse(input),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download='experimental-earth-rooted-event-course.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){status(e.message);}};
 status('Start with a complete rooted-store draft or reopen an original course.');
}

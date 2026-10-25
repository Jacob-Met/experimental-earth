import {readRateEvent,compareRateEvents,exportRateComparison,importRateComparison} from './rate-events.js';
const panels=[...document.querySelectorAll('[data-event]')],resultHost=document.querySelector('#results'),status=document.querySelector('#status'),download=document.querySelector('#download');
let revision=0,current=null;
const field=(panel,name)=>panel.querySelector(`[data-field="${name}"]`);
function retire(message='Inputs changed. Compare again.'){
  revision++;current=null;resultHost.replaceChildren();download.disabled=true;status.textContent=message;
}
function node(tag,text,parent){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(parent)parent.append(e);return e;}
function source(panel){return Object.fromEntries(['event','source','fileName'].map(k=>[k,field(panel,k).value]));}
function fill(panel,event){for(const key of ['event','source','fileName'])field(panel,key).value=event.source[key];field(panel,'text').value=event.text;}
function table(parent,head,rows){const wrap=node('div',undefined,parent);wrap.className='table-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label','Scrollable original sample table');const t=node('table',undefined,wrap),h=node('tr',undefined,node('thead',undefined,t));for(const s of head)node('th',s,h).scope='col';const b=node('tbody',undefined,t);for(const row of rows){const tr=node('tr',undefined,b);for(const value of row)node('td',String(value),tr);}}
function pointPlot(parent,result){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 640 280');svg.setAttribute('role','img');svg.setAttribute('aria-label','Original runoff sample points: left blue, right red. No interpolation. All values follow in tables.');
  const all=[...result.left.samples,...result.right.samples],maxT=Math.max(1,...all.map(s=>s.minute)),maxQ=Math.max(1,...all.filter(s=>s.runoff.kind==='observed').map(s=>s.runoff.value));
  for(const [event,side] of [[result.left,'left'],[result.right,'right']])for(const s of event.samples){if(s.runoff.kind!=='observed')continue;const c=document.createElementNS(ns,'circle');c.setAttribute('cx',String(40+560*s.minute/maxT));c.setAttribute('cy',String(235-195*s.runoff.value/maxQ));c.setAttribute('r',side==='left'?'5':'3');c.setAttribute('class',side);const title=document.createElementNS(ns,'title');title.textContent=`${side}: ${s.raw.minute} min, ${s.raw.runoff_mm_hr} mm/h, source line ${s.sourceLine}`;c.append(title);svg.append(c);}
  for(const [x,y,text] of [[40,265,'0 min'],[510,265,`${maxT} min`],[5,22,`${maxQ} mm/h`],[5,239,'0']]){const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.textContent=text;svg.append(t);}parent.append(svg);
}
function render(result){
  resultHost.replaceChildren();node('h2','Original sample comparison',resultHost);
  node('p','Blue points: left event. Red points: right event. Points are original rate samples; missing samples are not zero. No line, interpolated total, continuous peak or onset is inferred.',resultHost);pointPlot(resultHost,result);
  for(const [side,event,summary] of [['Left',result.left,result.leftSummary],['Right',result.right,result.rightSummary]]){
    const a=node('article',undefined,resultHost);node('h3',`${side}: ${event.source.event}`,a);node('p',event.source.source,a);node('p',`Supplied filename: ${event.source.fileName}. Original line references are declared provenance, not file authentication.`,a);
    node('p',`${summary.sampleCount} samples; ${summary.missingRunoffCount} missing runoff values. Largest sample gap: ${summary.largestSampleGapMinutes} min. Highest sampled runoff: ${summary.peakSampleRateMmHr??'unknown'} mm/h. First positive sample: ${summary.firstPositiveSampleMinute===null?'not observed':`${summary.firstPositiveSampleMinute} min`}.`,a);
    table(a,['Minute','Rain mm/h','Run-on mm/h','Runoff mm/h','Original source line'],event.samples.map(s=>[s.raw.minute,s.raw.rain_mm_hr,s.raw.runon_mm_hr,s.raw.runoff_mm_hr,s.raw.source_line]));
  }
  node('h3','Right minus left at coincident original times',resultHost);node('p','Times share the declared run-relative origin. Matching time alone does not establish matching forcing, initial conditions or a causal treatment effect. A dash means at least one original rate is missing or unknown.',resultHost);
  if(!result.coincident.length)node('p','No coincident original times; no aligned values were invented.',resultHost);
  else table(resultHost,['Minute','Rain change mm/h','Run-on change mm/h','Runoff change mm/h','Left / right source line'],result.coincident.map(p=>[p.minute,...['rain','runon','runoff'].map(k=>p.rightMinusLeftMmHr[k]??'—'),`${p.leftSourceLine} / ${p.rightSourceLine}`]));
  current=result;download.disabled=false;status.textContent='Original samples compared. Results are descriptive; no model was calibrated or adopted.';
}
for(const panel of panels){
  panel.addEventListener('input',()=>retire());
  panel.querySelector('[data-file]').addEventListener('change',async event=>{
    retire('Reading event file…');const token=revision,file=event.target.files[0];if(!file)return;
    try{if(file.size>128000)throw Error('Event CSV exceeds 128000 bytes.');const text=await file.text();if(token!==revision)return;field(panel,'text').value=text;field(panel,'fileName').value=file.name;status.textContent='Event file loaded. Check original source and conditions, then compare.';}
    catch(e){if(token===revision)status.textContent=e.message;}
    finally{if(event.target.files[0]===file)event.target.value='';}
  });
}
document.querySelector('#compare').addEventListener('click',()=>{
  retire();try{render(compareRateEvents(...panels.map(p=>readRateEvent(field(p,'text').value,source(p)))));}catch(e){status.textContent=e.message;}
});
document.querySelector('#example').addEventListener('click',async()=>{
  retire('Opening acquired USDA original samples…');const token=revision;
  try{
    const response=await fetch('./research/usda-er2-rate-comparison.json');if(!response.ok)throw Error('The acquired example could not be opened.');
    const text=await response.text();if(token!==revision)return;
    const result=importRateComparison(text);fill(panels[0],result.left);fill(panels[1],result.right);render(result);
  }catch(e){if(token===revision)status.textContent=e.message;}
});
download.addEventListener('click',()=>{
  if(!current)return;const text=exportRateComparison(current.left,current.right),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=node('a');a.href=url;a.download='original-rate-comparison.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.querySelector('#reopen').addEventListener('change',async event=>{
  retire('Reading original comparison…');const token=revision,file=event.target.files[0];if(!file)return;
  try{if(file.size>300000)throw Error('Rate comparison file exceeds 300000 bytes.');const text=await file.text();if(token!==revision)return;const result=importRateComparison(text);fill(panels[0],result.left);fill(panels[1],result.right);render(result);}catch(e){if(token===revision)status.textContent=e.message;}
  finally{if(event.target.files[0]===file)event.target.value='';}
});
document.documentElement.dataset.rateEventsReady='true';

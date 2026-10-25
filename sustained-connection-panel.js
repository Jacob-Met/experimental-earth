import {compareSustainedConnections} from './sustained-connection.js';

/** Uses the parent investigation's source, including its isolated reopened site. */
export function mountSustainedConnection(parent){
 const panel=document.createElement('section');panel.hidden=true;
 panel.innerHTML=`<h3>Keep one connection for a whole time window</h3>
 <p>The native-time course can change paths. Here the same offered connection must cover the entire declared interval, using linear interpolation between the retained depth snapshots.</p>
 <form><label>Window start (minutes)<input data-start type="number" min="0" step="any" required value="0"></label>
 <label>Window end (minutes)<input data-end type="number" min="0" step="any" required></label>
 <button type="submit">Compare a fixed connection</button></form>
 <p data-error role="alert"></p><div data-result aria-live="polite"></div>
 <p class="mini-note">A depth-only fixed grid connection, not a moving traversal or physical access recommendation. Peaks between original solver snapshots are unknown; the result describes their explicitly linear interpolation.</p>`;
 parent.append(panel);
 const $=s=>panel.querySelector(s);let context=null,window=null;
 const retire=()=>{window=null;$('[data-result]').replaceChildren();$('[data-error]').textContent='';};
 $('form').addEventListener('input',retire);
 $('form').addEventListener('submit',event=>{
  event.preventDefault();retire();if(!context)return;
  try{
   if(!$('[data-start]').value||!$('[data-end]').value)throw Error('Declare both window endpoints.');
   const {project,question,results}=context;
   const r=compareSustainedConnections(results,project.width,project.height,question,{startMinute:Number($('[data-start]').value),endMinute:Number($('[data-end]').value)});
   window=r.window;
   const name=i=>String.fromCharCode(65+i%project.width)+(Math.floor(i/project.width)+1);
   for(const key of ['existing','proposal']){
    const item=document.createElement('p'),value=r[key];item.style.overflowWrap='anywhere';
    item.textContent=key+': '+(value.connected?`${value.bottleneckMm} mm minimum achievable whole-window maximum. Fixed path: ${value.path.map(name).join(' → ')}.`:'No connection inside the offered footprint.');
    $('[data-result]').append(item);
    if(value.connected){const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Original/interpolated peak witnesses along this fixed path';detail.append(summary);
     for(const peak of value.pathPeaks){const p=document.createElement('p');p.textContent=`${name(peak.cellIndex)}: ${peak.depthMm} mm at ${peak.minute} min`;detail.append(p);} $('[data-result]').append(detail);}
   }
  }catch(error){$('[data-error]').textContent=error.message;}
 });
 return {getWindow(){return window?{...window}:null;},restore(value){if(!context)throw Error('Compare a connection first.');compareSustainedConnections(context.results,context.project.width,context.project.height,context.question,value);$('[data-start]').value=value.startMinute;$('[data-end]').value=value.endMinute;$('form').dispatchEvent(new Event('submit',{cancelable:true}));},clear(){context=null;panel.hidden=true;retire();},receive(project,question,results){context={project,question,results};retire();panel.hidden=false;$('[data-start]').value=results.existing.snapshots[0].minute;$('[data-end]').value=results.existing.snapshots.at(-1).minute;}};
}

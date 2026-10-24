import {compareSunPathSampling,inspectSunPathSampling,SUN_SAMPLING_SEMANTICS} from './solar-path-sampling.js';
import {sunPathContext} from './solar-path.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
export function mountSunPathSamplingPanel({host,prefix,getStudy,getCell,drawCourse}){
 const box=node('section');box.id=prefix;box.style.minWidth='0';box.style.overflowWrap='anywhere';
 box.innerHTML=`<h3>Inspect additional discrete times</h3><p>Compare a finer whole-minute divisor with this original course. The original declaration and project remain unchanged.</p><label class="input-label">Finer interval, minutes<input id="${prefix}-step" type="number" min="1" max="239" step="1" value="1"></label><button id="${prefix}-run" type="button" disabled>Compare complete finer grid</button><p id="${prefix}-status" role="status"></p><div id="${prefix}-results"></div><details id="${prefix}-full" hidden><summary>Inspect the complete finer course</summary><div id="${prefix}-course"></div></details>`;host.append(box);
 const $=suffix=>box.querySelector('#'+prefix+'-'+suffix);let generation=0,comparison=null;
 const signature=s=>s?sunPathContext(s.project)+'|'+JSON.stringify(s.report.declaration):null;
 function draw(){
  $('results').replaceChildren();$('course').replaceChildren();$('full').hidden=!comparison;
  if(!comparison)return;
  const result=inspectSunPathSampling(comparison,Number(getCell()));
  const times=result.intervals.flatMap(i=>i.newObservations),distinct=times.length;
  $('results').append(node('p',`${comparison.insertedSamples} distinct timestamps inserted across the complete grid. At this cell, ${distinct} distinct inserted timestamps have a classification absent from both original interval endpoints, comprising ${result.newObservationCount} per-scenario observations.`),node('p',SUN_SAMPLING_SEMANTICS));
  for(const interval of result.intervals){if(!interval.newObservations.length)continue;
   const section=node('section');section.append(node('h4',`${interval.startUtc} to ${interval.endUtc}`));
   for(const row of interval.newObservations){const p=node('p',`${row.utc}: `);p.dataset.insertedTime=row.utc;
    for(const target of row.newTargets){const v=row[target];const span=node('span',`${target}: ${v.status} (endpoints ${interval.left[target].status}, ${interval.right[target].status}). `);span.dataset.target=target;span.dataset.status=v.status;
     if(v.witness)span.append(node('span',`Original witness cell ${v.witness.cellIndex}, ${v.witness.kind}: ${v.witness.source}. `));p.append(span);
    }section.append(p);
   }$('results').append(section);
  }
  drawCourse($('course'),comparison.fine,Number(getCell()));
 }
 function invalidate(message='Compare again after changing the source or declaration.'){
  generation++;comparison=null;draw();const s=getStudy(),available=s&&s.report.declaration.stepMinutes>1;
  $('run').disabled=!available;$('run').textContent='Compare complete finer grid';$('status').textContent=s&&!available?'The original interval is one minute; no finer whole-minute grid is supported.':message;
 }
 $('step').addEventListener('input',()=>invalidate('Finer interval changed. Compare again.'));
 $('run').addEventListener('click',()=>{
  const study=getStudy();if(!study)return;const text=$('step').value,step=Number(text),token=++generation,key=signature(study),source=structuredClone(study.project),declaration=structuredClone(study.report.declaration);
  $('run').disabled=true;$('status').textContent='Calculating every finer-grid sample…';
  setTimeout(()=>{
   if(token!==generation||key!==signature(getStudy())||text!==$('step').value)return;
   try{if(text==='')throw Error('Enter a finer whole-minute divisor.');const next=compareSunPathSampling(source,declaration,step);if(token!==generation||key!==signature(getStudy()))return;comparison=next;draw();$('status').textContent='Complete finer grid compared; original course unchanged.';}
   catch(error){$('status').textContent=`${error.message} Original course and any previously accepted fine comparison remain unchanged.`;}
   finally{if(token===generation)$('run').disabled=false;}
  },20);
 });
 return {invalidate,refresh(){if(comparison)draw();else{const s=getStudy();$('run').disabled=!s||s.report.declaration.stepMinutes<=1;if(s?.report.declaration.stepMinutes===1)$('status').textContent='The original interval is one minute; no finer whole-minute grid is supported.';}}};
}

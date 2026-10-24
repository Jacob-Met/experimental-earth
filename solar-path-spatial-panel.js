import {summarizeSunPathSpatial,inspectSunPathSpatial,SUN_PAIR_CATEGORIES,SUN_SPATIAL_SEMANTICS} from './solar-path-spatial.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const name=(width,i)=>`${String.fromCharCode(65+i%width)}${Math.floor(i/width)+1}`;
export function mountSunPathSpatialPanel({host,prefix,getReport,getCell,onSelectCell,courseLabel='Original'}){
 if(!document.querySelector('link[data-sun-spatial]')){const link=document.createElement('link');link.rel='stylesheet';link.href='./solar-path-spatial-panel.css';link.dataset.sunSpatial='';document.head.append(link);}
 const box=node('section');box.id=prefix;box.className='sun-spatial';
 box.innerHTML=`<h3>Where do the sampled obstruction changes occur?</h3><p>Inspect the ${courseLabel.toLowerCase()} dated course across every retained ground centre. This map does not use or replace the separate finer-grid investigation.</p><label class="input-label">Map view<select id="${prefix}-mode"><option value="course">${courseLabel} course counts</option><option value="instant">One ${courseLabel.toLowerCase()} UTC sample</option></select></label><label class="input-label">${courseLabel} UTC sample for inspection<select id="${prefix}-time"></select></label><p id="${prefix}-status" role="status"></p><div class="sun-spatial-scroll" role="region" aria-label="Spatial ground-centre map; arrow keys select cells"><div id="${prefix}-grid" class="sun-spatial-grid" role="group" aria-label="Retained ground centres"></div></div><div id="${prefix}-detail"></div><p id="${prefix}-limits"></p>`;host.append(box);const $=id=>box.querySelector('#'+prefix+'-'+id);let report=null,summary=null;
 $('limits').textContent=SUN_SPATIAL_SEMANTICS;
 function select(index,focus=false){onSelectCell(index);if(focus)$('grid').querySelector(`[data-spatial-cell="${index}"]`)?.focus();}
 function draw(){
  $('grid').replaceChildren();$('detail').replaceChildren();if(!summary)return;
  const selected=Number(getCell()),time=Number($('time').value),instant=$('mode').value==='instant';
  $('status').textContent=instant?`${summary.times[time].utc}: ${summary.width} × ${summary.height} retained ground centres. Categories keep limitations separate.`:`${summary.sampleCount} ${courseLabel.toLowerCase()} sampled instants per centre. Additional and removed counts are separate; mixed patterns and limited samples remain visible.`;
  $('grid').style.gridTemplateColumns=`repeat(${summary.width},minmax(120px,1fr))`;
  for(const cell of summary.cells){const i=cell.cellIndex,category=instant?summary.times[time].categories[i]:cell.pattern,b=node('button');b.type='button';b.dataset.spatialCell=String(i);b.dataset.pattern=category;b.tabIndex=i===selected?0:-1;b.setAttribute('aria-pressed',String(i===selected));b.append(node('strong',name(summary.width,i)));
   const text=instant?SUN_PAIR_CATEGORIES[category]:`Additional ${cell.counts.additional}; removed ${cell.counts.removed}; limited ${cell.limitedSamples}; ${cell.pattern}`;b.append(node('span',text));b.setAttribute('aria-label',`${name(summary.width,i)}: ${text}`);
   b.addEventListener('click',()=>select(i,true));b.addEventListener('keydown',event=>{let next=i;const column=i%summary.width;switch(event.key){case'ArrowRight':if(column<summary.width-1)next++;break;case'ArrowLeft':if(column>0)next--;break;case'ArrowDown':if(i+summary.width<summary.cells.length)next=i+summary.width;break;case'ArrowUp':if(i>=summary.width)next=i-summary.width;break;case'Home':next=0;break;case'End':next=summary.cells.length-1;break;default:return;}event.preventDefault();select(next,true);});$('grid').append(b);
  }
  const row=inspectSunPathSpatial(report,summary,selected,time);$('detail').append(node('h4',`${name(summary.width,selected)} · ${row.utc}`),node('p',SUN_PAIR_CATEGORIES[row.category]));
  for(const target of ['existing','proposal']){const result=row[target],p=node('p',`${target}: ${result.status}.`);p.dataset.spatialTarget=target;p.dataset.status=result.status;if(result.witness)p.append(node('span',` Original witness ${name(summary.width,result.witness.cellIndex)} (${result.witness.kind}): ${result.witness.source}`));$('detail').append(p);}
  $('detail').append(node('p',Object.entries(row.counts).map(([key,count])=>`${SUN_PAIR_CATEGORIES[key]}: ${count}`).join('; ')));
 }
 $('mode').addEventListener('change',draw);$('time').addEventListener('change',draw);
 function clear(){report=null;summary=null;$('time').replaceChildren();$('grid').replaceChildren();$('detail').replaceChildren();$('status').textContent='Compare or reopen an original dated course to inspect its spatial pattern.';}
 return {clear,refresh(){const next=getReport();if(!next){clear();return;}try{if(next!==report){const nextSummary=summarizeSunPathSpatial(next);report=next;summary=nextSummary;$('time').replaceChildren(...summary.times.map(t=>{const o=node('option',t.utc);o.value=String(t.index);return o;}));}draw();}catch(error){clear();$('status').textContent=error.message;}}};
}

const node=(tag,text,classes)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(classes)el.className=classes;return el;};
const format=value=>new Intl.NumberFormat('en-US',{maximumSignificantDigits:7}).format(value);

/** Local inspection owns its worker and DOM only; neither files nor report change. */
export function mountProposalLocalInspection(container,{files,report}) {
 const root=node('div',undefined,'local-inspection');container.append(root);
 root.append(node('p','Inspect one grid location across every saved proposal at the same retained model time. Coordinates refer to the shared grid, not a geographic location. No measurements or original files are changed.'));
 const controls=node('div',undefined,'local-cell-controls');
 function select(id,label,count,display){const field=node('label',label);field.htmlFor=id;const input=node('select');input.id=id;for(let i=0;i<count;i++){const option=node('option',display(i));option.value=String(i);input.append(option);}field.append(input);controls.append(field);return input;}
 const column=select('local-cell-column','Column',report.originalSite.width,i=>String.fromCharCode(65+i));
 const row=select('local-cell-row','Row',report.originalSite.height,i=>String(i+1));
 const inspect=node('button','Inspect cell');inspect.type='button';inspect.id='inspect-local-depth';controls.append(inspect);root.append(controls);
 const status=node('p','Choose a cell, then inspect its modeled depths.');status.id='local-depth-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 const results=node('div');results.id='local-depth-results';results.setAttribute('aria-busy','false');root.append(results);
 let worker=null,generation=0,disposed=false,result=null,selectedMinute=null;
 const events=[];const listen=(target,event,fn)=>{target.addEventListener(event,fn);events.push(()=>target.removeEventListener(event,fn));};
 function retire(){generation++;worker?.terminate();worker=null;result=null;results.replaceChildren();results.setAttribute('aria-busy','false');inspect.disabled=false;}
 function changeCell(){retire();status.textContent=`Cell ${String.fromCharCode(65+Number(column.value))}${Number(row.value)+1} selected. Inspect again to calculate its depths.`;}
 listen(column,'change',changeCell);listen(row,'change',changeCell);
 function render(data){
  result=data;
  const times=data.snapshotMinutes;
  if(!Array.isArray(times)||!times.length)throw Error('No retained model times were returned.');
  let index=times.length-1;
  if(selectedMinute!==null){index=0;for(let i=1;i<times.length;i++)if(Math.abs(times[i]-selectedMinute)<Math.abs(times[index]-selectedMinute))index=i;}
  results.append(node('h3',`Cell ${data.cell.label} · all saved proposals`));
  results.append(node('p',`Shared grid: ${data.originalSite.width} × ${data.originalSite.height} cells, ${data.originalSite.cellSizeM} m cell width. These are simultaneous modeled depths at this cell, not each proposal’s maximum depth or observed measurements.`,'note'));
  const timeGroup=node('fieldset',undefined,'local-time-controls');timeGroup.append(node('legend','Choose a retained model time'));
  const label=node('label','Time after event start');label.htmlFor='local-depth-time';
  const output=node('output');output.htmlFor='local-depth-time';label.append(output);timeGroup.append(label);
  const slider=node('input');slider.type='range';slider.id='local-depth-time';slider.min='0';slider.max=String(times.length-1);slider.step='1';slider.value=String(index);timeGroup.append(slider);
  const actions=node('div',undefined,'actions');const previous=node('button','Previous snapshot','secondary'),next=node('button','Next snapshot','secondary');previous.type=next.type='button';previous.id='local-depth-previous';next.id='local-depth-next';actions.append(previous,next);timeGroup.append(actions);results.append(timeGroup);
  results.append(node('p','All rows use the same retained solver snapshot; no interpolation is applied. Values are rounded for display.','note'));
  results.append(node('p','A positive change means deeper water at this same cell and time; a negative change means shallower water.','note'));
  const region=node('div',undefined,'table-scroll local-depth-table');region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',`Modeled depth at cell ${data.cell.label} for the existing site and every proposal`);
  const table=node('table');table.append(node('caption',`Cell ${data.cell.label}: depth and change from the existing site`));const head=node('thead'),headRow=node('tr');for(const text of ['Original scenario','Surface material','Depth (mm)','Change from existing (mm)']){const th=node('th',text);th.scope='col';headRow.append(th);}head.append(headRow);table.append(head);const body=node('tbody');table.append(body);region.append(table);
  results.append(node('p','If needed, scroll the table horizontally. With a keyboard, focus the table region and use the arrow keys.','note'),region);
  const displayed=[];
  const addRow=(title,filename,surface)=>{const tr=node('tr'),th=node('th');th.scope='row';th.append(node('span',title));if(filename!==null)th.append(node('small',filename,'local-source-file'));tr.append(th,node('td',surface));const depth=node('td'),delta=node('td');tr.append(depth,delta);body.append(tr);displayed.push({depth,delta});};
  addRow('Existing site','Shared unchanged reference',data.existing.surfaceName);
  for(const candidate of data.candidates)addRow(`${candidate.inputOrdinal}. ${candidate.title}`,files[candidate.inputOrdinal-1]?.name??'Original project file',candidate.surfaceName);
  function show(i){index=Math.max(0,Math.min(times.length-1,i));slider.value=String(index);selectedMinute=times[index];output.textContent=`${format(times[index])} min · snapshot ${index+1} of ${times.length}`;slider.setAttribute('aria-valuetext',`${format(times[index])} minutes after event start, snapshot ${index+1} of ${times.length}`);previous.setAttribute('aria-disabled',String(index===0));next.setAttribute('aria-disabled',String(index===times.length-1));displayed[0].depth.textContent=format(data.existing.depthsMm[index]);displayed[0].delta.textContent='0';data.candidates.forEach((candidate,i)=>{displayed[i+1].depth.textContent=format(candidate.depthsMm[index]);const delta=candidate.proposalMinusExistingMm[index];displayed[i+1].delta.textContent=(delta>0?'+':'')+format(delta);});}
  // These controls belong to the disposable results subtree, with no global listeners.
  slider.addEventListener('input',()=>show(Number(slider.value)));previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));show(index);
 }
 function start(){
  retire();const ticket=generation;inspect.disabled=true;results.setAttribute('aria-busy','true');status.textContent='Checking original files and calculating this cell across all proposals…';
  function fail(message){if(disposed||ticket!==generation)return;worker?.terminate();worker=null;results.replaceChildren();results.setAttribute('aria-busy','false');inspect.disabled=false;status.textContent=`Local inspection unavailable: ${message}`;}
  try{worker=new Worker('./proposal-local-depth-worker.js',{type:'module'});worker.onmessage=({data})=>{if(disposed||ticket!==generation)return;if(data.type==='progress')status.textContent=`Calculated ${data.completed} of ${data.total}: ${data.fileName}`;else if(data.type==='error')fail(data.message);else if(data.type==='complete'){worker.terminate();worker=null;try{render(data.result);results.setAttribute('aria-busy','false');inspect.disabled=false;status.textContent=`Cell ${data.result.cell.label} ready: existing site and ${data.result.candidates.length} proposals. Use the shared time control to compare.`;}catch(error){fail(error.message);}}};worker.onerror=event=>{event.preventDefault();fail(event.message||'The local calculation could not complete.');};worker.postMessage({files,cellIndex:Number(row.value)*report.originalSite.width+Number(column.value),report});}catch(error){fail(error.message);}
 }
 listen(inspect,'click',start);
 return ()=>{if(disposed)return;disposed=true;retire();for(const remove of events)remove();root.remove();};
}

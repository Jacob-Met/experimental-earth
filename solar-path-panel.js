import {mountSunBearingCoursePanel} from './solar-bearing-course-panel.js';
import {mountSolarBearingPanel} from './solar-bearing-panel.js';
import {mountSunPathDatesPanel} from './solar-path-dates-panel.js';
import {mountSunPathSpatialPanel} from './solar-path-spatial-panel.js';
import {mountSunPathSamplingPanel} from './solar-path-sampling-panel.js';
import {compareSunPath,sunPathCellCourse,sunPathContext,SUN_PATH_SEMANTICS} from './solar-path.js';
import {serializeSunPathInvestigation,parseSunPathInvestigation,checkSunPathInvestigationBytes,SUN_PATH_INVESTIGATION_LIMITS} from './solar-path-receipt.js';

const labels={
  blocked:'Blocked across declared height bounds',
  'height-dependent':'Unresolved across declared heights',
  grazing:'Grazing or numerically unresolved',
  'no-mapped-blocker':'No mapped blocker; other obstructions remain unknown',
  footprint:'Declared obstruction footprint; not a ground exposure sample',
  'below-horizon':'Calculated sun centre at or below the horizon',
  'low-elevation':'Calculated sun below 1°; outside the obstruction model',
};
const colors={blocked:'#6657a4','height-dependent':'#cf8722',grazing:'#c54e42',
  'no-mapped-blocker':'#e1bd48',footprint:'#59636b','below-horizon':'#253b4a','low-elevation':'#8496a4'};
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const svgNode=(tag,attrs={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
const cellName=(width,i)=>`${String.fromCharCode(65+i%width)}${Math.floor(i/width)+1}`;
const angle=n=>Number(n.toFixed(3)).toString();

export function mountSunPathPanel({getProject,notice}) {
  const panel=node('section');panel.id='solar-path';panel.className='panel study';
  panel.style.minWidth='0';panel.style.overflowWrap='anywhere';
  panel.innerHTML=`<h2>How does direct-sun obstruction change through the day?</h2>
    <p>Use the saved existing and proposed columns with a dated sun path. Enter a location and the grid's orientation; all calculations stay in this browser. The source fields record your basis, not a verified survey.</p>
    <div class="input-pair"><label>Latitude, degrees north<input id="sun-path-latitude" type="number" min="-89.999999" max="89.999999" step="any"></label><label>Longitude, degrees east<input id="sun-path-longitude" type="number" min="-180" max="180" step="any"></label></div>
    <label class="input-label">Location source or explicit assumption<input id="sun-path-location-source" maxlength="400"></label>
    <label class="input-label">Bearing of increasing grid columns, clockwise from true north<input id="sun-path-bearing" type="number" min="0" max="359.999999" step="any"></label>
    <p class="mini-note">For an east-right, south-down grid, enter 90°. Increasing rows must point 90° clockwise from increasing columns. A magnetic compass reading needs its own true-north correction; none is inferred here.</p>
    <label class="input-label">Orientation source or explicit assumption<input id="sun-path-orientation-source" maxlength="400"></label>
    <div class="input-pair sun-path-times"><label>Start, UTC<input id="sun-path-start" type="text" placeholder="2026-06-21T08:00:00Z" spellcheck="false"></label><label>End, UTC<input id="sun-path-end" type="text" placeholder="2026-06-21T18:00:00Z" spellcheck="false"></label></div>
    <p class="mini-note">Use explicit UTC timestamps with seconds and Z. To inspect a local day, enter that day's UTC endpoints. Dates and times are never interpreted in your device's time zone.</p>
    <label class="input-label">Sample interval, minutes<input id="sun-path-step" type="number" min="1" max="240" step="1" value="30"></label>
    <div class="obs-actions"><button id="sun-path-run" type="button" class="primary">Compare dated sun path</button><button id="sun-path-save" type="button" disabled>Save investigation with location and site</button></div>
    <p id="sun-path-status" role="status"></p>
    <label class="input-label">Inspect ground sample<select id="sun-path-cell"></select></label>
    <div id="sun-path-results"></div>
    <p class="mini-note">This inspection does not change the saved sun direction, columns or project file. Drafts disappear on reload. Save an investigation to retain its original site, geographic coordinates, source words and UTC inputs in a separate local file.</p>
    <details id="sun-path-retained"><summary>Reopen a retained sun-path investigation</summary>
      <p>Choose a saved investigation to recalculate its original site independently of the active project. The file contains declared inputs, including geographic location; it does not authenticate the sources.</p>
      <label class="input-label">Investigation JSON<input id="sun-path-open" type="file" accept="application/json,.json"></label>
      <p id="sun-path-open-status" role="status"></p>
      <div id="sun-path-retained-inspection" hidden>
        <p id="sun-path-retained-source"></p>
        <label class="input-label">Inspect retained ground sample<select id="sun-path-retained-cell"></select></label>
        <div id="sun-path-retained-results"></div>
      </div>
      <button id="sun-path-forget" type="button" disabled>Close retained investigation</button>
    </details>`;
  document.querySelector('#solar-occlusion').after(panel);
  panel.querySelector('.sun-path-times').style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%,240px),1fr))';
  const $=id=>panel.querySelector('#'+id);
  let signature='',size='',generation=0,report=null,reportSource=null;
  let openGeneration=0,retained=null;
  let currentSampling,retainedSampling,currentSpatial,retainedSpatial,dateComparison,bearingInspection,bearingCourse;
  const controls=['latitude','longitude','location-source','bearing','orientation-source','start','end','step'];

  function invalidate(message='Compare again after changing a declaration or source.') {
    currentSampling?.invalidate(message);generation++;report=null;reportSource=null;$('sun-path-save').disabled=true;$('sun-path-results').replaceChildren();
    $('sun-path-status').dataset.state='not-compared';$('sun-path-status').textContent=message;
    $('sun-path-run').disabled=false;$('sun-path-run').textContent='Compare dated sun path';currentSampling?.refresh();currentSpatial?.refresh();dateComparison?.refresh();bearingInspection?.refresh();bearingCourse?.refresh();
  }
  for(const id of controls)for(const event of ['input','change'])$('sun-path-'+id).addEventListener(event,()=>invalidate());
  const number=id=>{const value=$('sun-path-'+id).value.trim();if(value==='')throw Error('Enter the location, grid bearing and sample interval explicitly.');return Number(value);};
  function declaration() {
    return {latitudeDeg:number('latitude'),longitudeDeg:number('longitude'),gridColumnBearingDeg:number('bearing'),
      locationSource:$('sun-path-location-source').value,orientationSource:$('sun-path-orientation-source').value,
      startUtc:$('sun-path-start').value.trim(),endUtc:$('sun-path-end').value.trim(),stepMinutes:number('step')};
  }
  function add(parent,tag,text){const e=node(tag,text);parent.append(e);return e;}
  function drawCourse(out,report,cellIndex) {
    out.replaceChildren();if(!report)return;
    const rows=sunPathCellCourse(report,cellIndex);
    add(out,'h3',`Existing and proposal at ${cellName(report.width,cellIndex)}`);
    add(out,'p',`${rows.length} discrete samples from ${report.declaration.startUtc} through ${report.declaration.endUtc}. The final interval can be shorter than the chosen spacing. Counts do not measure hours of shade.`);
    add(out,'p',`Declared location: ${report.declaration.latitudeDeg}° north, ${report.declaration.longitudeDeg}° east. Source: ${report.declaration.locationSource}. Grid column bearing: ${report.declaration.gridColumnBearingDeg}° from true north. Source: ${report.declaration.orientationSource}.`);
    const counts=['existing','proposal'].map(target=>{
      const blocked=rows.filter(r=>r[target].status==='blocked').length;
      const unresolved=rows.filter(r=>['height-dependent','grazing'].includes(r[target].status)).length;
      return `${target}: ${blocked} blocked samples; ${unresolved} unresolved height/grazing samples`;
    });
    add(out,'p',counts.join('. ')+'. Other categories remain visible below.');

    const svg=svgNode('svg',{viewBox:'0 0 760 122',role:'img','aria-label':`Discrete obstruction samples over UTC time for ${cellName(report.width,cellIndex)}; full values in the following table.`});
    svg.style.width='100%';svg.style.height='auto';svg.style.display='block';
    const title=svgNode('title');title.textContent='Each dot is one evaluated time, with no interpolation between dots.';svg.append(title);
    const start=Date.parse(rows[0].utc),span=Date.parse(rows.at(-1).utc)-start;
    for(const [target,y]of [['existing',35],['proposal',75]]){
      const label=svgNode('text',{x:0,y:y+4,'font-size':15});label.textContent=target==='existing'?'Existing':'Proposal';svg.append(label);
      svg.append(svgNode('line',{x1:95,y1:y,x2:740,y2:y,stroke:'#dce5df'}));
      for(const row of rows){
        const dot=svgNode('circle',{cx:95+645*(Date.parse(row.utc)-start)/span,cy:y,r:Math.min(5,260/rows.length+1),fill:colors[row[target].status]});
        const tooltip=svgNode('title');tooltip.textContent=`${row.utc}: ${labels[row[target].status]}`;dot.append(tooltip);svg.append(dot);
      }
    }
    for(const [x,utc,anchor]of [[95,rows[0].utc,'start'],[740,rows.at(-1).utc,'end']]){
      const tick=svgNode('text',{x,y:110,'font-size':13,'text-anchor':anchor});tick.textContent=utc.slice(11,16)+' UTC';svg.append(tick);
    }
    out.append(svg);
    add(out,'p','Purple = blocked; amber = height-dependent; red = grazing; gold = no mapped blocker; gray = footprint; dark blue = centre below horizon; light blue = low elevation.');
    const wrapper=node('div');wrapper.className='joint-table-wrap';wrapper.tabIndex=0;wrapper.setAttribute('role','region');wrapper.setAttribute('aria-label','Sun-path sample table; scroll horizontally to inspect both scenarios');
    const table=node('table');const caption=add(table,'caption',`Sampled UTC times and retained witnesses for ${cellName(report.width,cellIndex)}`);caption.style.textAlign='left';
    const head=add(table,'thead',''),header=add(head,'tr','');
    for(const label of ['UTC instant','Sun / grid angles','Existing','Proposal']){const th=add(header,'th',label);th.scope='col';}
    const body=add(table,'tbody','');
    for(const row of rows){
      const tr=add(body,'tr','');tr.dataset.sunTime=row.utc;
      const th=add(tr,'th',row.utc);th.scope='row';
      add(tr,'td',`Elevation ${angle(row.elevationDeg)}°; azimuth ${angle(row.azimuthDeg)}°; grid heading ${angle(row.headingDeg)}°.`);
      for(const target of ['existing','proposal']){
        const result=row[target],td=add(tr,'td',labels[result.status]);td.dataset.target=target;td.dataset.status=result.status;
        if(result.witness)add(td,'p',`Witness ${cellName(report.width,result.witness.cellIndex)} (${result.witness.kind}): ${result.witness.source}`);
      }
    }
    wrapper.append(table);out.append(wrapper);
    add(out,'p',SUN_PATH_SEMANTICS);
    add(out,'p',`Calculated with ${report.model.name} ${report.model.version}, apparent altitude with its standard refraction approximation. Below 1° the existing obstruction model is not evaluated; no continuous night/visibility interval is inferred.`);
  }
  function draw() {drawCourse($('sun-path-results'),report,Number($('sun-path-cell').value));currentSampling?.refresh();currentSpatial?.refresh();dateComparison?.refresh();bearingInspection?.refresh();bearingCourse?.refresh();}
  function drawRetained() {drawCourse($('sun-path-retained-results'),retained?.report,Number($('sun-path-retained-cell').value));retainedSampling?.refresh();retainedSpatial?.refresh();dateComparison?.refresh();bearingInspection?.refresh();bearingCourse?.refresh();}
  function cellOptions(select,width,height,selected=0) {
    select.replaceChildren();
    for(let i=0;i<width*height;i++){const option=node('option',cellName(width,i));option.value=String(i);select.append(option);}
    select.value=String(Number.isInteger(selected)&&selected>=0&&selected<width*height?selected:0);
  }
  currentSpatial=mountSunPathSpatialPanel({host:$('sun-path-results').parentElement,prefix:'sun-path-spatial',getReport:()=>report,getCell:()=>$('sun-path-cell').value,onSelectCell:index=>{$('sun-path-cell').value=String(index);draw();}});
  retainedSpatial=mountSunPathSpatialPanel({host:$('sun-path-retained-inspection'),prefix:'sun-path-retained-spatial',getReport:()=>retained?.report,getCell:()=>$('sun-path-retained-cell').value,onSelectCell:index=>{$('sun-path-retained-cell').value=String(index);drawRetained();}});
  currentSampling=mountSunPathSamplingPanel({host:$('sun-path-results').parentElement,prefix:'sun-path-sampling',getStudy:()=>report&&reportSource?{project:reportSource,report}:null,getCell:()=>$('sun-path-cell').value,drawCourse});
  retainedSampling=mountSunPathSamplingPanel({host:$('sun-path-retained-inspection'),prefix:'sun-path-retained-sampling',getStudy:()=>retained?{project:retained.investigation.project,report:retained.report}:null,getCell:()=>$('sun-path-retained-cell').value,drawCourse});
  dateComparison=mountSunPathDatesPanel({host:panel,getCurrent:()=>report&&reportSource?{project:reportSource,report}:null,getRetained:()=>retained?{project:retained.investigation.project,report:retained.report}:null,drawCourse});
  bearingInspection=mountSolarBearingPanel({host:panel,getCurrent:()=>report&&reportSource?{project:reportSource,report}:null,getRetained:()=>retained?{project:retained.investigation.project,report:retained.report}:null});
  bearingCourse=mountSunBearingCoursePanel({host:panel,getCurrent:()=>report&&reportSource?{project:reportSource,report}:null,getRetained:()=>retained?{project:retained.investigation.project,report:retained.report}:null});
  $('sun-path-save').addEventListener('click',()=>{
    try {
      if(!report||!reportSource||sunPathContext(reportSource)!==sunPathContext(getProject()))throw Error('Compare the current source before saving an investigation.');
      const text=serializeSunPathInvestigation(reportSource,report.declaration,Number($('sun-path-cell').value));
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      const link=node('a');link.href=url;link.download='experimental-earth-sun-path.json';link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      notice('Saved investigation includes its original site, geographic coordinates and source words.');
    } catch(error){notice(error.message);}
  });
  $('sun-path-retained-cell').addEventListener('change',drawRetained);
  $('sun-path-open').addEventListener('change',async()=>{
    const file=$('sun-path-open').files?.[0];if(!file)return;
    dateComparison.cancel('New original investigation selected; pending date work cancelled.');bearingInspection.cancel('New original investigation selected; pending bearing work cancelled.');bearingCourse.cancel('New original investigation selected; pending common-bearing work cancelled.');retainedSampling.invalidate('New retained file selected; compare its finer grid after admission.');const token=++openGeneration;
    $('sun-path-open-status').dataset.state='opening';$('sun-path-open-status').textContent='Reading the retained inputs and recomputing their comparison…';
    // Closing also cancels an in-flight first import, before any inspection exists.
    $('sun-path-forget').disabled=false;
    try {
      checkSunPathInvestigationBytes(file.size);
      const text=await file.text();
      if(token!==openGeneration)return;
      const reopened=parseSunPathInvestigation(text);
      if(token!==openGeneration)return;
      retained=reopened;retainedSampling.invalidate('Retained source reopened. Compare a finer interval.');
      const source=retained.investigation.project;
      cellOptions($('sun-path-retained-cell'),source.width,source.height,retained.investigation.selectedCellIndex);
      $('sun-path-retained-source').textContent=`Retained source: ${source.title}. Grid ${source.width} × ${source.height}. Site source: ${source.source}. ${SUN_PATH_INVESTIGATION_LIMITS}`;
      $('sun-path-retained-inspection').hidden=false;drawRetained();
      $('sun-path-open-status').dataset.state='reopened';$('sun-path-open-status').textContent=`Recomputed ${retained.report.samples.length} complete samples from the file's original site. The active project is unchanged.`;
    } catch(error){
      if(token!==openGeneration)return;
      $('sun-path-open-status').dataset.state='refused';$('sun-path-open-status').textContent=`${error.message} ${retained?'The previously reopened investigation is still shown.':'No investigation was opened.'}`;
      notice(error.message);
    } finally {
      if(token===openGeneration){$('sun-path-open').value='';$('sun-path-forget').disabled=!retained;}
    }
  });
  $('sun-path-forget').addEventListener('click',()=>{
    retainedSampling.invalidate('Retained investigation closed.');openGeneration++;retained=null;retainedSpatial.clear();$('sun-path-open').value='';$('sun-path-retained-results').replaceChildren();
    $('sun-path-retained-cell').replaceChildren();$('sun-path-retained-source').textContent='';$('sun-path-retained-inspection').hidden=true;
    $('sun-path-open-status').dataset.state='closed';$('sun-path-open-status').textContent='Retained investigation closed. Its file and the active project are unchanged.';
    $('sun-path-forget').disabled=true;dateComparison.refresh();bearingInspection.refresh();bearingCourse.refresh();
  });
  $('sun-path-cell').addEventListener('change',draw);
  $('sun-path-run').addEventListener('click',()=>{
    invalidate();let input,source;
    try{input=declaration();source=structuredClone(getProject());}catch(error){$('sun-path-status').dataset.state='error';$('sun-path-status').textContent=error.message;notice(error.message);return;}
    const token=generation,context=sunPathContext(source);
    $('sun-path-run').disabled=true;$('sun-path-run').textContent='Calculating…';$('sun-path-status').textContent='Calculating the complete dated course…';
    setTimeout(()=>{
      if(token!==generation || context!==sunPathContext(getProject()))return;
      try {
        report=compareSunPath(source,input);reportSource=source;draw();$('sun-path-save').disabled=false;
        $('sun-path-status').dataset.state='compared';$('sun-path-status').textContent=`Compared ${report.samples.length} complete samples. Saved project and single-direction declaration are unchanged.`;
      } catch(error){report=null;$('sun-path-results').replaceChildren();$('sun-path-status').dataset.state='error';$('sun-path-status').textContent=error.message;notice(error.message);}
      finally{if(token===generation){$('sun-path-run').disabled=false;$('sun-path-run').textContent='Compare dated sun path';}}
    },20);
  });
  return {refresh(){
    const p=getProject(),next=sunPathContext(p),shape=`${p.width}x${p.height}`;
    if(shape!==size){cellOptions($('sun-path-cell'),p.width,p.height,Number($('sun-path-cell').value));size=shape;}
    if(next!==signature){signature=next;invalidate('Declare the location, orientation and UTC times, then compare the saved obstructions.');}
  }};
}

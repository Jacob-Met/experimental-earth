import {prepareLateralHeatStudy, validateLateralHeatStudy, compareLateralHeat, lateralHeatCurrent} from './lateral-heat.js';
const node = (tag, text = '') => {const x=document.createElement(tag);x.textContent=text;return x;};
const number = x => Number(x).toLocaleString('en-US',{maximumFractionDigits:4});
const cell = (p,i) => String.fromCharCode(65+i%p.width)+(Math.floor(i/p.width)+1);
const neighborFields=[
  ['absorptivity','Absorbed fraction of incident input',0,1],
  ['capacityJm2K','Heat capacity · J/(m²·K)',1000,10000000],
  ['exchangeWm2K','Exchange to the reservoir · W/(m²·K)',0,1000],
  ['initialC','Initial temperature · °C',-100,200],
];

export function mountLateralHeat({getProject}) {
  const panel=node('section');panel.id='lateral-heat';panel.className='panel';
  panel.innerHTML=`<span class="eyebrow">HEAT BETWEEN PLACES</span><h2>Does a surface change warm its neighbor?</h2>
    <p>Use the saved surface heat declaration for one cell and explicitly declare an adjacent cell. Compare both places with and without lateral heat exchange under the same exposure. The neighboring layer stays unchanged between plans.</p>
    <form id="lateral-form"><label class="input-label">Adjacent cell<select id="lateral-neighbor"></select></label>
    <div class="heat-layers"><fieldset><legend>Neighboring layer</legend>${neighborFields.map(([key,label,min,max])=>`<label class="input-label">${label}<input id="lateral-neighbor-${key}" type="number" min="${min}" max="${max}" step="any" required></label>`).join('')}
    <label class="input-label">Source or basis for the neighbor properties<textarea id="lateral-neighbor-source" rows="3" maxlength="600" required></textarea></label></fieldset>
    <fieldset><legend>Connection between the cells</legend>
    <label class="input-label">Total edge conductance · W/K<input id="lateral-conductance" type="number" min="0" max="1000" step="any" required></label>
    <label class="input-label">Source or basis for the connection<textarea id="lateral-edge-source" rows="3" maxlength="600" required></textarea></label></fieldset></div>
    <p class="mini-note">Edge conductance is total W/K across this shared edge, not W/(m²·K). It is not inferred from surface labels or cell size. Both cells receive the saved incident input and reservoir temperature.</p>
    <label class="input-label">Maximum split step · seconds<input id="lateral-step" type="number" min="1" max="300" step="any" value="30" required></label>
    <button id="lateral-example" type="button">Load fictional neighbor draft</button><button id="lateral-run" type="submit">Compare heat transfer</button></form>
    <div class="obs-actions"><button id="lateral-export" type="button" disabled>Download original inputs</button><label>Reopen original inputs<input id="lateral-import" type="file" accept="application/json,.json"></label><button id="lateral-current" type="button">Use current workspace</button></div>
    <p id="lateral-status" role="status"></p><div id="lateral-results"></div>
    <p class="mini-note">Two uniform cells with a declared constant connection; no resolved within-cell gradients, nonlinear radiation, evaporation or comfort prediction. Half-step differences disclose numerical sensitivity, not error bounds. Endpoint temperatures can miss interior peaks. These are declared model results, not observed site temperatures.</p>`;
  document.getElementById('surface-heat').after(panel);
  const $=id=>panel.querySelector('#'+id);
  let study=null, frozen=null, report=null, lastContext='', serial=0;
  const active=()=>frozen??getProject();
  function fillDraft(input) {
    for(const [key] of neighborFields)$('lateral-neighbor-'+key).value=input.neighbor[key];
    $('lateral-neighbor-source').value=input.neighbor.source;
    $('lateral-conductance').value=input.conductanceWK;$('lateral-edge-source').value=input.source;
  }
  function readDraft() {
    const neighbor={source:$('lateral-neighbor-source').value};
    for(const [key] of neighborFields){const value=$('lateral-neighbor-'+key).value;if(!value.trim())throw Error('Enter every neighboring layer property');neighbor[key]=Number(value);}
    const conductance=$('lateral-conductance').value;
    if(!conductance.trim())throw Error('Enter the total edge conductance');
    return {neighbor,conductanceWK:Number(conductance),source:$('lateral-edge-source').value};
  }
  function clear(message) {report=null;$('lateral-results').replaceChildren();$('lateral-export').disabled=true;$('lateral-status').textContent=message;}
  function choices() {
    const p=active(), selected=p.surfaceHeatStudy?.cellIndex, old=$('lateral-neighbor').value;
    $('lateral-neighbor').replaceChildren();
    if(Number.isInteger(selected)) for(let i=0;i<p.width*p.height;i++) {
      if(Math.abs(i%p.width-selected%p.width)+Math.abs(Math.floor(i/p.width)-Math.floor(selected/p.width))===1) {
        const option=node('option',cell(p,i));option.value=i;$('lateral-neighbor').append(option);
      }
    }
    if([...$('lateral-neighbor').options].some(o=>o.value===old))$('lateral-neighbor').value=old;
    $('lateral-run').disabled=!Number.isInteger(selected);
  }
  function draw() {
    const p=active(),host=$('lateral-results');host.replaceChildren();
    host.append(node('h3',`Heat transfer results · ${cell(p,study.heatStudy.cellIndex)} and ${cell(p,study.neighborIndex)} · ${number(report.durationMinutes)} minutes`));
    host.append(node('p',frozen?'Reopened original project: '+p.title+'; current workspace is unchanged.':'Current workspace and saved heat exposure.'));
    host.append(node('p',`Shared edge: ${number(study.conductanceWK)} W/K. ${study.source}. Neighbor: ${study.neighbor.source}`));
    const wrap=node('div');wrap.id='lateral-table-scroll';wrap.tabIndex=0;
    wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Neighboring-cell heat results; scroll horizontally to inspect every column');
    wrap.style.cssText='overflow-x:auto;width:100%;max-width:100%;min-width:0;outline-offset:2px';
    const table=node('table');table.style.cssText='width:100%;min-width:700px;border-collapse:collapse';
    const heading=node('tr');for(const text of ['Plan / minute','Changed cell °C','Neighbor °C','A → B kJ','Total residual J'])heading.append(node('th',text));table.append(heading);
    for(const target of ['existing','proposal']) {
      const result=report.results[target];
      for(const row of result.refined.trajectory) {
        const tr=node('tr');for(const value of [`${target} / ${number(row.minute)}`, ...row.temperaturesC.map(number),number(row.transferJ/1000),number(row.totalResidualJ)])tr.append(node('td',value));table.append(tr);
      }
      host.append(node('p',`${target}: without lateral exchange, final changed cell ${number(result.isolated.final.temperaturesC[0])} °C and neighbor ${number(result.isolated.final.temperaturesC[1])} °C. Largest schedule-boundary change after halving ${number(result.coarse.maxStepSeconds)} to ${number(result.refined.maxStepSeconds)} s: ${number(result.maximumBoundaryDifferenceC)} °C. The requested step is reduced when needed to resolve the declared exchange rates.`));
    }
    for(const row of table.rows)for(let i=0;i<row.cells.length;i++)row.cells[i].style.cssText=`padding:8px 12px;white-space:nowrap;text-align:${i===0?'left':'right'}`;
    wrap.append(table);const hint=node('p','On a narrow screen, swipe the table or focus it and use the left and right arrow keys to inspect every column.');hint.className='mini-note';
    host.append(hint,wrap,node('p',`Final proposal minus existing: changed cell ${number(report.proposalMinusExistingC[0])} °C; neighbor ${number(report.proposalMinusExistingC[1])} °C.`));
    const details=node('details'),summary=node('summary','Inspect signed cell energy accounting (joules)');details.append(summary);
    const pre=node('pre',JSON.stringify(Object.fromEntries(['existing','proposal'].map(t=>[t,report.results[t].refined.final])),null,2));pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';details.append(pre);host.append(details);
    $('lateral-export').disabled=false;$('lateral-status').textContent='Compared original inputs. Positive lateral transfer travels from the changed cell to its neighbor; negative travels back.';
  }
  $('lateral-example').addEventListener('click',()=>{
    fillDraft({neighbor:{absorptivity:.6,capacityJm2K:80000,exchangeWm2K:10,initialC:25,source:'Fictional neighboring layer; not a measured property'},conductanceWK:80,source:'Fictional shared-edge connection; not inferred from geometry'});serial++;clear('Fictional draft loaded. Compare to inspect it.');
  });
  for(const input of panel.querySelectorAll('form input, form textarea, form select'))input.addEventListener('input',()=>{serial++;clear('Draft changed; compare again.');});
  $('lateral-form').addEventListener('submit',event=>{
    event.preventDefault();serial++;clear('');
    try {const draft=readDraft();study=prepareLateralHeatStudy(active(),{...draft,neighborIndex:Number($('lateral-neighbor').value)});report=compareLateralHeat(active(),study,Number($('lateral-step').value));if(report.status!=='compared')throw Error('Original place or exposure changed');draw();}
    catch(error){clear(error.message);}
  });
  $('lateral-export').addEventListener('click',()=>{
    if(!report||!lateralHeatCurrent(active(),study))return clear('Original inputs changed; compare again.');
    const data={schema:'experimental-earth-lateral-bundle/1',project:active(),study,maxStepSeconds:report.maxStepSeconds};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    if(blob.size>4*1024*1024)return clear('Original-input bundle exceeds the 4 MiB reopen limit.');
    const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download='experimental-earth-lateral-heat.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('lateral-import').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;const ticket=++serial;
    try {if(file.size>4*1024*1024)throw Error('Original-input bundle exceeds 4 MiB');const bundle=JSON.parse(await file.text());if(ticket!==serial)throw Error('Draft changed during file read; reopen again');
      if(bundle.schema!=='experimental-earth-lateral-bundle/1')throw Error('Select a lateral heat original-input bundle');
      validateLateralHeatStudy(bundle.study);const next=compareLateralHeat(bundle.project,bundle.study,bundle.maxStepSeconds);
      if(next.status!=='compared')throw Error('The retained input bundle does not match its original source');
      frozen=bundle.project;study=bundle.study;report=next;choices();$('lateral-neighbor').value=study.neighborIndex;
      fillDraft(study);$('lateral-step').value=bundle.maxStepSeconds;draw();
    }catch(error){if(ticket===serial)clear(error.message);}finally{event.target.value='';}
  });
  $('lateral-current').addEventListener('click',()=>{serial++;frozen=null;study=null;choices();clear('Using current workspace; compare a new declaration.');});
  function refresh() {
    if(frozen)return;
    const p=getProject(),context=JSON.stringify([p.width,p.height,p.weather.cellSizeM,p.source,p.surfaceHeatStudy,p.existing,p.proposal]);
    if(context!==lastContext){serial++;lastContext=context;choices();clear(p.surfaceHeatStudy?'Workspace changed; compare with the current source.':'Save a surface heat declaration above to begin.');}
  }
  refresh();return {refresh};
}

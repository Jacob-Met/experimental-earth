import {pondingExposure, snapshotDepths} from './ponding-exposure.js';
import {parseRouteCells, routeThresholdWindows, routeDepthAtMinute} from './route-ponding.js';
import {routeBlockageAttribution} from './route-blockage.js';

/**
 * Same-time route question over existing solver results. The parent ponding
 * panel owns the time and depth controls; this review never edits site evidence.
 */
export function mountRoutePondingPanel({getProject, getResults}) {
  const parent=document.getElementById('ponding-replay');
  if(!parent) throw new Error('Ponding replay must be mounted before route inspection.');
  const panel=document.createElement('section');
  panel.className='panel';panel.id='route-ponding-review';
  panel.innerHTML=[
    '<div class="section-heading"><div><span class="eyebrow">CONNECT THE EVIDENCE</span><h2>Inspect a connected route</h2></div></div>',
    '<p>List an ordered route of distinct neighboring site cells, then compare simultaneous modeled ponding across the entire route. The minute and depth threshold are shared with <strong>Ponding through time</strong> above.</p>',
    '<form id="route-ponding-form">',
    '<label class="input-label" for="route-ponding-cells">Route cells (for example D3 E3 F3)</label>',
    '<input id="route-ponding-cells" type="text" maxlength="1024" autocomplete="off" placeholder="D3 E3 F3" style="box-sizing:border-box;max-width:100%;width:100%">',
    '<button type="submit" class="subtle">Inspect declared route</button>',
    '</form>',
    '<p id="route-ponding-error" role="alert"></p>',
    '<div id="route-ponding-now" aria-live="polite"></div>',
    '<div id="route-ponding-windows"></div>',
    '<p class="mini-note">This identifies simultaneous model-depth conditions, not actual route safety, a timed human traversal, an accessibility assessment or a field forecast. Interpolated crossings may miss short wet periods between solver steps. The route is an ephemeral query; it is not added to the project or its source evidence.</p>'
  ].join('');
  parent.after(panel);
  const $=id=>panel.querySelector('#'+id);
  const clock=document.getElementById('ponding-minute');
  const limit=document.getElementById('ponding-threshold');
  if(!clock || !limit) throw new Error('Original ponding time and threshold controls are missing.');
  const num=value=>Number(value.toFixed(2)).toLocaleString('en-US');
  const cellName=(i,p)=>String.fromCharCode(65+(i%p.width))+(Math.floor(i/p.width)+1);
  let declared=null, route=null, windows=null, blockage=null;
  function renderWindows() {
    const target=$('route-ponding-windows');
    target.replaceChildren();
    if(!route || !windows) return;
    const title=document.createElement('p');
    title.textContent='Authored route: '+route.labels.join(' → ')+' (current site and weather).';
    target.append(title);
    for(const [key,label] of [['existing','Existing'],['proposal','Proposal']]) {
      const finding=windows[key], disclosure=document.createElement('details');
      const summary=document.createElement('summary');
      summary.textContent=label+': '+num(finding.clearMinutes)+
        ' min when every listed cell is at/below '+num(Number(limit.value))+
        ' mm ('+finding.clearWindows.length+' continuous interval(s)).';
      disclosure.append(summary);
      if(finding.clearWindows.length) {
        const list=document.createElement('ol');list.style.overflowWrap='anywhere';
        for(const span of finding.clearWindows) {
          const item=document.createElement('li');
          item.textContent=num(span.startMinute)+'–'+num(span.endMinute)+
            ' min ('+num(span.endMinute-span.startMinute)+' min).';
          list.append(item);
        }
        disclosure.append(list);
      } else {
        const note=document.createElement('p');
        note.textContent='No positive-duration interval meets this same-time threshold.';
        disclosure.append(note);
      }
      const attribution=blockage[key];
      const attributionTitle=document.createElement('h3');
      attributionTitle.textContent='Where the route exceeds the threshold';
      disclosure.append(attributionTitle);
      const shared=document.createElement('p');
      shared.textContent='Multiple route cells exceed together for '+num(attribution.multipleAboveMinutes)+
        ' modeled min. Sole-cell time plus this shared time accounts for '+num(attribution.aboveMinutes)+
        ' min with at least one route cell above threshold.';
      disclosure.append(shared);
      const wetCells=attribution.cells.filter(cell=>cell.minutesAbove>0);
      if(wetCells.length) {
        const table=document.createElement('table');
        table.id='route-blockage-'+key;
        table.style.width='100%';table.style.borderCollapse='collapse';
        table.style.tableLayout='fixed';table.style.fontVariantNumeric='tabular-nums';
        const caption=document.createElement('caption');caption.style.textAlign='left';
        caption.textContent='Modeled minutes above '+num(Number(limit.value))+
          ' mm, ordered by sole-cell duration.';
        table.append(caption);
        const head=document.createElement('thead'),header=document.createElement('tr');
        for(const label of ['Cell','Sole cell above (min)','Above, including overlaps (min)']) {
          const th=document.createElement('th');th.scope='col';th.textContent=label;
          th.style.textAlign=label==='Cell'?'left':'right';th.style.padding='6px 4px';
          th.style.verticalAlign='bottom';if(label==='Cell')th.style.width='16%';header.append(th);
        }
        head.append(header);table.append(head);
        const body=document.createElement('tbody');
        for(const cell of wetCells) {
          const row=document.createElement('tr'),name=document.createElement('th');
          name.scope='row';name.textContent=cellName(cell.cellIndex,getProject());
          name.style.textAlign='left';name.style.padding='6px 4px';row.append(name);
          for(const value of [cell.soleAboveMinutes,cell.minutesAbove]) {
            const td=document.createElement('td');td.textContent=num(value);
            td.style.textAlign='right';td.style.padding='6px 4px';row.append(td);
          }
          body.append(row);
        }
        table.append(body);disclosure.append(table);
      } else {
        const clear=document.createElement('p');
        clear.textContent='No listed cell exceeds the threshold for a positive modeled duration.';
        disclosure.append(clear);
      }
      const meaning=document.createElement('p');meaning.className='mini-note';
      meaning.textContent='Sole-cell minutes mean that exactly one listed cell is above the threshold. '+
        'Individual above-threshold totals overlap and must not be added. '+
        'These are interpolated model conditions, not measurements or a forecast of what changing a cell would do.';
      disclosure.append(meaning);
      if(finding.aboveAtStart || finding.aboveAtEnd) {
        const note=document.createElement('p');
        note.textContent='The route exceeds the threshold at '+
          (finding.aboveAtStart&&finding.aboveAtEnd?'both modeled endpoints.':
           finding.aboveAtStart?'the start of the event.':'the end of the event.')+
          ' Conditions outside the modeled event are unknown.';
        disclosure.append(note);
      }
      target.append(disclosure);
    }
    const delta=windows.proposal.clearMinutes-windows.existing.clearMinutes;
    const p=document.createElement('p');
    p.textContent='Proposal minus existing: '+(delta>0?'+':'')+num(delta)+
      ' modeled minutes meeting the simultaneous depth condition; not a traversal guarantee.';
    target.append(p);
  }
  function drawAtMinute() {
    const target=$('route-ponding-now');target.replaceChildren();
    if(!route || !windows) return;
    const project=getProject(),results=getResults(),minute=Number(clock.value);
    const threshold=Number(limit.value);
    for(const [key,label] of [['existing','Existing'],['proposal','Proposal']]) {
      const depths=snapshotDepths(results[key],minute);
      const status=routeDepthAtMinute(depths,route.indices,threshold);
      const p=document.createElement('p');
      p.textContent=label+' at '+num(minute)+' min: deepest route cell '+
        cellName(status.maxCellIndex,project)+' = '+num(status.maxDepthMm)+' mm. '+
        (status.everyCellAtOrBelow?'All route cells at/below threshold.':
          'One or more route cells above threshold.');
      target.append(p);
    }
  }
  function refresh() {
    const project=getProject(), results=getResults();
    if(declared!==null) {
      try {
        const next=parseRouteCells(declared,project.width,project.height);
        const threshold=Number(limit.value);
        const start=results.existing.snapshots[0].minute;
        const end=results.existing.snapshots.at(-1).minute;
        const exposures={
          existing:pondingExposure(results.existing,threshold),
          proposal:pondingExposure(results.proposal,threshold)
        };
        const nextWindows={
          existing:routeThresholdWindows(exposures.existing,next.indices,start,end),
          proposal:routeThresholdWindows(exposures.proposal,next.indices,start,end)
        };
        const nextBlockage={
          existing:routeBlockageAttribution(exposures.existing,next.indices,start,end),
          proposal:routeBlockageAttribution(exposures.proposal,next.indices,start,end)
        };
        route=next;windows=nextWindows;blockage=nextBlockage;
        $('route-ponding-error').textContent='';
      } catch(error) {
        route=null;windows=null;blockage=null;
        $('route-ponding-error').textContent='Route query cannot be evaluated for this site: '+error.message;
      }
    }
    renderWindows();drawAtMinute();
  }
  $('route-ponding-form').addEventListener('submit',event=>{
    event.preventDefault();declared=$('route-ponding-cells').value;refresh();
  });
  clock.addEventListener('input',drawAtMinute);
  limit.addEventListener('change',refresh);
  return {refresh};
}


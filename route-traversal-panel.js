import {pondingExposure} from './ponding-exposure.js';
import {parseSegmentMinutes, timedRouteWindows, inspectTimedRoute} from './route-traversal.js';

/** Additive, explicitly hypothetical moving-route question. The existing route,
 * threshold and replay belong to the parent inspector and cannot be edited here. */
export function mountTimedTraversal({parent, getProject, getResults, getRoute, getThreshold}) {
  const section=document.createElement('section');
  section.id='route-traversal-review';
  section.innerHTML=[
    '<div class="section-heading"><div><span class="eyebrow">CONDITIONAL TIMING</span><h3>Test a moving traversal</h3></div></div>',
    '<p>The simultaneous route inspection above considers every cell at one time. This separate question visits the cells at <strong>declared arrival times</strong>. Specify hypothetical minutes between cells; no walking speed, ground distance or route safety is inferred.</p>',
    '<form id="route-traversal-form">',
    '<label class="input-label" for="route-traversal-steps">Minutes per step (one for every step, or a comma-separated time for each step)</label>',
    '<input id="route-traversal-steps" type="text" maxlength="512" autocomplete="off" placeholder="2, 3" style="box-sizing:border-box;max-width:100%;width:100%" required>',
    '<label class="input-label" for="route-traversal-start">Earliest departure minute</label>',
    '<input id="route-traversal-start" type="number" min="0" step="any" placeholder="0" required>',
    '<label class="input-label" for="route-traversal-end">Latest departure minute</label>',
    '<input id="route-traversal-end" type="number" min="0" step="any" placeholder="30" required>',
    '<button type="submit" class="subtle">Compare moving departures</button>',
    '</form>',
    '<p id="route-traversal-error" role="alert"></p>',
    '<div id="route-traversal-results" aria-live="polite"></div>',
    '<section id="route-traversal-inspection" hidden>',
    '<h4>Inspect one departure</h4>',
    '<p id="route-traversal-inspection-context"></p>',
    '<form id="route-traversal-inspection-form">',
    '<label class="input-label" for="route-traversal-departure">Departure minute to inspect</label>',
    '<input id="route-traversal-departure" type="number" step="any" required>',
    '<button type="submit" class="subtle">Inspect chosen departure</button>',
    '</form>',
    '<p id="route-traversal-inspection-error" role="alert"></p>',
    '<div id="route-traversal-inspection-results" aria-live="polite"></div>',
    '</section>'
  ].join('');
  parent.append(section);
  const $=id=>section.querySelector('#'+id);
  const num=v=>Number(v.toFixed(2)).toLocaleString('en-US');
  const cellName=(i,p)=>String.fromCharCode(65+(i%p.width))+(Math.floor(i/p.width)+1);
  const precise=v=>v.toLocaleString('en-US',{maximumSignificantDigits:6,useGrouping:false});
  let declared=null, inspectionMinute=null;
  function clearInspection({hide=false,forget=false}={}) {
    $('route-traversal-inspection-error').textContent='';
    $('route-traversal-inspection-results').replaceChildren();
    if(hide) $('route-traversal-inspection').hidden=true;
    if(forget) {
      inspectionMinute=null;
      $('route-traversal-departure').value='';
    }
  }
  function reset() {
    declared=null;
    $('route-traversal-error').textContent='';
    $('route-traversal-results').replaceChildren();
    clearInspection({hide:true,forget:true});
  }
  function readContext() {
    const route=getRoute(), project=getProject(),results=getResults();
    if(!route) throw new Error('Inspect a valid neighboring-cell route first.');
    const segmentMinutes=parseSegmentMinutes(declared.steps,route.indices.length);
    const start=results.existing.snapshots[0].minute;
    const end=results.existing.snapshots.at(-1).minute;
    if(results.proposal.snapshots[0].minute!==start ||
        results.proposal.snapshots.at(-1).minute!==end) {
      throw new Error('Existing and proposal models need a matching retained time horizon.');
    }
    return {route,project,results,segmentMinutes,start,end,threshold:getThreshold()};
  }
  function renderInspection({route,project,results,segmentMinutes,threshold}) {
    if(inspectionMinute===null) return;
    const target=$('route-traversal-inspection-results');
    try {
      if(!Number.isFinite(inspectionMinute) || inspectionMinute<declared.from ||
          inspectionMinute>declared.until) {
        throw new Error('Choose a finite departure within the comparison interval, including its endpoints.');
      }
      // Compute both scenarios before exposing rows: a refusal must not leave
      // one scenario's old or partial evidence visible.
      const findings={};
      for(const key of ['existing','proposal']) {
        findings[key]=inspectTimedRoute(results[key],route.indices,
          segmentMinutes,inspectionMinute,threshold);
      }
      const fragment=document.createDocumentFragment();
      const lead=document.createElement('p');
      lead.textContent='Inspecting departure '+String(inspectionMinute)+' min against '+
        precise(threshold)+' mm.';
      fragment.append(lead);
      for(const [key,label] of [['existing','Existing'],['proposal','Proposal']]) {
        const finding=findings[key],failed=finding.firstFailure;
        const summary=document.createElement('p');
        summary.textContent=failed
          ? label+': first modeled exceedance is '+cellName(failed.cellIndex,project)+
            ' at arrival minute '+precise(failed.minute)+' ('+precise(failed.depthMm)+' mm).'
          : label+': every cell is at/below the threshold at its declared arrival.';
        fragment.append(summary);
        const region=document.createElement('div');
        region.style.cssText='max-height:24rem;max-width:100%;overflow:auto';
        region.tabIndex=0;
        region.setAttribute('role','region');
        region.setAttribute('aria-label',label+' modeled arrival evidence');
        const table=document.createElement('table');
        table.dataset.scenario=key;
        table.style.cssText='width:100%;border-collapse:collapse';
        const caption=document.createElement('caption');
        caption.textContent=label+' arrivals at departure '+String(inspectionMinute)+' min';
        caption.style.cssText='text-align:left;font-weight:600';
        table.append(caption);
        const head=document.createElement('thead'),headRow=document.createElement('tr');
        for(const title of ['Cell','Arrival (min)','Depth (mm)','Threshold comparison']) {
          const cell=document.createElement('th');
          cell.scope='col';cell.textContent=title;
          cell.style.cssText='padding:.35rem .5rem;text-align:left';
          headRow.append(cell);
        }
        head.append(headRow);table.append(head);
        const body=document.createElement('tbody');
        for(const arrival of finding.arrivals) {
          const row=document.createElement('tr');
          row.dataset.cellIndex=String(arrival.cellIndex);
          row.dataset.routePosition=String(arrival.routePosition);
          const first=failed?.routePosition===arrival.routePosition;
          const above=arrival.depthMm>threshold;
          const values=[cellName(arrival.cellIndex,project),precise(arrival.minute),
            precise(arrival.depthMm),above?(first?'Above — first exceedance':'Above'):'At/below'];
          values.forEach((value,index)=>{
            const cell=document.createElement(index===0?'th':'td');
            if(index===0) cell.scope='row';
            cell.textContent=value;
            cell.style.cssText='padding:.35rem .5rem;text-align:left;vertical-align:top';
            if(index===1 || index===2) {
              cell.title=String(index===1?arrival.minute:arrival.depthMm);
            }
            row.append(cell);
          });
          body.append(row);
        }
        table.append(body);region.append(table);fragment.append(region);
      }
      const note=document.createElement('p');note.className='mini-note';
      note.textContent='These findings apply to the selected departure instant; an all-cell result does not establish a positive-duration qualifying window. Arrival times and depths are rounded for display; threshold comparisons use the retained model values. No safe traversal or physical flood conditions are established.';
      fragment.append(note);target.append(fragment);
    } catch(error) {
      target.replaceChildren();
      $('route-traversal-inspection-error').textContent='Departure inspection cannot be evaluated: '+error.message;
    }
  }
  function refresh() {
    const target=$('route-traversal-results');
    target.replaceChildren();
    clearInspection({hide:true});
    if(!declared) return;
    try {
      const context=readContext();
      const {route,project,results,segmentMinutes,start,end,threshold}=context;
      const findings={};
      for(const key of ['existing','proposal']) {
        findings[key]={
          windows:timedRouteWindows(pondingExposure(results[key],threshold),route.indices,
            segmentMinutes,start,end,declared.from,declared.until),
          requested:inspectTimedRoute(results[key],route.indices,
            segmentMinutes,declared.from,threshold)
        };
      }
      $('route-traversal-error').textContent='';
      const lead=document.createElement('p');
      lead.textContent='Declared travel: '+segmentMinutes.map(num).join(', ')+
        ' modeled min per step. Departure interval '+num(declared.from)+'–'+num(declared.until)+
        ' min; every route arrival is inside the retained replay.';
      target.append(lead);
      const precision=document.createElement('p');precision.className='mini-note';
      precision.textContent='Approximate departure intervals: bounds and totals below are rounded to 2 decimal places. Inspect a specific departure below for the modeled depth at every arrival.';
      target.append(precision);
      for(const [key,label] of [['existing','Existing'],['proposal','Proposal']]) {
        const finding=findings[key], w=finding.windows;
        const summary=document.createElement('p');
        summary.textContent=label+': '+num(w.clearMinutes)+' modeled departure minutes in '+
          w.clearWindows.length+' continuous qualifying interval(s). '+
          (w.earliestFeasibleDepartureMinute===null
            ? 'No positive-duration modeled departure window qualifies.'
            : 'Earliest qualifying interval starts at minute '+num(w.earliestFeasibleDepartureMinute)+'.');
        target.append(summary);
        if(w.clearWindows.length) {
          const list=document.createElement('ol');
          list.style.overflowWrap='anywhere';
          for(const window of w.clearWindows) {
            const item=document.createElement('li');
            item.textContent='Depart '+num(window.startMinute)+'–'+num(window.endMinute)+' min.';
            list.append(item);
          }
          target.append(list);
        }
        const sample=document.createElement('p'),failed=finding.requested.firstFailure;
        sample.textContent=failed
          ? 'At earliest requested departure '+num(declared.from)+' min, first modeled exceedance is '+
            cellName(failed.cellIndex,project)+' at arrival minute '+num(failed.minute)+
            ' ('+num(failed.depthMm)+' mm).'
          : 'At earliest requested departure '+num(declared.from)+
            ' min, every cell is at/below threshold at its modeled arrival.';
        target.append(sample);
      }
      const diff=findings.proposal.windows.clearMinutes-findings.existing.windows.clearMinutes;
      const delta=document.createElement('p');
      delta.textContent='Proposal minus existing: '+(diff>0?'+':'')+num(diff)+
        ' modeled departure minutes satisfying these conditional arrival-depth comparisons.';
      target.append(delta);
      const note=document.createElement('p');
      note.className='mini-note';
      note.textContent='These conditional interpolated model-depth comparisons do not establish safe human traversal, accessibility, walking speeds or physical flood conditions. Isolated threshold-equality instants are not counted as positive-duration departure windows.';
      target.append(note);
      $('route-traversal-inspection').hidden=false;
      const input=$('route-traversal-departure');
      input.min=String(declared.from);input.max=String(declared.until);
      if(inspectionMinute===null && input.value==='') input.value=String(declared.from);
      $('route-traversal-inspection-context').textContent='Choose one departure from '+
        String(declared.from)+' to '+String(declared.until)+' min, including either endpoint. This inspects the comparison above without changing its interval. Changes to timing inputs apply when you compare again.';
      renderInspection(context);
    } catch(error) {
      $('route-traversal-error').textContent='Timed traversal cannot be evaluated: '+error.message;
    }
  }
  $('route-traversal-form').addEventListener('submit',event=>{
    event.preventDefault();
    clearInspection({hide:true,forget:true});
    declared={
      steps:$('route-traversal-steps').value,
      from:Number($('route-traversal-start').value),
      until:Number($('route-traversal-end').value)
    };
    refresh();
  });
  $('route-traversal-inspection-form').addEventListener('submit',event=>{
    event.preventDefault();
    inspectionMinute=$('route-traversal-departure').valueAsNumber;
    refresh();
  });
  $('route-traversal-departure').addEventListener('input',()=>{
    // The visible rows describe the last submitted instant, not this draft.
    // Remove them as soon as the field changes so they cannot be mistaken for
    // evidence for the value currently in the control.
    if(inspectionMinute!==null) {
      inspectionMinute=null;
      clearInspection();
      $('route-traversal-inspection-error').textContent='Departure changed. Inspect the chosen departure to update the arrival evidence.';
    }
  });
  $('route-traversal-inspection-form').addEventListener('invalid',()=>{
    clearInspection();inspectionMinute=null;
    $('route-traversal-inspection-error').textContent='Choose a finite departure within the comparison interval, including its endpoints.';
  },true);
  $('route-traversal-form').addEventListener('invalid',()=>{
    $('route-traversal-error').textContent=$('route-traversal-results').hasChildNodes()
      ? 'Timing changes were not compared. Previous results remain in view.'
      : 'Enter valid timing inputs before comparing departures.';
  },true);
  return {refresh,reset};
}

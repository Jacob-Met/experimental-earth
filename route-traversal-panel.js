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
    '<div id="route-traversal-results" aria-live="polite"></div>'
  ].join('');
  parent.append(section);
  const $=id=>section.querySelector('#'+id);
  const num=v=>Number(v.toFixed(2)).toLocaleString('en-US');
  const cellName=(i,p)=>String.fromCharCode(65+(i%p.width))+(Math.floor(i/p.width)+1);
  let declared=null;
  function reset() {
    declared=null;
    $('route-traversal-error').textContent='';
    $('route-traversal-results').replaceChildren();
  }
  function refresh() {
    const target=$('route-traversal-results');
    target.replaceChildren();
    if(!declared) return;
    try {
      const route=getRoute(), project=getProject(),results=getResults();
      if(!route) throw new Error('Inspect a valid neighboring-cell route first.');
      const segmentMinutes=parseSegmentMinutes(declared.steps,route.indices.length);
      const start=results.existing.snapshots[0].minute;
      const end=results.existing.snapshots.at(-1).minute;
      if (results.proposal.snapshots[0].minute!==start ||
          results.proposal.snapshots.at(-1).minute!==end) {
        throw new Error('Existing and proposal models need a matching retained time horizon.');
      }
      const threshold=getThreshold();
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
    } catch(error) {
      $('route-traversal-error').textContent='Timed traversal cannot be evaluated: '+error.message;
    }
  }
  $('route-traversal-form').addEventListener('submit',event=>{
    event.preventDefault();
    declared={
      steps:$('route-traversal-steps').value,
      from:Number($('route-traversal-start').value),
      until:Number($('route-traversal-end').value)
    };
    refresh();
  });
  return {refresh,reset};
}

import { pondingNumber } from './number-format.js';
import { pondingExposure, snapshotDepths } from './ponding-exposure.js';

export function mountPondingPanel({ getProject, getResults }) {
  const panel=document.createElement('section');
  panel.className='panel';panel.id='ponding-replay';
  panel.innerHTML=`<div class="section-heading"><div><span class="eyebrow">FOLLOW THE WATER</span><h2>Ponding through time</h2></div></div>
    <p>Inspect the same modeled minute in both places, then compare how long each cell stays above a chosen depth.</p>
    <label class="input-label">Replay minute <output id="ponding-minute-label"></output><input id="ponding-minute" type="range" min="0" step="any" value="0"></label>
    <label class="input-label">Depth threshold (mm)<input id="ponding-threshold" type="number" min="0.01" max="1000" step="any" value="10"></label>
    <p id="ponding-error" role="alert"></p>
    <div class="maps"><div class="map-col"><h3>Existing · depth now</h3><div class="grid" id="ponding-existing" role="group" aria-label="Existing replay cells"></div></div><div class="map-col"><h3>Proposal · depth now</h3><div class="grid" id="ponding-proposal" role="group" aria-label="Proposal replay cells"></div></div></div>
    <div id="ponding-detail" aria-live="polite"></div>
    <p class="mini-note">Duration counts depth strictly above the threshold. Crossing times and replay depths use straight-line interpolation between saved solver snapshots; brief peaks or dry gaps between them may be missed. These are modeled exposure diagnostics, not measured durations, flood predictions or access-safety ratings.</p>`;
  document.getElementById('maps').after(panel);
  const $=id=>panel.querySelector('#'+id);
  let selected=0, exposure, threshold=10;
  const num=pondingNumber;
  const cellName=(i,p)=>`${String.fromCharCode(65+i%p.width)}${Math.floor(i/p.width)+1}`;
  function draw() {
    const project=getProject(), results=getResults(), minute=Number($('ponding-minute').value);
    $('ponding-minute-label').textContent=`${num(minute)} / ${num(project.weather.durationMinutes)} min`;
    for(const target of ['existing','proposal']) {
      const grid=$('ponding-'+target);grid.style.gridTemplateColumns=`repeat(${project.width},minmax(0,1fr))`;
      const depths=snapshotDepths(results[target],minute), fragment=document.createDocumentFragment();
      depths.forEach((depth,i)=>{
        const button=document.createElement('button');button.type='button';button.className='replay-cell';button.setAttribute('aria-pressed',String(i===selected));
        button.style.cssText='min-width:0;padding:7px 2px;font-size:10px;overflow-wrap:anywhere;aspect-ratio:1;border-radius:4px';
        button.style.outline=i===selected?'2px solid #173a36':'none';
        button.style.background=`hsl(185 40% ${92-Math.min(45,depth*2)}%)`;
        button.textContent=`${cellName(i,project)}: ${num(depth)} mm`;
        button.setAttribute('aria-label',`${target} ${cellName(i,project)}, ${num(depth)} mm at ${num(minute)} minutes, ${num(exposure[target][i].minutesAbove)} minutes above ${threshold} mm`);
        button.addEventListener('click',()=>{selected=i;draw();});fragment.append(button);
      });grid.replaceChildren(fragment);
    }
    const a=exposure.existing[selected],b=exposure.proposal[selected], detail=$('ponding-detail');detail.replaceChildren();
    const heading=document.createElement('h3');heading.textContent=`Cell ${cellName(selected,project)} · time above ${num(threshold)} mm`;detail.append(heading);
    for(const [label,value] of [['Existing',a],['Proposal',b]]) {
      const p=document.createElement('p');
      p.textContent=`${label}: ${num(value.minutesAbove)} min. `+(value.intervals.length?`Wet intervals: ${value.intervals.map(x=>`${num(x.startMinute)}–${num(x.endMinute)} min`).join('; ')}.`:'No retained interval above threshold.');detail.append(p);
      const integral=document.createElement('p');
      integral.textContent=`${label}: ${num(value.excessMmMinutes)} mm·min accumulated depth above threshold. `+(value.aboveAtStart?'Already above threshold at the first snapshot; earlier onset unknown. ':'')+(value.aboveAtEnd?'Still above threshold at the last snapshot; later clearance unknown.':'');detail.append(integral);
    }
    const delta=document.createElement('p'), difference=b.minutesAbove-a.minutesAbove;
    delta.textContent=`Proposal minus existing: ${difference>0?'+':''}${num(difference)} min. Both use the same modeled event (${num(project.weather.stepMinutes)} min solver step).`;detail.append(delta);
  }
  function refresh() {
    const project=getProject(), results=getResults();
    selected=Math.min(selected,project.width*project.height-1);
    $('ponding-minute').max=project.weather.durationMinutes;
    $('ponding-minute').value=Math.min(Number($('ponding-minute').value),project.weather.durationMinutes);
    exposure={existing:pondingExposure(results.existing,threshold),proposal:pondingExposure(results.proposal,threshold)};
    draw();
  }
  $('ponding-minute').addEventListener('input',draw);
  $('ponding-threshold').addEventListener('change',()=>{
    const next=Number($('ponding-threshold').value);
    try { pondingExposure(getResults().existing,next);threshold=next;$('ponding-error').textContent='';refresh(); }
    catch(error){$('ponding-error').textContent=error.message;$('ponding-threshold').value=threshold;}
  });
  return {refresh};
}

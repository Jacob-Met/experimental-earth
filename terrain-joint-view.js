import { INTERVENTION_METRICS } from './intervention-study.js';
const fmt=n=>n!==0&&Math.abs(n)<.0001?n.toExponential(3):Number(n).toLocaleString('en-US',{maximumFractionDigits:5});
const name=(i,w)=>`${String.fromCharCode(65+i%w)}${Math.floor(i/w)+1}`;
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export function renderJointTerrain(output,report,width){
  const names=report.cellIndices.map(i=>name(i,width));
  output.append(el('p',`${report.candidateCount} finite combinations; rows ${names[0]}, columns ${names[1]}. Offsets are metres relative to each supplied central height. Every entry is proposal − existing.`));
  for(const [a,axis] of report.axes.entries())output.append(el('p',`${names[a]}: ${axis.source.fileName}, line ${axis.source.line}; ${axis.source.elevationValue} ± ${axis.source.uncertaintyValue} ${axis.source.unit}; datum ${axis.source.datum}; ${axis.source.source}. Fixed authored change ${fmt(axis.interventionDeltaM)} m.`));
  output.append(el('p','These combinations are declared hypotheses, not an inferred error correlation or a claim that every combination is physically possible. Finite samples do not bound the continuous intervals. Negative differences mean a smaller modeled quantity, not an overall benefit. Peak depths compare separate maxima, which need not occur at the same time.'));
  const label=el('label','Quantity in the two-axis table '),metric=document.createElement('select');metric.id='terrain-joint-metric';
  for(const [key,m]of Object.entries(INTERVENTION_METRICS)){const option=el('option',`${m.label} (${m.unit})`);option.value=key;metric.append(option);}metric.value='peakPondingLiters';label.append(metric);output.append(label);
  const scroll=el('div');scroll.style.overflowX='auto';scroll.tabIndex=0;scroll.setAttribute('aria-label','Scrollable table of combined ground-height hypotheses');
  const table=el('table');table.id='terrain-joint-matrix';table.style.width='100%';table.style.borderCollapse='collapse';scroll.append(table);output.append(scroll);
  const selected=el('section');selected.id='terrain-joint-selected';selected.setAttribute('aria-live','polite');output.append(selected);
  let selection=Math.floor(report.sampleCount/2)*report.sampleCount+Math.floor(report.sampleCount/2);
  function detail(){
    const c=report.candidates[selection];selected.replaceChildren(el('h3',`Selected combination: ${names.map((n,a)=>`${n} ${fmt(c.offsetsM[a])} m`).join(' / ')}`));
    c.elevations.forEach(e=>selected.append(el('p',`${name(e.cellIndex,width)}: existing ${fmt(e.existingElevationM)} m → proposal ${fmt(e.proposalElevationM)} m`)));
    for(const[key,m]of Object.entries(INTERVENTION_METRICS)){const row=c.metrics[key];selected.append(el('p',`${m.label}: existing ${fmt(row.existing)}; proposal ${fmt(row.proposal)}; difference ${fmt(row.delta)} ${m.unit}`));}
    const local=el('details');local.append(el('summary','Inspect final and peak depth at every cell'));
    for(const row of c.cells)local.append(el('p',`${name(row.cellIndex,width)} · final: ${fmt(row.existingFinalMm)} → ${fmt(row.proposalFinalMm)} mm (difference ${fmt(row.finalDeltaMm)}); peak: ${fmt(row.existingPeakMm)} → ${fmt(row.proposalPeakMm)} mm (difference ${fmt(row.peakDeltaMm)}).`));selected.append(local);
    for(const button of table.querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.index)===selection));
  }
  function matrix(){
    table.replaceChildren();table.append(el('caption',`${INTERVENTION_METRICS[metric.value].label}: proposal − existing (${INTERVENTION_METRICS[metric.value].unit})`));
    const head=el('thead'),header=el('tr');header.append(el('th',`${names[0]} ↓ / ${names[1]} →`));
    for(const offset of report.axes[1].offsets){const th=el('th',`${fmt(offset)} m`);th.scope='col';th.style.whiteSpace='nowrap';header.append(th);}head.append(header);table.append(head);
    const body=el('tbody');
    for(let row=0;row<report.sampleCount;row++){const tr=el('tr'),th=el('th',`${fmt(report.axes[0].offsets[row])} m`);th.scope='row';th.style.whiteSpace='nowrap';tr.append(th);
      for(let col=0;col<report.sampleCount;col++){const index=row*report.sampleCount+col,c=report.candidates[index],td=el('td'),button=el('button',fmt(c.metrics[metric.value].delta));button.type='button';button.className='subtle';button.dataset.index=String(index);button.style.minWidth='76px';button.style.whiteSpace='nowrap';button.style.padding='12px 8px';button.setAttribute('aria-label',`${names[0]} offset ${fmt(c.offsetsM[0])} m, ${names[1]} offset ${fmt(c.offsetsM[1])} m: ${fmt(c.metrics[metric.value].delta)} ${INTERVENTION_METRICS[metric.value].unit}`);button.addEventListener('click',()=>{selection=index;detail();});td.append(button);tr.append(td);}body.append(tr);}
    table.append(body);detail();
  }
  metric.addEventListener('change',matrix);matrix();
}

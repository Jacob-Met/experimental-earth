import { INTERVENTION_METRICS } from './intervention-study.js';
const fmt=n=>n!==0&&Math.abs(n)<.0001?n.toExponential(3):Number(n).toLocaleString('en-US',{maximumFractionDigits:5});
const name=(i,w)=>`${String.fromCharCode(65+i%w)}${Math.floor(i/w)+1}`;
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
function disclosure(title){const node=el('details');node.append(el('summary',title));return node;}
export function renderSharedGround(output,report,width){
 output.append(el('p',`Declared basis: ${report.basis}`));
 output.append(el('p',`${report.cellIndices.length} supplied cells share the same additive offset. Requested interval: ±${fmt(report.commonHalfWidthM)} m. Largest interval fitting every selected source: ±${fmt(report.maximumHalfWidthM)} m.`));
 const ledger=disclosure(`Inspect all ${report.axes.length} selected sources and limiting intervals`);ledger.id='shared-ground-ledger';
 for(const axis of report.axes){const s=axis.source;ledger.append(el('p',`${name(axis.cellIndex,width)}${report.limitingCellIndices.includes(axis.cellIndex)?' · limiting interval':''}: existing ${fmt(axis.originalExisting.elevationM)} m → proposal ${fmt(axis.originalProposal.elevationM)} m; authored change ${fmt(axis.interventionDeltaM)} m. ${s.fileName}, line ${s.line}; ${s.elevationValue} ± ${s.uncertaintyValue} ${s.unit}; datum ${s.datum}; ${s.source}`));}output.append(ledger);
 const references=disclosure(`Fixed references: ${report.fixedReferences.crests.length} declared absolute crests and ${report.fixedReferences.unselectedTerrain.length} unselected ground cells`);references.id='shared-ground-references';
 if(!report.fixedReferences.crests.length)references.append(el('p','No absolute internal crests are declared.'));
 for(const c of report.fixedReferences.crests)references.append(el('p',`${c.target} ${name(c.cellIndex,width)} ${c.edge}: fixed crest ${fmt(c.crestElevationM)} m; ${c.source}`));
 if(!report.fixedReferences.unselectedTerrain.length)references.append(el('p','Every ground cell is explicitly selected.'));
 for(const c of report.fixedReferences.unselectedTerrain)references.append(el('p',`${name(c.cellIndex,width)} remains fixed: existing ${fmt(c.existingElevationM)} m; proposal ${fmt(c.proposalElevationM)} m.`));output.append(references);
 const label=el('label','Sampled difference '),metric=el('select');metric.id='shared-ground-metric';for(const[key,m]of Object.entries(INTERVENTION_METRICS)){const option=el('option',`${m.label} (${m.unit})`);option.value=key;metric.append(option);}metric.value='peakPondingLiters';label.append(metric);output.append(label);
 const table=el('table');table.id='shared-ground-samples';table.style.width='100%';output.append(table);
 const selected=el('section');selected.id='shared-ground-selected';selected.setAttribute('aria-live','polite');output.append(selected);let index=(report.sampleCount-1)/2;
 function detail(){const c=report.candidates[index];selected.replaceChildren(el('h4',`Selected shared offset: ${fmt(c.offsetM)} m (${c.label})`));
  for(const[key,m]of Object.entries(INTERVENTION_METRICS)){const v=c.metrics[key];selected.append(el('p',`${m.label}: existing ${fmt(v.existing)}; proposal ${fmt(v.proposal)}; difference ${fmt(v.delta)} ${m.unit}`));}
  const heights=disclosure('Inspect every selected hypothetical elevation');for(const e of c.elevations)heights.append(el('p',`${name(e.cellIndex,width)}: existing ${fmt(e.existingElevationM)} m → proposal ${fmt(e.proposalElevationM)} m`));selected.append(heights);
  const local=disclosure('Inspect final and peak depth at every cell');for(const row of c.cells)local.append(el('p',`${name(row.cellIndex,width)} · final: ${fmt(row.existingFinalMm)} → ${fmt(row.proposalFinalMm)} mm (difference ${fmt(row.finalDeltaMm)}); peak: ${fmt(row.existingPeakMm)} → ${fmt(row.proposalPeakMm)} mm (difference ${fmt(row.peakDeltaMm)}).`));selected.append(local);
  for(const button of table.querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.index)===index));
 }
 function samples(){table.replaceChildren(el('caption',`${INTERVENTION_METRICS[metric.value].label}: proposal − existing (${INTERVENTION_METRICS[metric.value].unit})`));const header=el('tr');for(const title of ['Common offset (m)','Modeled difference']){const th=el('th',title);th.scope='col';header.append(th);}const head=el('thead');head.append(header);table.append(head);const body=el('tbody');
  report.candidates.forEach((c,i)=>{const tr=el('tr'),offset=el('th',fmt(c.offsetM));offset.scope='row';tr.append(offset);const cell=el('td'),button=el('button',fmt(c.metrics[metric.value].delta));button.type='button';button.className='subtle';button.dataset.index=String(i);button.style.whiteSpace='nowrap';button.style.padding='12px 8px';button.title=String(c.metrics[metric.value].delta);button.setAttribute('aria-label',`Select shared offset ${c.offsetM} m: difference ${c.metrics[metric.value].delta} ${INTERVENTION_METRICS[metric.value].unit}`);button.addEventListener('click',()=>{index=i;detail();});cell.append(button);tr.append(cell);body.append(tr);});table.append(body);detail();
 }
 metric.addEventListener('change',samples);samples();
 output.append(el('p','These finite hypotheses do not infer an error correlation, probability or continuous bound. The shared-error basis is a declaration, not a verified survey fact. Negative differences mean a smaller modeled quantity, not an overall benefit. Separate maxima can occur at different places or times. This ground-only change is not a datum conversion; fixed crest elevations remain fixed.'));
}

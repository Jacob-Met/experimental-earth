import {proposeReceivingLayers} from './receiving-proposal.js';
const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
const fmt=n=>n.toLocaleString('en-US',{maximumSignificantDigits:8});
export function mountReceivingProposals({host,getSource,getSelection,onAdd}){
 const panel=node('section');panel.id='receiver-proposals';
 panel.innerHTML='<h3>Can the calibration depths suggest a receiving layer?</h3><p>Use the original storm-end and later calibration depths to propose editable storage and drainage values. The source must have no lateral or boundary flow.</p><label class="joint-choice"><input id="rp-empty" type="checkbox"> Assume the receiving layer starts empty</label><label class="input-label">Basis for that assumption<textarea id="rp-basis" rows="2" maxlength="200"></textarea></label><button id="rp-run" type="button">Find proposals from original calibration</button><p id="rp-status" role="status" aria-live="polite"></p><div id="rp-results"></div><p class="mini-note">These central-value proposals do not cover all solutions within the observation bands. All original calibration rows are checked; held-aside values only challenge the result. Nothing changes until you add a proposal.</p>';
 host.append(panel);const $=id=>panel.querySelector('#rp-'+id);let accepted=null;
 function clear(){accepted=null;$('results').replaceChildren();$('status').textContent='';}
 $('empty').onchange=clear;$('basis').oninput=clear;
 $('run').onclick=()=>{
  clear();
  try{
   if(!$('empty').checked)throw Error('Confirm the initially empty assumption before proposing a layer.');
   const project=structuredClone(getSource()),selection=getSelection(),report=proposeReceivingLayers(project,{...selection,initialStoredMm:0,basis:$('basis').value});
   accepted={project,selection,report};
   $('status').textContent=report.status==='need-calibration-pair'?'Supply two calibration readings at one original cell: storm end and a later retained time. Held-aside readings are not used.':report.status==='unsupported-pairs'?'No original pair supports this filling-and-recession regime.':report.status==='calibration-conflict'?'The pair-derived proposals conflict with other original calibration bands.':'Review the proposals and their original evidence before adding one.';
   for(const candidate of report.candidates){
    const h=candidate.hypothesis,card=node('article');card.dataset.proposal=h.id;
    card.append(node('h4',h.label),node('p',fmt(h.capacityMm)+' mm storage · '+fmt(h.drainagePerHour)+' /hour drainage · initially empty'),node('p','Modeled filling at minute '+fmt(candidate.fillMinute)+'.'),node('p','Original calibration: '+(candidate.calibration.compatible?'all bands compatible':'conflicting band')+'. Held aside: '+(candidate.challenge.compatible===null?'no original rows':candidate.challenge.compatible?'all bands compatible':'conflicting band')+'.'));
    const details=node('details');details.append(node('summary','Original rows and forward predictions'));
    for(const [role,evaluation]of [['Calibration',candidate.calibration],['Held aside',candidate.challenge]])for(const e of evaluation.errors){const r=project.observations[e.index];details.append(node('p',role+' row '+(e.index+1)+': '+fmt(r.depthMm)+' ± '+fmt(r.uncertaintyMm)+' mm; modeled '+fmt(e.depthMm)+' mm. '+r.source));}
    card.append(details);const add=node('button','Add as an editable explanation');add.type='button';add.disabled=!candidate.calibration.compatible;
    add.onclick=()=>{try{if(!accepted||JSON.stringify(getSource())!==JSON.stringify(project)||JSON.stringify(getSelection())!==JSON.stringify(selection))throw Error('The original source changed. Find proposals again.');onAdd(structuredClone(h));clear();$('status').textContent='Proposal added as an editable explanation. Compare all original evidence again.';}catch(error){$('status').textContent=error.message;}};
    card.append(add);$('results').append(card);
   }
   for(const pair of report.refusedPairs)$('results').append(node('p','Original rows '+pair.rows.map(i=>i+1).join(' / ')+': unsupported filling-and-recession regime.'));
  }catch(error){$('status').textContent=error.message;}
 };
 return {clear};
}

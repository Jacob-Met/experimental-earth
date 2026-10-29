import {investigateQuestion,validateQuestionScope} from './rain-soil-question.js';
const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export function mountRainSoilQuestion({host,getAccepted,notice}){
 const section=element('section');section.append(element('h4','When could another depth reading distinguish these explanations?'),element('p','Declare where and when you could obtain another reading, and its proposed ± precision. This is an offered measurement tolerance, not an acquired observation. Only calibration-compatible rain/soil pairs choose the question.'));
 const form=element('form');section.append(form);host.append(section);
 const input=(label,value)=>{const wrap=element('label',label),field=element('input');field.value=value;wrap.append(field);form.append(wrap);return field;};
 const cells=input('Available cells (for example A1, B2)','A1'),from=input('Available from event minute','0'),to=input('Available through event minute','120'),uncertainty=input('Proposed depth precision ± mm','1');
 const button=element('button','Find a distinguishing depth question');button.type='submit';button.disabled=true;form.append(button);
 const output=element('div');output.setAttribute('role','status');section.append(output);
 function clear(){button.disabled=true;output.replaceChildren();}
 function enable(){const accepted=getAccepted();button.disabled=!accepted;output.replaceChildren();if(accepted){to.value=String(accepted.project.weather.durationMinutes);let saved=accepted.request.readingQuestion;if(saved!==undefined){try{saved=validateQuestionScope(accepted.project,saved);}catch{output.append(element('p','Saved acquisition scope is invalid. Declare a new scope before planning.'));return;}}if(saved){cells.value=saved.cellIndices.map(i=>String.fromCharCode(65+i%accepted.project.width)+(Math.floor(i/accepted.project.width)+1)).join(', ');from.value=String(saved.fromMinute);to.value=String(saved.toMinute);uncertainty.value=String(saved.uncertaintyMm);output.append(element('p','Saved acquisition scope restored. Recompute to inspect its conditional question.'));}}}
 form.addEventListener('input',()=>{output.replaceChildren();const accepted=getAccepted();if(accepted)delete accepted.request.readingQuestion;});
 form.addEventListener('submit',event=>{event.preventDefault();output.replaceChildren();try{
  const accepted=getAccepted();if(!accepted)throw Error('Compare or reopen original rain/soil evidence first.');
  const {project,request}=accepted;delete request.readingQuestion;
  const cellIndices=cells.value.split(',').map(raw=>{const m=/^([A-X])([1-9][0-9]?)$/.exec(raw.trim().toUpperCase());if(!m)throw Error('Use explicit cell coordinates such as A1.');const x=m[1].charCodeAt(0)-65,y=Number(m[2])-1;if(x>=project.width||y>=project.height)throw Error('An offered cell is outside the original site.');return y*project.width+x;});
  const numeric=field=>field.value.trim()===''?NaN:Number(field.value);
  const scope={cellIndices:[...new Set(cellIndices)],fromMinute:numeric(from),toMinute:numeric(to),uncertaintyMm:numeric(uncertainty)};
  const q=investigateQuestion(project,request,scope);request.readingQuestion=structuredClone(scope);
  const meanings={'insufficient-alternatives':'Fewer than two pairs are supported by calibration and any supplied rainfall bound. No distinguishing question is selected.','no-unrecorded-question':'No unrecorded retained solver samples exist within the offered cells and time window.','no-separated-extremes':'No offered retained solver sample separates even the extreme predictions beyond the proposed reading bands. A different available time, place or precision may be needed.'};
  if(q.status!=='separating-extremes'){output.append(element('p',meanings[q.status]));return;}
  const name=String.fromCharCode(65+q.best.cellIndex%project.width)+(Math.floor(q.best.cellIndex/project.width)+1);
  output.append(element('p',`Consider ${name} at event minute ${q.best.minute} in original ${project.title}, ${request.target}. The largest offered depth spread is ${q.best.spanMm.toPrecision(5)} mm across ${q.pairs.length} calibration-compatible pairs.`));
  const list=element('ul');q.pairs.forEach((pair,i)=>{const depth=q.best.depthsMm[i];list.append(element('li',`Rain ${pair.rainMmHr}, soil ${pair.rateMmHr} mm/h predicts ${depth.toPrecision(5)} mm: proposed reading band ${(depth-scope.uncertaintyMm).toPrecision(5)} to ${(depth+scope.uncertaintyMm).toPrecision(5)} mm.`));});output.append(list,element('p','The most separated pair’s declared reading bands do not overlap. Intermediate explanations may remain unresolved. This is modeled disagreement at retained solver times, not expected information gain or a measurement that has occurred.'));
 }catch(error){output.append(element('p',error.message));notice(error.message);}});
 return {clear,enable};
}

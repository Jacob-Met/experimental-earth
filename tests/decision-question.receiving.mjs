import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {makeExample} from '../core.js';
export async function receiveDecisionQuestion({evaluate,send,delay,report,artifactDirectory}) {
 const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 const p=makeExample();p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[1,10,20,35]};
 for(let i=0;i<p.proposal.length;i++)if(p.existing[i].surface==='turf'&&i%3===0)p.proposal[i].surface='garden';
 p.observations=[{cellIndex:0,minute:0,depthMm:0,uncertaintyMm:0,source:'authored uninformative calibration',scenario:'existing',use:'calibration'}];
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);await send('Page.reload',{ignoreCache:true});await delay(350);
 await evaluate("document.querySelector('#find-decision-reading').click()");
 assert.equal(await evaluate("document.querySelector('#decision-status').dataset.state"),'question');
 assert.ok((await evaluate("document.querySelector('#decision-status').textContent")).includes('F2 at 70 min'));
 assert.ok((await evaluate("document.querySelector('#decision-predictions').textContent")).includes('More: 35 mm/h'));
 report.push('actual courtyard decision question selects F2 at70min across opposing outflow effects');
 const visualReceipts=[];
 for(const [name,width,height] of [['desktop',1440,1000],['narrow',390,1000]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await send('Page.bringToFront');
  const visual=await evaluate(`(async()=>{
    const target=document.getElementById('decision-status'),predictions=document.getElementById('decision-predictions');
    if(!target.textContent.includes('F2 at 70 min')||predictions.querySelectorAll('li').length!==4)throw Error('Decision question not ready for visual receiving');
    await document.fonts.ready;
    const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await paint();window.scrollTo({top:scrollY+target.getBoundingClientRect().top-32,left:0,behavior:'instant'});
    let last=null,stable=0;
    for(let attempt=0;attempt<30;attempt++){
      await paint();const r=target.getBoundingClientRect(),p=predictions.getBoundingClientRect();
      const now={top:r.top,left:r.left,width:r.width,height:r.height,bottom:p.bottom,scrollY};
      stable=last&&Object.keys(now).every(key=>Math.abs(now[key]-last[key])<.5)?stable+1:0;last=now;if(stable>=2)break;
    }
    const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height,bottom:r.bottom};};
    const r=rect(target),p=rect(predictions),front=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return {viewport:{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth},question:target.textContent,predictions:predictions.textContent,
      questionRect:r,predictionsRect:p,stable:stable>=2,frontmost:front===target||target.contains(front),scrollY};
  })()`);
  assert.equal(visual.stable,true,JSON.stringify(visual));assert.equal(visual.frontmost,true,JSON.stringify(visual));
  assert.ok(visual.questionRect.top>=0&&visual.questionRect.width>0&&visual.questionRect.height>0,JSON.stringify(visual));
  assert.ok(visual.predictionsRect.top>=0&&visual.predictionsRect.bottom<=visual.viewport.height,JSON.stringify(visual));
  assert.ok(visual.viewport.scroll<=width+1,JSON.stringify(visual));
  const screenshot=artifactDirectory+'/decision-question-'+name+'.png';
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(screenshot,Buffer.from(shot.data,'base64'));
  visualReceipts.push({name,screenshot,...visual});
 }
 writeFileSync(artifactDirectory+'/decision-question-visual.json',JSON.stringify(visualReceipts,null,2)+'\n');
 await send('Emulation.clearDeviceMetricsOverride');

 await evaluate("(()=>{const e=document.querySelector('#decision-tolerance');e.value=12;e.dispatchEvent(new Event('input'));})()");
 assert.equal(await evaluate("document.querySelector('#decision-status').dataset.state"),'not-compared');
 await evaluate("document.querySelector('#find-decision-reading').click()");
 assert.ok((await evaluate("document.querySelector('#decision-status').textContent")).includes('overlapping or touching'));
 await evaluate("document.querySelector('#obs-depth').value='123';document.querySelector('#obs-source').value='stale A1 draft';document.querySelector('#prepare-decision-reading').click()");
 assert.equal(await evaluate("document.querySelector('#obs-cell').value"),'F2');assert.equal(await evaluate("document.querySelector('#obs-minute').value"),'70');assert.equal(await evaluate("document.querySelector('#obs-uncertainty').value"),'12');assert.equal(await evaluate("document.querySelector('#obs-use').value"),'challenge');assert.equal(await evaluate("document.querySelector('#obs-scenario').value"),'existing');
 assert.equal(await evaluate("document.querySelector('#obs-depth').value"),'');assert.equal(await evaluate("document.querySelector('#obs-source').value"),'');assert.ok((await evaluate("document.querySelector('#toast').textContent")).includes('draft cleared'));assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).observations.length,1);
 report.push('tolerance change invalidates question, overlap is disclosed, preparation sets metadata without inventing evidence');
 await evaluate("(()=>{const e=document.querySelector('#decision-metric');e.value='storedLiters';e.dispatchEvent(new Event('change'));document.querySelector('#find-decision-reading').click();})()");
 assert.equal(await evaluate("document.querySelector('#decision-status').dataset.state"),'no-reversal');assert.equal(await evaluate("document.querySelector('#prepare-decision-reading').hidden"),true);
 await evaluate("document.querySelector('#copy-existing').click()");assert.equal(await evaluate("document.querySelector('#decision-status').dataset.state"),'not-compared');
 report.push('nonreversing objective gives no manufactured question; proposal changes invalidate derived state');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'));report.push('decision question controls fit390px viewport; visible F2/70 question and predictions captured at1440px and390px after stable paint');await send('Emulation.clearDeviceMetricsOverride');
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(original)})`);await send('Page.reload',{ignoreCache:true});await delay(350);
 return visualReceipts;
}

import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {makeExample} from '../core.js';
export async function receiveDecisionObservations({evaluate,send,delay,report,artifactDirectory}) {
 const original=await evaluate("localStorage.getItem('experimental-earth-site-v1')");
 const p=makeExample();p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[1,10,20,35]};
 for(let i=0;i<p.proposal.length;i++)if(p.existing[i].surface==='turf'&&i%3===0)p.proposal[i].surface='garden';
 p.observations=[{cellIndex:0,minute:0,depthMm:0,uncertaintyMm:0,source:'authored initial control',scenario:'existing',use:'calibration'}];
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(JSON.stringify(p))})`);await send('Page.reload',{ignoreCache:true});await delay(350);
 await evaluate("document.querySelector('#compare-decision-measurements').click()");
 assert.equal(await evaluate("document.querySelectorAll('[data-measurement-type=collection]').length"),0);
 await evaluate("(()=>{const e=document.querySelector('#decision-tolerance');e.value=2;e.dispatchEvent(new Event('input'));const c=document.querySelector('#decision-collection-enabled');c.checked=true;c.dispatchEvent(new Event('input'));document.querySelector('#compare-decision-measurements').click();})()");
 assert.equal(await evaluate("document.querySelector('#decision-measurement-status').dataset.state"),'options');
 assert.ok((await evaluate("document.querySelector('#decision-measurement-status').textContent")).includes('Largest declared band margin: full-boundary collection'));
 assert.ok((await evaluate("document.querySelector('[data-measurement-type=collection]').textContent")).includes('35–65 min'));
 report.push('measurement options require declared collection feasibility and compare depth against35–65min collected-volume bands');
 const visuals=[];
 for(const [name,width,height] of [['desktop',1440,1000],['narrow',390,1100]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Page.bringToFront');
  const visual=await evaluate(`(async()=>{
   const target=document.getElementById('decision-measurement-status'),options=document.getElementById('decision-measurement-options');
   if(options.querySelectorAll('[data-measurement-type]').length!==2||!options.textContent.includes('35–65 min'))throw Error('Expected both measurement options');
   await document.fonts.ready;const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await paint();
   window.scrollTo({top:scrollY+target.getBoundingClientRect().top-24,left:0,behavior:'instant'});
   let last=null,stable=0;for(let n=0;n<30;n++){await paint();const a=target.getBoundingClientRect(),b=options.getBoundingClientRect();const now=[a.top,a.left,a.width,a.height,b.bottom,scrollY];stable=last&&now.every((v,i)=>Math.abs(v-last[i])<.5)?stable+1:0;last=now;if(stable>=2)break;}
   const a=target.getBoundingClientRect(),b=options.getBoundingClientRect(),front=document.elementFromPoint(a.left+a.width/2,a.top+a.height/2);
   return {status:target.textContent,options:options.textContent,stable:stable>=2,frontmost:front===target||target.contains(front),top:a.top,bottom:b.bottom,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};
  })()`);
  assert.equal(visual.stable,true);assert.equal(visual.frontmost,true);assert.ok(visual.top>=0&&visual.bottom<=height,JSON.stringify(visual));assert.ok(visual.scrollWidth<=width+1,JSON.stringify(visual));
  const screenshot=artifactDirectory+'/decision-options-'+name+'.png',shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(screenshot,Buffer.from(shot.data,'base64'));visuals.push({name,screenshot,...visual});
 }
 writeFileSync(artifactDirectory+'/decision-options-visual.json',JSON.stringify(visuals,null,2)+'\n');await send('Emulation.clearDeviceMetricsOverride');
 report.push('both measurement options visibly received at1440px and390px with stable painted bounds');
 await evaluate("(()=>{const e=document.querySelector('#decision-tolerance');e.value=1;e.dispatchEvent(new Event('input'));})()");
 assert.equal(await evaluate("document.querySelector('#decision-measurement-status').dataset.state"),'not-compared');await evaluate("document.querySelector('#compare-decision-measurements').click()");
 assert.ok((await evaluate("document.querySelector('#decision-measurement-status').textContent")).includes('Largest declared band margin: local depth'));
 await evaluate("(()=>{const e=document.querySelector('#decision-tolerance');e.value=2;e.dispatchEvent(new Event('input'));document.querySelector('#compare-decision-measurements').click();})()");
 report.push('prospective depth precision invalidates results and changes the declared band-margin choice');
 await evaluate("document.querySelector('#outlet-volume').value=999;document.querySelector('#outlet-source').value='stale source';document.querySelector('#outlet-event').value='old event';document.querySelector('#outlet-collection').value='old coverage';document.querySelector('#outlet-coverage').checked=true;document.querySelector('[data-prepare-measurement=collection]').click()");
 for(const [id,value] of [['outlet-start','35'],['outlet-end','65'],['outlet-uncertainty','20'],['outlet-unit','L'],['outlet-use','challenge'],['outlet-volume',''],['outlet-source',''],['outlet-event',''],['outlet-collection','']])assert.equal(await evaluate(`document.getElementById('${id}').value`),value,id);
 assert.equal(await evaluate("document.querySelector('#outlet-coverage').checked"),false);
 assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).outletEvidence,undefined);
 report.push('preparation clears stale drafts and fills interval/tolerance only, without a measured value, source or coverage assertion');
 await evaluate("document.querySelector('#outlet-event').value='authored receiving event';document.querySelector('#outlet-collection').value='authored entire-boundary arrangement';document.querySelector('#outlet-volume').value=100;document.querySelector('#outlet-source').value='authored receiving measurement';document.querySelector('#outlet-reading-form').requestSubmit()");
 assert.equal(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).outletEvidence,undefined);
 await evaluate("document.querySelector('#outlet-coverage').checked=true;document.querySelector('#outlet-reading-form').requestSubmit()");
 const saved=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));assert.equal(saved.outletEvidence.readings.length,1);assert.equal(saved.outletEvidence.readings[0].volume,100);assert.equal(saved.outletEvidence.readings[0].use,'challenge');assert.equal(saved.observations.length,1);
 await send('Page.reload',{ignoreCache:true});await delay(350);assert.equal(await evaluate("document.querySelector('#outlet-event').value"),'authored receiving event');
 await evaluate("document.querySelector('#decision-collection-enabled').checked=true;document.querySelector('#compare-decision-measurements').click()");
 const interval=await evaluate("document.querySelector('[data-measurement-type=collection] > p').textContent");const match=interval.match(/(\d+(?:\.\d+)?)–(\d+(?:\.\d+)?) min/);assert.ok(match);assert.ok(Number(match[2])<=35||Number(match[1])>=65,interval);
 report.push('only actual explicit form submission retains a sourced collection; reload preserves it and later options exclude overlapping intervals');
 await evaluate("document.querySelector('#rain').value=37;document.querySelector('#rain').dispatchEvent(new Event('change'));document.querySelector('#compare-decision-measurements').click()");
 assert.equal(await evaluate("document.querySelectorAll('[data-measurement-type=collection]').length"),0);assert.ok((await evaluate("document.querySelector('#decision-measurement-options').textContent")).includes('another scenario or event context'));
 report.push('changed event context removes collection preparation while retaining independent depth investigation');
 await evaluate(`localStorage.setItem('experimental-earth-site-v1',${JSON.stringify(original)})`);await send('Page.reload',{ignoreCache:true});await delay(350);return visuals;
}

import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
export async function receiveEventChallenge(evaluate, report, {send, artifactDirectory}) {
  const result = await evaluate(`(async () => {
    const {makeExample}=await import('./core.js');
    const p=makeExample(); p.width=p.height=2;p.selectedIndex=0;
    p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'analytic fixture'}));p.proposal=structuredClone(p.existing);
    Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,mobilityPerHour:0,boundaryExitPerHour:0});
    p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[0,10,20]};
    p.observations=[{cellIndex:0,minute:60,depthMm:20,uncertaintyMm:11,source:'analytic first',scenario:'existing',use:'calibration'}];
    async function upload(id,value){const input=document.getElementById(id);const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(value)],'fixture.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,80));}
    await upload('import',p);
    const second=structuredClone(p);second.weather.rainMmHr=50;Object.assign(second.observations[0],{depthMm:40,uncertaintyMm:.01,use:'challenge',source:'analytic second <script>unsafe</script>'});
    await upload('event-project-file',second);
    document.getElementById('event-first-ref').value='A';document.getElementById('event-second-ref').value='B';document.getElementById('event-compare').click();
    const status=document.getElementById('event-status').textContent;
    const residuals=document.getElementById('event-results').textContent;
    const unsafeNodes=document.querySelectorAll('#event-results script').length;
    const original=URL.createObjectURL;let saved;
    URL.createObjectURL=blob=>{saved=blob;return original(blob)};
    document.getElementById('event-export').click();URL.createObjectURL=original;
    const bundle=JSON.parse(await saved.text());
    await upload('event-bundle-file',bundle);
    const reopened=document.getElementById('event-status').textContent;
    const input=document.getElementById('event-bundle-file'), pendingFile=new File([JSON.stringify(bundle)],'delayed.json',{type:'application/json'});
    let finishRead;
    const originalFileText=File.prototype.text;
    File.prototype.text=function(){return this.name==='delayed.json'?new Promise(resolve=>{finishRead=resolve;}):originalFileText.call(this);};
    const pendingTransfer=new DataTransfer();pendingTransfer.items.add(pendingFile);input.files=pendingTransfer.files;input.dispatchEvent(new Event('change'));
    document.getElementById('event-compare').click();
    const currentComparison=document.getElementById('event-status').textContent;
    File.prototype.text=originalFileText;
    finishRead(JSON.stringify(bundle));await new Promise(resolve=>setTimeout(resolve,30));
    const newerIntentPreserved=document.getElementById('event-status').textContent===currentComparison;
    await upload('event-bundle-file',{schema:'invalid'});
    const rejected=document.getElementById('event-status').textContent;
    const retained=!document.getElementById('event-export').disabled;
    document.getElementById('rain').value=31;document.getElementById('rain').dispatchEvent(new Event('change'));
    const stale=document.getElementById('event-export').disabled && !document.getElementById('event-results').textContent;
    return {bundle,status,residuals,unsafeNodes,reopened,rejected,retained,stale,newerIntentPreserved,schema:bundle.schema,secondRain:bundle.challengeProject.weather.rainMmHr};
  })()`);
  assert.match(result.status,/1 candidate\(s\).*10 mm\/h/);
  assert.match(result.residuals,/analytic second <script>unsafe<\/script>/);
  assert.equal(result.unsafeNodes,0);
  assert.equal(result.schema,'experimental-earth-event-challenge/1');assert.equal(result.secondRain,50);
  assert.match(result.reopened,/Reopened saved evidence/);
  assert.match(result.rejected,/Import refused/);assert.equal(result.retained,true);assert.equal(result.stale,true);
  assert.equal(result.newerIntentPreserved,true);
  await evaluate(`(async()=>{
    const input=document.getElementById('event-bundle-file'),dt=new DataTransfer();
    dt.items.add(new File([${JSON.stringify(JSON.stringify(result.bundle))}],'review.json',{type:'application/json'}));
    input.files=dt.files;input.dispatchEvent(new Event('change'));
    for(let attempt=0;attempt<40;attempt++){
      if(document.getElementById('event-status').textContent.includes('Reopened saved evidence') && document.querySelectorAll('#event-results > details').length===3)return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw Error('Cross-event review bundle did not render before visual receiving');
  })()`);
  const visualReceipts=[];
  for (const [name,width,height] of [['narrow',390,844],['desktop',1440,1000]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await send('Page.bringToFront');
    const visual=await evaluate(`(async()=>{
      const results=document.getElementById('event-results');
      if(!results.textContent.includes('analytic second') || results.querySelectorAll(':scope > details').length!==3)throw Error('Expected nonempty cross-event candidate results');
      for(let ancestor=results;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;
      const candidate=results.querySelector('details');candidate.open=true;
      const target=candidate.querySelector('summary');
      await document.fonts.ready;
      const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await paint();
      // styles.css declares smooth scrolling. Explicit instant scrolling and
      // stable-paint checks prevent a screenshot of an in-flight old position.
      window.scrollTo({top:scrollY+target.getBoundingClientRect().top-32,left:0,behavior:'instant'});
      let last=null,stable=0;
      for(let attempt=0;attempt<30;attempt++){
        await paint();const rect=target.getBoundingClientRect();
        const now={top:rect.top,left:rect.left,width:rect.width,height:rect.height,scrollY};
        stable=last&&Object.keys(now).every(key=>Math.abs(now[key]-last[key])<.5)?stable+1:0;last=now;
        if(stable>=2)break;
      }
      const rect=target.getBoundingClientRect(),candidateRect=candidate.getBoundingClientRect();
      const centerX=rect.left+rect.width/2,centerY=rect.top+rect.height/2;
      const front=document.elementFromPoint(centerX,centerY);
      return {viewport:{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth},
        summary:target.textContent,candidateText:candidate.textContent,
        rect:{top:rect.top,left:rect.left,width:rect.width,height:rect.height,bottom:rect.bottom},
        candidateBottom:candidateRect.bottom,stable:stable>=2,frontmost:front===target||target.contains(front),scrollY};
    })()`);
    assert.match(visual.summary,/10 mm\/h/);
    assert.match(visual.candidateText,/analytic second/);
    assert.equal(visual.stable,true,JSON.stringify(visual));
    assert.equal(visual.frontmost,true,JSON.stringify(visual));
    assert.ok(visual.rect.width>0&&visual.rect.height>0&&visual.rect.top>=0&&visual.rect.bottom<=visual.viewport.height,JSON.stringify(visual));
    assert.ok(visual.viewport.scroll<=visual.viewport.width+1,JSON.stringify(visual));
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(artifactDirectory+'/cross-event-'+name+'.png',Buffer.from(shot.data,'base64'));
    visualReceipts.push({name,...visual});
  }
  writeFileSync(artifactDirectory+'/cross-event-visual.json',JSON.stringify(visualReceipts,null,2)+'\n');
  report.push('cross-event import, analytic challenge, escaped sources, portable recomputation, transactional rejection and stale invalidation');
}

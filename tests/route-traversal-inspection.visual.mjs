import assert from 'node:assert/strict';
import {isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

const root=process.argv[2];
if(!root || !isAbsolute(root)) throw Error('Supply repository absolute path');
const {withBrowserSession}=await import(pathToFileURL(join(root,'tests/support/browser-session.mjs')).href);
const runDirectory=join(root,'.browser-inspection-visual-'+randomUUID());
await withBrowserSession({root,chromeBin:'/usr/bin/google-chrome',runDirectory},async({send,evaluate,exceptions,sandboxPath})=>{
  await send('Runtime.enable');await send('Page.enable');
  for(let i=0;i<100;i++) {
    if(await evaluate("!!document.querySelector('#route-traversal-form')")) break;
    await delay(100);
  }
  assert.equal(await evaluate("!!document.querySelector('#route-traversal-form')"),true);
  await evaluate(`(()=>{
    document.querySelector('#reset').click();
    const threshold=document.querySelector('#ponding-threshold');
    threshold.value='10';threshold.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('#route-ponding-cells').value='D3 E3 F3';
    document.querySelector('#route-ponding-form').requestSubmit();
    document.querySelector('#route-traversal-steps').value='1';
    document.querySelector('#route-traversal-start').value='0';
    document.querySelector('#route-traversal-end').value='30';
    document.querySelector('#route-traversal-form').requestSubmit();
    document.querySelector('#route-traversal-departure').value='10';
    document.querySelector('#route-traversal-inspection-form').requestSubmit();
  })()`);
  assert.equal(await evaluate("document.querySelector('#route-traversal-inspection-error').textContent"),'');
  assert.equal(await evaluate("document.querySelectorAll('#route-traversal-inspection-results table').length"),2);
  // app.js removes #toast.show after 3800ms. Observe its natural expiry;
  // do not hide or restyle any production element for the screenshots.
  for(let i=0;i<80;i++) {
    if(!await evaluate("document.querySelector('#toast').classList.contains('show')")) break;
    await delay(100);
  }
  assert.equal(await evaluate("document.querySelector('#toast').classList.contains('show')"),false);
  await delay(500);
  const outcomes=[];
  for(const [name,width,height,mobile] of [['desktop',1440,1000,false],['mobile',390,844,true]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
    for(const position of ['top','bottom']) {
      await evaluate(`(()=>{
        const section=document.querySelector('#route-traversal-inspection');
        const target=${JSON.stringify(position)}==='top'?section:section.querySelector('#route-traversal-inspection-results > .mini-note');
        const rect=target.getBoundingClientRect();
        const top=${JSON.stringify(position)}==='top'?scrollY+rect.top-8:scrollY+rect.bottom-innerHeight+100;
        window.scrollTo({top:Math.max(0,top),left:0,behavior:'instant'});
      })()`);
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const metrics=await evaluate(`(()=>{
        const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};};
        const section=document.querySelector('#route-traversal-inspection');
        const note=section.querySelector('#route-traversal-inspection-results > .mini-note');
        const toast=document.querySelector('#toast'),style=getComputedStyle(toast),tr=toast.getBoundingClientRect();
        const fixed=[...document.querySelectorAll('body *')].filter(node=>getComputedStyle(node).position==='fixed').map(node=>({tag:node.tagName,id:node.id,text:node.textContent.slice(0,100),...rect(node)}));
        return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,scroll:{x:scrollX,y:scrollY},section:rect(section),qualification:rect(note),
          proposal:rect(section.querySelector('table[data-scenario="proposal"]')),
          paragraphs:[...section.querySelectorAll('p')].map(node=>({text:node.textContent,...rect(node)})),fixed,
          toast:{show:toast.classList.contains('show'),opacity:style.opacity,display:style.display,visibility:style.visibility,offscreen:tr.bottom<=0||tr.top>=innerHeight||tr.right<=0||tr.left>=innerWidth}};
      })()`);
      assert.equal(metrics.viewport.width,width);assert.equal(metrics.viewport.height,height);
      assert.ok(metrics.documentWidth<=width+1,'no horizontal page overflow');
      assert.ok(!metrics.toast.show && (Number(metrics.toast.opacity)<=0.01||metrics.toast.display==='none'||metrics.toast.visibility==='hidden'||metrics.toast.offscreen),'reset toast naturally hidden');
      if(position==='top') assert.ok(metrics.section.top>=0&&metrics.section.top<height);
      else {
        assert.ok(metrics.qualification.top>=0&&metrics.qualification.bottom<=height-90,'full qualification above persistent bottom controls');
        assert.ok(metrics.proposal.top>=0&&metrics.proposal.bottom<=height-90,'full proposal table above persistent bottom controls');
      }
      const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const bytes=Buffer.from(capture.data,'base64'),path=join(runDirectory,`inspection-${name}-${position}.png`);
      await writeFile(path,bytes,{flag:'wx'});
      outcomes.push({name,position,path,sha256:createHash('sha256').update(bytes).digest('hex'),metrics});
    }
  }
  assert.deepEqual(exceptions,[]);
  const receipt={repository:root,runDirectory,sandboxPath,outcomes,exceptions,scope:'Visual-only maintained-example course; production and functional evaluator unchanged. Full viewport captures at top and bottom; natural reset-toast expiry, no CSS hiding. Does not replace functional receiving.'};
  await writeFile(join(runDirectory,'visual-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(receipt,null,2));
});

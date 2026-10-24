import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

export async function receiveObservationConsistency({evaluate,send,delay,report,artifactDirectory}) {
  const original=JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')"));
  const p=structuredClone(original);p.selectedIndex=0;
  const base={cellIndex:0,minute:2.5,depthMm:2,uncertaintyMm:1,scenario:'existing',use:'calibration',source:'Authored consistency control <not field evidence>'};
  p.observations=[base,{...base,depthMm:8,use:'challenge',source:'Second authored source'}];
  const load=async value=>evaluate(`(async()=>{const input=document.querySelector('#import');const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'consistency-control.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,150));})()`);
  const content=()=>evaluate("document.querySelector('.observation-consistency').textContent");
  await load(p);
  await evaluate("{const s=document.querySelector('#evidence-map-scenario');s.value='existing';s.dispatchEvent(new Event('change'));const r=document.querySelector('#evidence-map-role');r.value='calibration';r.dispatchEvent(new Event('change'));}");
  assert.ok((await content()).includes('4 mm gap'));
  assert.ok((await content()).includes('Held aside'));
  assert.ok((await content()).includes('independently of the map role filter'));
  assert.ok((await content()).includes('<not field evidence>'));
  assert.deepEqual(JSON.parse(await evaluate("localStorage.getItem('experimental-earth-site-v1')")).observations,p.observations);
  report.push('same-point contradiction exposes both raw sources/roles and extremal4mm witness gap, even under calibration-only map filter');
  if (artifactDirectory) {
    await evaluate("document.querySelector('.observation-consistency details').open=true");
    for (const [name,width,height] of [['contradictory',1440,1000],['contradictory-mobile',390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});
      await delay(80);
      const clip=await evaluate("(()=>{const r=document.querySelector('.observation-consistency').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
      const png=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
      await writeFile(join(artifactDirectory,name+'.png'),Buffer.from(png.data,'base64'));
    }
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  }

  const changed=structuredClone(p);changed.observations[1].minute=2.500001;
  await load(changed);assert.ok((await content()).includes('No repeated exact-time'));
  changed.observations[1].minute=2.5;changed.observations[1].uncertaintyMm=5;
  await load(changed);assert.ok((await content()).includes('Common declared band 3–3 mm'));
  await send('Page.reload',{ignoreCache:true});await delay(300);
  assert.ok((await content()).includes('Common declared band 3–3 mm'));
  report.push('near-but-distinct times remain separate; changed stated tolerance yields touching bands and survives ordinary reload');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate("document.querySelector('.observation-consistency details').open=true");
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
}

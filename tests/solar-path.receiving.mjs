import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareSolarStudy} from '../solar-occlusion.js';

export async function receiveSunPath({evaluate,send,delay,report}) {
  const p=makeExample();p.width=4;p.height=2;p.selectedIndex=0;p.weather.cellSizeM=2;
  p.existing=Array.from({length:8},()=>({surface:'turf',elevationM:0,provenance:'Authored geometric test, not a physical survey'}));p.proposal=structuredClone(p.existing);
  const literal='<img src=x onerror="window.__sunPathInjected=1">'+'x'.repeat(120);
  p.solarStudy=prepareSolarStudy(p,{headingDeg:0,elevationDeg:45,sunSource:'Original fixed direction, preserved by dated inspection',existing:[],
    proposal:[{cellIndex:2,heightMinM:2,heightMaxM:2,source:literal}]});
  const settings={latitude:'51.5',longitude:'-0.1',bearing:'90','location-source':'Authored London coordinate, no real site. '+literal,
    'orientation-source':'Authored east-right and south-down geometry.',start:'2026-06-21T04:00:00Z',end:'2026-06-21T20:00:00Z',step:'60'};
  const load=async value=>evaluate(`(async()=>{const input=document.querySelector('#import'),data=new DataTransfer();data.items.add(new File([${JSON.stringify(JSON.stringify(value))}],'sun-path-site.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,100));})()`);
  const fill=async values=>evaluate(`(()=>{for(const[id,value]of Object.entries(${JSON.stringify(values)})){const el=document.querySelector('#sun-path-'+id);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
  const stored=()=>evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const select=async n=>evaluate(`(()=>{const s=document.querySelector('#sun-path-cell');s.value=${JSON.stringify(String(n))};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const state=()=>evaluate("document.querySelector('#sun-path-status').dataset.state");
  async function run(expected='compared') {
    await evaluate("document.querySelector('#sun-path-run').click()");
    for(let i=0;i<100;i++){if(await evaluate("!document.querySelector('#sun-path-run').disabled"))break;await delay(25);}
    assert.equal(await state(),expected,await evaluate("document.querySelector('#sun-path-status').textContent"));
  }
  const status=(utc,target='proposal')=>evaluate(`document.querySelector('#sun-path-results [data-sun-time="${utc}"] [data-target="${target}"]').dataset.status`);

  await load(p);await fill(settings);await select(1);const original=await stored();await run();
  assert.equal(await evaluate("document.querySelectorAll('#sun-path-results tbody tr').length"),17);
  assert.equal(await status('2026-06-21T04:00:00.000Z'),'blocked');assert.equal(await status('2026-06-21T20:00:00.000Z'),'no-mapped-blocker');
  assert.equal(await status('2026-06-21T04:00:00.000Z','existing'),'no-mapped-blocker');assert.equal(await stored(),original);
  assert.match(await evaluate("document.querySelector('#sun-path-results').textContent"),/Counts do not measure hours of shade/);
  report.push('actual UTC/location/orientation controls produce 17 changing paired point samples without modifying the saved source');

  assert.equal(await evaluate("document.querySelectorAll('#sun-path-results img').length"),0);assert.equal(await evaluate('window.__sunPathInjected??null'),null);
  assert.ok((await evaluate("document.querySelector('#sun-path-results').textContent")).includes(literal));
  report.push('retained source and witness words are literal text, including HTML-looking and long source content');

  await fill({bearing:'270'});assert.equal(await state(),'not-compared');assert.equal(await evaluate("document.querySelector('#sun-path-results').textContent"),'');
  await run();assert.equal(await status('2026-06-21T04:00:00.000Z'),'no-mapped-blocker');assert.equal(await stored(),original);
  report.push('changing the declared grid bearing invalidates and consequentially changes the same ground sample');

  await fill({...settings,start:'2026-03-20T05:56:00Z',end:'2026-03-20T06:16:00Z',step:'5'});await run();
  const statuses=await evaluate("Array.from(document.querySelectorAll('#sun-path-results [data-target=proposal]'),e=>e.dataset.status)");
  assert.ok(statuses.includes('below-horizon'));assert.ok(statuses.includes('low-elevation'));assert.ok(statuses.includes('blocked'));
  report.push('near-horizon course keeps low and below-horizon samples explicitly unmodeled, with no invented clear result');

  await fill({start:'2026-02-30T12:00:00Z'});await run('error');assert.equal(await evaluate("document.querySelector('#sun-path-results').textContent"),'');assert.equal(await stored(),original);
  await fill({...settings,start:'2026-06-21T08:00:00Z',end:'2026-06-21T09:05:00Z',step:'30'});await run();
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#sun-path-results tbody tr'),r=>r.dataset.sunTime)"),['2026-06-21T08:00:00.000Z','2026-06-21T08:30:00.000Z','2026-06-21T09:00:00.000Z','2026-06-21T09:05:00.000Z']);
  report.push('impossible UTC date refuses without mutation; an unaligned final instant is included exactly once');

  await fill(settings);await evaluate("document.querySelector('#sun-path-run').click();document.querySelector('#sun-path-bearing').value='180';document.querySelector('#sun-path-bearing').dispatchEvent(new Event('input',{bubbles:true}));");await delay(100);
  assert.equal(await state(),'not-compared');assert.equal(await evaluate("document.querySelector('#sun-path-results').textContent"),'');assert.equal(await evaluate("document.querySelector('#sun-path-run').disabled"),false);
  await fill(settings);await evaluate("document.querySelector('#sun-path-run').click();document.querySelector('#reset').click();");await delay(100);
  assert.equal(await state(),'not-compared');assert.equal(await evaluate("document.querySelector('#sun-path-results').textContent"),'');
  report.push('pending calculations cannot publish after changed input or a replaced project');

  const stale=structuredClone(p);stale.existing[0].elevationM=.1;await load(stale);await fill(settings);await run('error');
  assert.match(await evaluate("document.querySelector('#sun-path-status').textContent"),/source changed/);assert.equal(await evaluate("document.querySelector('#sun-path-results').textContent"),'');
  report.push('changed terrain refuses the old source-bound obstruction declaration');

  await load(p);await fill(settings);await select(1);await run();await send('Page.reload',{ignoreCache:true});
  for(let i=0;i<100;i++){await delay(30);try{if(await evaluate("!!document.querySelector('#sun-path-run')"))break;}catch{}}
  assert.equal(await evaluate("document.querySelector('#sun-path-latitude').value"),'');assert.equal(await evaluate("document.querySelector('#sun-path-location-source').value"),'');assert.equal(await state(),'not-compared');
  assert.deepEqual(JSON.parse(await stored()).solarStudy,p.solarStudy);
  report.push('reload preserves the source study while private location drafts and derived path are deliberately temporary');

  await fill(settings);await select(1);await run();
  await evaluate("document.querySelector('#sun-path-cell').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});
  assert.equal(await evaluate("document.querySelector('#sun-path-cell').value"),'2');assert.match(await evaluate("document.querySelector('#sun-path-results h3').textContent"),/C1/);
  assert.equal(await status('2026-06-21T04:00:00.000Z'),'footprint');await select(1);
  report.push('keyboard sample selection updates actual paired statuses, including excluded obstruction footprints');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);
  assert.equal(await evaluate('innerWidth'),390,'narrow receiving must actually use a 390 CSS-pixel viewport');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true);
  assert.equal(await evaluate("document.querySelectorAll('#solar-path').length"),1);
  const external=await evaluate("performance.getEntriesByType('resource').map(r=>r.name).filter(u=>!u.startsWith(location.origin+'/'))");assert.deepEqual(external,[]);
  assert.equal(await stored(),original);
  report.push('390px source/result inspection stays within the viewport and makes no external runtime request');
}

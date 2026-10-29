import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {spawn} from 'node:child_process';
import {makeSkyCoverageExample} from '../shade-heat-sky-coverage-example.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {prepareSkyCoverageSource,parseSkyCoverageSource} from '../shade-heat-sky-coverage-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {profileFraction} from '../shade-heat-profile-band.js';
import {rational as q,sub} from '../vendor/chronos/exact-halfplanes.mjs';
import {withBrowserSession} from './support/browser-session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),runDirectory=root+'.browser-run-sky-allowance-'+randomUUID(),checks=[];
const exact=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)],example=makeSkyCoverageExample();let launcher=null;
try{
 launcher=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const launcherUrl=await new Promise((resolve,reject)=>{let output='',errors='';const timer=setTimeout(()=>reject(Error('Coverage launcher readiness: '+errors)),10000);
  launcher.stdout.on('data',data=>{output+=data.toString();const match=/Serving Experimental Earth at (http:\/\/127\.0\.0\.1:\d+\/)/.exec(output);if(match){clearTimeout(timer);resolve(match[1]);}});
  launcher.stderr.on('data',data=>{errors=(errors+data.toString()).slice(-4096);});launcher.once('error',e=>{clearTimeout(timer);reject(e);});launcher.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited '+code+': '+errors));});});
 const result=await withBrowserSession({root,runDirectory,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',commandMs:120000},async session=>{
  const {send,evaluate:value,exceptions}=session;assert(session.sandbox.admitted&&session.sandbox.observation.active);
  await send('DOM.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  async function until(expression){for(let i=0;i<1800;i++){try{if(await value(expression))return;}catch{}await delay(40);}throw Error('Coverage wait: '+expression+'; '+await value("document.getElementById('coverage-status')?.textContent"));}
  const click=id=>value('document.getElementById('+JSON.stringify(id)+').click()');
  async function field(id,content){await value('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.value='+JSON.stringify(String(content))+';e.dispatchEvent(new Event("input",{bubbles:true}));})()');}
  async function files(id,paths){const document=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#'+id});assert(input.nodeId);await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:paths});}
  async function state(kind){const expression="document.getElementById('coverage-status').dataset.state";await until(expression+'==='+JSON.stringify(kind)+(kind==='compared'?"||['refused','file-refused'].includes("+expression+')':''));assert.equal(await value(expression),kind,await value("document.getElementById('coverage-status').textContent"));}
  const observe=()=>value("window.coveragePosts=0;window.originalCoveragePost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.coveragePosts++;const handler=this.onmessage;this.onmessage=e=>{if(e.data.ok)window.observedCoverageResult=structuredClone(e.data.result);handler(e)};return window.originalCoveragePost.call(this,m,...args)}");
  const stored=()=>value("localStorage.getItem('experimental-earth-site-v1')");
  const exactText=v=>v.exact.numerator+' / '+v.exact.denominator;

  const allowanceArtifacts=[],allowanceCounts={reports:0,selections:0,roleViews:0,invalidInputs:0};
  const aq=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
  const acompare=(a,b)=>{const d=a[0]*b[1]-b[0]*a[1];return d<0n?-1:d>0n?1:0;};
  const aserial=x=>JSON.parse(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?String(v):v));
  const anormal=v=>{let a=v[0]<0n?-v[0]:v[0],b=v[1];while(b){const n=a%b;a=b;b=n;}return[v[0]/a,v[1]/a];};
  function allowanceEvents(r){
   if(!r.alternatives.length)return [];
   const map=new Map(),event=q=>{const v=anormal(q),key=v.join('/');if(!map.has(key))map.set(key,{value:v,existencePatternIndices:[],universalPatternIndices:[]});return map.get(key);};
   event([0n,1n]);for(const p of r.alternatives){event(aq(p.someProfileRelaxationC)).existencePatternIndices.push(p.patternIndex);event(aq(p.allProfileRelaxationC)).universalPatternIndices.push(p.patternIndex);}
   return [...map.values()].sort((a,b)=>acompare(a.value,b.value));
  }
  async function allowanceViews(output,name){
   const r=output.report,events=allowanceEvents(r),posts=await value('window.coveragePosts'),before=JSON.stringify(output),selections=[];
   allowanceCounts.reports++;
   if(!events.length){
    assert.deepEqual(await value("({...document.getElementById('coverage-allowance').dataset})"),{state:'original-incompatible'});
    assert.equal(await value("document.querySelector('#coverage-allowance input,#coverage-allowance select,#coverage-allowance button')===null"),true);
    assert.match(await value("document.getElementById('coverage-allowance').textContent"),/empty/);
   }else{
    const inputs=events.map((e,eventIndex)=>({input:{kind:'event',eventIndex},value:e.value}));
    for(let i=0;i+1<events.length;i++){const a=events[i].value,b=events[i+1].value,d=anormal([a[0]*b[1]+b[0]*a[1],2n*a[1]*b[1]]);inputs.push({input:{kind:'text',text:d[0]+' / '+d[1]},value:d});}
    for(const [text,q]of [['0.1',[1n,10n]],['1e-3',[1n,1000n]],['0.09999999999999999999999999999999999',[9999999999999999999999999999999999n,10n**35n]],['0.10000000000000000000000000000000001',[10000000000000000000000000000000001n,10n**35n]],['1 / '+String(2n**1075n),[1n,2n**1075n]],[String(2n**4095n),[2n**4095n,1n]]])inputs.push({input:{kind:'text',text},value:q});
    for(const item of inputs){
     if(item.input.kind==='event')await field('allowance-event-select',item.input.eventIndex);
     else{
      await field('allowance-input',item.input.text);
      assert.equal(await value("document.getElementById('coverage-allowance').dataset.state"),'editing');
      assert.equal(await value("document.getElementById('allowance-result').children.length"),0);
      await click('allowance-apply');
     }
     const evidence=await value("(()=>{const p=document.getElementById('allowance-selected-proof');p.open=true;p.dispatchEvent(new Event('toggle'));return JSON.parse(p.querySelector('pre').textContent)})()");
     assert.deepEqual(evidence.events,aserial(events));assert.deepEqual(evidence.selection.input,item.input);assert.deepEqual(evidence.selection.result.allowance,aserial(anormal(item.value)));
     const p=evidence.selection.result,selected=item.value,expectedPatterns=r.alternatives.map(a=>({patternIndex:a.patternIndex,status:acompare(selected,aq(a.someProfileRelaxationC))<0?'none':acompare(selected,aq(a.allProfileRelaxationC))<0?'some-but-not-every':'every'}));
     const global=expectedPatterns.every(a=>a.status==='every')?'every':expectedPatterns.some(a=>a.status!=='none')?'some-but-not-every':'none';
     assert.equal(p.globalStatus,global);assert.equal(await value("document.getElementById('coverage-allowance').dataset.globalStatus"),global);
     assert.deepEqual(await value("Array.from(document.querySelectorAll('#allowance-patterns tbody tr')).map(e=>({...e.dataset}))"),expectedPatterns.map(a=>({pattern:String(a.patternIndex),status:a.status})));
     const counts={none:expectedPatterns.filter(a=>a.status==='none').length,someButNotEvery:expectedPatterns.filter(a=>a.status==='some-but-not-every').length,every:expectedPatterns.filter(a=>a.status==='every').length,total:expectedPatterns.length};assert.deepEqual(p.patternCounts,counts);
     assert.deepEqual(await value("Array.from(document.querySelectorAll('#allowance-pattern-counts article')).map(e=>({kind:e.dataset.classification,count:Number(e.querySelector('strong').textContent)}))"),['none','someButNotEvery','every'].map(kind=>({kind,count:counts[kind]})));
     const dom=await value("(()=>{const s=document.getElementById('allowance-pattern-select'),out=[];for(const option of s.options){s.value=option.value;s.dispatchEvent(new Event('input'));for(const card of document.querySelectorAll('#allowance-roles .allowance-role'))out.push({identity:{...card.dataset},rows:Array.from(card.querySelectorAll('tbody tr')).map(e=>({...e.dataset}))});}return out})()");
     let roleIndex=0;
     for(const a of r.alternatives){
      const witnesses=[a.someProfile,...a.maxima.map(m=>m.witness)];
      for(const w of witnesses){
       const exactStatuses=[],numericStatuses=[];
       for(const [i,target]of r.requirements.entries()){
        const original=q(target.differenceC),limit=target.relation==='at-most'?[original[0]*selected[1]+selected[0]*original[1],original[1]*selected[1]]:[original[0]*selected[1]-selected[0]*original[1],original[1]*selected[1]];
        const row=w.requirements[i],exactPair=target.relation==='at-most'?aq(row.representedPairC.upper):aq(row.representedPairC.lower),numericPair=target.relation==='at-most'?aq(row.originalNumericalPairC.upper):aq(row.originalNumericalPairC.lower);
        exactStatuses.push((target.relation==='at-most'?acompare(exactPair,limit)<=0:acompare(exactPair,limit)>=0)?'met':'not-met');
        numericStatuses.push((target.relation==='at-most'?acompare(numericPair,limit)<=0:acompare(numericPair,limit)>=0)?'met':'not-met');
       }
       const counter=w.maximumViolationC!==null&&acompare(aq(w.maximumViolationC),selected)>0,identity={pattern:String(a.patternIndex),role:w.role,requirement:w.requirementIndex===null?'none':String(w.requirementIndex),meetsBoth:String(exactStatuses.every(s=>s==='met')),counterexample:String(counter)};
       assert.deepEqual(dom[roleIndex].identity,identity);
       assert.deepEqual(dom[roleIndex].rows,w.requirements.map((row,i)=>({requirement:String(i),exactOriginal:row.representedStatus,exactSelected:exactStatuses[i],numericalOriginal:row.originalNumericalStatus,numericalSelected:numericStatuses[i]})));
       const actual=p.patterns.find(x=>x.patternIndex===a.patternIndex).witnesses.find(x=>x.role===w.role&&x.requirementIndex===w.requirementIndex);
       assert.deepEqual(actual.selectedStatuses,exactStatuses);assert.equal(actual.designatedCounterexample,counter);
       const numerical=evidence.selection.numerical.find(x=>x.patternIndex===a.patternIndex&&x.role===w.role&&x.requirementIndex===w.requirementIndex);assert.deepEqual(numerical.selectedStatuses,numericStatuses);
       roleIndex++;allowanceCounts.roleViews++;
      }
     }
     assert.equal(roleIndex,dom.length);selections.push(evidence.selection);allowanceCounts.selections++;
    }
    // A source-only download after a different selected allowance preserves originals.
    if(name==='original'){const saved=await download('allowance-inspection');assert.deepEqual(saved.source,output.investigation);assert.deepEqual(Object.keys(saved.source),['kind','model','readings','query']);}
    await field('allowance-event-select',0);
    await value("window.retiredAllowanceProof=document.getElementById('allowance-selected-proof');window.retiredAllowanceSelect=document.getElementById('allowance-pattern-select');window.retiredAllowanceProof.querySelector('pre').textContent='';");
    await field('allowance-input','');
    assert.equal(await value("document.getElementById('coverage-allowance').dataset.state"),'editing');
    await value("window.retiredAllowanceProof.open=true;window.retiredAllowanceProof.dispatchEvent(new Event('toggle'));window.retiredAllowanceSelect.dispatchEvent(new Event('input'));");
    assert.equal(await value("window.retiredAllowanceProof.querySelector('pre').textContent"),'');
    assert.equal(await value("document.getElementById('allowance-result').children.length"),0);
    for(const text of ['-0','-1','1/0','NaN','1e9999999','2e-9999']){
     await field('allowance-input',text);await click('allowance-apply');
     assert.equal(await value("document.getElementById('coverage-allowance').dataset.state"),'invalid');assert.equal(await value("document.getElementById('allowance-input').getAttribute('aria-invalid')"),'true');assert.equal(await value("document.getElementById('allowance-result').children.length"),0);allowanceCounts.invalidInputs++;
    }
    await field('allowance-input','0');await value("document.getElementById('allowance-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))");
    assert.equal(await value("document.getElementById('coverage-allowance').dataset.state"),'classified');
    assert.equal(await value("document.getElementById('allowance-input').hasAttribute('aria-invalid')"),false);
    const stateBefore=await value("({...document.getElementById('coverage-allowance').dataset})");
    await value("(()=>{const host=document.getElementById('coverage-allowance');host.append(window.retiredAllowanceProof,window.retiredAllowanceSelect);window.retiredAllowanceProof.dispatchEvent(new Event('toggle'));window.retiredAllowanceSelect.dispatchEvent(new Event('input'));window.retiredAllowanceProof.remove();window.retiredAllowanceSelect.remove()})()");
    assert.deepEqual(await value("({...document.getElementById('coverage-allowance').dataset})"),stateBefore);
    await field('allowance-event-select',0);await value("document.getElementById('allowance-events').open=true;document.getElementById('allowance-events').dispatchEvent(new Event('toggle'))");
    assert.equal(await value("document.querySelectorAll('#allowance-events tbody tr').length"),events.length);
    assert.equal(await value("document.getElementById('allowance-input').labels.length"),1);assert.equal(await value("document.getElementById('allowance-event-select').labels.length"),1);
    assert.equal(await value("document.getElementById('allowance-feedback').getAttribute('aria-live')"),'polite');
    await value("document.querySelector('#allowance-patterns.table-wrap').focus()");assert.equal(await value("document.activeElement===document.getElementById('allowance-patterns')"),true);
    if(['original','nonattainers','tiny-positive'].includes(name)){
     for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});
      await value("document.getElementById('coverage-allowance').scrollIntoView({block:'start',behavior:'instant'})");await value("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
      assert.equal(await value("document.documentElement.scrollWidth<=innerWidth+1"),true);
      const fit=await value("Array.from(document.querySelectorAll('.allowance-controls input,.allowance-controls select,.allowance-counts article,.allowance-limits article')).every(e=>e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1)");
      assert.equal(fit,true);const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/allowance-'+name+'-'+width+'.png',Buffer.from(shot.data,'base64'));
     }
     await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
    }
   }
   assert.equal(await value('window.coveragePosts'),posts);assert.equal(JSON.stringify(output),before);
   const coverageName='runtime-coverage-'+name+'.json',coverageRaw=JSON.stringify(output,null,2),artifact={schema:'experimental-earth/sky-allowance-projection/1',coverageReport:{file:coverageName,sha256:createHash('sha256').update(coverageRaw).digest('hex'),acceptedMerge:'8495f63848b8d283c3f124be057d7e3c259efa36'},events:aserial(events),selections};
   const artifactName='runtime-allowance-'+name+'.json',raw=JSON.stringify(artifact,null,2);await writeFile(runDirectory+'/'+artifactName,raw);
   allowanceArtifacts.push({file:runDirectory+'/'+artifactName,sha256:createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw),coverageReport:artifact.coverageReport,selections:selections.length});
  }

  async function matches(output){
   const r=output.report,d=await value("({...document.getElementById('coverage-results').dataset})");
   assert.equal(d.status,r.compatibility);assert.equal(d.coverage,r.coverageStatus);assert.equal(d.minimum,r.minimumChanges===null?'none':String(r.minimumChanges));
   for(const [key,want]of [['patterns',r.patterns.length],['alternatives',r.alternatives.length],['records',output.investigation.readings.length],['originalTimes',r.originalTimes.length],['sources',r.work.uniqueSources]])assert.equal(Number(d[key]),want);
   const query=await value("['a','b'].map(id=>({receiverReadingIndex:Number(document.getElementById('coverage-'+id+'-receiver').value),utc:document.getElementById('coverage-'+id+'-time').value,store:document.getElementById('coverage-'+id+'-store').value,relation:document.getElementById('coverage-'+id+'-relation').value,differenceC:Number(document.getElementById('coverage-'+id+'-limit').value),source:document.getElementById('coverage-'+id+'-source').value}))");
   assert.deepEqual(query,output.investigation.query.requirements);
   const verdict=await value("({...document.getElementById('coverage-verdict').dataset})");
   assert.equal(verdict.coverage,r.coverageStatus);
   for(const [shown,key]of [['someOriginal','someProfileMeetsOriginal'],['allOriginal','allProfilesMeetOriginal'],['floorActive','floorActive'],['floorOnly','floorOnly']])assert.equal(verdict[shown],r[key]===null?'unevaluated':String(r[key]));
   for(const [shown,key]of [['some','someProfileRelaxationC'],['all','allProfileRelaxationC'],['raw','rawMaximumViolationC'],['gap','coverageGapC']])assert.equal(verdict[shown],r[key]?exactText(r[key]):'unevaluated');
   for(const [shown,key]of [['somePatterns','someProfileAttainingPatternIndices'],['allPatterns','allProfileAttainingPatternIndices'],['rawPairs','rawMaximumPairs'],['controllingPairs','controllingPairs'],['zeroPatterns','zeroCoverPatternIndices']])assert.deepEqual(JSON.parse(verdict[shown]),r[key]);
   const classes=await value("Array.from(document.querySelectorAll('.coverage-class')).map(e=>({...e.dataset}))");
   for(const row of classes){const changes=Number(row.changes),patterns=r.patterns.filter(p=>p.changes===changes),compatible=patterns.filter(p=>p.compatibility==='compatible');
    assert.equal(Number(row.examined),patterns.length);assert.equal(Number(row.compatible),compatible.length);
    assert.equal(row.status,changes>r.query.maximumChanges?'outside-declaration':!patterns.length?'not-examined':compatible.length?'compatible':'incompatible');}
   assert.equal(await value("document.querySelectorAll('#coverage-all-patterns tbody tr').length"),r.patterns.length);
   if(!r.alternatives.length){assert.equal(await value("Boolean(document.getElementById('coverage-pattern-select')||document.getElementById('coverage-witness'))"),false);return;}
   const rows=await value("Array.from(document.querySelectorAll('#coverage-pattern-results tbody tr')).map(e=>({...e.dataset}))");
   assert.deepEqual(rows,r.alternatives.map(a=>({pattern:String(a.patternIndex),some:exactText(a.someProfileRelaxationC),all:exactText(a.allProfileRelaxationC),raw:exactText(a.rawMaximumViolationC),someAttains:String(a.someProfileAttainsGlobalMinimum),allAttains:String(a.allProfileAttainsGlobalMaximum),floorOnly:String(a.floorOnly),maximumA:exactText(a.maxima[0].maximumViolationC),maximumB:exactText(a.maxima[1].maximumViolationC)})));
   assert.deepEqual(await value("Array.from(document.getElementById('coverage-pattern-select').options).map(o=>Number(o.value))"),r.alternatives.map(a=>a.patternIndex));
   const selected=Number(await value("document.getElementById('coverage-pattern-select').value")),pattern=r.alternatives.find(a=>a.patternIndex===selected),
    kind=await value("document.getElementById('coverage-role-select').value"),w=kind==='some-profile'?pattern.someProfile:pattern.maxima[kind==='maximum-a'?0:1].witness,
    data=await value("({...document.getElementById('coverage-witness').dataset})");
   assert.deepEqual(await value("Array.from(document.getElementById('coverage-role-select').options).map(o=>o.value)"),['some-profile','maximum-a','maximum-b']);
   assert.equal(data.pattern,String(selected));assert.equal(data.kind,kind);
   for(const [shown,want]of [['some',pattern.someProfileRelaxationC],['all',pattern.allProfileRelaxationC],['allowance',w.allowanceC],['required',w.requiredRelaxationC]])assert.equal(data[shown],exactText(want));
   assert.equal(data.maximum,w.maximumViolationC?exactText(w.maximumViolationC):'none');
   assert.equal(data.someAttains,String(pattern.someProfileAttainsGlobalMinimum));assert.equal(data.allAttains,String(pattern.allProfileAttainsGlobalMaximum));assert.equal(Number(data.phases),w.phaseProfiles.length);
   assert.deepEqual(await value("Array.from(document.querySelectorAll('#coverage-witness .phase-profile')).map(e=>JSON.parse(e.dataset.weights))"),w.phaseProfiles.map(p=>p.map(v=>v.lower)));
   assert.equal(await value("document.querySelectorAll('#coverage-observations tbody tr').length"),output.investigation.readings.length);
   const shown=await value("Array.from(document.querySelectorAll('#coverage-witness-requirements tbody tr')).map(e=>({...e.dataset}))");
   assert.deepEqual(shown,w.requirements.map(item=>({requirement:String(item.requirementIndex),represented:item.representedStatus,relaxedRepresented:item.relaxedRepresentedStatus,numerical:item.originalNumericalStatus,relaxedNumerical:item.relaxedOriginalNumericalStatus,originalLimit:exactText(item.originalLimitC),relaxedLimit:exactText(item.relaxedLimitC),
    representedLower:String(item.representedPairC.lower.lower),representedUpper:String(item.representedPairC.upper.upper),numericalLower:String(item.originalNumericalPairC.lower.lower),numericalUpper:String(item.originalNumericalPairC.upper.upper)})));
  }
  async function allViews(output){
   const before=await value('window.coveragePosts');let total=0;
   for(const pattern of output.report.alternatives){
    await field('coverage-pattern-select',pattern.patternIndex);
    for(const [kind,a]of [['some-profile',pattern.someProfile],['maximum-a',pattern.maxima[0].witness],['maximum-b',pattern.maxima[1].witness]]){
     await field('coverage-role-select',kind);await matches(output);
     const rows=await value("(()=>{const receiver=document.getElementById('coverage-receiver-select'),time=document.getElementById('coverage-time-select'),rows=[];for(const s of receiver.options){receiver.value=s.value;receiver.dispatchEvent(new Event('input'));for(const t of time.options){time.value=t.value;time.dispatchEvent(new Event('input'));const context={...document.getElementById('coverage-time-detail').dataset};rows.push(...Array.from(document.querySelectorAll('#coverage-time-detail .coverage-value')).map(e=>({...context,...e.dataset})));}}return rows})()");
     assert.equal(rows.length,a.originalReplays.length*output.report.originalTimes.length*2);total+=rows.length;
     for(const row of rows){assert.equal(Number(row.pattern),pattern.patternIndex);assert.equal(row.kind,kind);
      const replay=a.originalReplays.find(p=>p.sourceIndex===Number(row.source)),at=replay.originalCourse[Number(row.time)],store=row.store;
      assert.equal(row.utc,at.utc);assert.equal(Number(row.additiveLower),profileFraction(sub(exact(at.additiveC.proposal.lower[store]),exact(at.additiveC.existing.upper[store]))).lower);
      assert.equal(Number(row.additiveUpper),profileFraction(sub(exact(at.additiveC.proposal.upper[store]),exact(at.additiveC.existing.lower[store]))).upper);
      assert.equal(Number(row.originalLower),profileFraction(sub(q(at.originalC.proposal.lower[store]),q(at.originalC.existing.upper[store]))).lower);
      assert.equal(Number(row.originalUpper),profileFraction(sub(q(at.originalC.proposal.upper[store]),q(at.originalC.existing.lower[store]))).upper);
     }
    }
   }assert.equal(await value('window.coveragePosts'),before);return total;
  }
  async function download(name){
   const directory=runDirectory+'/download-'+name;await mkdir(directory);await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('coverage-export');
   const path=directory+'/original-clock-sky-coverage-inputs.json';let found=false;for(let i=0;i<300;i++){try{await access(path);found=true;break;}catch{await delay(30);}}assert(found);
   const text=await readFile(path,'utf8'),source=parseSkyCoverageSource(text);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);return {path,text,source};
  }

  await send('Page.navigate',{url:launcherUrl+'sky-relaxation.html'});await until("Boolean(document.querySelector('a[href=\"sky-coverage.html\"]'))");
  assert.equal(await value("document.querySelector('a[href=\"sky-coverage.html\"]').target"),'_blank');const originalStorage=await stored();
  await send('Page.navigate',{url:launcherUrl+'sky-coverage.html'});await until("document.getElementById('coverage-example')?.disabled===false");await observe();await click('coverage-example');await state('compared');
  const actual=await value('window.observedCoverageResult');await matches(actual);assert.deepEqual(actual.investigation.readings,example.readings);
  assert.equal(actual.report.minimumChanges,2);assert.equal(actual.report.patterns.length,121);assert.deepEqual(actual.report.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
  assert.equal(actual.report.coverageStatus,'compared-common-relaxations');assert.equal(actual.report.someProfileMeetsOriginal,false);assert.equal(actual.report.allProfilesMeetOriginal,false);assert(actual.report.someProfileRelaxationC.lower>0);assert(actual.report.allProfileRelaxationC.lower>actual.report.someProfileRelaxationC.upper);assert.deepEqual(actual.report.someProfileAttainingPatternIndices,[79]);assert.deepEqual(actual.report.allProfileAttainingPatternIndices,[79]);assert.deepEqual(actual.report.controllingPairs,[{patternIndex:79,requirementIndex:0}]);
  assert.equal(actual.report.work.actualWitnessProfiles,3);assert.equal(actual.report.work.executedThermalCourses,47604);
  await writeFile(runDirectory+'/runtime-coverage-original.json',JSON.stringify(actual,null,2));
  await allowanceViews(actual,"original");
  await value("document.getElementById('coverage-selected-certificate').open=true");await until("document.querySelector('#coverage-selected-certificate pre').textContent.length>0");
  const coverageProof=await value("JSON.parse(document.querySelector('#coverage-selected-certificate pre').textContent)");assert.deepEqual(coverageProof.selected,actual.report.exactEvidence.result.minimum.cases[0].relaxation);
  assert.equal(await value("Boolean(document.getElementById('coverage-time-select'))"),true);
  await value("window.retiredCoverageRole=document.getElementById('coverage-role-select')");
  await field('coverage-role-select','maximum-a');await matches(actual);
  await value("document.getElementById('coverage-selected-certificate').open=true");await until("document.querySelector('#coverage-selected-certificate pre').textContent.length>0");
  assert.deepEqual(await value("JSON.parse(document.querySelector('#coverage-selected-certificate pre').textContent).selected"),actual.report.exactEvidence.result.cases[0].tests[0]);
  const roleContext=await value("({...document.getElementById('coverage-witness').dataset})");
  await value("window.retiredCoverageRole.value='maximum-b';window.retiredCoverageRole.dispatchEvent(new Event('input'))");
  assert.deepEqual(await value("({...document.getElementById('coverage-witness').dataset})"),roleContext);
  await value("document.getElementById('coverage-selected-certificate').open=false");
  checks.push('Actual new entry and worker retain24original records/3receivers/17times, complete121pattern search, sole minimum2-change pattern[6,10], certified one-profile and every-profile amounts with three separate role profiles');
  assert.equal(await allViews(actual),306);await field('coverage-time-select',3);await value("document.getElementById('coverage-time-select').focus()");
  for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40});await until("document.getElementById('coverage-time-detail').dataset.time==='4'");
  await value("document.getElementById('coverage-requirement-proof').open=true");await until("document.querySelector('#coverage-requirement-proof pre').textContent.length>0");
  const disclosed=await value("JSON.parse(document.querySelector('#coverage-requirement-proof pre').textContent)");assert.deepEqual(disclosed.result,actual.report.exactEvidence.result);assert.deepEqual(disclosed.requirements,actual.report.requirements);
  await value("document.getElementById('coverage-requirement-proof').open=false;document.getElementById('coverage-all-patterns').open=true;document.querySelector('#coverage-all-patterns .coverage-proof').open=true");
  await until("document.querySelector('#coverage-all-patterns pre').textContent.length>0");await field('coverage-proof-select',0);
  const originalProof=await value("JSON.parse(document.querySelector('#coverage-all-patterns pre').textContent)");assert.deepEqual(originalProof.proof,actual.report.exactEvidence.result.minimum.analysis.cases[0]);await value("document.getElementById('coverage-all-patterns').open=false");
  assert.equal(await value("(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);return new Set(ids).size===ids.length})()"),true);
  checks.push('Every306 profile-role receiver/time/component view and both requirement statuses match actual exact/numerical output; keyboard selection, original and augmented proof disclosure use no new worker and IDs remain unique');
  assert.match(await value("document.getElementById('coverage-global-amounts').textContent"),/4\.2935\d+e-5/);assert.match(await value("document.getElementById('coverage-global-amounts').textContent"),/1\.805024e-3/);
  const saved=await download('original');assert.deepEqual(saved.source,actual.investigation);
  for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await delay(70);assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
   for(const [selector,label]of [['.coverage-requirement','requirements'],['#coverage-verdict','coverage-verdict'],['#coverage-witness','common-profile'],['#coverage-time-detail','original-time']]){
    await value('document.querySelector('+JSON.stringify(selector)+').scrollIntoView({block:"start",behavior:"instant"})');await value('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/coverage-'+label+'-'+width+'.png',Buffer.from(shot.data,'base64'));
   }
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  const three=makeThreeEpochSkyExample(),priorPath=runDirectory+'/prior-three-inputs.json';await writeFile(priorPath,JSON.stringify(prepareThreeEpochSkySource(three.readings,three.query)));
  await files('coverage-originals',[priorPath]);await state('not-compared');assert.equal(await value("document.querySelectorAll('#coverage-sources tbody tr').length"),24);assert.equal(await value("document.getElementById('coverage-results').hidden"),true);
  assert.equal(await value("document.getElementById('coverage-maximum').value"),'2');
  await send('Page.reload',{ignoreCache:true});await until("document.getElementById('coverage-example')?.disabled===false");await observe();await files('coverage-reopen',[saved.path]);await state('compared');
  assert.deepEqual(await value('window.observedCoverageResult'),actual);await matches(actual);
  checks.push('Source-only download and fresh document/worker reproduce the exact report; a prior fixed-profile inquiry preserves all observations without passing its known cuts;1440/390layouts retain viewport bounds');
  const tiedReadings=structuredClone(example.readings);for(const input of tiedReadings)input.query.reading.halfWidthC=1;
  const tiedQuery=structuredClone(example.query);tiedQuery.searchSource='Authored wider original bands with two broad whole-interval requirements';
  Object.assign(tiedQuery.requirements[0],{relation:'at-most',differenceC:100});Object.assign(tiedQuery.requirements[1],{relation:'at-least',differenceC:-100});
  const tiedSource=prepareSkyCoverageSource(tiedReadings,tiedQuery),tiedPath=runDirectory+'/tied-inputs.json';await writeFile(tiedPath,JSON.stringify(tiedSource));
  await files('coverage-reopen',[tiedPath]);await state('compared');const tied=await value('window.observedCoverageResult');await matches(tied);
  assert.equal(tied.report.minimumChanges,1);assert.equal(tied.report.patterns.length,16);assert.deepEqual(tied.report.alternatives.map(a=>a.splitAfterIntervals),Array.from({length:9},(_,i)=>[i+3]));
  assert.equal(tied.report.unexaminedHigherChangePatterns,105);assert.equal(tied.report.floorOnly,true);assert.deepEqual(tied.report.controllingPairs,[]);assert.deepEqual(tied.report.allProfileAttainingPatternIndices,tied.report.alternatives.map(a=>a.patternIndex));assert.deepEqual(tied.report.someProfileAttainingPatternIndices,tied.report.alternatives.map(a=>a.patternIndex));assert.deepEqual(tied.report.zeroCoverPatternIndices,tied.report.someProfileAttainingPatternIndices);assert.equal(tied.report.work.actualWitnessProfiles,27);
  assert.equal(await allViews(tied),2754);await field('coverage-pattern-select',tied.report.alternatives[0].patternIndex);
  await value("window.retiredCoverageTime=document.getElementById('coverage-time-select');window.retiredCoverageReceiver=document.getElementById('coverage-receiver-select')");
  await field('coverage-pattern-select',tied.report.alternatives[1].patternIndex);const currentView=await value("({...document.getElementById('coverage-time-detail').dataset})");
  await value("window.retiredCoverageTime.value='0';window.retiredCoverageTime.dispatchEvent(new Event('input'));window.retiredCoverageReceiver.value='0';window.retiredCoverageReceiver.dispatchEvent(new Event('input'))");
  assert.deepEqual(await value("({...document.getElementById('coverage-time-detail').dataset})"),currentView);
  await writeFile(runDirectory+'/runtime-coverage-ties.json',JSON.stringify(tied,null,2));
  await allowanceViews(tied,"ties");
  checks.push('All9 tied minimum one-change patterns have floor-only universal zero under broad upper/lower requirements;27 separate role profiles supply2754 views;105higher patterns stay unexamined and detached controls retire');
  const mixedQuery={...tiedQuery,requirements:structuredClone(example.query.requirements),searchSource:'Retain the independently declared wider original bands while restoring both authored original thresholds'};
  const mixedSource=prepareSkyCoverageSource(tiedReadings,mixedQuery),mixedPath=runDirectory+'/nonattainer-inputs.json';await writeFile(mixedPath,JSON.stringify(mixedSource));
  await files('coverage-reopen',[mixedPath]);await state('compared');const mixed=await value('window.observedCoverageResult');await matches(mixed);
  assert.equal(mixed.report.minimumChanges,1);assert.equal(mixed.report.someProfileRelaxationC.exact.numerator,'0');assert.deepEqual(mixed.report.someProfileAttainingPatternIndices,[8,9,10,11]);
  assert.equal(mixed.report.alternatives.length,9);assert.equal(mixed.report.alternatives.filter(a=>!a.someProfileAttainsGlobalMinimum).length,5);assert.equal(await allViews(mixed),2754);
  const nonwinner=mixed.report.alternatives.find(a=>!a.someProfileAttainsGlobalMinimum);await field('coverage-pattern-select',nonwinner.patternIndex);await field('coverage-role-select','some-profile');await matches(mixed);
  assert.notEqual(nonwinner.someProfileRelaxationC.exact.numerator,'0');assert(mixed.report.allProfileRelaxationC.lower>0);assert.equal(await value("document.getElementById('coverage-witness').dataset.allowance"),exactText(nonwinner.someProfileRelaxationC));
  await value("document.getElementById('coverage-selected-certificate').open=true");await until("document.querySelector('#coverage-selected-certificate pre').textContent.length>0");
  assert.deepEqual(await value("JSON.parse(document.querySelector('#coverage-selected-certificate pre').textContent).selected"),mixed.report.exactEvidence.result.minimum.cases.find(c=>c.patternIndex===nonwinner.patternIndex).relaxation);
  await value("document.getElementById('coverage-selected-certificate').open=false");
  for(const [width,height,mobile]of [[1440,1000,false],[390,844,true]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});await value("document.getElementById('coverage-witness').scrollIntoView({block:'start',behavior:'instant'})");await delay(40);
   assert(await value('document.documentElement.scrollWidth<=innerWidth+1'));
   const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(runDirectory+'/coverage-nonattainer-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,mobile:false,deviceScaleFactor:1});
  await writeFile(runDirectory+'/runtime-coverage-nonattainers.json',JSON.stringify(mixed,null,2));
  await allowanceViews(mixed,"nonattainers");
  checks.push('Global one-profile zero retains four exact tied winners and five positive nonattaining pattern optima while universal coverage remains positive;2754 additional views retain own versus global allowances');
  const representative=[example.readings[0],example.readings[3],example.readings[5]].map(input=>{const source=structuredClone(input.source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});return {...input,source};});
  const choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
  const partialReadings=choices.map(([source,index,store])=>{const input=representative[source];return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,reading:{...input.query.reading,utc:originalSkyReadingTimes(input.source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar partial original clock'}});});
  const partialTimes=originalSkyReadingTimes(partialReadings[0].source),partialQuery={...tiedQuery,searchSource:'All original internal boundaries on this independently declared partial clock',
   requirements:[{...tiedQuery.requirements[0],receiverReadingIndex:0,utc:partialTimes.at(-1).utc,store:'surfaceC'},{...tiedQuery.requirements[1],receiverReadingIndex:2,utc:partialTimes[3].utc,store:'subsurfaceC'}]};
  const partialSource=prepareSkyCoverageSource(partialReadings,partialQuery),partialPath=runDirectory+'/partial-inputs.json';await writeFile(partialPath,JSON.stringify(partialSource));
  await value("window.retiredCoverageChoice=document.getElementById('coverage-pattern-select')");await files('coverage-reopen',[partialPath]);await state('compared');const partial=await value('window.observedCoverageResult');await matches(partial);
  assert.equal(partial.report.minimumChanges,0);assert.equal(partial.report.patterns.length,1);assert.equal(partial.report.someProfileMeetsOriginal,true);
  assert.equal(partial.report.unexaminedHigherChangePatterns,45);assert.equal(partial.report.originalTimes.at(-1).minute,127.4);assert.equal(partial.report.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');assert.equal(await allViews(partial),198);
  const beforeOld=await value("({...document.getElementById('coverage-time-detail').dataset})");await value("window.retiredCoverageChoice.value='3';window.retiredCoverageChoice.dispatchEvent(new Event('input'))");assert.deepEqual(await value("({...document.getElementById('coverage-time-detail').dataset})"),beforeOld);
  await writeFile(runDirectory+'/runtime-coverage-partial.json',JSON.stringify(partial,null,2));
  await allowanceViews(partial,"partial");
  checks.push('Unfamiliar11-time127.4minute clock and5mixed records preserve all original identities; three static role profiles supply198 views and45higher patterns stay unexamined');
  const targetPosts=await value('window.coveragePosts');
  const edits=[['a-receiver',1],['a-time',partial.report.originalTimes[2].utc],['a-store','subsurfaceC'],['a-relation','at-least'],['a-limit',-100],['a-source','A freshly declared lower requirement'],
   ['b-receiver',0],['b-time',partial.report.originalTimes[0].utc],['b-store','surfaceC'],['b-relation','at-most'],['b-limit',0],['b-source','An exact initial-state upper requirement']];
  for(const [id,content]of edits){await field('coverage-'+id,content);assert.equal(await value("document.getElementById('coverage-results').hidden&&document.getElementById('coverage-export').disabled"),true);}
  assert.equal(await value('window.coveragePosts'),targetPosts);await click('coverage-run');await state('compared');const retargeted=await value('window.observedCoverageResult');await matches(retargeted);
  assert.deepEqual(retargeted.investigation.readings,partial.investigation.readings);assert.equal(await value('window.coveragePosts'),targetPosts+1);assert.equal(retargeted.report.someProfileMeetsOriginal,true);assert.equal(retargeted.report.allProfilesMeetOriginal,true);assert.equal(retargeted.report.floorActive,true);assert.equal(retargeted.report.floorOnly,false);assert.deepEqual(retargeted.report.controllingPairs,[{patternIndex:0,requirementIndex:1}]);assert.equal(await allViews(retargeted),198);
  await writeFile(runDirectory+'/runtime-coverage-retargeted.json',JSON.stringify(retargeted,null,2));
  await allowanceViews(retargeted,"retargeted");
  await field('coverage-b-limit',-1);await click('coverage-run');await state('compared');const one=await value('window.observedCoverageResult');await matches(one);
  assert.equal(one.report.someProfileMeetsOriginal,false);assert.equal(one.report.someProfileRelaxationC.lower,1);assert.deepEqual(one.report.alternatives[0].someProfile.requirements.map(item=>item.representedStatus),['met','not-met']);assert.equal(one.report.work.actualWitnessProfiles,3);assert.equal(await allViews(one),198);
  await writeFile(runDirectory+'/runtime-coverage-constant-positive.json',JSON.stringify(one,null,2));
  await allowanceViews(one,"constant-positive");
  const tinyQuery=structuredClone(partialQuery);
  for(const [i,target]of tinyQuery.requirements.entries())Object.assign(target,{receiverReadingIndex:0,utc:partialTimes[0].utc,store:'surfaceC',relation:i?'at-least':'at-most',differenceC:i?Number.MIN_VALUE:-Number.MIN_VALUE});
  const tinySource=prepareSkyCoverageSource(partialReadings,tinyQuery),tinyPath=runDirectory+'/tiny-positive-inputs.json';await writeFile(tinyPath,JSON.stringify(tinySource));
  await files('coverage-reopen',[tinyPath]);await state('compared');const tiny=await value('window.observedCoverageResult');await matches(tiny);
  assert.equal(tiny.report.someProfileMeetsOriginal,false);assert(tiny.report.someProfileRelaxationC.exact.numerator!=='0');
  assert.match(await value("document.getElementById('coverage-global-amounts').textContent"),/4\.940656e-324/);assert.notEqual(tiny.report.allProfileRelaxationC.exact.numerator,'0');
  const belowDisplay=await value("(async()=>{const m=await import('./shade-heat-sky-coverage-view.js');return m.skyCoverageAmountText({exact:{numerator:'1',denominator:(2n**1075n).toString()}})})()");
  assert.equal(belowDisplay,'2.470328e-324');assert.equal(await allViews(tiny),198);
  await writeFile(runDirectory+'/runtime-coverage-tiny-positive.json',JSON.stringify(tiny,null,2));
  await allowanceViews(tiny,"tiny-positive");
  checks.push('Actual source thresholds at the smallest positive binary64 amount retain positive one-profile and every-profile amounts, original failures and scientific display; exact2^-1075 formatting also remains positive');
  await files('coverage-reopen',[partialPath]);await state('compared');await matches(partial);
  checks.push('All12 target identity/relation/threshold/source edits retire the previous proof before one fresh worker; exact initial equality has zero every-profile amount with a binding contact and a constant positive optimum retains one original failure, across396additional views');

  for(const [name,content]of [
   ['derived',JSON.stringify({...partial.investigation,report:partial.report})],
   ['cuts',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,splitAfterIntervals:[1,2]}})],
   ['requirement-clock',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,requirements:partial.investigation.query.requirements.map((target,index)=>index?target:{...target,utc:'2026-06-21T06:07:37.001Z'})}})],
   ['requirement-count',JSON.stringify({...partial.investigation,query:{...partial.investigation.query,requirements:[partial.investigation.query.requirements[0]]}})],
   ['utf8',Buffer.from([0xff,0xfe])],['oversize',' '.repeat(5*1024*1024+1)]]){
   const path=runDirectory+'/bad-'+name+'.json';await writeFile(path,content);const before=await value('window.coveragePosts');await files('coverage-reopen',[path]);await state('file-refused');
   assert.equal(await value('window.coveragePosts'),before);await matches(partial);assert.equal(await value("document.getElementById('coverage-export').disabled"),false);
  }
  const shortSource=structuredClone(example.readings[0].source);Object.assign(shortSource.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
  const shortTimes=originalSkyReadingTimes(shortSource),impossibleReadings=[[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(shortSource.project,shortSource.declaration,{bins:4,reading:{...example.readings[0].query.reading,utc:shortTimes[index].utc,store,temperatureC:index===2?400:25,halfWidthC:index===2?0:100,source:'Authored impossible final original observation'}}));
  const impossibleSource=prepareSkyCoverageSource(impossibleReadings,{...partialQuery,requirements:partialQuery.requirements.map((target,index)=>({...target,receiverReadingIndex:index,utc:shortTimes[index+1].utc}))}),impossiblePath=runDirectory+'/impossible-inputs.json';
  await writeFile(impossiblePath,JSON.stringify(impossibleSource));await files('coverage-reopen',[impossiblePath]);await state('compared');const impossible=await value('window.observedCoverageResult');await matches(impossible);
  assert.equal(impossible.report.compatibility,'incompatible');assert.equal(impossible.report.minimumChanges,null);assert.equal(impossible.report.coverageStatus,'original-incompatible');
  assert.equal(impossible.report.someProfileRelaxationC,null);assert.equal(impossible.report.allProfileRelaxationC,null);assert.equal(impossible.report.allProfilesMeetOriginal,null);assert.equal(impossible.report.floorOnly,null);assert.equal(impossible.report.someProfileMeetsOriginal,null);assert.equal(impossible.report.patterns.length,2);assert.equal(impossible.report.alternatives.length,0);assert.equal(impossible.report.work.executedWitnessCourses,0);
  await writeFile(runDirectory+'/runtime-coverage-original-empty.json',JSON.stringify(impossible,null,2));
  await allowanceViews(impossible,"original-empty");const impossibleSaved=await download('incompatible');assert.deepEqual(impossibleSaved.source,impossible.investigation);
  checks.push('Malformed UTF-8, excess bytes, injected output/cuts and altered target count/clock are refused before a worker without replacing the accepted inquiry; impossible original evidence leaves both requirements unevaluated and has no witness');
  await files('coverage-reopen',[partialPath]);await state('compared');
  const slow=runDirectory+'/slow-coverage-inputs.json';await writeFile(slow,saved.text);
  await value("window.coverageArrayBuffer=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow-coverage-inputs.json')return new Promise(resolve=>{window.releaseCoverageFile=()=>window.coverageArrayBuffer.call(this).then(resolve)});return window.coverageArrayBuffer.call(this)}");
  await files('coverage-reopen',[slow]);await until("typeof window.releaseCoverageFile==='function'");assert.equal(await value("document.getElementById('coverage-export').disabled&&document.getElementById('coverage-time-select').disabled"),true);
  assert.equal(await value("Array.from(document.querySelectorAll('#coverage-allowance input,#coverage-allowance select,#coverage-allowance button')).every(e=>e.disabled)"),true);
  const heldAllowance=await value("document.getElementById('coverage-allowance').outerHTML");
  await value("document.getElementById('allowance-input').dispatchEvent(new Event('input'));document.getElementById('allowance-event-select').dispatchEvent(new Event('input'));document.getElementById('allowance-apply').dispatchEvent(new Event('click'))");
  assert.equal(await value("document.getElementById('coverage-allowance').outerHTML"),heldAllowance);
  await field('coverage-a-source','Newer requirement while an older file is pending');assert.equal(await value("document.getElementById('coverage-results').hidden"),true);
  await files('coverage-reopen',[impossiblePath]);await state('compared');await matches(impossible);await value('window.releaseCoverageFile()');await delay(80);await matches(impossible);await value('File.prototype.arrayBuffer=window.coverageArrayBuffer');
  await value("window.heldCoveragePost=Worker.prototype.postMessage;window.holdCoverage=true;Worker.prototype.postMessage=function(m,...args){if(window.holdCoverage&&m.operation==='prepare'){window.holdCoverage=false;const handler=this.onmessage;this.onmessage=e=>{window.releaseCoverageWorker=()=>handler(e)}}return window.heldCoveragePost.call(this,m,...args)}");
  await files('coverage-reopen',[partialPath]);await until("typeof window.releaseCoverageWorker==='function'");await files('coverage-reopen',[impossiblePath]);await state('compared');await matches(impossible);
  await value('window.releaseCoverageWorker()');await delay(80);await matches(impossible);await value('Worker.prototype.postMessage=window.heldCoveragePost');
  checks.push('Pending file/result controls are held; requirement edits retire old evidence; held file bytes and an older completed worker cannot replace a newer complete inquiry');
  await files('coverage-originals',[partialPath]);await state('not-compared');const postBefore=await value('window.coveragePosts');await field('coverage-maximum',0);await click('coverage-run');await state('compared');
  const fixed=await value('window.observedCoverageResult');assert.equal(await value('window.coveragePosts'),postBefore+1);assert.equal(fixed.report.totalDeclaredPatterns,1);assert.equal(fixed.report.unexaminedHigherChangePatterns,0);await matches(fixed);
  await writeFile(runDirectory+'/runtime-coverage-declared-static.json',JSON.stringify(fixed,null,2));
  await allowanceViews(fixed,"declared-static");
  await value("document.getElementById('coverage-source-details').open=true;document.querySelector('#coverage-sources .table-wrap').focus()");
  assert.equal(await value("document.activeElement===document.querySelector('#coverage-sources .table-wrap')"),true);assert.equal(await stored(),originalStorage);assert.deepEqual(exceptions,[]);
  checks.push('Explicit maximum0 recomputes only the declared static class; original evidence tables remain focusable; saved site state and page exception count remain unchanged');
  checks.push('Exact allowance selections preserve every event and profile role, recompute exact/numerical statuses, refuse invalid text, retire stale inspection callbacks and preserve source-only downloads without worker posts');
  return {checks,allowanceCounts,allowanceArtifacts,sandbox:session.sandbox,exceptions,launcher:{command:'python3 serve.py --port 0',url:launcherUrl},
   qualification:'Actual fresh worker output is the UI oracle. The original minimum class is fixed before the two whole-interval requirements. Every pattern retains its own one-profile minimum, both signed residual maxima and its nonnegative coverage bound. Three role profiles remain separate. All global raw/clamped/binding ties and original/allowance-relaxed exact/numerical statuses remain distinct.'};
 });
 const receipt={status:'PASS',...result.value,receipt:result.receipt};await writeFile(runDirectory+'/browser.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}catch(error){console.error(JSON.stringify({status:'FAIL',error:String(error),checks,receipt:error.receipt??null,runDirectory},null,2));process.exitCode=1;}
finally{if(launcher&&launcher.exitCode===null&&launcher.signalCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>launcher.kill('SIGKILL'),3000);launcher.once('close',()=>{clearTimeout(timer);resolve();});launcher.kill('SIGTERM');});}

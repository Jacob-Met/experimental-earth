import assert from 'node:assert/strict';
import { readFile, writeFile, unlink, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = await realpath(process.env.DEMO_PACKAGE_ROOT ?? (() => { throw Error('Set DEMO_PACKAGE_ROOT to the actual video package directory'); })());
const videoPath = process.env.DEMO_VIDEO_PATH;
assert.ok(videoPath && !isAbsolute(videoPath) && !videoPath.split(/[\\/]/).includes('..'), 'DEMO_VIDEO_PATH must be a relative package path without traversal');
const videoFile = await realpath(resolve(root,videoPath));
assert.ok(videoFile.startsWith(root+sep), 'Video must resolve inside the served package');
const timelineSource = JSON.parse(await readFile(process.env.DEMO_TIMELINE_PATH ?? (() => { throw Error('Set DEMO_TIMELINE_PATH to the normalized encoded-video timeline'); })(),'utf8'));
const stages = Array.isArray(timelineSource) ? timelineSource : (timelineSource.stages ?? timelineSource.timeline);
assert.ok(Array.isArray(stages) && stages.length>0, 'Timeline must be an array, .stages or .timeline with atSeconds');
for(const [index,stage] of stages.entries()) {
  assert.ok(Number.isFinite(stage.atSeconds) && stage.atSeconds>=0,'Every stage requires encoded-video atSeconds');
  if(index) assert.ok(stage.atSeconds>stages[index-1].atSeconds,'Stage times must be strictly increasing');
}
const expected = {
  width:Number(process.env.DEMO_EXPECTED_WIDTH??1280),height:Number(process.env.DEMO_EXPECTED_HEIGHT??1012),
  duration:Number(process.env.DEMO_EXPECTED_DURATION??79.23),tolerance:Number(process.env.DEMO_DURATION_TOLERANCE??0.5),
};
assert.ok(Object.values(expected).every(Number.isFinite) && expected.width>0 && expected.height>0 && expected.duration>0 && expected.tolerance>=0);
const runDirectory=process.env.BROWSER_RUN_DIRECTORY;
assert.ok(runDirectory && isAbsolute(runDirectory),'Set a unique absolute BROWSER_RUN_DIRECTORY');
const playbackMode=process.env.DEMO_PLAYBACK_MODE??'http';
assert.ok(['http','downloaded-blob'].includes(playbackMode),'DEMO_PLAYBACK_MODE must be http or downloaded-blob');
const fullPlaybackRequested=process.env.DEMO_FULL_PLAYBACK==='1';
const sha256=createHash('sha256').update(await readFile(videoFile)).digest('hex');
const wrapperName='.private-demo-playback-'+randomUUID()+'.html';
const wrapperPath=resolve(root,wrapperName);
const encodedPath=relative(root,videoFile).split(sep).map(encodeURIComponent).join('/');
const html=`<!doctype html><html><meta charset="utf-8"><title>Private demo playback receiving</title><style>html,body{margin:0;background:#000}video{display:block;width:100vw;height:100vh;object-fit:contain}</style><video id="demo" preload="auto" muted playsinline></video><script>
window.mediaEvents=[];window.setupError=null;window.downloadReceipt=null;
const video=document.getElementById('demo');
for(const name of ['loadedmetadata','loadeddata','canplay','playing','pause','seeking','seeked','ended','error','stalled','waiting','progress','suspend'])video.addEventListener(name,()=>mediaEvents.push({event:name,time:video.currentTime,ready:video.readyState,error:video.error?{code:video.error.code,message:video.error.message}:null}));
(async()=>{
 const path=${JSON.stringify(encodedPath)};
 if(${JSON.stringify(playbackMode)}==='http'){video.src=path;return;}
 const response=await fetch(path);if(!response.ok)throw Error('Artifact download HTTP '+response.status);
 const bytes=await response.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(digest!==${JSON.stringify(sha256)})throw Error('Downloaded artifact SHA256 differs from the local original');
 window.downloadReceipt={url:response.url,httpStatus:response.status,bytes:bytes.byteLength,sha256:digest};
 const blobUrl=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));video.src=blobUrl;
 window.addEventListener('pagehide',()=>URL.revokeObjectURL(blobUrl),{once:true});
})().catch(error=>{window.setupError=String(error)});
</script></html>`;
await writeFile(wrapperPath,html,{flag:'wx'});
let result;
try {
  result=await withBrowserSession({root,chromeBin:process.env.CHROME_BIN??'/opt/google/chrome/chrome',runDirectory},async session=>{
    const {send,evaluate}=session;
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:expected.width,height:expected.height,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:session.baseUrl+wrapperName});
    const diagnosticExpression=`(()=>{const v=document.querySelector('#demo');const ranges=value=>Array.from({length:value.length},(_,i)=>[value.start(i),value.end(i)]);return {setupError:window.setupError??null,download:window.downloadReceipt??null,video:v?{currentTime:v.currentTime,seeking:v.seeking,paused:v.paused,ended:v.ended,readyState:v.readyState,networkState:v.networkState,duration:Number.isFinite(v.duration)?v.duration:null,currentSrc:v.currentSrc,buffered:ranges(v.buffered),seekable:ranges(v.seekable),error:v.error?{code:v.error.code,message:v.error.message}:null}:null,mediaEvents:(window.mediaEvents??[]).slice(-30)}})()`;
    async function waitFor(expression,label,timeout=20000) {
      const end=Date.now()+timeout;
      let lastState=null;
      while(Date.now()<end) {
        session.signal.throwIfAborted();
        try {
          lastState=await evaluate(diagnosticExpression);
          assert.equal(lastState.setupError,null,'Playback setup failed: '+JSON.stringify(lastState));
          assert.equal(lastState.video?.error??null,null,'Media load or decode error: '+JSON.stringify(lastState));
          if(await evaluate(expression))return;
        }catch(error) { if(!/Execution context was destroyed|Cannot find context|Cannot find default execution context/i.test(String(error)))throw error; }
        await delay(100);
      }
      await writeFile(resolve(session.runDirectory,'playback-failure.json'),JSON.stringify({label,playbackMode,sha256,lastState},null,2));
      throw Error('Timed out: '+label+'; media state: '+JSON.stringify(lastState));
    }
    await waitFor(`document.querySelector('#demo') instanceof HTMLVideoElement && document.querySelector('#demo').readyState>=2 && Number.isFinite(document.querySelector('#demo').duration)`,'actual video metadata and first decoded frame');
    const metadata=await evaluate(`(()=>{const v=document.querySelector('#demo');return {width:v.videoWidth,height:v.videoHeight,duration:v.duration,currentSrc:v.currentSrc,readyState:v.readyState}})()`);
    assert.equal(metadata.width,expected.width);assert.equal(metadata.height,expected.height);
    assert.ok(Math.abs(metadata.duration-expected.duration)<=expected.tolerance,JSON.stringify({metadata,expected}));
    const downloadReceipt=await evaluate('window.downloadReceipt');
    if(playbackMode==='http')assert.equal(metadata.currentSrc,new URL(encodedPath,session.baseUrl).href);
    else {
      assert.ok(metadata.currentSrc.startsWith('blob:'+new URL(session.baseUrl).origin+'/'));
      assert.equal(downloadReceipt.sha256,sha256);
      assert.equal(downloadReceipt.url,new URL(encodedPath,session.baseUrl).href);
      assert.ok(downloadReceipt.bytes>0);
    }
    await evaluate(`document.querySelector('#demo').play()`);
    const started=await evaluate(`document.querySelector('#demo').currentTime`);
    await waitFor(`!document.querySelector('#demo').paused && document.querySelector('#demo').currentTime>${started+0.5}`,'real playback progression',10000);
    const advanced=await evaluate(`document.querySelector('#demo').currentTime`);
    await evaluate(`document.querySelector('#demo').pause()`);
    const captures=[];
    const samples=stages.map((stage,index)=>{
      assert.ok(stage.atSeconds<metadata.duration,'Stage must lie inside decoded video');
      const next=stages[index+1]?.atSeconds??metadata.duration;
      const at=Math.min(stage.atSeconds+Math.min(1,(next-stage.atSeconds)/2),metadata.duration-0.02);
      return {...stage,at};
    });
    assert.ok(metadata.duration>0.08,'Final decode sample requires at least 0.08 seconds');
    samples.push({id:'final-cutoff',label:'Decoded video tail, 0.08 seconds before the authoritative cutoff',at:metadata.duration-0.08});
    for(const [index,stage] of samples.entries()) {
      const at=stage.at;
      await evaluate(`(()=>{const v=document.querySelector('#demo');v.currentTime=${at};})()`);
      await waitFor(`(()=>{const v=document.querySelector('#demo');return !v.seeking && v.readyState>=2 && Math.abs(v.currentTime-${at})<0.15})()`,'stage seek '+index);
      // Two animation frames allow the decoded frame to reach the compositor.
      await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const observed=await evaluate(`(()=>{const v=document.querySelector('#demo');return {time:v.currentTime,readyState:v.readyState,seeking:v.seeking,quality:v.getVideoPlaybackQuality?{total:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames}:null}})()`);
      const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const path=resolve(session.runDirectory,'stage-'+String(index+1).padStart(2,'0')+'.png');
      await writeFile(path,Buffer.from(screenshot.data,'base64'));
      captures.push({id:stage.id??String(index),label:stage.label??'',requested:at,...observed,path});
    }
    let fullPlayback=null;
    if(fullPlaybackRequested) {
      await evaluate(`(()=>{const v=document.querySelector('#demo');v.pause();v.playbackRate=1;v.currentTime=0;})()`);
      await waitFor(`(()=>{const v=document.querySelector('#demo');return !v.seeking && v.readyState>=2 && v.currentTime<0.05 && v.playbackRate===1})()`,'full playback reset to beginning');
      const qualityExpression=`(()=>{const v=document.querySelector('#demo');const q=v.getVideoPlaybackQuality?.();return q?{total:q.totalVideoFrames,dropped:q.droppedVideoFrames,corrupted:q.corruptedVideoFrames??null}:null})()`;
      const qualityBefore=await evaluate(qualityExpression);
      const startedAt=new Date().toISOString(),startedMonotonic=performance.now();
      await evaluate(`document.querySelector('#demo').play()`);
      await waitFor(`document.querySelector('#demo').ended`,'complete normal-speed decoder playback',Math.ceil((metadata.duration+15)*1000));
      const completedAt=new Date().toISOString(),elapsedSeconds=(performance.now()-startedMonotonic)/1000;
      const state=await evaluate(`(()=>{const v=document.querySelector('#demo');return {time:v.currentTime,duration:v.duration,ended:v.ended,playbackRate:v.playbackRate,played:Array.from({length:v.played.length},(_,i)=>[v.played.start(i),v.played.end(i)])}})()`);
      assert.equal(state.ended,true);assert.equal(state.playbackRate,1);
      assert.ok(Math.abs(state.time-metadata.duration)<0.05,'Completion must reach the decoded media end');
      assert.ok(elapsedSeconds>=metadata.duration-0.5,'Normal-speed completion cannot skip the recorded duration');
      fullPlayback={startedAt,completedAt,elapsedSeconds,...state,qualityBefore,qualityAfter:await evaluate(qualityExpression),
        qualification:'Complete decoder playback at normal speed; no human motion-quality assessment or dropped-frame threshold inferred'};
    }
    const mediaEvents=await evaluate('window.mediaEvents');
    assert.equal(mediaEvents.some(event=>event.event==='error'),false);
    assert.deepEqual(session.exceptions,[]);
    const receipt={status:'BROWSER_PLAYBACK_VERIFIED_VISUAL_REVIEW_PENDING',playbackMode,downloadReceipt,sha256,videoFile,metadata,expected,
      progression:{started,advanced},captures,fullPlaybackRequested,fullPlayback,mediaEvents,sandbox:session.sandbox,sandboxPath:session.sandboxPath,
      limits:[playbackMode==='downloaded-blob'?'Checks decoding and seeking of the complete SHA256-verified downloaded artifact; does not qualify HTTP Range streaming':'Checks HTTP-backed media decoding and seeks through this test server','Screenshots require separate human visual assessment','Does not establish public accessibility, submission or physical validity']};
    await writeFile(resolve(session.runDirectory,'playback-receipt.json'),JSON.stringify(receipt,null,2));
    return receipt;
  });
}finally { await unlink(wrapperPath); }
console.log(JSON.stringify({...result.value,session:result.receipt},null,2));

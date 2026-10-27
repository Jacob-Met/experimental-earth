// Private recording sketch, not a qualification or publication script.
// Requires the complete exact-source checkout and maintained Linux browser owner.
// Saves original JPEG frames + timed ffconcat manifest; does not invoke ffmpeg.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { withBrowserSession } from './support/browser-session.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runDirectory = process.env.BROWSER_RUN_DIRECTORY ?? root + '.browser-recording-' + randomUUID();
const source = {};
for (const name of ['index.html','app.js','core.js','tests/rain-journey.recording.mjs','tests/rain-demo-course.mjs'])
  source[name] = createHash('sha256').update(await readFile(root + name)).digest('hex');

async function recordOwnedPage(session, directory) {
  await mkdir(directory, { recursive: false });
  const pages = await (await fetch(session.cdpUrl + '/json', { signal: session.signal })).json();
  const page = pages.find(item => item.type === 'page' && item.url === session.baseUrl);
  assert.ok(page, 'Record only the original admitted product tab');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(), frames = [];
  let sequence = 0, failure = null, writes = Promise.resolve();
  const started = performance.now();
  function rejectPending(error) { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); }
  const abort = () => { failure ??= Error('Browser owner aborted'); rejectPending(failure); ws.close(); };
  session.signal.addEventListener('abort', abort, { once: true });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Recorder connection timed out')),10000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onclose = ws.onerror = () => { clearTimeout(timer); reject(Error('Recorder connection failed')); };
    });
  } catch (error) { session.signal.removeEventListener('abort',abort); ws.close(); throw error; }
  ws.onclose = ws.onerror = () => { failure ??= Error('Recorder connection lost'); rejectPending(failure); };
  const send = (method, params = {}) => new Promise((resolve,reject) => {
    if (session.signal.aborted || ws.readyState !== WebSocket.OPEN) return reject(Error('Recorder disconnected'));
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(Error('Recorder command timed out: '+method)); },10000);
    pending.set(id,{resolve,reject,timer});
    try { ws.send(JSON.stringify({id,method,params})); }
    catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
  });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.screencastFrame') {
      const frame = { file: 'frame-' + String(frames.length).padStart(6,'0') + '.jpg',
        receivedSeconds: (performance.now()-started)/1000, metadata: message.params.metadata };
      frames.push(frame);
      const bytes = Buffer.from(message.params.data,'base64');
      writes = writes.then(() => writeFile(directory+'/'+frame.file,bytes)).catch(error => { failure ??= error; });
      send('Page.screencastFrameAck',{sessionId:message.params.sessionId}).catch(error => { failure ??= error; });
    }
    const p = pending.get(message.id);
    if (p) { pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(Error(message.error.message)):p.resolve(message.result); }
  };
  try {
    await send('Page.enable');
    await send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1280,maxHeight:900,everyNthFrame:1});
  } catch(error) { session.signal.removeEventListener('abort',abort);rejectPending(error);ws.close();throw error; }
  return { seconds: () => (performance.now()-started)/1000, async stop() {
    try {
      await send('Page.stopScreencast');
      const stoppedSeconds = (performance.now()-started)/1000;
      await writes;
      if (failure) throw failure;
      assert.ok(frames.length > 0,'A recording needs actual browser frames');
      const lines = ['ffconcat version 1.0'];
      frames.forEach((frame,index) => {
        lines.push("file '"+frame.file+"'", 'duration '+Math.max(0.001,(frames[index+1]?.receivedSeconds??stoppedSeconds)-frame.receivedSeconds).toFixed(6));
      });
      lines.push("file '"+frames.at(-1).file+"'");
      await writeFile(directory+'/frames.ffconcat',lines.join('\n')+'\n');
      await writeFile(directory+'/frames.json',JSON.stringify({frames,stoppedSeconds,clock:'Node monotonic receipt time; original CDP frame metadata retained'},null,2));
      return { frameCount:frames.length, firstFrameSeconds:frames[0].receivedSeconds,
        durationSeconds:stoppedSeconds-frames[0].receivedSeconds, directory };
    } finally { session.signal.removeEventListener('abort',abort);rejectPending(Error('Recorder closed'));ws.close(); }
  } };
}

const {runCourtyardDemo}=await import('./rain-demo-course.mjs');
await runCourtyardDemo({root,runDirectory,source,withBrowserSession,recordOwnedPage});

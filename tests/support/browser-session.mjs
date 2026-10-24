import { createServer } from 'node:http';
import { withChromiumSession } from './chromium-session.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { requireChromiumSandbox } from './chromium-sandbox.mjs';
import { resolve, sep, extname } from 'node:path';

const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png' };

export async function serveDirectory(directory) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + (name === '/' ? '/index.html' : name));
      if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const data = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control':'no-store' });
      response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((yes,no) => { server.once('error',no); server.listen(0,'127.0.0.1',yes); });
  return { baseUrl:`http://127.0.0.1:${server.address().port}/`, close:() => new Promise(yes => { server.close(yes); server.closeAllConnections(); }) };
}

/** Compose the maintained HAMON process owner with this product's HTTP/CDP course. */
export async function withBrowserSession({root, chromeBin, runDirectory, commandMs=10000}, run) {
  if(!Number.isSafeInteger(commandMs) || commandMs<1 || commandMs>120000)throw new TypeError('commandMs must be an integer from 1 to 120000');
  const web=await serveDirectory(root);
  try {
    return await withChromiumSession({executable:chromeBin,runDirectory}, async owner => {
      const {signal}=owner;
      const tabs=await (await fetch(owner.cdpUrl+'/json',{signal})).json();
      const target=tabs.find(t=>t.type==='page');
      if(!target)throw Error('Owned browser has no page');
      const ws=new WebSocket(target.webSocketDebuggerUrl);
      const pending=new Map(), exceptions=[];
      let serial=0;
      function rejectPending(error) {
        for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}
        pending.clear();
      }
      const abort=()=>{rejectPending(signal.reason);ws.close();};
      signal.addEventListener('abort',abort,{once:true});
      try {
        signal.throwIfAborted();
        await new Promise((yes,no)=>{
          const timer=setTimeout(()=>no(Error('CDP connection timed out')),commandMs);
          ws.onopen=()=>{clearTimeout(timer);yes();};
          ws.onerror=()=>{clearTimeout(timer);no(Error('CDP connection failed'));};
          ws.onclose=()=>{clearTimeout(timer);no(Error('CDP connection closed'));};
        });
        ws.onclose=()=>rejectPending(Error('CDP connection closed'));
        ws.onerror=()=>rejectPending(Error('CDP connection failed'));
        ws.onmessage=event=>{
          const msg=JSON.parse(event.data);
          if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.text);
          const p=pending.get(msg.id);
          if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
        };
        function send(method,params={}) {
          return new Promise((yes,no)=>{
            if(signal.aborted || ws.readyState!==WebSocket.OPEN){no(Error('CDP is not connected'));return;}
            const id=++serial;
            const timer=setTimeout(()=>{pending.delete(id);no(Error('CDP command timed out: '+method));},commandMs);
            pending.set(id,{resolve:yes,reject:no,timer});
            try{ws.send(JSON.stringify({id,method,params}));}catch(e){pending.delete(id);clearTimeout(timer);no(e);}
          });
        }
        async function evaluate(expression) {
          const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
          if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
          return result.result.value;
        }
        const sandboxPath=resolve(owner.runDirectory,'sandbox.json');
        let sandbox;
        try {
          sandbox=await requireChromiumSandbox({send,signal});
        } catch(error) {
          if(error.receipt)await writeFile(sandboxPath,JSON.stringify(error.receipt,null,2)+'\n',{flag:'wx',mode:0o600});
          throw error;
        }
        await writeFile(sandboxPath,JSON.stringify(sandbox,null,2)+'\n',{flag:'wx',mode:0o600});
        await send('Page.navigate',{url:web.baseUrl});
        return await run({...owner,baseUrl:web.baseUrl,send,evaluate,exceptions,sandbox,sandboxPath});
      } finally {
        signal.removeEventListener('abort',abort);
        rejectPending(Error('Browser session closed'));ws.close();
      }
    });
  } finally { await web.close(); }
}

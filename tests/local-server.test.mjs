import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {request} from 'node:http';
import {mkdtemp, readdir, readFile, symlink, unlink, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
function get(port, path, {method='GET', headers={}}={}) {
  return new Promise((resolveResult,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers},res=>{
      const chunks=[];
      res.on('data',b=>chunks.push(b));
      res.on('end',()=>resolveResult({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
      res.on('error',reject);
    });
    req.on('error',reject); req.end();
  });
}
function launch() {
  return new Promise((resolvePort,reject)=>{
    const child=spawn('python3',['serve.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
    let output='';
    const timer=setTimeout(()=>{cleanup();reject(Error('workbench server did not announce loopback port'))},15000);
    function cleanup(){clearTimeout(timer);child.stdout.off('data',onData);child.off('exit',onExit)}
    function onExit(code){cleanup();reject(Error(`server exited before ready: ${code}, ${output}`))}
    function onData(buf){output+=buf.toString();const m=output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);if(m){cleanup();resolvePort({port:Number(m[1]),child})}}
    child.on('exit',onExit);child.stdout.on('data',onData);
  });
}

test('real local workbench serves exact browser bytes but not checkout internals', {timeout:90000}, async()=>{
  const {port,child}=await launch();
  const dir=await mkdtemp(join(tmpdir(),'earth-server-fixture-'));
  const outside=join(dir,'synthetic-private.txt');
  const link=join(root,'server-synthetic-private.js');
  try {
    await writeFile(outside,'fixture-private-bytes-only');
    await symlink(outside,link);
    const sourceFiles=(await readdir(root)).filter(name=>name!=='server-synthetic-private.js'&&/\.(?:html|js|css)$/.test(name));
    assert.ok(sourceFiles.length>300, 'complete maintained browser module set');
    for(const name of sourceFiles){
      const response=await get(port,`/${name}`);
      assert.equal(response.status,200,`/${name}`);
      assert.deepEqual(response.body,await readFile(join(root,name)),`/${name}`);
      assert.match(response.headers['content-type'],name.endsWith('.js')?/javascript/:name.endsWith('.css')?/css/:/html/);
      assert.equal(response.headers['x-content-type-options'],'nosniff');
    }
    const nestedBrowserFiles=[
      'vendor/chronos/exact-halfplanes.mjs', 'vendor/suncalc/index.js',
      'research/usda-er2-rate-comparison.json',
      'examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt',
      'docs/SOIL_BAND_FEASIBILITY.md', 'docs/SOIL_PARAMETER_REFINEMENT.md',
    ];
    for(const name of nestedBrowserFiles){
      const response=await get(port,`/${name}`);
      assert.equal(response.status,200,`/${name}`);
      assert.deepEqual(response.body,await readFile(join(root,name)),`/${name}`);
    }
    const home=await get(port,'/');
    assert.equal(home.status,200);
    assert.deepEqual(home.body,await readFile(join(root,'index.html')));
    const head=await get(port,'/app.js?refresh=1',{method:'HEAD'});
    assert.equal(head.status,200);assert.equal(head.body.length,0);
    assert.equal(Number(head.headers['content-length']),(await readFile(join(root,'app.js'))).length);
    for(const path of ['/README.md','/package.json','/serve.py','/.git/config','/tests/local-server.test.mjs',
                        '/docs/demos/courtyard-2026-10-27/README.md','/server-synthetic-private.js',
                        '/vendor/suncalc/LICENSE','/vendor/chronos/PROVENANCE.md',
                        '/research/usda-er2-original-pair.json','/examples/joint-two-storms.json',
                        '/..%2fREADME.md','/%2e%2egit/config','/missing.js']){
      assert.equal((await get(port,path)).status,404,`private/refused ${path}`);
    }
    for(const [path,options,code] of [
      ['/app.js',{headers:{Host:`untrusted.example:${port}`}},403],
      ['/app.js',{headers:{Origin:'http://untrusted.example'}},403],
      ['/app.js',{headers:{Origin:'null'}},403],
      ['/app.js',{headers:{Origin:`http://localhost:${port}`}},200],
      ['/app.js',{method:'POST'},405],
      ['/app.js',{method:'OPTIONS'},405],
    ]) assert.equal((await get(port,path,options)).status,code,`${path}: ${JSON.stringify(options)}`);
    assert.equal((await get(port,'/app.js',{headers:{Host:`localhost:${port}`}})).status,200);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise(ok=>child.once('exit',ok)),new Promise(ok=>setTimeout(ok,3000))]);
    await unlink(link).catch(()=>{});
    await rm(dir,{recursive:true,force:true});
  }
});

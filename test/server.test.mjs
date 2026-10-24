import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRainLabServer } from '../tools/serve.mjs';

test('local server delivers executable ES modules with strict MIME and no unrelated files', async () => {
  const server = createRainLabServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [path, mime] of [
      ['/', 'text/html'], ['/styles.css', 'text/css'],
      ['/src/app.mjs', 'text/javascript'], ['/src/water.mjs', 'text/javascript'],
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, `${path} reachable`);
      assert.ok(response.headers.get('content-type').startsWith(mime), `${path} has ${mime} MIME`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok((await response.text()).length > 20);
    }
    const head = await fetch(base + '/src/water.mjs', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    for (const path of ['/package.json', '/README.md', '/test/water.test.mjs', '/.git/config', '/%2e%2e/README.md']) {
      assert.equal((await fetch(base + path)).status, 404, `${path} remains inaccessible`);
    }
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
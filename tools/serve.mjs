import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Narrow asset list: never expose other source, imports, VCS or private files.
const ASSETS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/src/app.mjs', ['src/app.mjs', 'text/javascript; charset=utf-8']],
  ['/src/water.mjs', ['src/water.mjs', 'text/javascript; charset=utf-8']],
]);
export function createRainLabServer() {
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; }
    catch { res.writeHead(400).end(); return; }
    const asset = ASSETS.get(pathname);
    if (!asset) { res.writeHead(404).end(); return; }
    const [name, mime] = asset;
    try {
      const data = await readFile(join(ROOT, name));
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8060);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer 1–65535');
  createRainLabServer().listen(port, '127.0.0.1', () =>
    console.log(`Rain Lab (local only): http://127.0.0.1:${port}/`));
}
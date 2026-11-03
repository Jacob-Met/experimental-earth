import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outfile = join(root, 'app.bundle.js');
const check = process.argv.includes('--check');
if (process.argv.some(arg => arg.startsWith('--') && arg !== '--check')) {
  throw Error('Only --check is supported.');
}
const built = await build({
  absWorkingDir: root,
  entryPoints: [join(root, 'app.js')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  write: false,
  logLevel: 'error',
});
if (built.outputFiles?.length !== 1) throw Error('Expected exactly one browser bundle.');
const bytes = built.outputFiles[0].contents;
if (check) {
  const existing = await readFile(outfile);
  if (!existing.equals(bytes)) throw Error('Bundled preview is stale; run npm run build:preview.');
  console.log('Preview bundle is byte-for-byte current.');
} else {
  await writeFile(outfile, bytes);
  console.log('Wrote reproducible experimental preview:', bytes.length, 'bytes.');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const file = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

test('experimental ESM entry preserves ordinary HTML except explicit module selection', () => {
  const ordinary = file('../index.html');
  const experimental = file('../index-bundled.html');
  assert.equal((ordinary.match(/src="\.\/app\.js"/g) ?? []).length, 1);
  assert.equal(experimental.trimEnd(), ordinary.replace('src="./app.js"', 'src="./app.bundle.js"').trimEnd());
});

test('bundled experimental entry retains worker, navigation CSS, and module-relative URLs', () => {
  const bundle = file('../app.bundle.js');
  assert.ok(bundle.length > 100000);
  assert.match(bundle, /rain-comparison-worker\.js/);
  assert.match(bundle, /investigation-navigation\.css/);
  assert.match(bundle, /import\.meta\.url/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The documented local workbench must not expose its source tree on the LAN.
test('the npm and documented Python launchers bind explicitly to IPv4 loopback', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const launcher = 'python3 -m http.server 8765 --bind 127.0.0.1';
  assert.equal(packageJson.scripts.serve, launcher);
  assert.ok(readme.includes(`Run \`${launcher}\``), 'README must describe the protected launcher');
  assert.ok(readme.includes('http://127.0.0.1:8765/'), 'README must provide a URL matching the bound family');
});

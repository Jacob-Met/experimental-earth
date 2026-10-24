# Browser receiving runtime

`chromium-session.mjs` is an exact vendored snapshot of HAMON's maintained
`tools/browser_receiving/chromium-session.mjs`, supplied from the #1511 lineage.
SHA-256: `c38f888fadff89877cebc9f05bb57c12153c12bf419e2b6d660cc425945927ff`.
Keep process lifecycle changes in HAMON and refresh this snapshot deliberately.
Its contract and limitations remain unchanged: Linux / Node 22+, installed
Chromium, one exclusive run directory, ephemeral loopback CDP, direct-child
cleanup, retained profiles/logs/receipts, no assertion of active sandbox status by that process-owner receipt alone.

`chromium-sandbox.mjs` is an exact snapshot of HAMON’s maintained same-browser
admission helper (#1490 lineage). SHA-256:
`4607c67b360596ee06b36e41a6b5d3a8a6da70defb04292d955f609dcef05ead`.
The product adapter persists its separate
`sandbox.json` success or refusal receipt and requires admission before product
navigation or assertions.

`browser-session.mjs` composes that owner with this product's HTTP and CDP
consumer. HTTP binds port zero; each course gets a new origin and browser
profile. CDP commands have a ten-second default timeout and cooperate with the
owner's abort signal. The HTTP server and WebSocket close in finally; no global
process lookup or kill is used. This is a trusted local test workspace, not a
server intended for public use.

Run `CHROME_BIN=/opt/google/chrome/chrome node tests/browser-session.receiving.mjs`
using the actual installed binary (verify the path; wrappers can change launch flags),
for actual concurrent-session, command-timeout and failure-cleanup controls.
Run two `npm run browser-receive` processes simultaneously to qualify the full
product journey independently. Default run directories are unique
`.browser-run-<uuid>` children of the project; set `BROWSER_RUN_DIRECTORY` to an
absolute, nonexistent directory to choose retention placement. Screenshots are
saved inside that run directory, or at explicit `BROWSER_SCREENSHOT`. Do not
commit retained profiles, logs or screenshots. A receipt is execution evidence;
physical field accuracy remains separate. Active sandbox admission is recorded in
`sandbox.json`; the process owner’s `sandbox: not-assessed` field remains unchanged.

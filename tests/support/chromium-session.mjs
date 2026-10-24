/** Own one Linux Chromium process for a bounded receiving course.
 * This module does not establish browser sandbox status or product correctness.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, open, realpath, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const SCHEMA = 'hamon.chromium-session.v1';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export class ChromiumSessionError extends Error {
  constructor(message, receipt, cause) {
    super(message, { cause });
    this.name = 'ChromiumSessionError';
    this.receipt = receipt;
  }
}

function milliseconds(value, fallback, label) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > 3_600_000)
    throw new TypeError(`${label} must be an integer from 1 to 3600000`);
  return result;
}

async function digest(file) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest('hex') };
}

async function endpoint(profile, timeoutMs) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  let text;
  try {
    const file = await open(portFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > 4096) throw new Error('invalid DevToolsActivePort file');
      text = (await file.readFile()).toString('utf8');
    } finally { await file.close(); }
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  // Chromium's complete file need not end in a newline.
  if (!text.includes('\n')) return null;
  const match = /^([1-9][0-9]{0,4})\n(\/devtools\/browser\/[A-Za-z0-9-]+)\n?$/.exec(text);
  if (!match || Number(match[1]) > 65535) throw new Error('invalid DevToolsActivePort contents');
  const cdpUrl = `http://127.0.0.1:${match[1]}`;
  let response;
  try {
    response = await fetch(`${cdpUrl}/json/version`, {
      signal: AbortSignal.timeout(Math.max(1, Math.min(500, timeoutMs))), redirect: 'error',
    });
  } catch { return null; }
  if (!response.ok) throw new Error('DevTools version endpoint refused');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 65536) throw new Error('DevTools version response exceeds 64 KiB');
    chunks.push(chunk);
  }
  const version = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const expected = `ws://127.0.0.1:${match[1]}${match[2]}`;
  if (version.webSocketDebuggerUrl !== expected || typeof version.Browser !== 'string')
    throw new Error('DevTools browser identity differs from owned profile endpoint');
  return { cdpUrl, browserWebSocketUrl: expected, browserVersion: version.Browser };
}

/**
 * Run an existing course with a fresh owned browser, then stop that direct child.
 * `run` must use the supplied AbortSignal and stop its own servers/connections.
 * Profiles/logs are retained, including on failure; no directory is removed.
 */
export async function withChromiumSession(options, run) {
  if (!options || typeof options !== 'object' || typeof run !== 'function')
    throw new TypeError('options and a course callback are required');
  if (process.platform !== 'linux') throw new Error('only Linux receiving is qualified');
  const { executable, runDirectory, signal } = options;
  if (typeof executable !== 'string' || !path.isAbsolute(executable) ||
      typeof runDirectory !== 'string' || !path.isAbsolute(runDirectory))
    throw new TypeError('executable and runDirectory must be absolute paths');
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new TypeError('signal must be an AbortSignal');
  const startupMs = milliseconds(options.startupTimeoutMs, 15000, 'startupTimeoutMs');
  const shutdownMs = milliseconds(options.shutdownTimeoutMs, 3000, 'shutdownTimeoutMs');
  const courseMs = milliseconds(options.courseTimeoutMs, 120000, 'courseTimeoutMs');
  signal?.throwIfAborted();
  const resolvedExecutable = await realpath(executable);
  if (!(await stat(resolvedExecutable)).isFile()) throw new Error('executable is not a regular file');
  await access(resolvedExecutable, constants.X_OK);
  const root = path.resolve(runDirectory);
  // mkdir without recursive is the no-overwrite admission for the complete run.
  await mkdir(root, { mode: 0o700 });
  const profile = path.join(root, 'profile');
  const stdoutFile = path.join(root, 'stdout.bin');
  const stderrFile = path.join(root, 'stderr.bin');
  const receiptFile = path.join(root, 'session.json');
  const receipt = {
    schema: SCHEMA, status: 'starting', startedAt: new Date().toISOString(),
    executable: resolvedExecutable, runDirectory: root, profileDirectory: profile,
    stdoutFile, stderrFile, receiptFile, sandbox: 'not-assessed',
    limits: { startupMs, shutdownMs, courseMs },
    cleanup: { attempted: false, directChildExited: false, scope: 'launched-direct-child-only' },
  };
  let child, exit, close, spawnError, failure, value;
  let hasFailure = false;
  const recordFailure = reason => {
    if (!hasFailure) { failure = reason; hasFailure = true; }
  };
  let stdout, stderr, childDone;
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  try {
    await mkdir(profile, { mode: 0o700 });
    stdout = await open(stdoutFile, 'wx', 0o600);
    stderr = await open(stderrFile, 'wx', 0o600);
    controller.signal.throwIfAborted();
    const argv = [
      '--headless=new', '--enable-automation', '--allow-chrome-scheme-url',
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
      `--user-data-dir=${profile}`, 'about:blank',
    ];
    receipt.argv = argv;
    child = spawn(resolvedExecutable, argv, { stdio: ['ignore', stdout.fd, stderr.fd] });
    childDone = new Promise(resolve => {
      child.once('error', error => { spawnError = error; resolve(); });
      child.once('exit', (code, nativeSignal) => { exit = { code, signal: nativeSignal }; });
      child.once('close', (code, nativeSignal) => { close = { code, signal: nativeSignal }; resolve(); });
    });
    receipt.pid = child.pid ?? null;
    await writeFile(path.join(root, 'launch.json'), JSON.stringify(receipt, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 });
    await stdout.close(); stdout = null;
    await stderr.close(); stderr = null;
    const deadline = performance.now() + startupMs;
    let ready;
    while (!ready) {
      controller.signal.throwIfAborted();
      if (spawnError) throw spawnError;
      if (exit || close) throw new Error('browser exited before readiness');
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error('browser startup timed out');
      ready = await endpoint(profile, remaining);
      if (!ready) await delay(Math.min(25, remaining));
    }
    if (exit || close || controller.signal.aborted) throw new Error('browser stopped during readiness');
    Object.assign(receipt, ready, { status: 'running', readyAt: new Date().toISOString() });
    let courseTimer;
    let abortListener;
    try {
      const interrupted = new Promise((_, reject) => {
        abortListener = () => reject(controller.signal.reason ?? new Error('course aborted'));
        controller.signal.addEventListener('abort', abortListener, { once: true });
        if (controller.signal.aborted) abortListener();
        courseTimer = setTimeout(() => {
          controller.abort(new Error('browser course timed out'));
        }, courseMs);
      });
      value = await Promise.race([
        Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          return run(Object.freeze({ ...ready, profileDirectory: profile,
            runDirectory: root, signal: controller.signal }));
        }),
        interrupted,
        childDone.then(() => { throw new Error('browser exited during course'); }),
      ]);
      receipt.status = 'course-completed';
    } finally {
      clearTimeout(courseTimer);
      controller.signal.removeEventListener('abort', abortListener);
    }
  } catch (error) {
    recordFailure(error);
    receipt.status = 'failed';
    receipt.error = { name: error?.name ?? 'Error', message: String(error?.message ?? error) };
  } finally {
    controller.abort(new Error('browser session closing'));
    signal?.removeEventListener('abort', onAbort);
    await stdout?.close().catch(() => {});
    await stderr?.close().catch(() => {});
    if (child) {
      receipt.cleanup.attempted = true;
      receipt.cleanup.signals = [];
      for (const nativeSignal of ['SIGTERM', 'SIGKILL']) {
        if (close || spawnError) break;
        try {
          if (child.kill(nativeSignal)) receipt.cleanup.signals.push(nativeSignal);
        } catch (error) { receipt.cleanup.error = String(error.message); }
        await Promise.race([childDone, delay(shutdownMs)]);
      }
      receipt.cleanup.directChildExited = Boolean(close || spawnError);
      receipt.exit = close ?? exit ?? null;
      if (!receipt.cleanup.directChildExited) {
        receipt.status = 'cleanup-incomplete';
        recordFailure(new Error('owned browser cleanup was not confirmed'));
      }
    }
    // A direct child's exit does not independently establish descendant exit.
    receipt.logsComplete = !child || Boolean(close || spawnError);
    receipt.logScope = 'bytes observed after direct-child close; descendants are not independently inventoried';
    for (const [name, file] of [['stdout', stdoutFile], ['stderr', stderrFile]]) {
      try {
        receipt[name] = receipt.logsComplete
          ? { path: file, ...(await digest(file)) }
          : { path: file, bytes: null, sha256: null };
      }
      catch (error) {
        receipt.logsComplete = false;
        receipt[name] = { path: file, error: String(error.message) };
        recordFailure(error);
      }
    }
    receipt.finishedAt = new Date().toISOString();
    if (hasFailure && receipt.status === 'course-completed') receipt.status = 'failed';
    try { await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      recordFailure(error);
      receipt.status = 'failed';
      receipt.receiptWriteError = String(error.message);
    }
  }
  if (hasFailure) throw new ChromiumSessionError('Chromium receiving session failed', receipt, failure);
  return { value, receipt };
}

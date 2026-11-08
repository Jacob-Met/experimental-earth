#!/usr/bin/env node
/** Original-file adapter; scientific admission belongs to the consumer. */
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectReceivedRainfallReadout} from './rainfall-readout-receive.js';

const USAGE = 'Usage: node inspect-received-rainfall-readout.mjs original-proposal.json readout-plan.json declared-reading.json';
const ORIGINAL_LIMIT = 4 * 1024 * 1024;
const PLAN_QUERY_LIMIT = 4096;
const READING_LIMIT = 4096;
const identity = stat => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid'].map(key => String(stat[key])).join(':');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function readInput(filename, label, limit) {
  const path = resolve(filename);
  const named = await lstat(path, {bigint: true});
  if (!named.isFile() || named.size < 1n || named.size > BigInt(limit)) {
    throw Error(`${label} must be a nonempty regular file of at most ${limit} bytes; symlinks and devices are not admitted`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes, opened;
  try {
    opened = await handle.stat({bigint: true});
    if (!opened.isFile() || identity(named) !== identity(opened)) throw Error(label + ' changed before opening');
    const buffer = Buffer.alloc(Number(opened.size) + 1);
    let count = 0;
    while (count < buffer.length) {
      const {bytesRead} = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    const after = await handle.stat({bigint: true});
    if (count !== Number(opened.size) || identity(opened) !== identity(after)) throw Error(label + ' changed during reading');
    bytes = buffer.subarray(0, count);
  } finally {
    await handle.close();
  }
  if (identity(opened) !== identity(await lstat(path, {bigint: true}))) throw Error(label + ' changed during reading');
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || !Buffer.from(text, 'utf8').equals(bytes)) throw Error(label + ' requires exact UTF-8 without a BOM');
  return {path, text, bytes, identity: identity(opened), sha256: digest(bytes)};
}

export async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  if (args.length !== 3 || args.some(arg => !arg || arg.startsWith('--'))) throw Error(USAGE);
  if (!['linux', 'darwin'].includes(process.platform)) throw Error('Original-file admission currently supports Linux and macOS');
  const [original, plan, reading] = await Promise.all([
    readInput(args[0], 'Original proposal', ORIGINAL_LIMIT),
    readInput(args[1], 'Readout plan', PLAN_QUERY_LIMIT),
    readInput(args[2], 'Declared reading', READING_LIMIT),
  ]);
  const report = inspectReceivedRainfallReadout(original.text, plan.text, reading.text);
  const [originalAfter, planAfter, readingAfter] = await Promise.all([
    readInput(original.path, 'Original proposal', ORIGINAL_LIMIT),
    readInput(plan.path, 'Readout plan', PLAN_QUERY_LIMIT),
    readInput(reading.path, 'Declared reading', READING_LIMIT),
  ]);
  for (const [before, after, label] of [
    [original, originalAfter, 'Original proposal'],
    [plan, planAfter, 'Readout plan'],
    [reading, readingAfter, 'Declared reading'],
  ]) {
    if (after.identity !== before.identity || !after.bytes.equals(before.bytes)) throw Error(label + ' changed before result publication');
  }
  const output = {
    schema: 'experimental-earth-rainfall-readout-receive-cli/1',
    inputs: {
      originalProposal: {sha256: original.sha256, bytes: original.bytes.length},
      readoutPlan: {sha256: plan.sha256, bytes: plan.bytes.length},
      declaredReading: {sha256: reading.sha256, bytes: reading.bytes.length},
    },
    report,
  };
  // Complete admission, analysis and serialization before publishing result bytes.
  const text = JSON.stringify(output, null, 2) + '\n';
  process.stdout.write(text);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('RECEIVED RAINFALL READOUT REFUSAL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
/** Four-original-file adapter for an exact continuous-family shallow duration range. */
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectArchivedRainShallowDuration} from './archived-rain-shallow-duration.js';

const USAGE = 'Usage: node inspect-archived-rain-shallow-duration.mjs authored-timing.json first-archived-reading.json third-archived-reading.json shallow-peak-criterion.json';
const ORIGINAL_LIMIT = 16384;
const READING_LIMIT = 4096;
const CRITERION_LIMIT = 4096;
const OUTPUT_LIMIT = 4194304;
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
  if (args.length !== 4 || args.some(arg => !arg || arg.startsWith('--'))) throw Error(USAGE);
  if (!['linux', 'darwin'].includes(process.platform)) throw Error('Original-file admission currently supports Linux and macOS');
  const [original, firstReading, thirdReading, criterion] = await Promise.all([
    readInput(args[0], 'Original authored declaration', ORIGINAL_LIMIT),
    readInput(args[1], 'Declared first-quarter archived reading', READING_LIMIT),
    readInput(args[2], 'Declared third-quarter archived reading', READING_LIMIT),
    readInput(args[3], 'Declared shallow-depth peak criterion', CRITERION_LIMIT),
  ]);
  const report = inspectArchivedRainShallowDuration(original.text, firstReading.text, thirdReading.text, criterion.text);
  const output = {
    schema: 'experimental-earth-archived-rain-shallow-duration-cli/1',
    inputs: {
      originalDeclaration: {sha256: original.sha256, bytes: original.bytes.length},
      firstArchivedReading: {sha256: firstReading.sha256, bytes: firstReading.bytes.length},
      thirdArchivedReading: {sha256: thirdReading.sha256, bytes: thirdReading.bytes.length},
      peakCriterion: {sha256: criterion.sha256, bytes: criterion.bytes.length},
    },
    report,
  };
  // Serialize the complete bounded result before the final original-file guards.
  const text = JSON.stringify(output, null, 2) + '\n';
  if (Buffer.byteLength(text, 'utf8') > OUTPUT_LIMIT) throw Error('Archived rain shallow duration output exceeds its 4 MiB byte bound');
  const [originalAfter, firstReadingAfter, thirdReadingAfter, criterionAfter] = await Promise.all([
    readInput(original.path, 'Original authored declaration', ORIGINAL_LIMIT),
    readInput(firstReading.path, 'Declared first-quarter archived reading', READING_LIMIT),
    readInput(thirdReading.path, 'Declared third-quarter archived reading', READING_LIMIT),
    readInput(criterion.path, 'Declared shallow-depth peak criterion', CRITERION_LIMIT),
  ]);
  for (const [before, after, label] of [
    [original, originalAfter, 'Original authored declaration'],
    [firstReading, firstReadingAfter, 'Declared first-quarter archived reading'],
    [thirdReading, thirdReadingAfter, 'Declared third-quarter archived reading'],
    [criterion, criterionAfter, 'Declared shallow-depth peak criterion'],
  ]) {
    if (after.identity !== before.identity || !after.bytes.equals(before.bytes)) throw Error(label + ' changed before result publication');
  }
  process.stdout.write(text);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('ARCHIVED RAIN SHALLOW DURATION REFUSAL: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

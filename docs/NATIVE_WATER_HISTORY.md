# Export a saved project's complete water history in Node

Run from the repository with Node 22 on Linux:

```sh
node export-water-history.mjs tests/fixtures/water-history-tradeoff.json water-history-output
node export-water-history.mjs water-history-output/project.original.json water-history-reopened
```

The destination must not exist. The command reads the complete original project, uses the maintained project validator, computes one unchanged base-rain existing/proposed comparison, and invokes the same CSV serializer as the workbench download. No package installation is required.

## What you receive

- **project.original.json:** the exact supplied UTF-8 bytes, including original whitespace and all declarations.
- **water-history.csv:** every retained model minute, existing stored litres, proposed stored litres, and proposed-minus-existing litres. The first two columns retain the JSON spelling of the project title and the SHA-256 of the exact original input bytes.
- **receipt.json:** input and output sizes/hashes, the number of original snapshots, first/last minute, method, and scope.

See [the maintained CSV format](../WATER_HISTORY_CSV.md) for column definitions and literal title quoting. Numeric values and row order come from the original paired solver snapshots. There is no interpolation, resampling or pooling. A fractional final step remains a row, and a dry course retains all zero rows.

The saved original file is the authority when reopening. The CSV and receipt are outputs, never inputs to the calculation. Reopening the same original with the same source version produces the same three files byte for byte. Formatting the same project differently changes its byte digest while leaving the numeric course unchanged. The digest authenticates a byte identity; it is not evidence that the declarations were measured.

## Model scope

The command executes only the ordinary base-rain comparison. Optional investigation declarations are validated and preserved in the original project, but their analyses are not executed. Stored litres are whole-site conceptual model results, not local depth measurements, calibrated hydrology, flood-risk forecasts, or evidence of physical safety. This command does not open a browser.

## File handling

Input is a nonempty regular file of at most 4 MiB, with exact UTF-8 and no BOM. The final file component cannot be a symlink. File identity and bytes are checked while reading and again before creating the output directory. This is not protection against all ancestor symlinks or against another process changing the original after the final check.

The complete CSV is bounded to 2 MiB. Output uses a fresh private directory and exclusive files with readback and file fsync. Existing destinations are refused. A later I/O failure can leave a partial fresh directory; retain it for inspection and choose a new destination after correcting the cause. The directory is not an atomic transaction or a crash-durability guarantee.

## Focused verification

```sh
node --test --test-concurrency=1 tests/water-history-csv.test.mjs tests/export-water-history.test.mjs
```

The five maintained serializer groups cover exact numeric spelling, literal title quoting, all 721 retained rows, asynchronous source capture and refusal boundaries. The five new groups launch twelve actual CLI processes: five successful creation/reopen courses and seven expected refusals. They receive a committed tradeoff project, an independently calculated 2×2 no-flow fractional case, a complete 721-row dry course, byte-sensitive input formatting and existing/malformed/nonregular inputs. All three outputs from a fresh reopen must be byte-identical. This is a targeted native-file qualification, not a full-suite or browser qualification.

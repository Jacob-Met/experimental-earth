# Build a private runtime distribution

This builder reads an existing source directory and an independently obtained,
complete recursive Git tree response. It does not fetch, modify, or publish source.
Use an isolated source directory that is not being edited during packaging.

First verify the exact commit-to-tree association through the authorized source
service. The two required identifiers record that evidence; the builder does not
independently prove a commit's association with a tree. The tree's blob hashes and
sizes then verify every included source byte, without requiring checkout metadata.

```sh
python3 tools/runtime-release/build_runtime.py \
  --source /path/to/exact/source \
  --tree /path/to/verified-recursive-tree.json \
  --source-commit 3b7f6bff95515339f0198b1edc714edb5b013b00 \
  --source-tree fe548b77a3d400e5f6ee7fc624b4eca6c7afde76 \
  --version 2026.10.28-experimental.1 \
  --output /path/to/new/output
```

Keep DISTRIBUTION_README.md alongside the builder. Version names must contain only
letters, digits, dots, underscores, or hyphens, beginning with a letter or digit.
Outputs are exclusively created; never overwrite an already published archive.

Included guidance is the user README, product seed, and direct docs/*.md links
from that README, plus the launcher's explicit nested guides. Historical nested
documentation, contributor workflow, tests, and owner receipts are excluded.
Vendor notices and the NOAA example's attribution README/source receipt are
intentional provenance material. A README guide may refer to development evidence
outside this runtime distribution; it is not a complete source checkout.

The manifest separates unchanged source files from generated START_HERE.md.
Its own hash is covered by the archive checksum. Stable ZIP_STORED entries avoid
compressor-version differences. Identical source, metadata, template, and builder
inputs produce identical archive bytes; there are no timestamps from the machine.

After building, extract the archive elsewhere and exercise the actual launcher,
all HTML entry points, nested modules/data, and project export/reopen. Publish only
through the existing authorized private release route, then verify the downloaded
asset independently. Record actual platforms and browser journeys in release notes.

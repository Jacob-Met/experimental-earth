"""Decode the pinned author-supplied RDA; writes only an explicit output path.
Requires rdata==1.1.0 with its dependencies. No downloading or smoothing.
Usage: python extract-source.py /path/to/drainage.rda /path/to/drainage.csv
"""
import hashlib
import json
import sys
from pathlib import Path

import rdata

source, destination = map(Path, sys.argv[1:])
raw = source.read_bytes()
assert hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest() == "2f9c9d3ff923d27da08f911092ea67bfb4c8df3a"
objects = rdata.read_rda(source)
assert list(objects) == ["drainage"]
rows = objects["drainage"]
assert rows.shape == (2184, 2)
assert list(rows.columns) == ["time_sec", "q_mmh"]
assert set(rows.iloc[:, 0].diff().dropna().astype(float)) == {30.0}
rows.to_csv(destination, index=False)
print(json.dumps({"rows": len(rows), "csv_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "source_sha256": hashlib.sha256(raw).hexdigest()}))

#!/usr/bin/env python3
"""Package a verified source snapshot without Git or third-party dependencies.

The caller obtains --commit and --expected-tree from trusted commit metadata.
The complete source directory (including dotfiles, excluding only .git) must
reconstruct that Git tree. Output must be outside the source directory.
"""

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import tempfile
import zipfile


def git_hash(kind, data):
    return hashlib.sha1(kind.encode() + b" " + str(len(data)).encode() + b"\0" + data).hexdigest()


def safe_path(name):
    path = PurePosixPath(name)
    if (not name or "\\" in name or "\0" in name or path.is_absolute()
            or name != path.as_posix() or any(p in (".", "..") for p in path.parts)
            or any(p.startswith(".") for p in path.parts)):
        raise ValueError(f"Unsafe or hidden package path: {name!r}")
    return name


def read_source(root):
    """Read once; archive bytes are the exact bytes used for tree verification."""
    files = {}

    def walk(directory, prefix=""):
        entries = []
        for path in directory.iterdir():
            if not prefix and path.name == ".git":
                continue
            name = prefix + path.name
            info = path.lstat()
            encoded = os.fsencode(path.name)
            if stat.S_ISDIR(info.st_mode):
                oid = walk(path, name + "/")
                if oid is not None:  # Git does not record empty directories.
                    entries.append((encoded + b"/", b"40000", encoded, oid))
            elif stat.S_ISREG(info.st_mode):
                data = path.read_bytes()
                mode = "100755" if info.st_mode & 0o111 else "100644"
                oid = git_hash("blob", data)
                files[name] = {"data": data, "mode": mode, "git_blob": oid}
                entries.append((encoded, mode.encode(), encoded, oid))
            else:
                raise ValueError(f"Unsupported source entry (symlink/special file): {name}")
        if not entries and prefix:
            return None
        body = b"".join(mode + b" " + name + b"\0" + bytes.fromhex(oid)
                        for _, mode, name, oid in sorted(entries))
        return git_hash("tree", body)

    return walk(root), files


def served_assets(files):
    """Read the maintained allowlist as data, without importing serve.py."""
    parsed = ast.parse(files["serve.py"]["data"].decode("utf-8"))
    assignments = [node.value for node in parsed.body if isinstance(node, ast.Assign)
                   and any(isinstance(t, ast.Name) and t.id == "NESTED_BROWSER_ASSETS"
                           for t in node.targets)]
    if len(assignments) != 1:
        raise ValueError("Expected one NESTED_BROWSER_ASSETS assignment in serve.py")
    value = assignments[0]
    if (not isinstance(value, ast.Call) or not isinstance(value.func, ast.Name)
            or value.func.id != "frozenset" or len(value.args) != 1 or value.keywords):
        raise ValueError("Unsupported server allowlist syntax; review the server first")
    nested = ast.literal_eval(value.args[0])
    if not isinstance(nested, (set, list, tuple)) or not all(isinstance(p, str) for p in nested):
        raise ValueError("Server allowlist must contain literal paths")
    selected = {name for name in files if "/" not in name and not name.startswith(".")
                and PurePosixPath(name).suffix.lower() in (".html", ".js", ".css")}
    selected.update(safe_path(name) for name in nested)
    selected.add("serve.py")
    if "index.html" not in selected:
        raise ValueError("Missing browser entry point index.html")
    # Preserve source README and attribution notices without serving directories.
    for name in files:
        leaf = PurePosixPath(name).name.upper()
        if name == "README.md" or leaf in ("LICENSE", "LICENSE.MD", "LICENSE.TXT",
                                            "NOTICE", "NOTICE.MD", "NOTICE.TXT", "COPYING"):
            selected.add(safe_path(name))
    return selected


def launch_text(commit, tree):
    return f"""# Experimental Earth — local browser build

Requires Python 3.9 or newer and a modern browser with JavaScript module and
Web Worker support. This package needs no npm dependency installation.

1. Extract the complete ZIP archive.
2. Open a terminal in the extracted folder containing `serve.py`.
3. Run `python3 serve.py`.
4. Open http://127.0.0.1:8765/ in your browser.

Keep the terminal running while using the app. Press Ctrl+C there to stop it.
Use the HTTP address; do not open index.html directly. If the port is occupied,
run `python3 serve.py --port 0` and open the address printed by the server.
The server binds to this computer's loopback address and serves only its
maintained browser asset allowlist.

Source commit: `{commit}`
Verified source Git tree: `{tree}`

BUILD_MANIFEST.json records SHA-256 hashes for all other packaged files and
the Git blob identifiers for source files. The accompanying .sha256 file
records the ZIP checksum. Generated launch text and manifest are packaging
metadata, not files attributed to the source commit.

This manifest verifies source custody and packaged bytes. It does not assert
that browser launch, interaction, or performance tests passed. Consult the
release notes for actual platform checks and known limitations.
"""


def package(root, output, commit, expected_tree, includes):
    root, output = root.resolve(), output.resolve()
    if output == root or root in output.parents:
        raise ValueError("Output must be outside the verified source directory")
    for label, value in (("commit", commit), ("expected-tree", expected_tree)):
        if not re.fullmatch(r"[0-9a-f]{40}", value):
            raise ValueError(f"{label} must be a full lowercase SHA-1 identifier")
    actual_tree, source = read_source(root)
    if actual_tree != expected_tree:
        raise ValueError(f"Source tree mismatch: expected {expected_tree}, got {actual_tree}")
    selected = served_assets(source)
    selected.update(safe_path(name) for name in includes)
    reserved = {"LAUNCH.md", "BUILD_MANIFEST.json"}
    if selected & reserved:
        raise ValueError("Selected source conflicts with generated package filenames")
    missing = selected - source.keys()
    if missing:
        raise ValueError(f"Missing selected source files: {sorted(missing)}")
    payload = {name: source[name] for name in sorted(selected)}
    payload["LAUNCH.md"] = {"data": launch_text(commit, actual_tree).encode(), "mode": "100644"}
    manifest = {
        "schema_version": 1, "source_commit": commit, "source_git_tree": actual_tree,
        "source_file_count": len(source),
        "commit_tree_binding": "Supplied by caller from trusted commit metadata",
        "manifest_scope": "All ZIP entries except BUILD_MANIFEST.json itself",
        "files": [{"path": name, "bytes": len(item["data"]),
                   "sha256": hashlib.sha256(item["data"]).hexdigest(),
                   "git_mode": item["mode"], "origin": "source" if "git_blob" in item else "generated",
                   **({"git_blob": item["git_blob"]} if "git_blob" in item else {})}
                  for name, item in sorted(payload.items())],
    }
    payload["BUILD_MANIFEST.json"] = {
        "data": (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode(), "mode": "100644"}
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() or Path(str(output) + ".sha256").exists():
        raise ValueError("Output or checksum already exists; choose a fresh output name")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".zip", delete=False) as handle:
            temporary = Path(handle.name)
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, item in sorted(payload.items()):
                info = zipfile.ZipInfo(safe_path(name), date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.compress_type = zipfile.ZIP_DEFLATED
                mode = 0o100755 if item["mode"] == "100755" else 0o100644
                info.external_attr = mode << 16
                archive.writestr(info, item["data"])
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None or set(archive.namelist()) != set(payload):
                raise ValueError("Archive integrity verification failed")
            for name, item in payload.items():
                if archive.read(name) != item["data"]:
                    raise ValueError(f"Archive byte mismatch: {name}")
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        # Exclusive creation avoids silently replacing another artifact.
        with output.open("xb") as destination, temporary.open("rb") as source_zip:
            import shutil
            shutil.copyfileobj(source_zip, destination)
        with Path(str(output) + ".sha256").open("x") as checksum:
            checksum.write(f"{digest}  {output.name}\n")
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {"archive": str(output), "sha256": digest, "source_commit": commit,
            "source_git_tree": actual_tree, "packaged_files": len(payload)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--expected-tree", required=True)
    parser.add_argument("--include", action="append", default=[], help="Additional explicit tracked file")
    args = parser.parse_args()
    try:
        print(json.dumps(package(args.source, args.output, args.commit, args.expected_tree, args.include), indent=2))
    except (ValueError, OSError, KeyError, SyntaxError) as error:
        parser.exit(1, f"Packaging failed: {error}\n")


if __name__ == "__main__":
    main()

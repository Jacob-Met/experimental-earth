"""Receive the default browser archive through its own Python entry point."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "browser_packager", ROOT / "tools" / "package-browser-build.py"
)
PACKAGER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGER)


class BrowserPackageStartupTests(unittest.TestCase):
    def test_default_archive_launches_its_shipped_server(self):
        self.receive_archive("HEAD", expects_client=True)

    def test_pre_client_source_still_builds_and_launches(self):
        self.receive_archive(
            "792e3e7b5ea2ea659d286631e199bbf53ce7c593", expects_client=False
        )

    def receive_archive(self, ref, expects_client):
        commit = subprocess.check_output(
            ["git", "rev-parse", ref], cwd=ROOT, text=True
        ).strip()
        tree = subprocess.check_output(
            ["git", "rev-parse", commit + "^{tree}"], cwd=ROOT, text=True
        ).strip()
        archived = subprocess.check_output(["git", "archive", commit], cwd=ROOT)
        with tempfile.TemporaryDirectory(prefix="earth package receiving ") as temp:
            directory = Path(temp)
            source = directory / "source"
            source.mkdir()
            with tarfile.open(fileobj=io.BytesIO(archived)) as original:
                # Git archive is from this repository's exact committed tree.
                original.extractall(source)
            output = directory / "runtime.zip"
            PACKAGER.package(source, output, commit, tree, includes=[])
            extracted = directory / "extracted runtime"
            with zipfile.ZipFile(output) as runtime:
                runtime.extractall(extracted)
            manifest = json.loads((extracted / "BUILD_MANIFEST.json").read_text())
            self.assertEqual(
                "nebius_nemotron.py" in [row["path"] for row in manifest["files"]],
                expects_client,
            )
            # Ignore environment/user packages; imports must resolve from the
            # shipped directory. --help starts no listener or model request.
            result = subprocess.run(
                [sys.executable, "-E", "-s", "serve.py", "--help"],
                cwd=extracted, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("--port", result.stdout)


if __name__ == "__main__":
    unittest.main()

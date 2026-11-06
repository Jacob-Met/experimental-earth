"""Receive packaged Python launchers without requiring Git or repository history."""
import ast
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "browser_packager", ROOT / "tools" / "package-browser-build.py"
)
PACKAGER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGER)

# An authored no-client control, not a substitute for the retained receiving
# evidence from the original pre-client source commit.
NO_CLIENT_LAUNCHER = """import argparse
NESTED_BROWSER_ASSETS = frozenset([])
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.parse_args()
"""


class BrowserPackageStartupTests(unittest.TestCase):
    def test_current_launcher_starts_from_default_archive(self):
        self.receive_launcher((ROOT / "serve.py").read_text(), has_client=True)

    def test_launcher_without_client_needs_no_client_file(self):
        self.receive_launcher(NO_CLIENT_LAUNCHER, has_client=False)

    def receive_launcher(self, launcher, has_client):
        with tempfile.TemporaryDirectory(prefix="earth package receiving ") as temp:
            directory = Path(temp)
            source = directory / "source"
            source.mkdir()
            (source / "serve.py").write_text(launcher)
            (source / "index.html").write_text("<!doctype html><title>Startup fixture</title>")
            if has_client:
                shutil.copyfile(ROOT / "nebius_nemotron.py", source / "nebius_nemotron.py")
            # Copy the launcher's declared resources as source bytes. The test
            # concerns Python startup; it does not qualify browser interaction.
            for node in ast.parse(launcher).body:
                if isinstance(node, ast.Assign) and any(
                    isinstance(target, ast.Name) and target.id == "NESTED_BROWSER_ASSETS"
                    for target in node.targets
                ):
                    for name in ast.literal_eval(node.value.args[0]):
                        target = source / name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(ROOT / name, target)
            tree, _ = PACKAGER.read_source(source)
            output = directory / "runtime.zip"
            # Synthetic identity belongs only to this authored fixture.
            PACKAGER.package(source, output, "0" * 40, tree, includes=[])
            extracted = directory / "extracted runtime"
            with zipfile.ZipFile(output) as runtime:
                runtime.extractall(extracted)
            manifest = json.loads((extracted / "BUILD_MANIFEST.json").read_text())
            self.assertEqual(
                "nebius_nemotron.py" in [row["path"] for row in manifest["files"]],
                has_client,
            )
            # Ignore environment/user packages; resolve the client from the
            # shipped directory. --help starts no listener or model request.
            result = subprocess.run(
                [sys.executable, "-E", "-s", "serve.py", "--help"],
                cwd=extracted, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("--port", result.stdout)


if __name__ == "__main__":
    unittest.main()

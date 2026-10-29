# Experimental Earth — {{VERSION}}

Private experimental runtime distribution. Exact application source:
`{{SOURCE_SHA}}`. Preserve repository access restrictions when sharing this
archive. Included third-party notices and provenance retain their original terms.

## Start

You need **Python 3.9 or later** and a modern browser. No Node.js, npm install,
internet connection, or application build is needed to run this package.

Extract the complete archive. Open a terminal in its extracted directory and run:

```sh
python3 serve.py
```

On Windows with Python installed through the Python launcher, use `py -3 serve.py`.
Open the URL printed by the launcher (default **http://127.0.0.1:8765/**).
Keep the terminal open while using the workbench;
press Ctrl+C there to stop it. The unchanged maintained launcher binds only to
loopback and serves its explicit browser asset surface, not arbitrary documents.
Do not open index.html directly: browsers restrict JavaScript modules on file URLs.

If port 8765 is occupied, stop your previous workbench or explicitly use
`python3 serve.py --port 8766`. Each hostname/port is a different browser storage
location. Return to the same URL to recover the same browser-local workspace.
Use Export project ↗ before changing browser, hostname, or port, and Import project afterward.

## Use and retain your work

Edit the site and rainfall assumptions, compare the existing and proposed plans,
and inspect water accounting. Use Find an investigation to reach other questions.
Use Export project ↗ and Import project to save and reopen the working project. Individual
investigations may have their own download/reopen controls; follow their labels.

Read README.md and the included docs locally for model details and workflows.
Most documentation is intentionally outside the launcher's HTTP allowlist.
Some guide links refer to source or development material not included in this
runtime package. The NOAA example README is retained as attribution and source
context. Use the maintained `noaa-hourly.html` entry point with the included
`examples/noaa-tucson-hourly/tucson-hourly-excerpt.txt` literal excerpt; the README's
`project.json` preset and repository reproduction/build/test commands require the
full source checkout and are outside this runtime package.
Browser storage is local convenience, not a backup; keep exported projects safely.

This is a conceptual workbench, not an environmentally validated forecast, site
survey, engineering approval, or permission for a physical intervention.
Source descriptions and example conditions do not independently verify measurements.

## Integrity and qualification

RELEASE_MANIFEST.json lists exact source blob identities and SHA-256 file hashes.
The accompanying .zip.sha256 verifies the downloaded archive's bytes. The archive
contains runtime assets and guidance; development tests and checkout metadata
are intentionally absent. Packaging integrity does not establish browser behavior
or scientific validity. Consult the release notes for the platforms and consumer
journeys actually exercised; other platforms remain unqualified.

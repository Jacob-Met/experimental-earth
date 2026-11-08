# Recover a decision after a first reading is less precise than planned

This reproducible fictional walkthrough uses the maintained planners and receivers to carry original evidence through a complete decision journey. An imprecise first gauge reading leaves both target outcomes possible. A newly offered future gauge and, on one branch, a depth reading resolve the remaining question. Every reading below is an authored control, not acquired physical data.

Run commands from the repository root. Each receiver output path must be fresh: exclusive creation refuses an existing file. Keep the exact returned bytes. Receipt hashes bind the original files, including formatting; do not reserialize them or manually change hashes to make an unrelated original appear compatible.

## 1. Receive the wide first reading

```sh
node receive-mechanism-acquisition.mjs examples/mechanism-collection-original.json examples/mechanism-collection-menu.json examples/mechanism-conditional-first-receipt.json recovery-wide-original.json examples/mechanism-collection-choices.json examples/mechanism-conditional-sequences.json
```

The authored gauge 10–30 arrives at minute 30 with actual 13 ± 4 mm uncertainty. Planned `stop-miss` becomes actual `continuation-unresolved`: all 20 original explanations survive, six meeting and fourteen missing the absolute 200 L proposal-storage target. The initially offered depth alone leaves nine of 84 opposite-target pairs unresolved.

The successful recorded output is 4,140 bytes with SHA 256 `ec34f3eb51f7c3676297506ee393155d2567a3ee31d6b97361f4482db3afd364`. It retains the original calibration and appends the actual wide gauge as challenge evidence. This is the exact starting original bound by the recovery receipts below.

## 2. Plan a future reading at minute 35

```sh
node plan-mechanism-acquisition.mjs recovery-wide-original.json examples/mechanism-recovery-menu.json examples/mechanism-recovery-collections.json examples/mechanism-recovery-sequences.json
```

The new planning point is **exactly minute 35**: actual receipt 30 plus the declared five-minute interpretation/decision allowance. The new gauge covers 35–55, is declared available 55 and has planned ± 1 mm uncertainty. The second option remains existing-site cell 0 depth 60, declared available 60. The deadline remains 60; the original model horizon and target are unchanged.

This is a fresh prospective interval, not an attempt to recreate the already received 10–30 reading. The new menu, offered collection and sequence retain explicit fictional joint/conditional availability declarations. They do not verify staffing, setup, access or instrument precision.

## 3. Follow the low-gauge branch

```sh
node receive-mechanism-acquisition.mjs recovery-wide-original.json examples/mechanism-recovery-menu.json examples/mechanism-recovery-gauge-low.json recovery-low-original.json examples/mechanism-recovery-collections.json examples/mechanism-recovery-sequences.json
```

The authored low gauge is received 55. Its five-minute response allowance makes decision-ready time 60, so the recorded action is `take-second`. Ten explanations remain uncontradicted, with six meeting and four missing labels; depth separates all 24 remaining opposite-target pairs.

The actual low output is 4,445 bytes, SHA 256 `023a80ae5769086d0387418e82ea06c679dc8dd9fc5d2aadbf9f986869298072`. The final depth receipt is bound to **this exact returned low original**, not the wide original, high branch or late branch.

There is **no timing slack**. The declarations promise that depth can be chosen at 60 and is available 60 including its acquisition and processing, without earlier setup. That is an explicit fictional boundary case, not proof that a real observer can do so. Do not add an unstated post-depth interpretation allowance while claiming the same deadline has been met; a real workflow requiring more time needs a different truthful timing declaration and deadline.

## 4. Receive depth only on that low branch

```sh
node receive-mechanism-acquisition.mjs recovery-low-original.json examples/mechanism-recovery-depth-menu.json examples/mechanism-recovery-depth-receipt.json recovery-final-original.json
```

This is the existing four-argument singleton receiver. Its menu plans at 60 with deadline 60; the authored existing cell 0/minute 60 depth is 10 ± 1 mm, received 60. The receipt's collection identity is `null`; its original identity matches the low output above.

The successful final original is 4,717 bytes, SHA 256 `2f839ee21aa4631f1d912cd2ad47522657498c106672a98528798408af8d1374`. All 20 calibration-compatible rows and original 6-meet/14-miss labels remain. The uncontradicted indices are **1,4,7**, all meeting the target. Both gauge challenges—the initial wide 10–30 and the later low 35–55—remain alongside the final depth challenge. No previous evidence is replaced or promoted to calibration.

Whole-family target status remains conditional; `all-uncontradicted-meet` describes the surviving subset under these declared measurements and bounds. It is not a posterior probability, physical benefit guarantee or permission to alter a site.

## Separate alternative continuations

The following are **alternative fictional branches from the same wide original**. Do not append them to the low branch or combine their observations with each other.

```sh
node receive-mechanism-acquisition.mjs recovery-wide-original.json examples/mechanism-recovery-menu.json examples/mechanism-recovery-gauge-high.json recovery-high-original.json examples/mechanism-recovery-collections.json examples/mechanism-recovery-sequences.json
```

The high gauge received 55 yields `stop-miss`: ten uncontradicted explanations all miss the target. Its separate output is 4,446 bytes, SHA 256 `9a27ba5f599342ca7b5c29379c2050ee154dbc5660cadd06ca9e6da7ac6ef20e`. No depth continuation is required for this finite-family target verdict.

```sh
node receive-mechanism-acquisition.mjs recovery-wide-original.json examples/mechanism-recovery-menu.json examples/mechanism-recovery-gauge-late.json recovery-late-original.json examples/mechanism-recovery-collections.json examples/mechanism-recovery-sequences.json
```

The late low gauge arrives 56, so decision-ready time is 61. It yields `not-ready-by-deadline`, even though its evidence geometry still has 24 pairs that depth would separate. Its distinct output is 4,450 bytes, SHA 256 `250838616230855edbbf607533de62ff8fd2a13d735ac9a66e1c55f9cf1da017`. Do not apply the timely low branch's depth receipt to this original or describe its continuation as feasible by 60.

## Reopen the actual final original

The maintained original mechanism-proposal API is `importMechanismProposal`; do not substitute a site-project inspector for this envelope. From the repository root, the following invokes the importer once on the file actually written:

```sh
node --input-type=module -e 'import {readFile} from "node:fs/promises"; import {importMechanismProposal} from "./rain-mechanism-proposal.js"; const opened=importMechanismProposal(await readFile("recovery-final-original.json","utf8")); console.log(JSON.stringify(opened.result,null,2));'
```

The recorded complete journey successfully saved and separately reopened the final original through that unchanged importer, with source/input/runtime guards preserved. The facts above describe actual authored headless execution, not field acquisition, browser receiving or a full-repository test claim. The commands make no instrument calls and do not implement an autonomous acquisition loop.

If an input or planning admission refuses, inspect the explanation and preserve the originals. A failure after exclusive output creation can leave a partial file; a stdout failure does not roll back a saved original. Inspect retained artifacts before retrying. The complete chain of exact originals, actual uncertainty and receipt times is part of the scientific interpretation, not merely file bookkeeping.

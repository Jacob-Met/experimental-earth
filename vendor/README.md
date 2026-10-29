# Maintained numerical dependency

`worldlaw-linear-fit.mjs` is an unchanged snapshot of WORLDLAW's `src/science/linear-fit.mjs`, Git blob `5fc92b53ed52ba96dc60b1235aea87bffc4e83ca`, SHA256 `da9014bbdde66fbc78f1e43f2e93cfdb60ef708b571dd61367e3b1bb261538da`. WORLDLAW remains the owner. The relative browser module allows this standalone consumer to reuse the maintained normalized QR calculation without requiring a second live repository or a new shared package.

The caller validates finite, equally sized, bounded columns and target. A null return is a numerical refusal. No zero-coefficient or normal-equation fallback is introduced.

---
"@ckb-ccc/spore": minor
---

feat(spore): prepare for Spore v3 — optional CoBuild intent and native Rust Mutants

- Add `SporeVersion.V3` and Mutant script presets (entries stay empty until the spore-contract #75/#76 deployments are published; pass a custom `SporeScriptInfoLike` to try them early).
- All Spore/Cluster builders accept `withIntent: false` to skip attaching CoBuild Actions, valid only for scripts that accept transactions without them (Spore v3).
- Add `checkSporeIntent` to verify attached Actions against the resolved cells of a transaction, the downstream responsibility after CoBuild became optional intent metadata.
- Add Mutant tooling: `withMutants`/`getMutantIds` content-type helpers, `checkNativeMutantCode` ELF preflight mirroring the Mutant extension contract, `createMutant`, `findMutant`, `injectMutantReferences`, and `checkMutantPayments`.

Harden intent validation with category-bound deployment identities, a verified-only return value, complete owner and operation checks, all-witness Message handling and dependency-resolved Agent references. Preserve existing Actions during no-intent composition. Support paid Mutant/Proxy ID suffixes and all distinct MIME rule parameters, rejecting duplicate IDs and ambiguous rule matches.

Bind new native deployments through standard code Type IDs with reviewed deployment-supplied governance Locks and optional executable pins. Resolve live code successors and forward custom Cluster descriptors. Historical presets/defaults remain unchanged.

Match the contract's Unicode whitespace trimming in Mutant content-type parsing and construction, including U+0085, while preserving strict parameter whitespace rules.

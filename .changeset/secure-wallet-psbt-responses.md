---
"@ckb-ccc/xverse": patch
"@ckb-ccc/joy-id": patch
---

Bind signed Bitcoin PSBT responses to the original transaction and prevouts, check actual signature sighash modes and caller policies before finalization, and reject wallet-added final scripts. These checks also apply when automatic finalization is disabled.

Preserve partial/multiparty signing, unrelated bare inputs, and optional Taproot tree metadata while retaining commitment checks. Verify Taproot key-path signatures against the actual output key, rejecting incorrect empty-tree signatures. Use stock scure through a shared private compatibility, validation, and finalization boundary bundled into ESM and CommonJS builds.

Recheck the effective PSBTv2 transaction after metadata restoration, reject removed signature entries, and preserve finalized witness inputs with an explicit empty scriptSig.

Check single-key ECDSA public-key/script binding before automatic finalization, including wrapped payment scripts.

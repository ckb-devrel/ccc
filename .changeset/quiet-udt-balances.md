---
"@ckb-ccc/core": patch
---

Exclude data shorter than 16 bytes from `udtBalanceFrom` and its input/output balance and input-completion callers. Short data now contributes zero instead of a partial little-endian amount, without throwing. Empty data still contributes zero; complete uint128 amounts and trailing extension data retain their existing behavior. This is balance accounting, not validation of a cell or transaction, including owner-mode transactions. Consumers using this helper to decode nonstandard short amounts should use their protocol's decoder instead.

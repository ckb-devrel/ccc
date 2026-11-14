---
"@ckb-ccc/xverse": patch
"@ckb-ccc/joy-id": patch
---

Share stock-scure PSBT parsing and best-effort finalization between JoyID and Xverse. Use complete common-wallet PSBTs and finalize ready supported inputs on the original transaction, preserving normal scure parsing and transaction-wide checks. Retain unknown PSBT fields and bundle the helper into ESM and CommonJS output.

Both adapters finalize already signed inputs outside the wallet signing selection. Unsigned, finalized and unsupported inputs remain unchanged. Supported scripts include P2SH-P2WPKH, wrapped multisig and standard Taproot script templates.

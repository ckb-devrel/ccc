---
"@ckb-ccc/joy-id": patch
"@ckb-ccc/xverse": patch
---

Use `@scure/btc-signer` instead of `bitcoinjs-lib` for PSBTs. JoyID no longer
calls `initEccLib`, which set global state.

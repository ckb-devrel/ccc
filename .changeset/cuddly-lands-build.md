---
"@ckb-ccc/core": minor
"@ckb-ccc/joy-id": patch
"@ckb-ccc/okx": patch
"@ckb-ccc/uni-sat": patch
"@ckb-ccc/utxo-global": patch
"@ckb-ccc/xverse": patch
---

feat(core): add BTC PSBT signing support

- Add `SignerBtc.signPsbt()`, `signAndBroadcastPsbt()`, and `broadcastPsbt()` for signing and broadcasting PSBTs
- Add `SignPsbtOptions` and `InputToSign` for configuring PSBT signing

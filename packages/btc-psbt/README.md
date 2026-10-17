# Private wallet PSBT helpers

This source-only workspace package shares PSBT response validation and per-input
finalization between Xverse and JoyID. It is a development dependency bundled by
both adapters' tsdown configurations, with no independent build or publication.
Core does not depend on it. Wallet communication, input selection, and which inputs
to finalize remain adapter-specific.

`WalletPsbt` owns its scure transaction and input bytes. It exposes copied reads,
guarded serialization, and per-input finalization; no generic mutation or raw
transaction accessor is exposed. Finalization stages updates privately and checks
all inputs before and after mutation. `parseAndValidateSignedPsbt` enforces wallet
response binding, signature encoding, and caller sighash policy. Finalization also
checks encodings/declarations, verifies Taproot key signatures in the full
transaction at the original index, and binds ECDSA keys to single-key scripts.

Stock scure 2.4.1 is used without dependency patches. Parsing first tries its strict
public API. A fallback delegates structural and commitment validation to public
`normalizeInput`, `getPrevOut`, and `OutScript` APIs, with exactly two exceptions:

- Recognized bare P2PK/multisig inputs may omit wrappers; any redeem/witness script
  or Taproot commitment metadata on them is rejected.
- A Taproot internal key without a root or leaves describes an unknown tree.
  Its encoding is checked first, then only this key is omitted from a temporary
  validation projection. The original metadata is retained. Explicit roots,
  leaves, wrapper hashes, and canonical witness programs remain checked by scure.

Every fallback input is checked, including unrelated inputs, and every
serialization repeats these checks. The compatibility suite records acceptance
contracts from the former parser patch and tests malformed metadata, alias
isolation, atomic finalization, and the unrelated-input bypass of raw unchecked
transactions. No upstream private-key signing or finalizer implementation is copied.

Run the common suite with `pnpm --filter @ckb-ccc/btc-psbt test run`, and both
adapter suites with `pnpm --filter @ckb-ccc/xverse --filter @ckb-ccc/joy-id test run`.
After building the adapters, `pnpm test:psbt:artifacts` exercises their published
ESM/CommonJS entry points and checks that this private package is fully bundled.

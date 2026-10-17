<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/dev/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's support for Xverse
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/xverse"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fxverse"
  /></a>
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ckb-devrel/ccc" />
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/ckb-devrel/ccc/dev" />
  <img alt="GitHub branch check runs" src="https://img.shields.io/github/check-runs/ckb-devrel/ccc/dev" />
  <a href="https://live.ckbccc.com/"><img
    alt="Playground" src="https://img.shields.io/website?url=https%3A%2F%2Flive.ckbccc.com%2F&label=Playground"
  /></a>
  <a href="https://app.ckbccc.com/"><img
    alt="App" src="https://img.shields.io/website?url=https%3A%2F%2Fapp.ckbccc.com%2F&label=App"
  /></a>
  <a href="https://docs.ckbccc.com/"><img
    alt="Docs" src="https://img.shields.io/website?url=https%3A%2F%2Fdocs.ckbccc.com%2F&label=Docs"
  /></a>
</p>

<p align="center">
  CCC - CKBers' Codebase is a one-stop solution for your CKB JS/TS ecosystem development.
  <br />
  Empower yourself with CCC to discover the unlimited potential of CKB.
  <br />
  Interoperate with wallets from different chain ecosystems.
  <br />
  Fully enabling CKB's Turing completeness and cryptographic freedom power.
</p>

Check the [package documentation](https://docs.ckbccc.com/docs/packages/wallet-integrations/xverse) and [API reference](https://api.ckbccc.com/modules/_ckb-ccc_xverse.index) for more details.

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>

## Bitcoin PSBT response validation

`signPsbt` binds the wallet response to the requested transaction, input order,
outputs, locktime, and previously supplied UTXO data. Actual ECDSA and Schnorr
signature hash modes must match the input declaration and any caller allowlist
for new or replaced signatures. These checks also run with `autoFinalized: false`.
Other participants' unchanged signatures are not subject to the caller allowlist.
Responses that remove an existing signature are rejected.
Explicit non-default hash modes remain supported.

Wallets must return an unfinalized PSBT. Existing, unchanged finalized inputs are
preserved, but newly added or changed final scripts are rejected. Missing trusted
UTXO/script/Taproot metadata is restored after transaction binding, with conflicts
rejected. Omitted Taproot roots/leaves do not assert an empty tree. New key-path
signatures, and signatures about to be finalized, are verified against the actual
output key in the full transaction context. All committed prevouts are required,
except unrelated prevouts excluded by `ANYONECANPAY`.

Automatic finalization checks that a single-key ECDSA signature's public key
matches the committed script, including P2SH/P2WSH wrappers.
It supports ordinary payment scripts, wrapped multisig,
Taproot key-path, and scure's `tr_ns`/`tr_ms` script templates. Unrelated bare
P2PK/multisig inputs can be carried through while retaining commitment checks.
Arbitrary CLTV/CSV or inscription scripts are not automatically solved. Use
`autoFinalized: false` for partial/multiparty signing or application-managed
finalization; `broadcastPsbt` remains unsupported.

Both adapters bundle a shared private PSBT boundary using stock scure public APIs.
It encapsulates compatibility for bare inputs and omitted Taproot tree metadata,
validates all inputs before finalization and serialization, and never exposes an
unchecked mutable transaction. ESM and CommonJS consumers receive the same checks.

Xverse's RPC cannot forward `inputsToSign[].sighashTypes`; CCC enforces it locally
on returned signatures. `disableTweakSigner` remains unsupported by Xverse.

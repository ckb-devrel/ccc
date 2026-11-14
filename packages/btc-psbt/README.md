# Shared wallet PSBT finalization

This source-only workspace package shares stock scure parsing and best-effort
finalization between JoyID and Xverse. Both adapters bundle it into their ESM
and CommonJS output; it is not published separately.

`parsePsbt` uses scure's normal `Transaction.fromPSBT`, retaining unknown and
proprietary fields. The supported scope is complete common-wallet PSBTs with
the UTXO and script metadata required by scure.

With `autoFinalized` enabled, both adapters visit every input and call
`finalizeIdx` on the original transaction for each ready input. This preserves
scure's normal transaction-wide checks, including total fees and required UTXOs.
Finalized, unsigned and unsupported inputs remain unchanged. Parsing failures
and unexpected finalizer errors are reported, with the input index on the latter.

Supported scripts include P2PKH/P2WPKH, P2SH/P2WSH-wrapped single-key and multisig
scripts (including P2SH-P2WPKH), Taproot key-path, and scure's `tr_ns`/`tr_ms`
templates. Readiness matches signature keys, leaf hashes and thresholds.
`inputsToSign` controls wallet signing; local finalization also handles already
signed inputs outside that selection. Use `autoFinalized: false` to return the
partial PSBT without local finalization.

Run `pnpm --filter @ckb-ccc/btc-psbt test run` for the shared tests. After building
the adapters, run `pnpm --filter @ckb-ccc/joy-id --filter @ckb-ccc/xverse run test:artifacts`
for package-local native ESM/CommonJS loading, signing and bundle checks.
Adapter behavior is covered by their source unit tests. The artifact smoke checks
do not install npm tarballs or test package exports resolution.

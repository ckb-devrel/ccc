<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/dev/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's Support for DID CKB
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/did-ckb"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fdid-ckb"
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

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>

## Claim Cells

The package can discover, decode, and construct transactions for Claim Cells issued by a `did:ckb` identity. Claim Cells use a separate Claim Type deployment and may be locked to any complete CKB lock. A DID Lock deployment provides the convenience path for attaching a claim to a stable `did:ckb` while its controller rotates.

Applications must provide the Claim Type and optional DID Lock deployment for their selected network. `didCkb` defaults to the client's `KnownScript.DidCkb` configuration.

```ts
import { ccc } from "@ckb-ccc/core";
import {
  type ClaimScriptConfigLike,
  readClaims,
  writeClaim,
} from "@ckb-ccc/did-ckb";

const scripts = {
  claimType: claimTypeScriptInfo,
  didLock: didLockScriptInfo,
} satisfies ClaimScriptConfigLike;
```

### Read claims

`readClaims` scans every indexer page for one exact subject lock and returns decoded live claims alongside malformed or unsupported Cells that were isolated during the scan.

```ts
const result = await readClaims({
  client,
  scripts,
  filter: {
    subject: { did: subjectDid },
    issuerDid,
    schemaHash,
    evaluationTime: checkpointTimestamp,
  },
});

for (const claim of result.claims) {
  console.log(claim.claimId, claim.payload, claim.verification.time);
}
```

Use `subject: { lock }` to query any complete CKB lock directly. `issuerDid` and `schemaHash` are optional filters. A `did:ckb` subject requires the configured DID Lock deployment.

`evaluationTime` is an application-selected Unix timestamp in seconds. The reader never uses the local clock implicitly, and a claim expires exactly at `expiresAt`. Evaluating an earlier timestamp does not prove that the claim or DID state existed at that time; historical decisions need separate chain-state evidence.

Each result includes the issuer's current on-chain state. Applications remain responsible for deciding which issuers and schema hashes they trust. An unavailable issuer lookup must be treated as an incomplete authorization result rather than an accepted claim.

### Write claims

`writeClaim` constructs and balances one unsigned Claim Cell transaction. The issuer must control the current controller lock of `issuerDid`. By default the issuer also funds the output capacity and fee; pass `payerSigner` when another signer pays.

```ts
const built = await writeClaim({
  issuerSigner,
  scripts,
  input: {
    subject: { did: subjectDid },
    issuerDid,
    schemaHash,
    payload: { taskId: 42, rating: 5 },
    issuedAt: checkpointTimestamp,
  },
});

const preparedHash = built.tx.hash();
const signed = await issuerSigner.signOnlyTransaction(built.tx);
if (signed.hash() !== preparedHash) {
  throw new Error("Signer changed the prepared transaction");
}
const txHash = await issuerSigner.client.sendTransaction(signed);
```

Signing and broadcasting remain explicit caller actions. `writeClaims` constructs between one and eight claims for the same issuer and subject atomically, preparing and balancing the transaction once. Output capacity defaults to the exact occupied capacity of the encoded Claim Cell.

The Claim Cell protocol, current Testnet deployment, and schema examples are maintained in the [Vellum repository](https://github.com/truthixify/vellum/blob/main/docs/claim-cell.md).

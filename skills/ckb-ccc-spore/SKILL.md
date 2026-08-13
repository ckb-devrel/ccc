---
name: ckb-ccc-spore
description: Covers creating, transferring, and melting Spore protocol NFTs/DOBs(on-chain digital objects) on CKB with CCC, including cluster handling and the DOB/0 and DOB/1 content-type conventions built on top of Spore (DNA-driven trait patterns, decoders, SVG composition). Use when the user asks about Spore, DOB, DOB/0, DOB/1, on-chain NFTs, or clusters on CKB — even if they just say "NFT" or "digital object" without naming Spore or DOB specifically. Builds on the standard transaction pattern in ckb-ccc-transactions.
metadata:
  author: ckb-devrel
  version: "1.0.0"
  role: spoke
  depends-on: "ckb-ccc-fundamentals, ckb-ccc-transactions"
  priority: normal
---

# CKB CCC — Spore Protocol

Covers Spore (on-chain NFT/DOB) creation, transfer, and destruction. Assumes a connected `Signer` (see `ckb-ccc-signer-setup`) and the standard transaction pattern (see `ckb-ccc-transactions`) — this skill only adds the Spore-specific steps on top of that pattern.

---

## Spore vs. DOB — how they relate

**Spore is the base protocol**: a cell holding arbitrary `content` + `contentType`, optionally belonging to a Cluster. Everything in "Creating and managing Spore NFTs" below works for *any* content type.

**DOB (Digital Object) is a family of specialized `contentType` conventions built on top of Spore** — DOB/0 and DOB/1 each define their own content encoding and a matching decoder, so wallets/explorers know how to render them consistently:

- **DOB/0** (`contentType: "dob/0"`) — the content is a **DNA** string (raw hex bytes). The Cluster's description defines a **pattern**: a list of traits, each specifying which bytes of the DNA to read (`dnaOffset`, `dnaLength`) and how to interpret them (`options` → pick from a list, `range` → numeric range, `rawNumber` → raw value). A **decoder** applies the pattern to the DNA to produce human-readable traits, which compatible platforms (JoyID, Omiga, CKB Explorer, Mobit, Dobby) render.
- **DOB/1** (`contentType: "dob/1"`) — takes DOB/0's *decoded output* as input and assembles it into an SVG image (backgrounds, icons, compositing). Per the official protocol spec, the DOB/0 decoder produces named traits as **TEXT**, and the DOB/1 decoder consumes those traits to produce the final **SVG** string — so a DOB/1 cluster registers *both* decoders (`ver: 1`, `decoders: [dob0Entry, dob1Entry]`), and the minted spore's `contentType` is `"dob/1"`.

If the user just says "NFT", "DOB" or "digital object" without specifying a format, a plain Spore (no DOB pattern) is usually the simpler starting point — reach for DOB/0 when they specifically want DNA-driven, generative/random traits (loot-style items, PFP traits, etc.).

---

## Creating a DOB/0 (cluster + pattern + minted DOB)

1. **Define the trait pattern** — an array of `PatternElementDob0` entries, each mapping a slice of the DNA to a named trait.
2. **Encode it into the cluster description** — via `ccc.spore.dob.encodeClusterDescriptionForDob0()`, referencing a decoder obtained from `ccc.spore.dob.getDecoder(client, "dob0")`.
3. **Create the Cluster** — `ccc.spore.createSporeCluster({ signer, data: { name, description } })`, then `completeFeeBy` + `sendTransaction` as usual.
4. **Create the Spore with `contentType: "dob/0"`** — `content` is the DNA bytes (commonly a JSON string embedding a random hex DNA); set `clusterId` and `clusterMode: "clusterCell"`.

```typescript
import { ccc } from "@ckb-ccc/ccc";
import { client, signer } from "@ckb-ccc/playground"; // or your own client/signer

function generateSimpleDNA(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

// 1-2. Define pattern and encode the cluster description
const dob0Pattern: ccc.spore.dob.PatternElementDob0[] = [
  { traitName: "BackgroundColor", dobType: "String", dnaOffset: 0, dnaLength: 1, patternType: "options", traitArgs: ["red", "blue", "green", "black", "white"] },
  { traitName: "Type", dobType: "Number", dnaOffset: 1, dnaLength: 1, patternType: "range", traitArgs: [10, 50] },
  { traitName: "Timestamp", dobType: "Number", dnaOffset: 2, dnaLength: 4, patternType: "rawNumber" },
];

const dob0: ccc.spore.dob.Dob0 = {
  description: "A simple loot cluster",
  dob: { ver: 0, decoder: ccc.spore.dob.getDecoder(client, "dob0"), pattern: dob0Pattern },
};
const clusterDescription = ccc.spore.dob.encodeClusterDescriptionForDob0(dob0);

// 3. Create the cluster
const { tx: clusterTx, id: clusterId } = await ccc.spore.createSporeCluster({
  signer,
  data: { name: "Simple loot", description: clusterDescription },
});
await clusterTx.completeFeeBy(signer);
await signer.sendTransaction(clusterTx);

// 4. Mint a DOB/0 spore into that cluster
const { tx: sporeTx, id: sporeId } = await ccc.spore.createSpore({
  signer,
  data: {
    contentType: "dob/0",
    content: ccc.bytesFrom(`{ "dna": "${generateSimpleDNA(16)}" }`, "utf8"),
    clusterId,
  },
  clusterMode: "clusterCell",
});
await sporeTx.completeFeeBy(signer);
await signer.sendTransaction(sporeTx);
```

Transfer and melt for a DOB/0 spore use the exact same `transferSpore` / `meltSpore` calls shown below — DOB only changes how the content is *encoded and rendered*, not how the Spore cell itself is managed on-chain.

## Creating a DOB/1 (SVG composition on top of DOB/0)

DOB/1 doesn't replace DOB/0's DNA pattern — it **adds a second decoder on top of it**. Per the official protocol spec, the cluster description registers *two* decoders: the DOB/0 one (DNA → named traits, as TEXT) and a DOB/1 one (those traits → an SVG string). The minted Spore's `contentType` is `"dob/1"`.

1. **Define the DOB/0 pattern** — same as a plain DOB/0 (traits from DNA bytes).
2. **Define the DOB/1 pattern** — an array of `PatternElementDob1` entries.
   Each targets an `imageName` (e.g. `"IMAGE.0"`) and an `svgFields` (`"attributes"` sets the `<svg>` tag's attributes; `"elements"` maps a trait's value — or a numeric range — to a chunk of SVG markup, with a `[["*"], fallbackSvg]` entry as the wildcard/default case). A `traitName: ""` with `patternType: "raw"` inserts static markup that isn't tied to any trait (e.g. an always-present background image).
3. **Encode both into the cluster description** — via `ccc.spore.dob.encodeClusterDescriptionForDob1()`, passing `ver: 1` and a `decoders` array containing both the dob0 and dob1 `{ decoder, pattern }` pairs.
4. **Create the Cluster and mint the Spore** — identical to the DOB/0 flow, except `contentType: "dob/1"`; `content` is still the DNA.

```typescript
import { ccc } from "@ckb-ccc/ccc";
import { client, signer } from "@ckb-ccc/playground";

const dob0Pattern: ccc.spore.dob.PatternElementDob0[] = [
  { traitName: "Level", dobType: "String", dnaOffset: 0, dnaLength: 1, patternType: "options", traitArgs: ["Gold", "Silver", "Copper", "Blue"] },
  { traitName: "Member ID", dobType: "String", dnaOffset: 1, dnaLength: 10, patternType: "rawString" },
];

const dob1Pattern: ccc.spore.dob.PatternElementDob1[] = [
  { imageName: "IMAGE.0", svgFields: "attributes", traitName: "", patternType: "raw", traitArgs: "xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 500'" },
  { imageName: "IMAGE.0", svgFields: "elements", traitName: "", patternType: "raw", traitArgs: "<image width='400' height='400' x='50' y='100' href='https://spore.pro/svg/amazing-mushroom.svg' />" },
  {
    imageName: "IMAGE.0", svgFields: "elements", traitName: "Level", patternType: "options",
    traitArgs: [
      ["Gold", "<image width='100' height='100' href='btcfs://<tx-hash>i0' />"],
      ["Silver", "<image width='100' height='100' href='btcfs://<tx-hash>i1' />"],
      // ...one entry per Level option; no wildcard needed since Level's own
      // dob0Pattern options already cover every possible DNA value
    ],
  },
];

const dob1: ccc.spore.dob.Dob1 = {
  description: "Owning a Spore Genesis DOB grants exclusive access to special events, governance participation, and future airdrops within the Spore ecosystem.",
  dob: {
    ver: 1,
    decoders: [
      { decoder: ccc.spore.dob.getDecoder(client, "dob0"), pattern: dob0Pattern },
      { decoder: ccc.spore.dob.getDecoder(client, "dob1"), pattern: dob1Pattern },
    ],
  },
};
const clusterDescription = ccc.spore.dob.encodeClusterDescriptionForDob1(dob1);

const { tx: clusterTx, id: clusterId } = await ccc.spore.createSporeCluster({
  signer,
  data: { name: "Spore Genesis", description: clusterDescription },
});
await clusterTx.completeFeeBy(signer);
await signer.sendTransaction(clusterTx);

const { tx: sporeTx, id: sporeId } = await ccc.spore.createSpore({
  signer,
  data: {
    contentType: "dob/1", // note: dob/1, not dob/0 — this mints a DOB/1, not a DOB/0
    content: ccc.bytesFrom(`{ "dna": "${generateSimpleDNA(16)}" }`, "utf8"), // same generateSimpleDNA helper as the DOB/0 example
    clusterId,
  },
  clusterMode: "clusterCell",
});
await sporeTx.completeFeeBy(signer);
await signer.sendTransaction(sporeTx);
```

**Displaying `btcfs://` / `ipfs://` image URIs**: these aren't URLs a browser can load directly — they need a resolver (e.g. the [dob-render sdk](https://www.npmjs.com/package/@nervina-labs/dob-render)) to turn them into an actual displayable image (base64 or similar) before rendering the SVG. Don't assume `<image href="btcfs://...">` renders as-is in a plain `<img>`/browser context.

## Deeper recipes

More DOB/0 patterns (image-linked traits via BTCFS/IPFS, programmatic images) and more DOB/1 compositions (genesis-style layered images, btcfs/ipfs-linked backgrounds) are covered with worked, runnable examples in `sporeprotocol/dob-cookbook` — see `ckb-ccc-examples-finder` for how to fetch specific examples from that repo. For the underlying byte-level protocol spec (not just a working example), see the official docs: `docs.spore.pro/dob/dob0-protocol` and `docs.spore.pro/dob/dob1-protocol`.

---

## Creating and managing Spore NFTs

1. **Create Spore** — `const { tx, id: sporeId } = await ccc.spore.createSpore({ signer, data: { contentType: "text/plain", content: bytes } })`.
2. **If using a Cluster** — Specify `clusterMode: "lockProxy" | "clusterCell" | "skip"` in `createSpore()`. Omitting it when `clusterId` is set throws.
3. **Complete and send** — `await tx.completeInputsByCapacity(signer)`, `await tx.completeFeeBy(signer)`, `await signer.sendTransaction(tx)`.
4. **Save `sporeId`** — It is the Type script args; required for all subsequent transfer/melt operations.
5. **Transfer** — `const { tx } = await ccc.spore.transferSpore({ signer, id: sporeId, to: newOwnerLock })`. Then `completeFeeBy` and `sendTransaction`.
6. **Melt (destroy)** — `const { tx } = await ccc.spore.meltSpore({ signer, id: sporeId })`. **Irreversible** — permanently destroys the NFT and all on-chain content.

```typescript
import { ccc } from "@ckb-ccc/ccc";
import { signer } from "@ckb-ccc/playground"; // replace with an application signer outside Playground
 
const recipientAddr = await signer.getRecommendedAddress(); // replace with the intended recipient

// Create a Spore (stores content permanently on-chain)
const { tx, id: sporeId } = await ccc.spore.createSpore({
  signer,
  data: {
    contentType: "text/plain",
    content: new TextEncoder().encode("Hello, Spore!"),
  },
});
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer);
const txHash = await signer.sendTransaction(tx);
// Save sporeId — it's the Type script args, needed for transfer/melt

// Transfer a Spore
const { script: newOwner } = await ccc.Address.fromString(recipientAddr, signer.client);
const { tx: transferTx } = await ccc.spore.transferSpore({ signer, id: sporeId, to: newOwner });
await transferTx.completeFeeBy(signer);
await signer.sendTransaction(transferTx);

// Melt (destroy) a Spore — irreversible
const { tx: meltTx } = await ccc.spore.meltSpore({ signer, id: sporeId });
await meltTx.completeFeeBy(signer);
await signer.sendTransaction(meltTx);
```

Spore stores content fully on-chain. Large content (images) requires substantial CKB
capacity. Text Spore ≈ 200+ CKB minimum.

---

## Gotchas (Spore-specific)

| Symptom / Error | Cause | Fix |
|---|---|---|
| `createSpore` throws on `clusterId` | `clusterMode` not specified | Specify `clusterMode: "lockProxy" \| "clusterCell" \| "skip"` when `clusterId` is set |
| DOB doesn't render as expected on wallets/explorers | `contentType` doesn't match the DOB version actually encoded in the cluster's decoder chain | A DOB/0-only cluster → `contentType: "dob/0"`; a cluster with both dob0+dob1 decoders → `contentType: "dob/1"`. Mismatching these is an easy copy-paste mistake between examples — verify against the official protocol docs (`docs.spore.pro`), not just a similar-looking example |
| `btcfs://...` / `ipfs://...` image doesn't display | These aren't URLs a browser can load directly | Needs a resolver (e.g. JoyID's `dob-render-sdk`) to convert to a displayable image before rendering |

---

## Checklist (Spore-specific)

- [ ] **Spore cluster** — `clusterMode` specified when `clusterId` is set in `createSpore()`

Also check the checklists in `ckb-ccc-fundamentals` and `ckb-ccc-transactions`.

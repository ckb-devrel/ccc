<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 64px;">
  CCC
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/ccc"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fccc"
  /></a>
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ckb-devrel/ccc" />
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/ckb-devrel/ccc/master" />
  <img alt="GitHub branch check runs" src="https://img.shields.io/github/check-runs/ckb-devrel/ccc/master" />
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

## Use Cases

<p align="center">
  <a href="https://app.ckbccc.com/">
    <img src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/appPreview.png" width="50%" />
  </a>
</p>

For non-developers, you can [try CCC's app now here](https://app.ckbccc.com/) ([Project source code](https://github.com/ckb-devrel/ccc/tree/master/packages/demo)). It showcases how to use CCC for some basic scenarios in CKB:

- [Sign and verify any message.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/Sign/page.tsx>) ([Playground](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/sign.ts))
- [Transfer native CKB token.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/Transfer/page.tsx>) ([Playground](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transfer.ts))
- [Transfer UDT token.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/TransferUdt/page.tsx>) ([Playground](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferUdt.ts))
- See [Misc: Single-Use-Seals](https://talk.nervos.org/t/en-cn-misc-single-use-seals/8279) to learn how token issuing works in the cell model.
  - [Issue xUDT token with the Single-Use Lock.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/IssueXUdtSus/page.tsx>)
  - [Issue xUDT token controlled by a Type ID cell.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/IssueXUdtTypeId/page.tsx>)
- [Spore Protocol](https://docs.spore.pro/) SDK.
  - [Create spore cluster.](<https://github.com/ckb-devrel/ccc/blob/master/packages/demo/src/app/connected/(tools)/CreateSporeCluster/page.tsx>)
  - [Mint spore.](<https://github.com/ckb-devrel/ccc/blob/master/packages/demo/src/app/connected/(tools)/MintSpore/page.tsx>)
  - [Transfer/Melt spore.](<https://github.com/ckb-devrel/ccc/blob/master/packages/demo/src/app/connected/(tools)/TransferSpore/page.tsx>)
  - [Transfer spore cluster.](<https://github.com/ckb-devrel/ccc/blob/master/packages/demo/src/app/connected/(tools)/TransferSporeCluster/page.tsx>)
- [Manage Nervos DAO.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/NervosDao/page.tsx>)
- [Transfer native CKB token with time lock.](<https://github.com/ckb-devrel/ccc/blob/master/packages/demo/src/app/connected/(tools)/TimeLockedTransfer/page.tsx>)
- [Calculate the CKB hash of any messages.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/utils/(tools)/Hash/page.tsx>)
- [Generate mnemonic and keypairs. Encrypt to a keystore.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/utils/(tools)/Mnemonic/page.tsx>)
- [Decrypt a keystore.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/utils/(tools)/Keystore/page.tsx>)
- [Transfer the native CKB token with the old Lumos SDK.](<https://github.com/ckb-devrel/ccc/tree/master/packages/demo/src/app/connected/(tools)/TransferLumos/page.tsx>)

## Examples

<p align="center">
  <a href="https://live.ckbccc.com/">
    <img src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/preview.png" width="90%" />
  </a>
</p>

Check our [full documents for all detailed APIs](https://docs.ckbccc.com) to understand these examples better. If you are new to the CKB, we recommend checking [Nervos CKB Docs](https://docs.nervos.org/) for basic knowledge. We build examples based on [the CCC playground](https://live.ckbccc.com/).

<p align="center">
  <a href="https://live.ckbccc.com/">
    <img src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/playgroundCell.png" width="40%" />
  </a>
</p>

Cells are represented with graphs in the playground. The three layers of cells represent occupancy, type and lock from inside to outside. The filled center circle means that all CKB of this cell is used to store data.

When cells share the same color, the same script governs them. They are owned by the same address (the outside ring) or the same type of assets (the inside ring). Check the script details in the "Scripts" tab.

### Transaction Composing

Here's an example for transferring CKB:

```typescript
const tx = ccc.Transaction.from({
  outputs: [{ lock: toLock, capacity: ccc.fixedPointFrom(amount) }],
});
```

Tell CCC what you need, and then...

```typescript
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer); // Transaction fee rate is calculated automatically
const txHash = await signer.sendTransaction(tx);
```

We have done everything!

- [Use specified wallet in custom UI.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/customUi.ts)
- [Use all supported wallets in custom UI.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/customUiWithController.ts)
- [Sign and verify any message.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/sign.ts)
- [Transfer native CKB token.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transfer.ts)
- [Transfer all native CKB token.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferAll.ts)
- [Transfer UDT token.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferUdt.ts)
- [Interact with UDT through @ckb-ccc/udt](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/udt/quickstart.ts):
- [Get UDT symbol through @ckb-ccc/udt.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/udt/symbol.ts)
- [Check if a lock hash has been paused through @ckb-ccc/udt.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/pausableUdt/isPaused.ts)
- [Transfer UDT token through @ckb-ccc/udt.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/udt/transfer.ts)

## Quick Start with `create-ccc-app` (Recommended)

To quickly bootstrap a new CCC-based application, you can use our CLI tool `create-ccc-app`:

```bash
# Using npx
npx create-ccc-app@latest my-ccc-app
```

```bash
# Using yarn
yarn create ccc-app my-ccc-app
```

```bash
# Using pnpm
pnpm create ccc-app my-ccc-app
```

Follow the prompts to select your preferred framework template and start building your CCC application.

## Manual Installation

We design CCC for both front-end and back-end developers. You need only one package to fulfil all your needs:

- [NodeJS](https://www.npmjs.com/package/@ckb-ccc/shell): `npm install @ckb-ccc/shell`
- [Custom UI](https://www.npmjs.com/package/@ckb-ccc/ccc): `npm install @ckb-ccc/ccc`
- [Web Component](https://www.npmjs.com/package/@ckb-ccc/connector): `npm install @ckb-ccc/connector`
- [React](https://www.npmjs.com/package/@ckb-ccc/connector-react) ([Docs](https://docs.ckbccc.com/modules/_ckb_ccc_connector_react.html)): `npm install @ckb-ccc/connector-react`

CCC exports everything on the `ccc` object:

```typescript
import { ccc } from "@ckb-ccc/<package-name>";
```

For advanced developers, we provided the `cccA` object to fulfil all your needs. You should notice that these interfaces are not stable:

```typescript
import { cccA } from "@ckb-ccc/<package-name>/advanced";
```

## Build and Run

Run the demo of CCC in two steps:

1. Install packages and build the project

```shell
# Navigate to the project directory and run the following commands to install all necessary packages and build the project:
pnpm install
pnpm build
```

2. Run the demo in development mode

```shell
# Go to the demo directory and start the development server:
cd packages/demo
pnpm run dev
```

## Who uses CCC?

| [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/nervdao.svg" />](https://nervdao.com/) | [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/utxoglobal.svg" />](https://utxo.global/) | [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/mobit.svg" />](https://mobit.app/) | [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/omiga.svg" />](https://omiga.io/) |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |

| [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/nervape.svg" />](https://www.nervape.com/) | [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/utxoswap.svg" />](https://utxoswap.xyz/) | [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/did.svg" />](https://d.id/) | [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/boolnetwork.svg" />](https://bool.network/) |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |

| [<img height="50" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/projects/world3.svg" />](https://world3.ai/) | [<img height="50" src="assets/projects/rgbcat.svg" />](https://catnip.rgbcat.io/) |
| ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |

## FAQs

### Property '\*' does not exist on type 'typeof import("\*/@ckb-ccc/connector-react/dist/barrel")'.ts(2339)

CCC uses JS's [Package Entry Points](https://nodejs.org/api/packages.html#packages_package_entry_points) feature to help tree shaking while exporting everything on the `ccc` object. Ensure in your `tsconfig.json`, `moduleResolution` is set to `node16`, `nodenext`, or `bundler`, and `resolvePackageJsonExports` is not disabled.

Read the [TypeScript's Guide](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports) for more.

### TypeError: (0, react....createContext) is not a function

CCC UI only works on the client side. If you are using the [React Server Component](https://react.dev/reference/rsc/use-client), add

```tsx
"use client";
```

at the beginning of files using `ccc.Provider`.

### Can I use Lumos with CCC?

While we recommend using CCC for composing transactions, we also provide Lumos patches to:

- Support the JoyID Wallet.
- Support the Nostr Wallet.
- Support the Portal Wallet.

See [lumos-patches](https://www.npmjs.com/package/@ckb-ccc/lumos-patches): `npm install @ckb-ccc/lumos-patches`

You can apply patches by:

```typescript
import { generateDefaultScriptInfos } from "@ckb-ccc/lumos-patches";

// Before using Lumos. You don't need @ckb-lumos/joyid anymore.
registerCustomLockScriptInfos(generateDefaultScriptInfos());
```

## Additional Guides

### SSRI (Script Sourced Rich Information)

- [Quick Starts: Interact with SSRI-Compliant UDT Script with @ckb-ccc/udt](https://github.com/ckb-devrel/ccc/tree/master/guides/quickstart_udt.md)

## Links

- [CCC Playground](https://live.ckbccc.com/) and its [source code](https://github.com/ckb-devrel/ccc/tree/master/packages/playground) help you experiment with CCC instantly in browsers.
- [Nervos CKB Docs](https://docs.nervos.org/) is the documentation website of Nervos CKB.
- [Lumos](https://github.com/ckb-js/lumos) and its [Docs](https://lumos-website.vercel.app/): Lumos provides utils to help compose CKB transactions.
- [RGB++ SDK](https://github.com/ckb-cell/rgbpp-sdk) and its [Design](https://github.com/ckb-cell/RGBPlusPlus-design): RGB++ is a protocol for issuing assets with Turing-completed VM on BTC L1.
- [Spore SDK](https://github.com/sporeprotocol/spore-sdk) and its [Docs](https://docs.spore.pro/): The on-chain digital object (DOBs) protocol designed to empower ownership, distribution, and value capture.
- [PW SDK](https://talk.nervos.org/t/lay2-pw-sdk-build-dapps-on-ckb-and-run-them-everywhere/4289) is not maintained anymore. It is the early-age wallet connector and a brave pioneer of the CKB ecosystem.

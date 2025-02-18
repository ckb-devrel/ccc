<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's Support for SSRI
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/ssri"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fssri"
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

## Script-Sourced Rich Information

- Try interactive demo at [CCC App - SSRI](https://app.ckbccc.com/connected/SSRI)
- Read more about SSRI on [[EN/CN] Script-Sourced Rich Information - 来源于 Script 的富信息](https://talk.nervos.org/t/en-cn-script-sourced-rich-information-script/8256).

>## NOTE: This is the base package for interaction with SSRI-Compliant scripts
>
>If you are looking for UDT support, please refer directly to [@ckb-ccc/udt](https://www.npmjs.com/package/@ckb-ccc/udt) which supports both SSRI-compliant UDT and legacy support for `xUDT` through `ckb-asset-indexer` (coming soon).

## Additional Note

- Currently `ExecutorJsonRpc` is the only supported `Executor`. There will be more in the future and legacy support for `xUDT` will be added through `ckb-asset-indexer`.
- A public SSRI Executor JSON RPC Point is being scheduled, and efforts are being made to make to provide in-browser SSRI execution with WASM.

## Related Projects

- [`ssri-server`](https://github.com/ckb-devrel/ssri-server): `ExecutorJSONRpc` server for calling SSRI methods.
- [`ckb-ssri-std`](https://github.com/ckb-devrel/ckb-ssri-std): A toolkit to help developers build SSRI-Compliant scripts on CKB.

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>

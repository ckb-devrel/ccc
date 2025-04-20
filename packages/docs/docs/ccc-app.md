---
sidebar_position: 2
title: CCC App
description: The CCC App is a mini-toolset for CKB, showcasing some basic scenarios.
---

<p align="center">
  <a href="https://app.ckbccc.com/">
    <img src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/appPreview.png" width="70%" />
  </a>
</p>

The CCC App is a mini-toolset for CKB, showcasing some basic scenarios. You can still [try the CCC App here](https://app.ckbccc.com) even if you are not a developer. Here is the full list of the app's features:

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
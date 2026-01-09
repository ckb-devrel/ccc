---
sidebar-position: 3
title: Code Examples
description: Code examples for CCC.
---

Let's start with a minimal example for transferring CKB:

```typescript
const tx = ccc.Transaction.from({
  outputs: [{ lock: toLock, capacity: ccc.fixedPointFrom(amount) }],
});
```

Define the essential outputs of the transaction, and then...

```typescript
await tx.completeInputsByCapacity(signer);
await tx.completeFeeBy(signer); // Transaction fee rate is calculated automatically
const txHash = await signer.sendTransaction(tx);
```

That's it! The transaction is sent.

[Click here to read the full example of transferring native CKB token.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transfer.ts)

- [Use specified wallet in custom UI.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/customUi.ts)
- [Use all supported wallets in custom UI.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/customUiWithController.ts)
- [Sign and verify any message.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/sign.ts)
- [Transfer all native CKB token.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferAll.ts)
- [Transfer UDT token.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferUdt.ts)
- [Create a DID on CKB.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/createDid.ts)
- [Create a DID with Local ID.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/createDidWithLocalId.ts)
- [Destroy a DID on CKB.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/destroyDid.ts)
- [Transfer a DID on CKB.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferDid.ts)
- [Transfer from a multisig address.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferFromMultisig.ts)
- [Transfer from a multisig address with aggregated transactions.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferFromMultisigAggregateTxs.ts)
- [Transfer to a multisig address.](https://live.ckbccc.com/?src=https://raw.githubusercontent.com/ckb-devrel/ccc/refs/heads/master/packages/examples/src/transferToMultisig.ts)
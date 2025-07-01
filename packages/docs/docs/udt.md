---
sidebar-position: 5
title: UDT
description: UDT(User Defined Tokens) is the customized token created with properties defined by user. 
---

## Fungible Tokens

Unlike [ERC20(Ethereum)](https://eips.ethereum.org/EIPS/eip-20) and [BRC20(Bitcoin)](https://www.brc-20.io/), CKB uses a unique way to build custom tokens based on its UTXO-like Cell Model.

In CKB, custom tokens are called User-Defined Tokens (UDTs). s(Simple)UDT is the standard that defines the most basic implementation of a UDT fungible token on CKB, and CKB's core team has also proposed a minimal but also extensible standard for UDT called xUDT(extensible UDT).

Steps to Issue a Custom Token with sUDT/xUDT:

1. Create a Special Cell: When you issue tokens, you create a special Cell representing a balance of your custom token, similar to how physical cash represents a balance of currency.

2. Configure the Cell's Data: This Cell’s data field will store the token amount, while its Type Script will be the sUDT/xUDT Script. The script’s args field will contain the Lock Script Hash of the issuer.

3. Establish a Unique Token ID: The issuer’s Lock Script hash serves as the unique identifier for each custom token. Different Lock Script hashes represent different tokens, enabling secure and distinct transactions for each token type.

## SSRI-Compliant `UDT` (Advanced)

SSRI-Compliant UDT is an enhanced and the latest version of UDT that implements the SSRI (Script-Sourced Rich Information) protocol. By implementing the public traits `UDT`, SSRI allows UDT scripts to provide rich metadata and additional functionality directly from the script code, such as token name, symbol, icon, and other custom properties, making them more interoperable and user-friendly across different applications and wallets.

On a more abstract level, any Script can be a UDT if it implements the public traits `UDT` as SSRI provides unlimited extensibility.

## `@ckb-ccc/udt`: All-in-one SDK for interactions with `UDT`

@ckb-ccc/udt is a comprehensive SDK that provides a unified interface for interacting seamlessly with both SSRI-compliant UDTs and legacy sUDT and xUDT tokens on CKB. It offers a rich set of features including:

- Querying token metadata (name, symbol, icon, etc.)
- Checking token balances
- Transferring tokens

For detailed API documentation and usage examples, please refer to the [API Reference](https://api.ckbccc.com/).

## Tutorial: Interact UDT Script with `@ckb-ccc/udt`

>The following guide uses UDT and Pausable UDT as example and assume you're using the playground environment which provides the signer. Your signer would be different based on your project setup.

### Example 1: Prepare and Setup a `UDT` instance

1. Create or setup your project with CCC (see guide [here](https://docs.ckbccc.com/index.html#md:quick-start-with-create-ccc-app-recommended))

2. `(Only for SSRI-Compliant Token)` Start up your local SSRI server through docker:

    ```shell
    docker run -p 9090:9090 hanssen0/ckb-ssri-server
    ```

    Note: You can also choose to use the WASM implementation of SSRI Executor instead if you're developing browser based dApps, so you don't need to provide the service yourself.

3. `(Only for SSRI-Compliant Token)` Prepare the `OutPoint` of your SSRI-compliant UDT script. It's recommended to deploy your UDT script with Type ID, and the following way would allow you to get the `OutPoint` programmatically even if the script gets upgraded:

    ```ts
    import { ccc } from "@ckb-ccc/ccc";
    import { signer } from "@ckb-ccc/playground";
    // Note: Your signer would be different based on your project setup.

    const pudtScriptCell = await signer.client.findSingletonCellByType({
        codeHash:"0x00000000000000000000000000000000000000000000000000545950455f4944",
        hashType: "type",
        args: "0xf0bad0541211603bf14946e09ceac920dd7ed4f862f0ffd53d0d477d6e1d0f0b",
    });
    if (!scriptCell) {
        throw new Error("pudt script cell not found");
    }
    ```

4. Prepare the type `Script` object of your UDT. You can provide the code hash yourself by copying from the explorer, or get it programmatically from the `OutPoint` of your UDT script.
    For sUDT, you can get the type `Script` object like this:

    ```ts
    const mySudtType = ccc.Script.from({
        codeHash: "0x5e7a36a77e68eecc013dfa2fe6a23f3b6c344b04005808694ae6dd45eea4cfd5",
        hashType: "type",
        args: "0xabcd..."  // The args of your sUDT
    });
    ```

    For xUDT, you can get it more programmatically:

    ```ts
    const xudtInfo = await signer.client.getKnownScript(ccc.KnownScript.XUdt);
    const myXudtType = ccc.Script.from({
        codeHash: xudtInfo.codeHash,
        hashType: xudtInfo.hashType,
        args: "0xabcd..."  // The args of your xUDT
    })
    ```

    For SSRI-Compliant UDT, you can get it this way even if the Script code gets updated:

    ```ts
    const pudtCodeHash = pudtScriptCell.cellOutput.type?.hash();
    if (!pudtCodeHash) {
      throw new Error("PUDT code hash not found");
    }
    const pudtType = {
      codeHash: pudtCodeHash,
      hashType: "type",
      args: "0x02c93173368ec56f72ec023f63148461b80e7698eddd62cbd9dbe31a13f2b330", // This is just for playground, you should replace it with the args with your SSRI-Compliant UDT 
    };
    ```

5. You have everything ready, now you can create an instance of your UDT and interact with it.

    For sUDT and xUDT, you will create the instance like this, but you can only call with `UDT.transfer` and `UDT.mint`. See how to call them with in the next example.

    ```ts
    const sudtOutPoint = ccc.OutPoint.from({
        txHash: "0xc7813f6a415144643970c2e88e0bb6ca6a8edc5dd7c1022746f628284a9936d5",
        index: 0
    });
    const mySudt = new ccc.udt.Udt(sudtOutPoint, mySudtType);
    ```

    For SSRI-Compliant UDT, you will need to provide the Executor and create your instance like this:

    ```ts
    const executor = new ccc.ssri.ExecutorJsonRpc("http://localhost:9090");
    const pudt = new ccc.udt.Udt(pudtScriptCell.outPoint, pudtType, {
      executor,
    });
    ```

    And then you can interact with your SSRI-Compliant UDT like this:

    ```ts
    const pudtName = await pudt.name();
    const pudtIcon = await pudt.icon();
    console.log(pudtName);
    // {"res":"pudt Token","cellDeps":[]}
    console.log(pudtIcon);
    // {"res":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQ ......
    ```

    The same script might have implemented multiple SSRI traits or sub-traits at the same time, but you can instantiate the same script arbitrarily with different traits as long as the script implemented the traits you want.

    ```ts
    const pudt = new ccc.udt.UdtPausable(pudtScriptCell.outPoint, pudtType, {
      executor,
    });
    const pudtEnumeratePaused = await pudt.enumeratePaused();
    console.log(pudtEnumeratePaused);
    // {"res":["0xb5202efa0f2d250af66f0f571e4b8be8b272572663707a052907f8760112fe35","0xa320a09489791af2e5e1fe84927eda84f71afcbd2c7a65cb419464fe46e75085"],"cellDeps":[{"txHash":"0x98c37eabc1672c4a0a30c0bb284ed49308f0cb58b0d8791f44cca168c973e7da","index":"0"}]}
    ```

### Example 2: Generate and Send a Transaction through @ckb-ccc/udt

1. Some of the methods allows you to generate a transaction object directly while taking care of most of the details for you. You just need to follow the guidance of the docs provided via your IDE.

    For all UDT including the legacy sUDT, xUDT, and SSRI-Compliant UDT, you can `transfer` and `mint` like this:

    ```ts
    const receiverA =
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2jk6pyw9vlnfakx7vp4t5lxg0lzvvsp3c5adflu";

    const { script: lockA } = await ccc.Address.fromString(
      receiverA,
      signer.client
    );

    const sudtTransferTx = (
      await mySudt.transfer(signer, [
          {
          to: lockA,
          amount: 10000,
          },
      ])
    ).res;

    const xudtTransferTx = (
      await myXudt.transfer(signer, [
          {
          to: lockA,
          amount: 10000,
          },
      ])
    ).res;

    const pudtTransferTx = (
      await pudt.transfer(signer, [
        {
          to: lockA,
          amount: 10000,
        },
      ])
    ).res;
    ```

    Many of these methods also allow you to pass in a previous `ccc.TransactionLike` object as the second argument, which allows you for example to transfer multiple UDT cells in a single transaction.

    ```ts
    const receiverB =
      "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz4emgssc6nqj4yv3nfv2sca7g9dzhscgmg28x";
    const { script: lockB } = await ccc.Address.fromString(
      receiverB,
      signer.client
    );
    let combinedTransferTx = (
      await pudt.transfer(
        signer,
        [
          {
            to: lockB,
            amount: 20000,
          },
        ],
        pudtTransferTx
      )
    ).res;
    ```

2. You only need to complete the inputs of the transaction just like processing any other transactions with CCC.

    ```ts
    // Note: You need to connect your wallet for the following parts. You also need to have enough balance of pudt in your wallet.
    combinedTransferTx = await pudt.completeBy(combinedTransferTx, signer);
    await combinedTransferTx.completeFeeBy(signer);
    await render(combinedTransferTx);
    const combinedTransferTxHash = await signer.sendTransaction(combinedTransferTx);

    console.log(combinedTransferTxHash);
    ```

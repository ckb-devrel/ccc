<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/master/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  @ckb-ccc/co-build
</h1>

<p align="center">
  CCC - CKBers' Codebase is a one-stop solution for your CKB JS/TS ecosystem development.
</p>

## Overview

`@ckb-ccc/co-build` provides tools and Molecule codecs to support the CKB Co-build Protocol, a standard for coordinating multi-party signers and complex script operations (such as Spore actions) within a single transaction.

## Quick Example

```typescript
import { ccc } from "@ckb-ccc/core";
import { CoBuild, ScriptInfo } from "@ckb-ccc/co-build";

const coBuild = new CoBuild(
  {
    codeHash: "0x...",
    hashType: "type",
    args: "0x...",
  },
  {
    name: "MyScript",
    url: "https://example.com",
    schema: "MySchema",
    messageType: "MyMessageType",
  },
);

// Build action
const action = coBuild.buildAction(ccc.bytesFrom("action payload"));

// Append to transaction
const { tx } = await coBuild.appendActions(transaction, action);
```

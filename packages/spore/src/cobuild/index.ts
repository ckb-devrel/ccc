import { ccc } from "@ckb-ccc/core";
import { UnpackResult } from "@ckb-ccc/codec";
import {
  Action,
  ActionVec,
  SporeAction,
  WitnessLayout,
} from "../codec/index.js";
import { DEFAULT_COBUILD_INFO_HASH } from "../predefined/index.js";

export function assembleCreateSporeAction(
  sporeOutput: ccc.CellOutputLike,
  sporeData: ccc.BytesLike,
  scriptInfoHash: ccc.HexLike = DEFAULT_COBUILD_INFO_HASH,
): UnpackResult<typeof Action> {
  if (!sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "CreateSpore",
    value: {
      sporeId: sporeType.args,
      dataHash: ccc.hashCkb(sporeData),
      to: {
        type: "Script",
        value: ccc.Script.from(sporeOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: ccc.hexFrom(scriptInfoHash),
    scriptHash: sporeTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleTransferSporeAction(
  sporeInput: ccc.CellOutputLike,
  sporeOutput: ccc.CellOutputLike,
  scriptInfoHash: ccc.HexLike = DEFAULT_COBUILD_INFO_HASH,
): UnpackResult<typeof Action> {
  if (!sporeInput.type || !sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }

  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "TransferSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(sporeInput.lock),
      },
      to: {
        type: "Script",
        value: ccc.Script.from(sporeOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: ccc.hexFrom(scriptInfoHash),
    scriptHash: sporeTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleMeltSporeAction(
  sporeInput: ccc.CellOutputLike,
  scriptInfoHash: ccc.HexLike = DEFAULT_COBUILD_INFO_HASH,
): UnpackResult<typeof Action> {
  if (!sporeInput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeInput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "MeltSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(sporeInput.lock),
      },
    },
  });
  return {
    scriptInfoHash: ccc.hexFrom(scriptInfoHash),
    scriptHash: sporeTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleCreateClusterAction(
  clusterOutput: ccc.CellOutputLike,
  clusterData: ccc.BytesLike,
  scriptInfoHash: ccc.HexLike = DEFAULT_COBUILD_INFO_HASH,
): UnpackResult<typeof Action> {
  if (!clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "CreateCluster",
    value: {
      clusterId: clusterType.args,
      dataHash: ccc.hashCkb(clusterData),
      to: {
        type: "Script",
        value: ccc.Script.from(clusterOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: ccc.hexFrom(scriptInfoHash),
    scriptHash: clusterTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export function assembleTransferClusterAction(
  clusterInput: ccc.CellOutputLike,
  clusterOutput: ccc.CellOutputLike,
  scriptInfoHash: ccc.HexLike = DEFAULT_COBUILD_INFO_HASH,
): UnpackResult<typeof Action> {
  if (!clusterInput.type || !clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "TransferCluster",
    value: {
      clusterId: clusterType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(clusterInput.lock),
      },
      to: {
        type: "Script",
        value: ccc.Script.from(clusterOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: ccc.hexFrom(scriptInfoHash),
    scriptHash: clusterTypeHash,
    data: ccc.hexFrom(actionData),
  };
}

export async function prepareSporeTransaction(
  signer: ccc.Signer,
  txLike: ccc.TransactionLike,
  actions: UnpackResult<typeof ActionVec>,
): Promise<ccc.Transaction> {
  let tx = ccc.Transaction.from(txLike);

  if (actions.length === 0) {
    return signer.prepareTransaction(tx);
  }

  const existedActions = extractCobuildActionsFromTx(tx);
  tx = await signer.prepareTransaction(tx);
  injectCobuild(tx, [...existedActions, ...actions]);
  return tx;
}

export function unpackCommonCobuildProof(
  data: ccc.HexLike,
): UnpackResult<typeof WitnessLayout> | undefined {
  try {
    return WitnessLayout.unpack(ccc.bytesFrom(data));
  } catch {
    return;
  }
}

export function extractCobuildActionsFromTx(
  tx: ccc.Transaction,
): UnpackResult<typeof ActionVec> {
  if (tx.witnesses.length === 0) {
    return [];
  }
  const witnessLayout = unpackCommonCobuildProof(
    tx.witnesses[tx.witnesses.length - 1],
  );
  if (!witnessLayout) {
    return [];
  }
  if (witnessLayout.type !== "SighashAll") {
    throw new Error("Invalid cobuild proof type: " + witnessLayout.type);
  }

  // Remove existed cobuild witness
  tx.witnesses.pop();
  return witnessLayout.value.message.actions;
}

export function injectCobuild(
  tx: ccc.Transaction,
  actions: UnpackResult<typeof ActionVec>,
): void {
  const witnessLayout = ccc.hexFrom(
    WitnessLayout.pack({
      type: "SighashAll",
      value: {
        seal: "0x",
        message: {
          actions,
        },
      },
    }),
  );
  tx.witnesses.push(ccc.hexFrom(witnessLayout));
}

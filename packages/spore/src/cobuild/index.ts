import { ccc, mol } from "@ckb-ccc/core";
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
): mol.EncodableType<typeof Action> {
  if (!sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.encode({
    type: "CreateSpore",
    value: {
      sporeId: sporeType.args,
      to: {
        type: "Script",
        value: sporeOutput.lock,
      },
      dataHash: ccc.hashCkb(sporeData),
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
): mol.EncodableType<typeof Action> {
  if (!sporeInput.type || !sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }

  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.encode({
    type: "TransferSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: sporeInput.lock,
      },
      to: {
        type: "Script",
        value: sporeOutput.lock,
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
): mol.EncodableType<typeof Action> {
  if (!sporeInput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeInput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.encode({
    type: "MeltSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: sporeInput.lock,
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
): mol.EncodableType<typeof Action> {
  if (!clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.encode({
    type: "CreateCluster",
    value: {
      clusterId: clusterType.args,
      to: {
        type: "Script",
        value: clusterOutput.lock,
      },
      dataHash: ccc.hashCkb(clusterData),
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
): mol.EncodableType<typeof Action> {
  if (!clusterInput.type || !clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.encode({
    type: "TransferCluster",
    value: {
      clusterId: clusterType.args,
      from: {
        type: "Script",
        value: clusterInput.lock,
      },
      to: {
        type: "Script",
        value: clusterOutput.lock,
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
  actions: mol.EncodableType<typeof ActionVec>,
): Promise<ccc.Transaction> {
  let tx = ccc.Transaction.from(txLike);

  if (actions.length === 0) {
    return signer.prepareTransaction(tx);
  }

  const existedActions = extractCobuildActionsFromTx(tx);
  tx = await signer.prepareTransaction(tx);
  injectCobuild(tx, [existedActions, actions].flat());
  return tx;
}

export function unpackCommonCobuildProof(
  data: ccc.HexLike,
): mol.EncodableType<typeof WitnessLayout> | undefined {
  try {
    return WitnessLayout.decode(ccc.bytesFrom(data));
  } catch {
    return;
  }
}

export function extractCobuildActionsFromTx(
  tx: ccc.Transaction,
): mol.EncodableType<typeof ActionVec> {
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
    throw new Error("Invalid cobuild proof type: SighashAll");
  }

  // Remove existed cobuild witness
  tx.witnesses.pop();
  return witnessLayout.value.message.actions;
}

export function injectCobuild(
  tx: ccc.Transaction,
  actions: mol.EncodableType<typeof ActionVec>,
): void {
  tx.setWitnessAt(
    Math.max(tx.witnesses.length, tx.inputs.length),
    WitnessLayout.encode({
      type: "SighashAll",
      value: {
        seal: "0x",
        message: {
          actions,
        },
      },
    }),
  );
}

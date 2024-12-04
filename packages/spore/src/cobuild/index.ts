import { ccc } from "@ckb-ccc/core";
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
): ccc.molecule.EncodableType<typeof Action> {
  if (!sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.encode({
    CreateSpore: {
      sporeId: sporeType.args,
      to: {
        Script: ccc.Script.from(sporeOutput.lock),
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
): ccc.molecule.EncodableType<typeof Action> {
  if (!sporeInput.type || !sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }

  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.encode({
    TransferSpore: {
      sporeId: sporeType.args,
      from: {
        Script: ccc.Script.from(sporeInput.lock),
      },
      to: {
        Script: ccc.Script.from(sporeOutput.lock),
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
): ccc.molecule.EncodableType<typeof Action> {
  if (!sporeInput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeInput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.encode({
    MeltSpore: {
      sporeId: sporeType.args,
      from: {
        Script: ccc.Script.from(sporeInput.lock),
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
): ccc.molecule.EncodableType<typeof Action> {
  if (!clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.encode({
    CreateCluster: {
      clusterId: clusterType.args,
      to: {
        Script: ccc.Script.from(clusterOutput.lock),
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
): ccc.molecule.EncodableType<typeof Action> {
  if (!clusterInput.type || !clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.encode({
    TransferCluster: {
      clusterId: clusterType.args,
      from: {
        Script: ccc.Script.from(clusterInput.lock),
      },
      to: {
        Script: ccc.Script.from(clusterOutput.lock),
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
  actions: ccc.molecule.EncodableType<typeof ActionVec>,
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
): ccc.molecule.EncodableType<typeof WitnessLayout> | undefined {
  try {
    return WitnessLayout.decode(ccc.bytesFrom(data));
  } catch {
    return;
  }
}

export function extractCobuildActionsFromTx(
  tx: ccc.Transaction,
): ccc.molecule.EncodableType<typeof ActionVec> {
  if (tx.witnesses.length === 0) {
    return [];
  }
  const witnessLayout = unpackCommonCobuildProof(
    tx.witnesses[tx.witnesses.length - 1],
  );
  if (!witnessLayout) {
    return [];
  }
  if (witnessLayout.SighashAll === undefined) {
    throw new Error("Invalid cobuild proof type: SighashAll");
  }

  // Remove existed cobuild witness
  tx.witnesses.pop();
  return witnessLayout.SighashAll.message.actions;
}

export function injectCobuild(
  tx: ccc.Transaction,
  actions: ccc.molecule.EncodableType<typeof ActionVec>,
): void {
  const witnessLayout = ccc.hexFrom(
    WitnessLayout.encode({
      SighashAll: {
        seal: "0x",
        message: {
          actions,
        },
      },
    }),
  );
  tx.witnesses.push(ccc.hexFrom(witnessLayout));
}

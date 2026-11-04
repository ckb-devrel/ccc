import { ccc } from "@ckb-ccc/core";
import {
  Action,
  ActionVec,
  Address,
  SporeAction,
  WitnessLayout,
} from "../codec/index.js";
import { DEFAULT_COBUILD_INFO_HASH } from "../predefined/index.js";

export function assembleCreateSporeAction(
  sporeOutput: ccc.CellOutputLike,
  sporeData: ccc.BytesLike,
  scriptInfoHash: ccc.HexLike = DEFAULT_COBUILD_INFO_HASH,
): ccc.EncodableType<typeof Action> {
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
): ccc.EncodableType<typeof Action> {
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
): ccc.EncodableType<typeof Action> {
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
): ccc.EncodableType<typeof Action> {
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
): ccc.EncodableType<typeof Action> {
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
  actions: ccc.EncodableType<typeof ActionVec>,
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
): ccc.DecodedType<typeof WitnessLayout> | undefined {
  try {
    return WitnessLayout.decode(ccc.bytesFrom(data));
  } catch {
    return;
  }
}

export function extractCobuildActionsFromTx(
  tx: ccc.Transaction,
): ccc.DecodedType<typeof ActionVec> {
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
  actions: ccc.EncodableType<typeof ActionVec>,
): void {
  tx.setWitness(
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

/**
 * Verify the CoBuild Actions attached to a transaction against its actual
 * cell transitions.
 *
 * Since spore-contract#76, Spore/Cluster/Proxy/Agent type scripts accept
 * transactions without Actions, and an attached Action is intent metadata
 * that the scripts do not authenticate. Builders and wallets must call
 * this (or equivalent logic) before trusting or displaying an intent.
 *
 * For every action whose script hash matches a Spore-protocol type script
 * in the transaction, the declared IDs, owners and data hashes are
 * compared against the resolved cells; misleading or duplicate actions
 * throw. Actions of other protocols are passed through unchecked, and a
 * transaction without a CoBuild witness simply returns no actions.
 *
 * Cross-cell references that live outside the transaction (a Cluster
 * Agent's referenced Proxy ID, for example) cannot be verified here and
 * are skipped.
 *
 * @returns the verified actions
 */
export async function checkSporeIntent(params: {
  client: ccc.Client;
  tx: ccc.TransactionLike;
}): Promise<ccc.DecodedType<typeof ActionVec>> {
  const { client } = params;
  const tx = ccc.Transaction.from(params.tx);

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
  const actions = witnessLayout.value.message.actions;

  // Index every typed cell transition of the transaction by type hash.
  // A type script hash includes its args, so each Spore-family cell has
  // its own entry.
  interface TransitionSide {
    lock: ccc.Script;
    args: ccc.Hex;
    data: ccc.Hex;
  }
  interface Transition {
    input?: TransitionSide;
    output?: TransitionSide;
  }
  const transitions = new Map<ccc.Hex, Transition>();

  for (const input of tx.inputs) {
    const cell = await client.getCell(input.previousOutput);
    if (!cell || !cell.cellOutput.type) {
      continue;
    }
    const type = ccc.Script.from(cell.cellOutput.type);
    const transition = transitions.get(type.hash()) ?? {};
    transition.input = {
      lock: ccc.Script.from(cell.cellOutput.lock),
      args: type.args,
      data: cell.outputData,
    };
    transitions.set(type.hash(), transition);
  }

  tx.outputs.forEach((output, i) => {
    if (!output.type) {
      return;
    }
    const type = ccc.Script.from(output.type);
    const transition = transitions.get(type.hash()) ?? {};
    transition.output = {
      lock: ccc.Script.from(output.lock),
      args: type.args,
      data: tx.outputsData[i] ?? "0x",
    };
    transitions.set(type.hash(), transition);
  });

  const isAddress = (
    address: ccc.DecodedType<typeof Address>,
    lock: ccc.Script,
  ) => address.type === "Script" && ccc.Script.from(address.value).eq(lock);

  const seen = new Set<string>();
  for (const action of actions) {
    const transition = transitions.get(action.scriptHash);
    if (!transition) {
      continue; // not a Spore-protocol transition of this transaction
    }

    const sporeAction = SporeAction.decode(ccc.bytesFrom(action.data));
    const key = `${action.scriptHash}:${sporeAction.type}`;
    if (seen.has(key)) {
      throw new Error(`Duplicated CoBuild action: ${key}`);
    }
    seen.add(key);

    const mustBe = (condition: boolean, what: string) => {
      if (!condition) {
        throw new Error(`Misleading CoBuild intent: ${what}`);
      }
    };

    switch (sporeAction.type) {
      case "CreateSpore": {
        const { sporeId, to, dataHash } = sporeAction.value;
        mustBe(transition.output !== undefined, "CreateSpore without output");
        mustBe(transition.input === undefined, "CreateSpore over a spent cell");
        mustBe(transition.output!.args === sporeId, "CreateSpore ID mismatch");
        mustBe(
          isAddress(to, transition.output!.lock),
          "CreateSpore to mismatch",
        );
        mustBe(
          ccc.hashCkb(ccc.bytesFrom(transition.output!.data)) === dataHash,
          "CreateSpore data hash mismatch",
        );
        break;
      }
      case "TransferSpore": {
        const { sporeId, from, to } = sporeAction.value;
        mustBe(
          transition.input !== undefined && transition.output !== undefined,
          "TransferSpore requires both input and output",
        );
        mustBe(
          transition.output!.args === sporeId,
          "TransferSpore ID mismatch",
        );
        mustBe(
          isAddress(from, transition.input!.lock),
          "TransferSpore from mismatch",
        );
        mustBe(
          isAddress(to, transition.output!.lock),
          "TransferSpore to mismatch",
        );
        break;
      }
      case "MeltSpore": {
        const { sporeId, from } = sporeAction.value;
        mustBe(transition.input !== undefined, "MeltSpore without input");
        mustBe(transition.output === undefined, "MeltSpore over a kept cell");
        mustBe(transition.input!.args === sporeId, "MeltSpore ID mismatch");
        mustBe(
          isAddress(from, transition.input!.lock),
          "MeltSpore from mismatch",
        );
        break;
      }
      case "CreateCluster": {
        const { clusterId, to, dataHash } = sporeAction.value;
        mustBe(transition.output !== undefined, "CreateCluster without output");
        mustBe(
          transition.input === undefined,
          "CreateCluster over a spent cell",
        );
        mustBe(
          transition.output!.args === clusterId,
          "CreateCluster ID mismatch",
        );
        mustBe(
          isAddress(to, transition.output!.lock),
          "CreateCluster to mismatch",
        );
        mustBe(
          ccc.hashCkb(ccc.bytesFrom(transition.output!.data)) === dataHash,
          "CreateCluster data hash mismatch",
        );
        break;
      }
      case "TransferCluster": {
        const { clusterId, from, to } = sporeAction.value;
        mustBe(
          transition.input !== undefined && transition.output !== undefined,
          "TransferCluster requires both input and output",
        );
        mustBe(
          transition.output!.args === clusterId,
          "TransferCluster ID mismatch",
        );
        mustBe(
          isAddress(from, transition.input!.lock),
          "TransferCluster from mismatch",
        );
        mustBe(
          isAddress(to, transition.output!.lock),
          "TransferCluster to mismatch",
        );
        break;
      }
      case "CreateClusterProxy":
      case "TransferClusterProxy":
      case "MeltClusterProxy": {
        const { clusterId, clusterProxyId } = sporeAction.value;
        const sides: ("input" | "output")[] =
          sporeAction.type === "MeltClusterProxy"
            ? ["input"]
            : sporeAction.type === "CreateClusterProxy"
              ? ["output"]
              : ["input", "output"];
        for (const side of sides) {
          mustBe(
            transition[side] !== undefined,
            `${sporeAction.type} without ${side}`,
          );
          const cell = transition[side]!;
          mustBe(
            cell.args === clusterProxyId,
            `${sporeAction.type} proxy ID mismatch`,
          );
          mustBe(
            ccc.bytesFrom(cell.data).length === 32 &&
              ccc.hexFrom(ccc.bytesFrom(cell.data)) === clusterId,
            `${sporeAction.type} cluster ID mismatch`,
          );
        }
        if (sporeAction.type === "CreateClusterProxy") {
          mustBe(
            transition.input === undefined,
            "CreateClusterProxy over a spent cell",
          );
        }
        if (sporeAction.type === "MeltClusterProxy") {
          mustBe(
            transition.output === undefined,
            "MeltClusterProxy over a kept cell",
          );
        }
        break;
      }
      case "CreateClusterAgent":
      case "TransferClusterAgent":
      case "MeltClusterAgent": {
        const { clusterId } = sporeAction.value;
        const side =
          sporeAction.type === "MeltClusterAgent" ? "input" : "output";
        mustBe(
          transition[side] !== undefined,
          `${sporeAction.type} without ${side}`,
        );
        mustBe(
          transition[side]!.args === clusterId,
          `${sporeAction.type} cluster ID mismatch`,
        );
        if (sporeAction.type === "CreateClusterAgent") {
          mustBe(
            transition.input === undefined,
            "CreateClusterAgent over a spent cell",
          );
        }
        if (sporeAction.type === "MeltClusterAgent") {
          mustBe(
            transition.output === undefined,
            "MeltClusterAgent over a kept cell",
          );
        }
        // The referenced Proxy ID lives in a cell dependency outside the
        // transaction and cannot be verified here.
        break;
      }
    }
  }

  return actions;
}

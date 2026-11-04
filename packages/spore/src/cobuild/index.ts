import { ccc, mol } from "@ckb-ccc/core";
import {
  Action,
  ActionVec,
  SporeAction,
  WitnessLayout,
  WitnessLayoutFieldTags,
} from "../codec/index.js";
import {
  DEFAULT_COBUILD_INFO_HASH,
  SporeScriptInfoLike,
  getClusterScriptInfos,
  getSporeScriptInfos,
} from "../predefined/index.js";

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

  const existedActions = extractCobuildActionsFromTx(tx);
  tx = await signer.prepareTransaction(tx);
  const combined = [...existedActions, ...actions];
  if (combined.length !== 0) {
    injectCobuild(tx, combined);
  }
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

function findCobuildMessage(tx: ccc.Transaction) {
  let message:
    { index: number; actions: ccc.DecodedType<typeof ActionVec> } | undefined;
  const tags: number[] = Object.values(WitnessLayoutFieldTags);
  for (const [index, witness] of tx.witnesses.entries()) {
    const bytes = ccc.bytesFrom(witness);
    if (
      bytes.length < 4 ||
      !tags.includes(Number(ccc.numFromBytes(bytes.slice(0, 4))))
    ) {
      continue; // ordinary Lock witnesses are not CoBuild Messages
    }
    let layout: ccc.DecodedType<typeof WitnessLayout>;
    try {
      layout = WitnessLayout.decode(bytes);
    } catch {
      throw new Error(`Malformed CoBuild witness at index ${index}`);
    }
    if (layout.type === "SighashAllOnly") {
      continue;
    }
    if (layout.type !== "SighashAll") {
      throw new Error(`Unsupported CoBuild witness at index ${index}`);
    }
    if (message !== undefined) {
      throw new Error("Duplicated CoBuild Message");
    }
    message = { index, actions: layout.value.message.actions };
  }
  return message;
}

export function extractCobuildActionsFromTx(
  tx: ccc.Transaction,
): ccc.DecodedType<typeof ActionVec> {
  const message = findCobuildMessage(tx);
  if (!message) {
    return [];
  }
  if (message.index < tx.inputs.length) {
    // Inputs may have been appended since this Message was injected. Keep all
    // other input witnesses at their original positions while preparing Locks.
    tx.witnesses[message.index] = "0x";
  } else {
    tx.witnesses.splice(message.index, 1);
  }
  return message.actions;
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

export type SporeIntentCategory =
  "Spore" | "Cluster" | "ClusterProxy" | "ClusterAgent";

/** Reviewed deployment identities, grouped by their actual contract category. */
export type SporeIntentScripts = Partial<
  Record<SporeIntentCategory, SporeScriptInfoLike[]>
>;

/**
 * Check optional intent before displaying it or signing the final transaction.
 * Returns only verified Spore-family Actions; foreign Actions remain untouched
 * in the transaction and are excluded from this result, not authenticated.
 *
 * Existing Spore/Cluster presets are recognized. Supply reviewed `scripts` for
 * custom v3, Proxy and Agent deployments, and `scriptInfoHashes` for custom
 * metadata schemas. These are caller trust anchors, not deployment attestation.
 * Owner fields, operation shape, IDs, immutable transfer data and creation data
 * hashes must match resolved cells. Agent creation also resolves its Proxy from
 * code dependencies (including depGroups). Missing cells, ambiguous categories,
 * duplicate Messages/Actions and misleading known-family metadata fail closed.
 *
 * No Message means no verified Actions, not certification of the transaction's
 * complete effects. Callers must still display the actual cell changes and
 * apply their wallet policy. This function does not verify signatures or fees.
 */
export async function checkSporeIntent(params: {
  client: ccc.Client;
  tx: ccc.TransactionLike;
  scripts?: SporeIntentScripts;
  scriptInfoHashes?: ccc.HexLike[];
}): Promise<ccc.DecodedType<typeof ActionVec>> {
  const { client } = params;
  const tx = ccc.Transaction.from(params.tx);
  const actions = findCobuildMessage(tx)?.actions;
  if (actions === undefined || actions.length === 0) {
    return [];
  }

  // Ignore args when recognizing deployments, but bind both codeHash/hashType.
  const identity = (script: Pick<ccc.ScriptLike, "codeHash" | "hashType">) =>
    ccc.Script.from({ ...script, args: "0x" }).hash();
  const deployments = new Map<ccc.Hex, SporeIntentCategory>();
  const defaults: SporeIntentScripts = {
    Spore: Object.values(getSporeScriptInfos(client)).filter(
      (s) => s !== undefined,
    ),
    Cluster: Object.values(getClusterScriptInfos(client)).filter(
      (s) => s !== undefined,
    ),
  };
  for (const category of [
    "Spore",
    "Cluster",
    "ClusterProxy",
    "ClusterAgent",
  ] as const) {
    for (const script of [
      ...(defaults[category] ?? []),
      ...(params.scripts?.[category] ?? []),
    ]) {
      const key = identity(script);
      const previous = deployments.get(key);
      if (previous !== undefined && previous !== category) {
        throw new Error("Ambiguous Spore intent deployment category");
      }
      deployments.set(key, category);
    }
  }
  const infoHashes = new Set(
    (params.scriptInfoHashes ?? [DEFAULT_COBUILD_INFO_HASH]).map((hash) => {
      const hex = ccc.hexFrom(hash);
      if (ccc.bytesFrom(hex).length !== 32) {
        throw new Error("Spore script info hash must be 32 bytes");
      }
      return hex;
    }),
  );
  interface Side {
    type: ccc.Script;
    lock: ccc.Script;
    data: ccc.Hex;
  }
  interface Transition {
    category: SporeIntentCategory;
    input?: Side;
    output?: Side;
  }
  const transitions = new Map<ccc.Hex, Transition>();
  const add = (
    side: "input" | "output",
    output: ccc.CellOutput,
    data: ccc.Hex,
  ) => {
    const type = output.type;
    if (!type) {
      return;
    }
    const category = deployments.get(identity(type));
    if (!category) {
      return;
    }
    const key = type.hash();
    const transition = transitions.get(key) ?? { category };
    if (transition[side]) {
      throw new Error(`Multiple Spore ${side} cells for ${key}`);
    }
    const length = ccc.bytesFrom(type.args).length;
    if (
      category === "ClusterProxy"
        ? length !== 32 && length !== 40
        : category === "ClusterAgent"
          ? length !== 32
          : length < 32
    ) {
      throw new Error(`Invalid ${category} ID length`);
    }
    transition[side] = { type, lock: output.lock, data };
    transitions.set(key, transition);
  };
  for (const [index, input] of tx.inputs.entries()) {
    const cell = await client.getCell(input.previousOutput);
    if (!cell) {
      throw new Error(`Input cell not found at index ${index}`);
    }
    add("input", cell.cellOutput, cell.outputData);
  }
  for (const [index, output] of tx.outputs.entries()) {
    if (tx.outputsData[index] === undefined) {
      throw new Error(`Output data not found at index ${index}`);
    }
    add("output", output, tx.outputsData[index]);
  }

  // Lazy resolution: only Agent creation needs another cell's declared ID.
  let dependencies: ccc.Cell[] | undefined;
  const resolveDependencies = async () => {
    if (dependencies) {
      return dependencies;
    }
    const cells: ccc.Cell[] = [];
    for (const dep of tx.cellDeps) {
      const cell = await client.getCell(dep.outPoint);
      if (!cell) {
        throw new Error("Intent dependency cell not found");
      }
      if (dep.depType === "code") {
        cells.push(cell);
      } else {
        for (const outPoint of mol
          .vector(ccc.OutPoint)
          .decode(cell.outputData)) {
          const member = await client.getCell(outPoint);
          if (!member) {
            throw new Error("Intent depGroup member not found");
          }
          cells.push(member);
        }
      }
    }
    dependencies = cells;
    return cells;
  };
  const mustBe = (condition: boolean, what: string) => {
    if (!condition) {
      throw new Error(`Misleading CoBuild intent: ${what}`);
    }
  };
  const seen = new Set<ccc.Hex>();
  const verified: ccc.DecodedType<typeof ActionVec> = [];
  for (const action of actions) {
    const transition = transitions.get(action.scriptHash);
    const knownInfo = infoHashes.has(action.scriptInfoHash);
    if (!transition && !knownInfo) {
      continue;
    } // foreign, excluded from verified result
    mustBe(
      transition !== undefined,
      "Unrecognized Spore deployment or script hash",
    );
    mustBe(knownInfo, "Unrecognized Spore script info hash");
    if (seen.has(action.scriptHash)) {
      throw new Error("Duplicated CoBuild action");
    }
    seen.add(action.scriptHash);
    const decoded = SporeAction.decode(action.data);
    const { type: kind, value } = decoded;
    const category = kind.replace(/^(Create|Transfer|Melt)/, "");
    mustBe(
      category === transition!.category,
      `${kind} deployment category mismatch`,
    );
    const { input, output } = transition!;
    if (kind.startsWith("Create")) {
      mustBe(!input && !!output, `${kind} requires output without input`);
    } else if (kind.startsWith("Transfer")) {
      mustBe(!!input && !!output, `${kind} requires both input and output`);
      mustBe(input!.data === output!.data, `${kind} modifies immutable data`);
    } else {
      mustBe(
        !!input && !output,
        `${kind} requires input without output (over a kept cell)`,
      );
    }
    const side = output ?? input!;
    const id = ccc.hexFrom(ccc.bytesFrom(side.type.args).slice(0, 32));
    const declaredId =
      "sporeId" in value
        ? value.sporeId
        : category === "ClusterProxy" && "clusterProxyId" in value
          ? value.clusterProxyId
          : value.clusterId;
    mustBe(id === declaredId, `${kind} ID mismatch`);
    if ("from" in value) {
      mustBe(
        value.from.type === "Script" &&
          ccc.Script.from(value.from.value).eq(input!.lock),
        `${kind} from mismatch`,
      );
    }
    if ("to" in value) {
      mustBe(
        value.to.type === "Script" &&
          ccc.Script.from(value.to.value).eq(output!.lock),
        `${kind} to mismatch`,
      );
    }
    if ("dataHash" in value) {
      mustBe(
        ccc.hashCkb(output!.data) === value.dataHash,
        `${kind} data hash mismatch`,
      );
    }
    if (category === "ClusterProxy" && "clusterId" in value) {
      mustBe(side.data === value.clusterId, `${kind} cluster ID mismatch`);
    }
    if (category === "ClusterAgent") {
      mustBe(
        ccc.bytesFrom(side.data).length === 32,
        `${kind} invalid Proxy type hash`,
      );
      if (decoded.type === "CreateClusterAgent") {
        const proxy = (await resolveDependencies()).find(
          (cell) => cell.cellOutput.type?.hash() === side.data,
        );
        mustBe(!!proxy?.cellOutput.type, `${kind} Proxy dependency missing`);
        const proxyType = proxy!.cellOutput.type!;
        mustBe(
          deployments.get(identity(proxyType)) === "ClusterProxy",
          `${kind} unrecognized Proxy deployment`,
        );
        const args = ccc.bytesFrom(proxyType.args);
        mustBe(
          args.length === 32 || args.length === 40,
          `${kind} invalid Proxy args`,
        );
        mustBe(
          ccc.hexFrom(args.slice(0, 32)) === decoded.value.clusterProxyId,
          `${kind} Proxy ID mismatch`,
        );
        mustBe(
          proxy!.outputData === decoded.value.clusterId,
          `${kind} Proxy cluster mismatch`,
        );
      }
    }
    verified.push(action);
  }
  return verified;
}

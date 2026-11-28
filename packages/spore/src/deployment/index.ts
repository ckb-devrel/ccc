import { ccc, mol } from "@ckb-ccc/core";
import {
  SporeCodePolicy,
  SporeScriptInfo,
  SporeScriptInfoLike,
} from "../predefined/index.js";

const TYPE_ID_CODE_HASH =
  "0x00000000000000000000000000000000000000000000000000545950455f4944";

export type SporeCodeDeploymentLike = {
  /** Standard Type ID args of the code Cell, not the NFT's asset ID. */
  typeId: ccc.HexLike;
  /** Initial location; CCC resolves successors through the standard Type ID. */
  cellDep: ccc.CellDepLike;
  /** Reviewed code-Cell Lock. Its script implements the upgrade policy. */
  governanceLock: ccc.ScriptLike;
  /** Optional binary pin. Omission follows upgrades authorized by the Lock. */
  expectedDataHash?: ccc.HexLike;
  cobuild?: boolean;
};

export type SporeCodeDeployment = SporeCodePolicy & {
  scriptInfo: SporeScriptInfo;
};

function byte32(value: ccc.HexLike, name: string): ccc.Hex {
  const normalized = ccc.hexFrom(value);
  if (ccc.bytesFrom(normalized).length !== 32) {
    throw new Error(`${name} must be 32 bytes`);
  }
  return normalized;
}

/**
 * Bind v3 code to its standard Type ID and a reviewed governance Lock.
 * Frozen, multisig, timelock and custom policies use their actual Lock scripts;
 * a policy name is not treated as evidence of authorization or immutability.
 * Type-bound native execution requires a Meepo-active chain (VM2).
 */
export function createSporeCodeDeployment(
  deployment: SporeCodeDeploymentLike,
): SporeCodeDeployment {
  const codeType = ccc.Script.from({
    codeHash: TYPE_ID_CODE_HASH,
    hashType: "type",
    args: byte32(deployment.typeId, "Code Type ID"),
  });
  const cellDep = ccc.CellDep.from(deployment.cellDep).clone();
  if (cellDep.depType !== "code") {
    throw new Error("Type-bound code deployment requires a code CellDep");
  }
  const codePolicy = {
    codeType,
    governanceLock: ccc.Script.from(deployment.governanceLock).clone(),
    expectedDataHash:
      deployment.expectedDataHash === undefined
        ? undefined
        : byte32(deployment.expectedDataHash, "Expected code data hash"),
  };
  return {
    ...codePolicy,
    scriptInfo: SporeScriptInfo.from({
      codeHash: codeType.hash(),
      hashType: "type",
      cellDeps: [{ cellDep, type: codeType.clone() }],
      cobuild: deployment.cobuild,
      codePolicy,
    }),
  };
}

/**
 * Resolve the live code Cell and compare its identity, current governance Lock
 * and optional binary pin with the reviewed deployment. A Lock rotation needs
 * an updated reviewed descriptor. This does not audit the Lock's semantics.
 */
export async function resolveSporeCodeDeployment(
  client: ccc.Client,
  deployment: SporeCodeDeployment,
): Promise<ccc.Cell> {
  return resolveReviewedCodeCell(client, deployment.scriptInfo, deployment);
}

async function resolveReviewedCodeCell(
  client: ccc.Client,
  scriptInfo: SporeScriptInfoLike,
  policy: SporeCodePolicy,
): Promise<ccc.Cell> {
  const { codeType, governanceLock, expectedDataHash } = policy;
  if (
    codeType.codeHash !== TYPE_ID_CODE_HASH ||
    codeType.hashType !== "type" ||
    ccc.bytesFrom(codeType.args).length !== 32 ||
    ccc.hashTypeFrom(scriptInfo.hashType) !== "type" ||
    ccc.hexFrom(scriptInfo.codeHash) !== codeType.hash()
  ) {
    throw new Error("Inconsistent standard Type ID deployment binding");
  }
  let foundSpentCandidate = false;
  for await (const indexed of client.findCellsByType(codeType, false)) {
    if (!indexed.cellOutput.type?.eq(codeType)) {
      throw new Error("Type-bound code Cell identity mismatch");
    }
    // The search yields cached cells before indexed cells. A spent predecessor
    // must not prevent reaching the live successor.
    const cell = await client.getCellLive(indexed.outPoint, true, true);
    if (!cell) {
      foundSpentCandidate = true;
      continue;
    }
    if (
      !cell.outPoint.eq(indexed.outPoint) ||
      !cell.cellOutput.type?.eq(codeType)
    ) {
      throw new Error("Live code Cell identity mismatch");
    }
    if (!cell.cellOutput.lock.eq(governanceLock)) {
      throw new Error(
        "Code Cell governance Lock differs from the reviewed policy",
      );
    }
    if (
      expectedDataHash !== undefined &&
      ccc.hashCkb(cell.outputData) !== expectedDataHash
    ) {
      throw new Error("Code Cell data differs from the reviewed binary pin");
    }
    return cell;
  }
  throw new Error(
    foundSpentCandidate
      ? "Indexed code Cell is no longer live. Refresh deployment dependencies"
      : "Type-bound code Cell not found",
  );
}

/** Bind exactly the reviewed live executable Cell when preparing a transaction. */
export async function addSporeCodeCellDeps(
  tx: ccc.Transaction,
  client: ccc.Client,
  scriptInfo: SporeScriptInfoLike,
): Promise<void> {
  const { codePolicy } = scriptInfo;
  if (!codePolicy) {
    await tx.addCellDepInfos(client, scriptInfo.cellDeps);
    return;
  }

  const dependencies = scriptInfo.cellDeps.map((dep) =>
    ccc.CellDepInfo.from(dep),
  );
  const executable = dependencies.filter((dep) =>
    dep.type?.eq(codePolicy.codeType),
  );
  if (executable.length !== 1 || executable[0].cellDep.depType !== "code") {
    throw new Error(
      "Reviewed deployment requires exactly one executable code CellDep",
    );
  }
  const cell = await resolveReviewedCodeCell(client, scriptInfo, codePolicy);
  const extraInfos = dependencies.filter((dep) => dep !== executable[0]);
  const extraDeps = extraInfos.length
    ? await client.getCellDeps(extraInfos)
    : [];
  const reference = executable[0].cellDep.outPoint;
  const failStale = (point: ccc.OutPoint) => {
    throw new Error(
      `Stale reviewed code dependency ${point.txHash}:${point.index}. Rebuild the transaction dependencies`,
    );
  };
  // Resolve existing deps historically so spent predecessors can still be
  // recognized by their Type ID. A committed dep group cannot be rewritten.
  const inspect = async (point: ccc.OutPoint) => {
    const dep = await client.getCell(point);
    if (!dep) {
      throw new Error(
        `Cannot inspect dependency ${point.txHash}:${point.index}`,
      );
    }
    if (
      !point.eq(cell.outPoint) &&
      dep.cellOutput.type?.eq(codePolicy.codeType)
    ) {
      failStale(point);
    }
    return dep;
  };

  let includesExecutable = false;
  for (const dep of [...tx.cellDeps, ...extraDeps]) {
    const point = dep.outPoint;
    if (dep.depType === "code" && point.eq(cell.outPoint)) {
      includesExecutable = true;
      continue;
    }
    if (point.eq(reference) && !point.eq(cell.outPoint)) {
      failStale(point);
    }
    const resolved = await inspect(point);
    if (dep.depType === "depGroup") {
      for (const member of mol
        .vector(ccc.OutPoint)
        .decode(resolved.outputData)) {
        if (member.eq(cell.outPoint)) {
          includesExecutable = true;
        } else if (member.eq(reference)) {
          failStale(member);
        } else {
          await inspect(member);
        }
      }
    }
  }
  tx.addCellDeps(extraDeps);
  if (!includesExecutable) {
    tx.addCellDeps({ outPoint: cell.outPoint, depType: "code" });
  }
}

export type SporeDeploymentProfileLike = {
  spore: SporeCodeDeploymentLike;
  cluster: SporeCodeDeploymentLike;
  mutant: SporeCodeDeploymentLike;
  clusterProxy?: SporeCodeDeploymentLike;
  clusterAgent?: SporeCodeDeploymentLike;
};

export type SporeDeploymentProfile = {
  spore: SporeCodeDeployment;
  cluster: SporeCodeDeployment;
  mutant: SporeCodeDeployment;
  clusterProxy?: SporeCodeDeployment;
  clusterAgent?: SporeCodeDeployment;
};

/** Group distinct code identities without changing historical presets/defaults. */
export function createSporeDeploymentProfile(
  deployments: SporeDeploymentProfileLike,
): SporeDeploymentProfile {
  const profile = {
    spore: createSporeCodeDeployment(deployments.spore),
    cluster: createSporeCodeDeployment(deployments.cluster),
    mutant: createSporeCodeDeployment(deployments.mutant),
    clusterProxy: deployments.clusterProxy
      ? createSporeCodeDeployment(deployments.clusterProxy)
      : undefined,
    clusterAgent: deployments.clusterAgent
      ? createSporeCodeDeployment(deployments.clusterAgent)
      : undefined,
  };
  const identities = Object.values(profile)
    .filter((deployment) => deployment !== undefined)
    .map((deployment) => deployment.codeType.hash());
  if (new Set(identities).size !== identities.length) {
    throw new Error("Spore deployment roles require distinct code Type IDs");
  }
  profile.spore.scriptInfo.mutantScript = profile.mutant.scriptInfo;
  profile.cluster.scriptInfo.mutantScript = profile.mutant.scriptInfo;
  return profile;
}

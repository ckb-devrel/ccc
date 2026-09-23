import { ccc } from "@ckb-ccc/core";
import { didToArgs } from "../identifier";

import { ClaimData, decodeClaimDataRaw } from "./codec";
import type {
  ClaimIssuerSource,
  ClaimScriptConfigLike,
  ClaimSubjectLike,
  WriteClaimInput,
  WriteClaimProps,
  WriteClaimResult,
  WriteClaimsProps,
  WriteClaimsResult,
} from "./types";

const CLAIM_TYPE_ARGS_LENGTH = 65;
const MAX_CLAIM_DATA_LENGTH = 16 * 1024;
const MAX_UINT64 = (1n << 64n) - 1n;
const CLAIM_ID_DOMAIN = "0x56454c4c554d5f434c41494d5f563100" satisfies ccc.Hex;
const OutPointVec = ccc.mol.vector(ccc.OutPoint);

type ResolvedScripts = {
  claimType: ccc.ScriptInfo;
  didCkb: ccc.ScriptInfo;
  didLock?: ccc.ScriptInfo;
};

type LoadedInput = {
  index: number;
  cell: ccc.Cell;
};

type LoadedCellDep = {
  cellDepIndex: number;
  cell: ccc.Cell;
};

type SubjectResolution =
  | {
      lock: ccc.Script;
      identityType?: never;
      controller?: never;
    }
  | {
      lock: ccc.Script;
      identityType: ccc.Script;
      controller: ccc.Script;
    };

type IssuerSelection = {
  source: ClaimIssuerSource;
  controller: ccc.Script;
  stateKey: string;
};

export type BuildClaimCellProps<TPayload = unknown> = {
  claimType: ccc.ScriptInfoLike;
  didCkb: ccc.ScriptInfoLike;
  subjectLock: ccc.ScriptLike;
  input: WriteClaimInput<TPayload>;
};

export type BuiltClaimCell = {
  output: ccc.CellOutput;
  outputData: ccc.Hex;
  claimId: ccc.Hex;
  nonce: ccc.Hex;
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireByteLength(
  value: ccc.HexLike,
  byteLength: number,
  field: string,
): ccc.Hex {
  const bytes = ccc.bytesFrom(value);
  if (bytes.length !== byteLength) {
    throw new Error(
      `${field} must be ${byteLength} bytes, got ${bytes.length}`,
    );
  }
  return ccc.hexFrom(bytes);
}

function requireUint64(value: ccc.NumLike, field: string): ccc.Num {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(
      `${field} numbers must be safe integers; use bigint for larger values`,
    );
  }
  const number = ccc.numFrom(value);
  if (number < 0n || number > MAX_UINT64) {
    throw new Error(`${field} must fit in an unsigned 64-bit integer`);
  }
  return number;
}

function randomNonce(): ccc.Hex {
  return ccc.hexFrom(crypto.getRandomValues(new Uint8Array(32)));
}

function sameScriptId(
  script: ccc.Script,
  info: Pick<ccc.ScriptInfo, "codeHash" | "hashType">,
): boolean {
  return script.codeHash === info.codeHash && script.hashType === info.hashType;
}

function outPointKey(value: ccc.OutPointLike): string {
  const outPoint = ccc.OutPoint.from(value);
  return `${outPoint.txHash}:${outPoint.index}`;
}

function claimId(
  type: ccc.Script,
  lock: ccc.Script,
  outputData: ccc.HexLike,
): ccc.Hex {
  return ccc.hashCkb(CLAIM_ID_DOMAIN, type.hash(), lock.hash(), outputData);
}

function outputStateKey(tx: ccc.Transaction, outputIndex: number): string {
  return `output:${ccc.hashCkb(
    tx.outputs[outputIndex].toBytes(),
    tx.outputsData[outputIndex] ?? "0x",
  )}`;
}

function claimTypeScript(
  claimType: ccc.ScriptInfo,
  didCkb: ccc.ScriptInfo,
  schemaHash: ccc.Hex,
): ccc.Script {
  const args = ccc.bytesConcat(
    requireByteLength(didCkb.codeHash, 32, "did:ckb codeHash"),
    ccc.hashTypeToBytes(didCkb.hashType),
    schemaHash,
  );
  if (args.length !== CLAIM_TYPE_ARGS_LENGTH) {
    throw new Error(`Claim Type args must be ${CLAIM_TYPE_ARGS_LENGTH} bytes`);
  }
  return ccc.Script.from({
    codeHash: requireByteLength(claimType.codeHash, 32, "Claim Type codeHash"),
    hashType: claimType.hashType,
    args,
  });
}

export function buildClaimCell<TPayload = unknown>(
  props: BuildClaimCellProps<TPayload>,
): BuiltClaimCell {
  const claimType = ccc.ScriptInfo.from(props.claimType);
  const didCkb = ccc.ScriptInfo.from(props.didCkb);
  const subjectLock = ccc.Script.from(props.subjectLock);
  const issuerId = requireByteLength(
    didToArgs(props.input.issuerDid),
    20,
    "issuer DID ID",
  );
  const schemaHash = requireByteLength(
    props.input.schemaHash,
    32,
    "schemaHash",
  );
  const nonce =
    props.input.nonce === undefined
      ? randomNonce()
      : requireByteLength(props.input.nonce, 32, "nonce");
  const issuedAt = requireUint64(props.input.issuedAt, "issuedAt");
  const expiresAt =
    props.input.expiresAt == null
      ? undefined
      : requireUint64(props.input.expiresAt, "expiresAt");

  if (issuedAt === 0n) {
    throw new Error("issuedAt must be greater than zero");
  }
  if (expiresAt !== undefined && expiresAt <= issuedAt) {
    throw new Error("expiresAt must be greater than issuedAt");
  }

  let outputData: ccc.Hex;
  try {
    outputData = ClaimData.fromV1({
      issuerId,
      nonce,
      issuedAt,
      expiresAt,
      payload: props.input.payload,
    }).toHex();
  } catch (error) {
    throw new Error(
      `Unable to encode Claim payload as canonical DAG-CBOR: ${messageFrom(error)}`,
      {
        cause: error,
      },
    );
  }
  const dataLength = ccc.bytesFrom(outputData).length;
  if (dataLength > MAX_CLAIM_DATA_LENGTH) {
    throw new Error(
      `Claim data must not exceed ${MAX_CLAIM_DATA_LENGTH} bytes, got ${dataLength}`,
    );
  }

  const type = claimTypeScript(claimType, didCkb, schemaHash);
  const occupiedOutput = ccc.CellOutput.from(
    { capacity: 0n, lock: subjectLock, type },
    outputData,
  );
  const capacity =
    props.input.capacity === undefined
      ? occupiedOutput.capacity
      : requireUint64(props.input.capacity, "capacity");
  if (capacity < occupiedOutput.capacity) {
    throw new Error(
      `Claim Cell capacity ${capacity} is below the occupied capacity ${occupiedOutput.capacity}`,
    );
  }

  const output = ccc.CellOutput.from({ capacity, lock: subjectLock, type });
  return {
    output,
    outputData,
    claimId: claimId(type, subjectLock, outputData),
    nonce,
  };
}

async function resolveScripts(
  client: ccc.Client,
  config: ClaimScriptConfigLike,
): Promise<ResolvedScripts> {
  return {
    claimType: ccc.ScriptInfo.from(config.claimType),
    didCkb: config.didCkb
      ? ccc.ScriptInfo.from(config.didCkb)
      : await client.getKnownScript(ccc.KnownScript.DidCkb),
    didLock: config.didLock ? ccc.ScriptInfo.from(config.didLock) : undefined,
  };
}

async function loadInputs(
  tx: ccc.Transaction,
  client: ccc.Client,
): Promise<LoadedInput[]> {
  return Promise.all(
    tx.inputs.map(async (input, index) => ({
      index,
      cell: await input.getCell(client),
    })),
  );
}

async function requireCell(
  client: ccc.Client,
  outPoint: ccc.OutPointLike,
  field: string,
): Promise<ccc.Cell> {
  const cell = await client.getCellLiveNoCache(outPoint, true, true);
  if (!cell) {
    const value = ccc.OutPoint.from(outPoint);
    throw new Error(`${field} ${value.txHash}:${value.index} is unavailable`);
  }
  return cell;
}

async function loadCellDeps(
  tx: ccc.Transaction,
  client: ccc.Client,
): Promise<LoadedCellDep[]> {
  const loaded: LoadedCellDep[] = [];

  for (
    let cellDepIndex = 0;
    cellDepIndex < tx.cellDeps.length;
    cellDepIndex += 1
  ) {
    const cellDep = tx.cellDeps[cellDepIndex];
    const root = await requireCell(client, cellDep.outPoint, "Cell dep");
    if (cellDep.depType === "code") {
      loaded.push({ cellDepIndex, cell: root });
      continue;
    }

    let members: ccc.OutPoint[];
    try {
      members = OutPointVec.decode(root.outputData);
    } catch (error) {
      throw new Error(
        `Cell dep group ${cellDepIndex} has invalid OutPoint data`,
        { cause: error },
      );
    }
    for (const member of members) {
      loaded.push({
        cellDepIndex,
        cell: await requireCell(
          client,
          member,
          `Cell dep group ${cellDepIndex} member`,
        ),
      });
    }
  }

  return loaded;
}

function matchingOutputs(tx: ccc.Transaction, type: ccc.Script): number[] {
  return tx.outputs.flatMap((output, index) =>
    output.type?.eq(type) ? [index] : [],
  );
}

async function findLiveIdentity(
  client: ccc.Client,
  type: ccc.Script,
  role: "issuer" | "subject",
): Promise<ccc.Cell> {
  const page = await client.findCellsPagedNoCache(
    {
      script: type,
      scriptType: "type",
      scriptSearchMode: "exact",
      withData: true,
    },
    "asc",
    2,
  );
  if (page.cells.some((cell) => !cell.cellOutput.type?.eq(type))) {
    throw new Error(
      `CKB indexer returned a Cell outside the exact ${role} DID query`,
    );
  }
  if (page.cells.length === 0) {
    throw new Error(`The ${role} did:ckb identity has no live state`);
  }
  if (page.cells.length !== 1) {
    throw new Error(`The ${role} did:ckb identity has ambiguous live state`);
  }
  return page.cells[0];
}

function addDirectCellDep(tx: ccc.Transaction, cell: ccc.Cell): number {
  tx.addCellDeps({ outPoint: cell.outPoint, depType: "code" });
  const index = tx.cellDeps.findIndex(
    ({ outPoint, depType }) => depType === "code" && outPoint.eq(cell.outPoint),
  );
  if (index < 0) {
    throw new Error("Unable to add identity Cell as a direct cell dep");
  }
  return index;
}

function rejectDidLockController(
  controller: ccc.Script,
  didLock: ccc.ScriptInfo,
): void {
  if (sameScriptId(controller, didLock)) {
    throw new Error(
      "A did:ckb identity controller must not use the configured DID Lock",
    );
  }
}

async function selectSubjectController(
  tx: ccc.Transaction,
  client: ccc.Client,
  identityType: ccc.Script,
): Promise<ccc.Script | undefined> {
  const inputs = await loadInputs(tx, client);
  const deps = await loadCellDeps(tx, client);
  const inputMatches = inputs.filter(({ cell }) =>
    cell.cellOutput.type?.eq(identityType),
  );
  const outputMatches = matchingOutputs(tx, identityType);

  if (inputMatches.length > 0) {
    if (inputMatches.length !== 1 || outputMatches.length !== 1) {
      throw new Error(
        "A subject DID input requires exactly one matching input and one post-transaction output",
      );
    }
    return tx.outputs[outputMatches[0]].lock;
  }

  const depMatches = deps.filter(({ cell }) =>
    cell.cellOutput.type?.eq(identityType),
  );
  if (outputMatches.length > 0) {
    if (outputMatches.length !== 1 || depMatches.length !== 0) {
      throw new Error(
        "The subject did:ckb identity has conflicting transaction states",
      );
    }
    return tx.outputs[outputMatches[0]].lock;
  }
  if (depMatches.length > 0) {
    if (depMatches.length !== 1) {
      throw new Error(
        "The subject did:ckb identity has ambiguous cell-dep state",
      );
    }
    return depMatches[0].cell.cellOutput.lock;
  }
}

async function resolveSubject(
  tx: ccc.Transaction,
  client: ccc.Client,
  scripts: ResolvedScripts,
  subject: ClaimSubjectLike,
): Promise<SubjectResolution> {
  const hasDid = "did" in subject && subject.did !== undefined;
  const hasLock = "lock" in subject && subject.lock !== undefined;
  if (hasDid === hasLock) {
    throw new Error("subject must contain exactly one of did or lock");
  }
  if (hasLock) {
    return { lock: ccc.Script.from(subject.lock) };
  }
  if (!scripts.didLock) {
    throw new Error("scripts.didLock is required for a did:ckb subject");
  }

  const subjectId = requireByteLength(
    didToArgs(subject.did),
    20,
    "subject DID ID",
  );
  const identityType = ccc.Script.from({
    codeHash: scripts.didCkb.codeHash,
    hashType: scripts.didCkb.hashType,
    args: subjectId,
  });
  let controller = await selectSubjectController(tx, client, identityType);
  if (!controller) {
    const live = await findLiveIdentity(client, identityType, "subject");
    addDirectCellDep(tx, live);
    controller = await selectSubjectController(tx, client, identityType);
    if (!controller) {
      throw new Error(
        "Unable to anchor exactly one live subject did:ckb state",
      );
    }
  }

  rejectDidLockController(controller, scripts.didLock);
  return {
    controller,
    identityType,
    lock: ccc.Script.from({
      codeHash: scripts.didLock.codeHash,
      hashType: scripts.didLock.hashType,
      args: identityType.hash(),
    }),
  };
}

async function selectIssuerFromTransaction(
  tx: ccc.Transaction,
  client: ccc.Client,
  issuerType: ccc.Script,
): Promise<IssuerSelection | undefined> {
  const inputs = await loadInputs(tx, client);
  const deps = await loadCellDeps(tx, client);
  const inputMatches = inputs.filter(({ cell }) =>
    cell.cellOutput.type?.eq(issuerType),
  );
  const outputMatches = matchingOutputs(tx, issuerType);
  const depMatches = deps.filter(({ cell }) =>
    cell.cellOutput.type?.eq(issuerType),
  );

  if (inputMatches.length > 0) {
    if (inputMatches.length !== 1 || outputMatches.length !== 1) {
      throw new Error(
        "An issuer DID input requires exactly one matching input and one post-transaction output",
      );
    }
    return {
      source: {
        kind: "input",
        inputIndex: inputMatches[0].index,
        outputIndex: outputMatches[0],
      },
      controller: inputMatches[0].cell.cellOutput.lock,
      stateKey: `input:${outPointKey(inputMatches[0].cell.outPoint)}`,
    };
  }

  if (depMatches.length > 0) {
    if (depMatches.length !== 1 || outputMatches.length !== 0) {
      throw new Error(
        "The issuer did:ckb identity has conflicting transaction states",
      );
    }
    return {
      source: { kind: "cell-dep", cellDepIndex: depMatches[0].cellDepIndex },
      controller: depMatches[0].cell.cellOutput.lock,
      stateKey: `cell-dep:${outPointKey(depMatches[0].cell.outPoint)}`,
    };
  }

  if (outputMatches.length > 0) {
    if (outputMatches.length !== 1) {
      throw new Error("The issuer did:ckb identity has ambiguous output state");
    }
    return {
      source: { kind: "output", outputIndex: outputMatches[0] },
      controller: tx.outputs[outputMatches[0]].lock,
      stateKey: outputStateKey(tx, outputMatches[0]),
    };
  }
}

async function selectIssuer(
  tx: ccc.Transaction,
  client: ccc.Client,
  issuerType: ccc.Script,
): Promise<IssuerSelection> {
  const selected = await selectIssuerFromTransaction(tx, client, issuerType);
  if (selected) {
    return selected;
  }

  const live = await findLiveIdentity(client, issuerType, "issuer");
  const cellDepIndex = addDirectCellDep(tx, live);
  return {
    source: { kind: "cell-dep", cellDepIndex },
    controller: live.cellOutput.lock,
    stateKey: `cell-dep:${outPointKey(live.outPoint)}`,
  };
}

async function signerAddresses(
  signers: readonly ccc.Signer[],
): Promise<Map<ccc.Signer, readonly ccc.Address[]>> {
  const entries = await Promise.all(
    signers.map(async (signer) => {
      const addresses = await signer.getAddressObjs();
      if (addresses.length === 0) {
        throw new Error("A supplied signer has no available CKB addresses");
      }
      return [signer, addresses] as const;
    }),
  );
  return new Map(entries);
}

function signerControls(
  addresses: Map<ccc.Signer, readonly ccc.Address[]>,
  signer: ccc.Signer,
  lock: ccc.Script,
): boolean {
  return (
    addresses.get(signer)?.some((address) => address.script.eq(lock)) ?? false
  );
}

function anySignerControls(
  addresses: Map<ccc.Signer, readonly ccc.Address[]>,
  lock: ccc.Script,
): boolean {
  return [...addresses.values()].some((items) =>
    items.some((address) => address.script.eq(lock)),
  );
}

async function addControllerInput(
  tx: ccc.Transaction,
  issuerSigner: ccc.Signer,
  controller: ccc.Script,
  mirrorCapacity: boolean,
): Promise<number> {
  const referenced = new Set([
    ...tx.inputs.map(({ previousOutput }) => outPointKey(previousOutput)),
    ...tx.cellDeps.map(({ outPoint }) => outPointKey(outPoint)),
  ]);

  for await (const cell of issuerSigner.findCells(
    {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    },
    true,
  )) {
    if (
      referenced.has(outPointKey(cell.outPoint)) ||
      !cell.cellOutput.lock.eq(controller) ||
      cell.cellOutput.type !== undefined ||
      ccc.bytesFrom(cell.outputData).length !== 0
    ) {
      continue;
    }

    const controllerInputIndex = tx.addInput(cell) - 1;
    if (mirrorCapacity) {
      tx.addOutput(
        { capacity: cell.cellOutput.capacity, lock: controller },
        "0x",
      );
    }
    return controllerInputIndex;
  }

  throw new Error(
    "Issuer signer has no live plain Cell available for controller authorization",
  );
}

async function ensureControllerInput(
  tx: ccc.Transaction,
  client: ccc.Client,
  selection: IssuerSelection,
  issuerSigner: ccc.Signer,
  addresses: Map<ccc.Signer, readonly ccc.Address[]>,
  mirrorCapacity: boolean,
): Promise<number> {
  if (!signerControls(addresses, issuerSigner, selection.controller)) {
    throw new Error(
      "issuerSigner does not control the selected issuer DID controller lock",
    );
  }
  if (selection.source.kind === "input") {
    return selection.source.inputIndex;
  }

  const inputs = await loadInputs(tx, client);
  const existing = inputs.find(({ cell }) =>
    cell.cellOutput.lock.eq(selection.controller),
  );
  if (existing) {
    return existing.index;
  }
  return addControllerInput(
    tx,
    issuerSigner,
    selection.controller,
    mirrorCapacity,
  );
}

function validateExistingClaimOutputs(
  tx: ccc.Transaction,
  targetType: ccc.Script,
  issuerId: ccc.Hex,
): Set<ccc.Hex> {
  const claimIds = new Set<ccc.Hex>();

  tx.outputs.forEach((output, index) => {
    if (!output.type?.eq(targetType)) {
      return;
    }
    const outputData = tx.outputsData[index] ?? "0x";
    if (ccc.bytesFrom(outputData).length > MAX_CLAIM_DATA_LENGTH) {
      throw new Error(
        `Existing Claim output ${index} exceeds the Claim data limit`,
      );
    }

    let decoded: ReturnType<typeof decodeClaimDataRaw>;
    try {
      decoded = decodeClaimDataRaw(outputData);
      ClaimData.decode(outputData);
    } catch (error) {
      throw new Error(
        `Existing Claim output ${index} is malformed: ${messageFrom(error)}`,
        {
          cause: error,
        },
      );
    }
    if (ccc.hexFrom(decoded.value.issuerId) !== issuerId) {
      throw new Error(
        `Existing Claim output ${index} belongs to a different issuer`,
      );
    }
    const issuedAt = ccc.numFrom(decoded.value.issuedAt);
    const expiresAt =
      decoded.value.expiresAt === undefined
        ? undefined
        : ccc.numFrom(decoded.value.expiresAt);
    if (issuedAt === 0n || (expiresAt !== undefined && expiresAt <= issuedAt)) {
      throw new Error(`Existing Claim output ${index} has invalid timestamps`);
    }
    if (ccc.bytesFrom(decoded.value.payload).length === 0) {
      throw new Error(`Existing Claim output ${index} has an empty payload`);
    }

    const id = claimId(targetType, output.lock, outputData);
    if (claimIds.has(id)) {
      throw new Error(
        `Existing Claim outputs contain duplicate claim ID ${id}`,
      );
    }
    claimIds.add(id);
  });

  return claimIds;
}

async function addRequiredScriptDeps(
  tx: ccc.Transaction,
  client: ccc.Client,
  scripts: ResolvedScripts,
  addresses: Map<ccc.Signer, readonly ccc.Address[]>,
  payerSigner: ccc.Signer,
): Promise<void> {
  await tx.addCellDepInfos(client, scripts.claimType.cellDeps);
  const inputs = await loadInputs(tx, client);
  const hasIdentityExecution =
    inputs.some(
      ({ cell }) =>
        cell.cellOutput.type &&
        sameScriptId(cell.cellOutput.type, scripts.didCkb),
    ) ||
    tx.outputs.some(
      (output) => output.type && sameScriptId(output.type, scripts.didCkb),
    );
  if (hasIdentityExecution) {
    await tx.addCellDepInfos(client, scripts.didCkb.cellDeps);
  }

  const didLock = scripts.didLock;
  if (!didLock) {
    return;
  }
  const payerMayAddDidLock =
    addresses
      .get(payerSigner)
      ?.some(({ script }) => sameScriptId(script, didLock)) ?? false;
  if (
    payerMayAddDidLock ||
    inputs.some(({ cell }) => sameScriptId(cell.cellOutput.lock, didLock))
  ) {
    await tx.addCellDepInfos(client, didLock.cellDeps);
  }
}

async function validateDidLockInputs(
  tx: ccc.Transaction,
  client: ccc.Client,
  didLock: ccc.ScriptInfo | undefined,
  addresses: Map<ccc.Signer, readonly ccc.Address[]>,
): Promise<void> {
  if (!didLock) {
    return;
  }
  const inputs = await loadInputs(tx, client);
  const groups = new Map<ccc.Hex, ccc.Script>();
  for (const { cell } of inputs) {
    const lock = cell.cellOutput.lock;
    if (sameScriptId(lock, didLock)) {
      groups.set(lock.hash(), lock);
    }
  }
  if (groups.size === 0) {
    return;
  }
  const deps = await loadCellDeps(tx, client);

  for (const lock of groups.values()) {
    const identityTypeHash = requireByteLength(lock.args, 32, "DID Lock args");
    const inputStates = inputs.filter(
      ({ cell }) => cell.cellOutput.type?.hash() === identityTypeHash,
    );
    const depStates = deps.filter(
      ({ cell }) => cell.cellOutput.type?.hash() === identityTypeHash,
    );
    let controller: ccc.Script;
    if (inputStates.length > 0) {
      if (inputStates.length !== 1) {
        throw new Error("A DID Lock input has ambiguous identity input state");
      }
      controller = inputStates[0].cell.cellOutput.lock;
    } else {
      if (depStates.length !== 1) {
        throw new Error(
          "A DID Lock input requires exactly one identity cell-dep state",
        );
      }
      controller = depStates[0].cell.cellOutput.lock;
    }
    rejectDidLockController(controller, didLock);
    if (!inputs.some(({ cell }) => cell.cellOutput.lock.eq(controller))) {
      throw new Error(
        "A DID Lock input is missing its controller authorization input",
      );
    }
    if (!anySignerControls(addresses, controller)) {
      throw new Error(
        "No supplied signer controls a DID Lock input's controller",
      );
    }
  }
}

async function validateInputCoverage(
  tx: ccc.Transaction,
  client: ccc.Client,
  didLock: ccc.ScriptInfo | undefined,
  addresses: Map<ccc.Signer, readonly ccc.Address[]>,
): Promise<void> {
  const inputs = await loadInputs(tx, client);
  for (const { index, cell } of inputs) {
    if (didLock && sameScriptId(cell.cellOutput.lock, didLock)) {
      continue;
    }
    if (!anySignerControls(addresses, cell.cellOutput.lock)) {
      throw new Error(`No supplied signer controls transaction input ${index}`);
    }
  }
  await validateDidLockInputs(tx, client, didLock, addresses);
}

function distinctSigners(signers: readonly ccc.Signer[]): ccc.Signer[] {
  return [...new Set(signers)];
}

function sameSubject(left: ClaimSubjectLike, right: ClaimSubjectLike): boolean {
  if ("did" in left && left.did !== undefined) {
    return "did" in right && right.did === left.did;
  }
  return (
    "lock" in right &&
    right.lock !== undefined &&
    ccc.Script.from(left.lock).eq(right.lock)
  );
}

async function validateSignerNetworks(
  signers: readonly ccc.Signer[],
): Promise<void> {
  const prefix = signers[0]?.client.addressPrefix;
  for (const signer of signers.slice(1)) {
    if (signer.client.addressPrefix !== prefix) {
      throw new Error(
        "All supplied signers must use clients for the same CKB network",
      );
    }
  }

  const clients = [...new Set(signers.map(({ client }) => client))];
  if (clients.length < 2) {
    return;
  }
  const genesisHeaders = await Promise.all(
    clients.map((client) => client.getHeaderByNumber(0)),
  );
  const genesisHash = genesisHeaders[0]?.hash;
  if (
    !genesisHash ||
    genesisHeaders.some((header) => header?.hash !== genesisHash)
  ) {
    throw new Error(
      "All supplied signers must use clients for the same CKB network",
    );
  }
}

function assertClaimOutput(
  tx: ccc.Transaction,
  outputIndex: number,
  built: BuiltClaimCell,
): void {
  const output = tx.outputs[outputIndex];
  const outputData = tx.outputsData[outputIndex];
  if (
    !output ||
    outputData === undefined ||
    !output.lock.eq(built.output.lock) ||
    !output.type?.eq(built.output.type!) ||
    output.capacity !== built.output.capacity ||
    outputData !== built.outputData ||
    claimId(output.type, output.lock, outputData) !== built.claimId
  ) {
    throw new Error("A signer changed the prepared Claim output");
  }
}

function sameIssuerState(
  left: IssuerSelection,
  right: IssuerSelection,
): boolean {
  return (
    left.source.kind === right.source.kind &&
    left.stateKey === right.stateKey &&
    left.controller.eq(right.controller)
  );
}

async function assertIdentityState(
  tx: ccc.Transaction,
  client: ccc.Client,
  subject: SubjectResolution,
  issuerType: ccc.Script,
  issuer: IssuerSelection,
  controllerInputOutPoint: ccc.OutPoint,
): Promise<{ issuer: IssuerSelection; controllerInputIndex: number }> {
  let selectedIssuer: IssuerSelection | undefined;
  try {
    selectedIssuer = await selectIssuerFromTransaction(tx, client, issuerType);
  } catch (error) {
    throw new Error(
      `A signer changed the selected issuer DID state: ${messageFrom(error)}`,
      {
        cause: error,
      },
    );
  }
  if (!selectedIssuer || !sameIssuerState(selectedIssuer, issuer)) {
    throw new Error("A signer changed the selected issuer DID state");
  }

  const controllerInputIndexes = tx.inputs.flatMap(
    ({ previousOutput }, index) =>
      previousOutput.eq(controllerInputOutPoint) ? [index] : [],
  );
  if (controllerInputIndexes.length !== 1) {
    throw new Error(
      "A signer changed the issuer controller authorization input",
    );
  }
  const controllerInputIndex = controllerInputIndexes[0];
  const controllerInput = tx.inputs[controllerInputIndex];
  const controllerCell = await controllerInput.getCell(client);
  if (!controllerCell.cellOutput.lock.eq(issuer.controller)) {
    throw new Error(
      "A signer changed the issuer controller authorization input",
    );
  }

  if (!subject.identityType) {
    return { issuer: selectedIssuer, controllerInputIndex };
  }
  let subjectController: ccc.Script | undefined;
  try {
    subjectController = await selectSubjectController(
      tx,
      client,
      subject.identityType,
    );
  } catch (error) {
    throw new Error(
      `A signer changed the selected subject DID state: ${messageFrom(error)}`,
      {
        cause: error,
      },
    );
  }
  if (!subjectController || !subjectController.eq(subject.controller)) {
    throw new Error("A signer changed the selected subject DID state");
  }
  return { issuer: selectedIssuer, controllerInputIndex };
}

/**
 * Builds and balances an unsigned Claim Cell transaction.
 *
 * The caller remains responsible for inspecting, signing, and broadcasting the returned
 * transaction.
 */
export async function writeClaims<TPayload = unknown>(
  props: WriteClaimsProps<TPayload>,
): Promise<WriteClaimsResult> {
  if (props.inputs.length < 1 || props.inputs.length > 8) {
    throw new Error("writeClaims requires between one and eight claim inputs");
  }
  const firstInput = props.inputs[0];
  if (
    props.inputs.some(
      (input) =>
        input.issuerDid !== firstInput.issuerDid ||
        !sameSubject(input.subject, firstInput.subject),
    )
  ) {
    throw new Error(
      "All claim inputs must use the same subject and issuer DID",
    );
  }

  const payerSigner = props.payerSigner ?? props.issuerSigner;
  const signers = distinctSigners([
    props.issuerSigner,
    ...(props.additionalSigners ?? []),
    payerSigner,
  ]);
  await validateSignerNetworks(signers);
  const addresses = await signerAddresses(signers);
  const client = props.issuerSigner.client;
  const scripts = await resolveScripts(client, props.scripts);
  let tx = ccc.Transaction.from(props.tx ?? {}).clone();
  const subject = await resolveSubject(tx, client, scripts, firstInput.subject);
  const issuerId = requireByteLength(
    didToArgs(firstInput.issuerDid),
    20,
    "issuer DID ID",
  );
  const issuerType = ccc.Script.from({
    codeHash: scripts.didCkb.codeHash,
    hashType: scripts.didCkb.hashType,
    args: issuerId,
  });
  const issuer = await selectIssuer(tx, client, issuerType);
  if (scripts.didLock) {
    rejectDidLockController(issuer.controller, scripts.didLock);
  }
  const initialControllerInputIndex = await ensureControllerInput(
    tx,
    client,
    issuer,
    props.issuerSigner,
    addresses,
    payerSigner !== props.issuerSigner,
  );
  const controllerInputOutPoint =
    tx.inputs[initialControllerInputIndex]?.previousOutput.clone();
  if (!controllerInputOutPoint) {
    throw new Error(
      "Unable to locate the issuer controller authorization input",
    );
  }

  const builtClaims = props.inputs.map((input) =>
    buildClaimCell({
      claimType: scripts.claimType,
      didCkb: scripts.didCkb,
      subjectLock: subject.lock,
      input,
    }),
  );
  const addedClaimIds = new Set<ccc.Hex>();
  const claimOutputs = builtClaims.map((built) => {
    const existingClaimIds = validateExistingClaimOutputs(
      tx,
      built.output.type!,
      issuerId,
    );
    if (
      existingClaimIds.has(built.claimId) ||
      addedClaimIds.has(built.claimId)
    ) {
      throw new Error(`Claim output would duplicate claim ID ${built.claimId}`);
    }
    addedClaimIds.add(built.claimId);
    return {
      built,
      outputIndex: tx.addOutput(built.output, built.outputData) - 1,
    };
  });

  await addRequiredScriptDeps(tx, client, scripts, addresses, payerSigner);
  await validateInputCoverage(tx, client, scripts.didLock, addresses);

  for (const signer of signers) {
    if (signer !== payerSigner) {
      tx = await signer.prepareTransaction(tx);
    }
  }

  try {
    await tx.completeFeeBy(payerSigner);
  } catch (error) {
    if (error instanceof ccc.ErrorTransactionInsufficientCapacity) {
      throw new Error(`Payer has insufficient CKB capacity: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }

  await validateInputCoverage(tx, client, scripts.didLock, addresses);
  for (const { built, outputIndex } of claimOutputs) {
    assertClaimOutput(tx, outputIndex, built);
  }
  const finalState = await assertIdentityState(
    tx,
    client,
    subject,
    issuerType,
    issuer,
    controllerInputOutPoint,
  );

  return {
    tx,
    claims: claimOutputs.map(({ built, outputIndex }) => ({
      claimId: built.claimId,
      outputIndex,
    })),
    issuerSource: finalState.issuer.source,
    controllerInputIndex: finalState.controllerInputIndex,
  };
}

/** Builds and balances one unsigned Claim Cell transaction containing a single claim. */
export async function writeClaim<TPayload = unknown>(
  props: WriteClaimProps<TPayload>,
): Promise<WriteClaimResult> {
  const result = await writeClaims({ ...props, inputs: [props.input] });
  const claim = result.claims[0];
  if (!claim) {
    throw new Error("Claim transaction did not contain the requested output");
  }
  return {
    tx: result.tx,
    claimId: claim.claimId,
    outputIndex: claim.outputIndex,
    issuerSource: result.issuerSource,
    controllerInputIndex: result.controllerInputIndex,
  };
}

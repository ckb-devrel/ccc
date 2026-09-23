import { ccc } from "@ckb-ccc/core";
import {
  decode as decodeDagCbor,
  encode as encodeDagCbor,
} from "@ipld/dag-cbor";
import { argsToDid, didToArgs } from "../identifier";

import { decodeClaimDataRaw } from "./codec";
import type {
  Claim,
  ClaimIssuerState,
  ClaimReadFailure,
  ClaimReadFailureCode,
  ClaimSchema,
  ClaimTimeEvaluation,
  ReadClaimsProps,
  ReadClaimsResult,
} from "./types";

const CLAIM_TYPE_ARGS_LENGTH = 65;
const MAX_CLAIM_DATA_LENGTH = 16 * 1024;
const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 100;
const MAX_CONCURRENT_ISSUER_LOOKUPS = 8;
const CLAIM_ID_DOMAIN = "0x56454c4c554d5f434c41494d5f563100" satisfies ccc.Hex;

type DecodedClaim = Omit<Claim, "duplicateCells" | "issuerState"> & {
  duplicateCells: ccc.Cell[];
};

type DecodeContext = {
  claimType: ccc.ScriptInfo;
  didCkb: ccc.ScriptInfo;
  subjectLock: ccc.Script;
  evaluationTime?: ccc.Num;
  issuerId?: ccc.Hex;
  schemaHash?: ccc.Hex;
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

function validatePageSize(value: number | undefined): number {
  const pageSize = value ?? DEFAULT_PAGE_SIZE;
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    throw new Error(
      `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`,
    );
  }
  return pageSize;
}

function validateEvaluationTime(
  value: ccc.NumLike | undefined,
): ccc.Num | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(
      "evaluationTime numbers must be safe integers; use bigint for larger values",
    );
  }

  const timestamp = ccc.numFrom(value);
  if (timestamp < 0n || timestamp > MAX_UINT64) {
    throw new Error("evaluationTime must fit in an unsigned 64-bit integer");
  }
  return timestamp;
}

function validateOrder(value: "asc" | "desc" | undefined): "asc" | "desc" {
  const order = value ?? "asc";
  if (order !== "asc" && order !== "desc") {
    throw new Error('order must be either "asc" or "desc"');
  }
  return order;
}

function failure(
  cell: ccc.Cell,
  code: ClaimReadFailureCode,
  message: string,
): ClaimReadFailure {
  return { cell, code, message };
}

function evaluateTime(
  issuedAt: ccc.Num,
  expiresAt: ccc.Num | undefined,
  evaluatedAt: ccc.Num | undefined,
): ClaimTimeEvaluation {
  if (evaluatedAt === undefined) {
    return { status: "not-evaluated" };
  }
  if (evaluatedAt < issuedAt) {
    return { status: "not-yet-active", evaluatedAt };
  }
  if (expiresAt !== undefined && evaluatedAt >= expiresAt) {
    return { status: "expired", evaluatedAt };
  }
  return { status: "active", evaluatedAt };
}

async function collectCells(
  client: ccc.Client,
  key: ccc.ClientIndexerSearchKeyLike,
  order: "asc" | "desc",
  pageSize: number,
): Promise<ccc.Cell[]> {
  const cells: ccc.Cell[] = [];
  let after: string | undefined;

  while (true) {
    const page = await client.findCellsPagedNoCache(
      key,
      order,
      pageSize,
      after,
    );
    cells.push(...page.cells);

    if (page.cells.length < pageSize) {
      return cells;
    }
    if (!page.lastCursor || page.lastCursor === after) {
      throw new Error("CKB indexer pagination did not advance");
    }
    after = page.lastCursor;
  }
}

async function resolveSubject(
  props: ReadClaimsProps,
  didCkb: ccc.ScriptInfo,
): Promise<ccc.Script> {
  const subject = props.filter.subject;
  const hasDid = "did" in subject && subject.did !== undefined;
  const hasLock = "lock" in subject && subject.lock !== undefined;

  if (hasDid === hasLock) {
    throw new Error("subject must contain exactly one of did or lock");
  }
  if (hasLock) {
    return ccc.Script.from(subject.lock);
  }
  if (!props.scripts.didLock) {
    throw new Error("scripts.didLock is required for a did:ckb subject");
  }

  const subjectId = requireByteLength(
    didToArgs(subject.did),
    20,
    "subject DID ID",
  );
  const identityType = ccc.Script.from({
    codeHash: didCkb.codeHash,
    hashType: didCkb.hashType,
    args: subjectId,
  });
  const didLock = ccc.ScriptInfo.from(props.scripts.didLock);

  return ccc.Script.from({
    codeHash: didLock.codeHash,
    hashType: didLock.hashType,
    args: identityType.hash(),
  });
}

function decodeCell(
  cell: ccc.Cell,
  context: DecodeContext,
): DecodedClaim | ClaimReadFailure | undefined {
  if (!cell.cellOutput.lock.eq(context.subjectLock)) {
    throw new Error(
      "CKB indexer returned a Cell outside the configured subject lock query",
    );
  }

  const type = cell.cellOutput.type;
  if (
    !type ||
    type.codeHash !== context.claimType.codeHash ||
    type.hashType !== context.claimType.hashType
  ) {
    throw new Error(
      "CKB indexer returned a Cell outside the configured Claim Type query",
    );
  }

  const args = ccc.bytesFrom(type.args);
  if (args.length !== CLAIM_TYPE_ARGS_LENGTH) {
    return failure(
      cell,
      "invalid-type-args",
      `Claim Type args must be ${CLAIM_TYPE_ARGS_LENGTH} bytes, got ${args.length}`,
    );
  }

  let issuerHashType: ccc.HashType;
  try {
    issuerHashType = ccc.hashTypeFrom(args[32]);
  } catch (error) {
    return failure(cell, "invalid-type-args", messageFrom(error));
  }

  const issuerCodeHash = ccc.hexFrom(args.slice(0, 32));
  if (
    issuerCodeHash !== context.didCkb.codeHash ||
    issuerHashType !== context.didCkb.hashType
  ) {
    return failure(
      cell,
      "unsupported-issuer-deployment",
      "Claim issuer deployment does not match the configured did:ckb Script Info",
    );
  }

  const schemaHash = ccc.hexFrom(args.slice(33));
  if (context.schemaHash !== undefined && schemaHash !== context.schemaHash) {
    return undefined;
  }

  const encoded = ccc.bytesFrom(cell.outputData);
  if (encoded.length > MAX_CLAIM_DATA_LENGTH) {
    return failure(
      cell,
      "invalid-claim-data",
      `Claim data exceeds the ${MAX_CLAIM_DATA_LENGTH}-byte limit`,
    );
  }
  if (encoded.length < 4) {
    return failure(
      cell,
      "invalid-claim-data",
      "Claim data is missing its version tag",
    );
  }

  const version = new DataView(encoded.buffer, encoded.byteOffset, 4).getUint32(
    0,
    true,
  );
  if (version !== 0) {
    return failure(
      cell,
      "unsupported-data-version",
      `Unsupported Claim data union variant ${version}`,
    );
  }

  let raw: ReturnType<typeof decodeClaimDataRaw>;
  try {
    raw = decodeClaimDataRaw(encoded);
  } catch (error) {
    return failure(cell, "invalid-claim-data", messageFrom(error));
  }

  const issuerId = ccc.hexFrom(raw.value.issuerId);
  if (context.issuerId !== undefined && issuerId !== context.issuerId) {
    return undefined;
  }

  const issuedAt = ccc.numFrom(raw.value.issuedAt);
  const expiresAt =
    raw.value.expiresAt === undefined
      ? undefined
      : ccc.numFrom(raw.value.expiresAt);
  const payloadBytes = ccc.hexFrom(raw.value.payload);
  if (ccc.bytesFrom(payloadBytes).length === 0) {
    return failure(
      cell,
      "invalid-claim-data",
      "Claim payload must not be empty",
    );
  }
  if (issuedAt === 0n) {
    return failure(
      cell,
      "invalid-claim-data",
      "issuedAt must be greater than zero",
    );
  }
  if (expiresAt !== undefined && expiresAt <= issuedAt) {
    return failure(
      cell,
      "invalid-claim-data",
      "expiresAt must be greater than issuedAt",
    );
  }

  let payload: unknown;
  try {
    payload = decodeDagCbor(ccc.bytesFrom(payloadBytes));
  } catch (error) {
    return failure(cell, "invalid-dag-cbor", messageFrom(error));
  }

  let canonicalPayload: Uint8Array;
  try {
    canonicalPayload = encodeDagCbor(payload);
  } catch (error) {
    return failure(cell, "invalid-dag-cbor", messageFrom(error));
  }
  if (!ccc.bytesEq(payloadBytes, canonicalPayload)) {
    return failure(
      cell,
      "non-canonical-dag-cbor",
      "Claim payload is valid DAG-CBOR but not canonically encoded",
    );
  }

  const subjectLock = cell.cellOutput.lock.clone();
  const subjectLockHash = subjectLock.hash();
  const issuerType = ccc.Script.from({
    codeHash: context.didCkb.codeHash,
    hashType: context.didCkb.hashType,
    args: issuerId,
  });

  return {
    version: "v1",
    claimId: ccc.hashCkb(
      CLAIM_ID_DOMAIN,
      type.hash(),
      subjectLockHash,
      cell.outputData,
    ),
    issuerDid: argsToDid(issuerId),
    issuerId,
    issuerType,
    subjectLock,
    subjectLockHash,
    schemaHash,
    nonce: ccc.hexFrom(raw.value.nonce),
    issuedAt,
    expiresAt,
    payload,
    payloadBytes,
    cell,
    duplicateCells: [],
    verification: {
      inclusion: "live",
      issuerAuthorization: "accepted-by-configured-claim-type",
      time: evaluateTime(issuedAt, expiresAt, context.evaluationTime),
    },
  };
}

function outPointKey(outPoint: ccc.OutPointLike): string {
  const value = ccc.OutPoint.from(outPoint);
  return `${value.txHash}:${value.index}`;
}

async function resolveIssuerHistory(
  client: ccc.Client,
  issuerType: ccc.Script,
  pageSize: number,
): Promise<ClaimIssuerState> {
  const liveOutPoints = new Set<string>();
  const seenTransactions = new Set<ccc.Hex>();
  let sawOutput = false;

  for await (const record of client.findTransactionsByType(
    issuerType,
    true,
    "asc",
    pageSize,
  )) {
    if (seenTransactions.has(record.txHash)) {
      throw new Error(`Issuer history repeated transaction ${record.txHash}`);
    }
    seenTransactions.add(record.txHash);

    const response = await client.getTransaction(record.txHash);
    if (!response || response.status !== "committed") {
      throw new Error(
        `Committed issuer transaction ${record.txHash} is unavailable`,
      );
    }
    if (response.transaction.hash() !== record.txHash) {
      throw new Error(
        `Issuer transaction ${record.txHash} has mismatched contents`,
      );
    }

    const recordedInputIndexes = record.cells.flatMap((cell) =>
      cell.isInput ? [ccc.numFrom(cell.cellIndex)] : [],
    );
    const recordedOutputIndexes = record.cells.flatMap((cell) =>
      cell.isInput ? [] : [ccc.numFrom(cell.cellIndex)],
    );
    const connectedInputIndexes = response.transaction.inputs.flatMap(
      (input, index) =>
        liveOutPoints.has(outPointKey(input.previousOutput))
          ? [BigInt(index)]
          : [],
    );
    const matchingOutputIndexes = response.transaction.outputs.flatMap(
      (output, index) => (output.type?.eq(issuerType) ? [BigInt(index)] : []),
    );
    if (
      recordedInputIndexes.length !== connectedInputIndexes.length ||
      recordedInputIndexes.some(
        (index, position) => index !== connectedInputIndexes[position],
      )
    ) {
      throw new Error(
        `Issuer history has a disconnected input at ${record.txHash}`,
      );
    }
    if (
      recordedOutputIndexes.length !== matchingOutputIndexes.length ||
      recordedOutputIndexes.some(
        (index, position) => index !== matchingOutputIndexes[position],
      )
    ) {
      throw new Error(
        `Issuer history has mismatched outputs at ${record.txHash}`,
      );
    }
    if (
      connectedInputIndexes.length > 1 ||
      matchingOutputIndexes.length > 1 ||
      connectedInputIndexes.length + matchingOutputIndexes.length === 0
    ) {
      throw new Error(
        `Issuer history is ambiguous at transaction ${record.txHash}`,
      );
    }

    if (connectedInputIndexes.length === 0) {
      if (
        sawOutput ||
        liveOutPoints.size !== 0 ||
        matchingOutputIndexes.length !== 1
      ) {
        throw new Error(
          `Issuer history has an invalid creation at ${record.txHash}`,
        );
      }
    } else {
      const input =
        response.transaction.inputs[Number(connectedInputIndexes[0])];
      if (!input || !liveOutPoints.delete(outPointKey(input.previousOutput))) {
        throw new Error(
          `Issuer history has a disconnected input at ${record.txHash}`,
        );
      }
    }

    if (matchingOutputIndexes.length === 1) {
      const outputIndex = matchingOutputIndexes[0];
      const outputKey = outPointKey({
        txHash: record.txHash,
        index: outputIndex,
      });
      if (liveOutPoints.has(outputKey)) {
        throw new Error(
          `Issuer history repeated an output at ${record.txHash}`,
        );
      }
      liveOutPoints.add(outputKey);
      sawOutput = true;
    }

    if (liveOutPoints.size > 1) {
      throw new Error(
        `Issuer history has multiple simultaneous states at ${record.txHash}`,
      );
    }
  }

  if (seenTransactions.size === 0) {
    return { status: "missing" };
  }
  if (!sawOutput || liveOutPoints.size !== 0) {
    throw new Error(
      "Issuer history is incomplete or inconsistent with the live-Cell query",
    );
  }
  return { status: "deactivated" };
}

async function resolveIssuerState(
  client: ccc.Client,
  issuerType: ccc.Script,
  pageSize: number,
): Promise<ClaimIssuerState> {
  try {
    const cells = await collectCells(
      client,
      {
        script: issuerType,
        scriptType: "type",
        scriptSearchMode: "exact",
        withData: true,
      },
      "asc",
      pageSize,
    );
    if (cells.some((cell) => !cell.cellOutput.type?.eq(issuerType))) {
      throw new Error(
        "CKB indexer returned a Cell outside the exact issuer Type query",
      );
    }

    if (cells.length === 1) {
      return {
        status: "active",
        cell: cells[0],
        controller: cells[0].cellOutput.lock.clone(),
      };
    }
    if (cells.length > 1) {
      return { status: "ambiguous", cells };
    }
    return await resolveIssuerHistory(client, issuerType, pageSize);
  } catch (error) {
    return { status: "unavailable", reason: messageFrom(error) };
  }
}

async function resolveIssuerStates(
  client: ccc.Client,
  claims: readonly DecodedClaim[],
  pageSize: number,
): Promise<Map<ccc.Hex, ClaimIssuerState>> {
  const issuerTypes = new Map<ccc.Hex, ccc.Script>();
  for (const claim of claims) {
    const key = claim.issuerType.hash();
    if (!issuerTypes.has(key)) {
      issuerTypes.set(key, claim.issuerType);
    }
  }

  const entries = [...issuerTypes.entries()];
  const issuerStates = new Map<ccc.Hex, ClaimIssuerState>();
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < entries.length) {
      const [key, issuerType] = entries[nextIndex++];
      issuerStates.set(
        key,
        await resolveIssuerState(client, issuerType, pageSize),
      );
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(MAX_CONCURRENT_ISSUER_LOOKUPS, entries.length) },
      worker,
    ),
  );
  return issuerStates;
}

/**
 * Reads every live Claim Cell under one exact subject lock.
 *
 * Invalid Cells are isolated in `invalid`. A subject-scan failure rejects the operation because a
 * partial result cannot prove completeness.
 */
export async function readClaims(
  props: ReadClaimsProps,
): Promise<ReadClaimsResult> {
  const claimType = ccc.ScriptInfo.from(props.scripts.claimType);
  const didCkb = props.scripts.didCkb
    ? ccc.ScriptInfo.from(props.scripts.didCkb)
    : await props.client.getKnownScript(ccc.KnownScript.DidCkb);
  const subjectLock = await resolveSubject(props, didCkb);
  const pageSize = validatePageSize(props.filter.pageSize);
  const order = validateOrder(props.filter.order);
  const issuerId =
    props.filter.issuerDid === undefined
      ? undefined
      : requireByteLength(
          didToArgs(props.filter.issuerDid),
          20,
          "issuer DID ID",
        );
  const schemaHash =
    props.filter.schemaHash === undefined
      ? undefined
      : requireByteLength(props.filter.schemaHash, 32, "schemaHash");
  const evaluationTime = validateEvaluationTime(props.filter.evaluationTime);

  const cells = await collectCells(
    props.client,
    {
      script: subjectLock,
      scriptType: "lock",
      scriptSearchMode: "exact",
      filter: {
        script: ccc.Script.from({
          codeHash: claimType.codeHash,
          hashType: claimType.hashType,
          args: "0x",
        }),
      },
      withData: true,
    },
    order,
    pageSize,
  );

  const claims: DecodedClaim[] = [];
  const invalid: ClaimReadFailure[] = [];
  const claimsById = new Map<ccc.Hex, DecodedClaim>();
  const context: DecodeContext = {
    claimType,
    didCkb,
    subjectLock,
    evaluationTime,
    issuerId,
    schemaHash,
  };

  for (const cell of cells) {
    const result = decodeCell(cell, context);
    if (result === undefined) {
      continue;
    }
    if ("code" in result) {
      invalid.push(result);
      continue;
    }

    const existing = claimsById.get(result.claimId);
    if (existing) {
      existing.duplicateCells.push(result.cell);
      continue;
    }
    claimsById.set(result.claimId, result);
    claims.push(result);
  }

  const issuerStates = await resolveIssuerStates(
    props.client,
    claims,
    pageSize,
  );

  return {
    claims: claims.map((claim): Claim => ({
      ...claim,
      issuerState: issuerStates.get(claim.issuerType.hash())!,
    })),
    invalid,
  };
}

/** Validates a claim's schema hash before parsing its untrusted payload. */
export function parseClaimPayload<TPayload>(
  claim: Claim,
  schema: ClaimSchema<TPayload>,
): TPayload {
  const schemaHash = requireByteLength(
    schema.hash,
    32,
    `schema ${schema.id} hash`,
  );
  if (claim.schemaHash !== schemaHash) {
    throw new Error(
      `Claim schema hash ${claim.schemaHash} does not match ${schema.id} (${schemaHash})`,
    );
  }
  return schema.parse(claim.payload);
}

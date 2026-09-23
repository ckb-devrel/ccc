import { ccc } from "@ckb-ccc/core";
import { describe, expect, test } from "vitest";
import { argsToDid } from "../identifier";

import { ClaimData, encodeClaimDataRaw } from "./codec";
import { parseClaimPayload, readClaims } from "./read";
import type { ClaimScriptConfigLike } from "./types";

function repeatedHex(byte: number, length: number): ccc.Hex {
  return `0x${byte.toString(16).padStart(2, "0").repeat(length)}`;
}

const CLAIM_TYPE_INFO = {
  codeHash: repeatedHex(0x11, 32),
  hashType: "type",
  cellDeps: [],
} satisfies ccc.ScriptInfoLike;

const DID_CKB_INFO = {
  codeHash: repeatedHex(0x22, 32),
  hashType: "type",
  cellDeps: [],
} satisfies ccc.ScriptInfoLike;

const DID_LOCK_INFO = {
  codeHash: repeatedHex(0x33, 32),
  hashType: "type",
  cellDeps: [],
} satisfies ccc.ScriptInfoLike;

const SUBJECT_LOCK = ccc.Script.from({
  codeHash: repeatedHex(0x44, 32),
  hashType: "type",
  args: repeatedHex(0x45, 20),
});

const CONTROLLER_LOCK = ccc.Script.from({
  codeHash: repeatedHex(0x55, 32),
  hashType: "type",
  args: repeatedHex(0x56, 20),
});

const ISSUER_ID = repeatedHex(0x66, 20);
const OTHER_ISSUER_ID = repeatedHex(0x67, 20);
const SUBJECT_ID = repeatedHex(0x68, 20);
const SCHEMA_HASH = repeatedHex(0x77, 32);
const OTHER_SCHEMA_HASH = repeatedHex(0x78, 32);

const SCRIPTS = {
  claimType: CLAIM_TYPE_INFO,
  didLock: DID_LOCK_INFO,
  didCkb: DID_CKB_INFO,
} satisfies ClaimScriptConfigLike;

function claimType(
  schemaHash: ccc.Hex = SCHEMA_HASH,
  issuerDeployment: ccc.ScriptInfoLike = DID_CKB_INFO,
): ccc.Script {
  const issuer = ccc.ScriptInfo.from(issuerDeployment);
  return ccc.Script.from({
    codeHash: CLAIM_TYPE_INFO.codeHash,
    hashType: CLAIM_TYPE_INFO.hashType,
    args: ccc.hexFrom(
      ccc.bytesConcat(
        issuer.codeHash,
        ccc.hashTypeToBytes(issuer.hashType),
        schemaHash,
      ),
    ),
  });
}

function issuerType(issuerId: ccc.Hex = ISSUER_ID): ccc.Script {
  return ccc.Script.from({
    codeHash: DID_CKB_INFO.codeHash,
    hashType: DID_CKB_INFO.hashType,
    args: issuerId,
  });
}

function claimCell(options: {
  outPointByte: number;
  outPointIndex?: number;
  issuerId?: ccc.Hex;
  nonceByte?: number;
  schemaHash?: ccc.Hex;
  issuerDeployment?: ccc.ScriptInfoLike;
  subjectLock?: ccc.Script;
  issuedAt?: bigint;
  expiresAt?: bigint;
  payload?: unknown;
  outputData?: ccc.Hex;
  type?: ccc.Script;
}): ccc.Cell {
  const outputData =
    options.outputData ??
    ClaimData.fromV1({
      issuerId: options.issuerId ?? ISSUER_ID,
      nonce: repeatedHex(options.nonceByte ?? options.outPointByte, 32),
      issuedAt: options.issuedAt ?? 10n,
      expiresAt: options.expiresAt,
      payload: options.payload ?? { account: "alice" },
    }).toHex();

  return ccc.Cell.from({
    outPoint: {
      txHash: repeatedHex(options.outPointByte, 32),
      index: options.outPointIndex ?? 0,
    },
    cellOutput: {
      capacity: 20_000_000_000n,
      lock: options.subjectLock ?? SUBJECT_LOCK,
      type:
        options.type ??
        claimType(options.schemaHash ?? SCHEMA_HASH, options.issuerDeployment),
    },
    outputData,
  });
}

function identityCell(options: {
  outPointByte: number;
  issuerId?: ccc.Hex;
  lock?: ccc.Script;
}): ccc.Cell {
  return ccc.Cell.from({
    outPoint: { txHash: repeatedHex(options.outPointByte, 32), index: 0 },
    cellOutput: {
      capacity: 20_000_000_000n,
      lock: options.lock ?? CONTROLLER_LOCK,
      type: issuerType(options.issuerId),
    },
    outputData: "0x",
  });
}

type GroupedTransaction =
  ccc.ClientFindTransactionsGroupedResponse["transactions"][number];

type FakeClientOptions = {
  claimCells?: ccc.Cell[];
  issuerCells?: Map<ccc.Hex, ccc.Cell[]>;
  history?: Map<ccc.Hex, GroupedTransaction[]>;
  transactions?: Map<ccc.Hex, ccc.ClientTransactionResponse>;
  failSubjectScan?: boolean;
  failIssuerScan?: boolean;
  stallSubjectCursor?: boolean;
  issuerScanDelayMs?: number;
};

function fakeClient(options: FakeClientOptions = {}) {
  const queries: {
    key: ccc.ClientIndexerSearchKeyLike;
    order: "asc" | "desc" | undefined;
    limit: ccc.NumLike | undefined;
    after: string | undefined;
  }[] = [];
  let issuerScanCount = 0;
  let activeIssuerScanCount = 0;
  let maxConcurrentIssuerScanCount = 0;

  const client = {
    getKnownScript: async () => ccc.ScriptInfo.from(DID_CKB_INFO),
    findCellsPagedNoCache: async (
      key: ccc.ClientIndexerSearchKeyLike,
      order?: "asc" | "desc",
      limit?: ccc.NumLike,
      after?: string,
    ): Promise<ccc.ClientFindCellsResponse> => {
      queries.push({ key, order, limit, after });
      const pageSize = Number(limit ?? 10);
      const offset = after
        ? Number(after.slice(after.lastIndexOf(":") + 1))
        : 0;

      let cells: ccc.Cell[];
      let cursorPrefix: string;
      if (key.scriptType === "lock") {
        if (options.failSubjectScan) {
          throw new Error("subject indexer unavailable");
        }
        cells = options.claimCells ?? [];
        cursorPrefix = "claims";
      } else {
        issuerScanCount += 1;
        activeIssuerScanCount += 1;
        maxConcurrentIssuerScanCount = Math.max(
          maxConcurrentIssuerScanCount,
          activeIssuerScanCount,
        );
        try {
          if (options.issuerScanDelayMs !== undefined) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.issuerScanDelayMs),
            );
          }
          if (options.failIssuerScan) {
            throw new Error("issuer indexer unavailable");
          }
          const keyHash = ccc.Script.from(key.script).hash();
          cells = options.issuerCells?.get(keyHash) ?? [];
          cursorPrefix = keyHash;
        } finally {
          activeIssuerScanCount -= 1;
        }
      }

      const orderedCells = order === "desc" ? [...cells].reverse() : cells;
      const page = orderedCells.slice(offset, offset + pageSize);
      return {
        cells: page,
        lastCursor:
          options.stallSubjectCursor && key.scriptType === "lock"
            ? (after ?? "")
            : `${cursorPrefix}:${offset + page.length}`,
      };
    },
    findTransactionsByType: (
      type: ccc.ScriptLike,
    ): AsyncGenerator<GroupedTransaction> =>
      (async function* () {
        const records =
          options.history?.get(ccc.Script.from(type).hash()) ?? [];
        for (const record of records) {
          yield record;
        }
      })(),
    getTransaction: async (txHash: ccc.HexLike) =>
      options.transactions?.get(ccc.hexFrom(txHash)),
  } as unknown as ccc.Client;

  return {
    client,
    queries,
    issuerScanCount: () => issuerScanCount,
    maxConcurrentIssuerScanCount: () => maxConcurrentIssuerScanCount,
  };
}

function activeIssuerMap(...cells: ccc.Cell[]): Map<ccc.Hex, ccc.Cell[]> {
  const result = new Map<ccc.Hex, ccc.Cell[]>();
  for (const cell of cells) {
    const type = cell.cellOutput.type;
    if (!type) {
      throw new Error("Identity fixture requires a Type Script");
    }
    const key = type.hash();
    result.set(key, [...(result.get(key) ?? []), cell]);
  }
  return result;
}

describe("ClaimData", () => {
  test("round-trips the V1 Molecule and DAG-CBOR payload", () => {
    const encoded = ClaimData.fromV1({
      issuerId: ISSUER_ID,
      nonce: repeatedHex(0x88, 32),
      issuedAt: 10n,
      expiresAt: 20n,
      payload: { account: "alice" },
    }).toHex();

    const decoded = ClaimData.decode(encoded);

    expect(decoded.type).toBe("v1");
    expect(decoded.value.issuerId).toBe(ISSUER_ID);
    expect(decoded.value.nonce).toBe(repeatedHex(0x88, 32));
    expect(decoded.value.issuedAt).toBe(10n);
    expect(decoded.value.expiresAt).toBe(20n);
    expect(decoded.value.payload).toEqual({ account: "alice" });
  });

  test("rejects trailing Molecule bytes and non-canonical DAG-CBOR", () => {
    const encoded = ClaimData.fromV1({
      issuerId: ISSUER_ID,
      nonce: repeatedHex(0x89, 32),
      issuedAt: 10n,
      payload: { account: "alice" },
    }).toBytes();
    expect(() => ClaimData.decode(ccc.bytesConcat(encoded, "0xff"))).toThrow(
      "invalid buffer size",
    );

    const nonCanonical = encodeClaimDataRaw({
      issuerId: ISSUER_ID,
      nonce: repeatedHex(0x8a, 32),
      issuedAt: 10n,
      payload: "0xa2616201616102",
    });
    expect(() => ClaimData.decode(nonCanonical)).toThrow(
      "not canonically encoded",
    );
  });
});

describe("readClaims", () => {
  test("reads every indexer page and evaluates the exact expiry boundary", async () => {
    const first = claimCell({ outPointByte: 0x01, expiresAt: 20n });
    const second = claimCell({ outPointByte: 0x02, issuedAt: 20n });
    const issuer = identityCell({ outPointByte: 0x03 });
    const fake = fakeClient({
      claimCells: [first, second],
      issuerCells: activeIssuerMap(issuer),
    });

    const result = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: {
        subject: { lock: SUBJECT_LOCK },
        evaluationTime: 20n,
        pageSize: 1,
      },
    });

    expect(result.invalid).toEqual([]);
    expect(result.claims).toHaveLength(2);
    expect(result.claims[0].verification.time).toEqual({
      status: "expired",
      evaluatedAt: 20n,
    });
    expect(result.claims[1].verification.time).toEqual({
      status: "active",
      evaluatedAt: 20n,
    });
    expect(result.claims[0].issuerState).toEqual({
      status: "active",
      cell: issuer,
      controller: CONTROLLER_LOCK,
    });
    expect(result.claims[0]).toMatchObject({
      version: "v1",
      claimId:
        "0x13dce23a674885ba1c49b10b20559c3b14fa4b801a2ff768936ed20de2829998",
      issuerDid: argsToDid(ISSUER_ID),
      issuerId: ISSUER_ID,
      subjectLockHash: SUBJECT_LOCK.hash(),
      schemaHash: SCHEMA_HASH,
      nonce: repeatedHex(0x01, 32),
      issuedAt: 10n,
      expiresAt: 20n,
      payload: { account: "alice" },
      verification: {
        inclusion: "live",
        issuerAuthorization: "accepted-by-configured-claim-type",
        time: { status: "expired", evaluatedAt: 20n },
      },
    });
    expect(result.claims[0].subjectLock.eq(SUBJECT_LOCK)).toBe(true);
    expect(fake.issuerScanCount()).toBe(2);
    expect(
      fake.queries.filter((query) => query.key.scriptType === "lock"),
    ).toHaveLength(3);
  });

  test("keeps time evaluation explicit and preserves descending indexer order", async () => {
    const older = claimCell({ outPointByte: 0x04, issuedAt: 20n });
    const newer = claimCell({ outPointByte: 0x05, issuedAt: 30n });
    const issuer = identityCell({ outPointByte: 0x06 });
    const fake = fakeClient({
      claimCells: [older, newer],
      issuerCells: activeIssuerMap(issuer),
    });

    const unevaluated = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK }, order: "desc" },
    });

    expect(
      unevaluated.claims.map((claim) => claim.cell.outPoint.txHash),
    ).toEqual([newer.outPoint.txHash, older.outPoint.txHash]);
    expect(unevaluated.claims.map((claim) => claim.verification.time)).toEqual([
      { status: "not-evaluated" },
      { status: "not-evaluated" },
    ]);
    expect(fake.issuerScanCount()).toBe(1);

    const beforeIssuance = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK }, evaluationTime: 19n },
    });
    expect(beforeIssuance.claims[0].verification.time).toEqual({
      status: "not-yet-active",
      evaluatedAt: 19n,
    });
  });

  test("applies issuer and schema filters after deployment validation", async () => {
    const matching = claimCell({ outPointByte: 0x10 });
    const otherSchema = claimCell({
      outPointByte: 0x11,
      schemaHash: OTHER_SCHEMA_HASH,
    });
    const otherIssuer = claimCell({
      outPointByte: 0x12,
      issuerId: OTHER_ISSUER_ID,
    });
    const foreignDeployment = {
      codeHash: repeatedHex(0x99, 32),
      hashType: "type",
      cellDeps: [],
    } satisfies ccc.ScriptInfoLike;
    const foreign = claimCell({
      outPointByte: 0x13,
      schemaHash: OTHER_SCHEMA_HASH,
      issuerDeployment: foreignDeployment,
    });
    const fake = fakeClient({
      claimCells: [matching, otherSchema, otherIssuer, foreign],
      issuerCells: activeIssuerMap(identityCell({ outPointByte: 0x14 })),
    });

    const result = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: {
        subject: { lock: SUBJECT_LOCK },
        issuerDid: argsToDid(ISSUER_ID),
        schemaHash: SCHEMA_HASH,
      },
    });

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].cell.outPoint.eq(matching.outPoint)).toBe(true);
    expect(result.invalid.map(({ code }) => code)).toEqual([
      "unsupported-issuer-deployment",
    ]);
  });

  test("isolates malformed type, Molecule, DAG-CBOR, and canonicality failures", async () => {
    const malformedArgs = claimCell({
      outPointByte: 0x20,
      type: ccc.Script.from({
        codeHash: CLAIM_TYPE_INFO.codeHash,
        hashType: CLAIM_TYPE_INFO.hashType,
        args: "0x01",
      }),
    });
    const unsupportedVersionBytes = ccc.bytesFrom(
      ClaimData.fromV1({
        issuerId: ISSUER_ID,
        nonce: repeatedHex(0x21, 32),
        issuedAt: 10n,
        payload: { ok: true },
      }).toBytes(),
    );
    unsupportedVersionBytes[0] = 1;
    const unsupportedVersion = claimCell({
      outPointByte: 0x21,
      outputData: ccc.hexFrom(unsupportedVersionBytes),
    });
    const malformedMolecule = claimCell({
      outPointByte: 0x22,
      outputData: "0x00000000",
    });
    const invalidCbor = claimCell({
      outPointByte: 0x23,
      outputData: ccc.hexFrom(
        encodeClaimDataRaw({
          issuerId: ISSUER_ID,
          nonce: repeatedHex(0x23, 32),
          issuedAt: 10n,
          payload: "0xff",
        }),
      ),
    });
    const nonCanonicalCbor = claimCell({
      outPointByte: 0x24,
      outputData: ccc.hexFrom(
        encodeClaimDataRaw({
          issuerId: ISSUER_ID,
          nonce: repeatedHex(0x24, 32),
          issuedAt: 10n,
          payload: "0xa2616201616102",
        }),
      ),
    });
    const fake = fakeClient({
      claimCells: [
        malformedArgs,
        unsupportedVersion,
        malformedMolecule,
        invalidCbor,
        nonCanonicalCbor,
      ],
    });

    const result = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims).toEqual([]);
    expect(result.invalid.map(({ code }) => code)).toEqual([
      "invalid-type-args",
      "unsupported-data-version",
      "invalid-claim-data",
      "invalid-dag-cbor",
      "non-canonical-dag-cbor",
    ]);
  });

  test("isolates invalid Claim data constraints", async () => {
    const emptyPayload = claimCell({
      outPointByte: 0x25,
      outputData: ccc.hexFrom(
        encodeClaimDataRaw({
          issuerId: ISSUER_ID,
          nonce: repeatedHex(0x25, 32),
          issuedAt: 10n,
          payload: "0x",
        }),
      ),
    });
    const zeroIssuedAt = claimCell({ outPointByte: 0x26, issuedAt: 0n });
    const invalidExpiry = claimCell({
      outPointByte: 0x27,
      issuedAt: 10n,
      expiresAt: 10n,
    });
    const oversized = claimCell({
      outPointByte: 0x28,
      outputData: ccc.hexFrom(new Uint8Array(16 * 1024 + 1)),
    });
    const invalidHashTypeArgs = ccc.bytesFrom(claimType().args);
    invalidHashTypeArgs[32] = 0xff;
    const invalidHashType = claimCell({
      outPointByte: 0x29,
      type: ccc.Script.from({
        codeHash: CLAIM_TYPE_INFO.codeHash,
        hashType: CLAIM_TYPE_INFO.hashType,
        args: ccc.hexFrom(invalidHashTypeArgs),
      }),
    });
    const result = await readClaims({
      client: fakeClient({
        claimCells: [
          emptyPayload,
          zeroIssuedAt,
          invalidExpiry,
          oversized,
          invalidHashType,
        ],
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims).toEqual([]);
    expect(result.invalid.map(({ code }) => code)).toEqual([
      "invalid-claim-data",
      "invalid-claim-data",
      "invalid-claim-data",
      "invalid-claim-data",
      "invalid-type-args",
    ]);
  });

  test("deduplicates identical live claim IDs in indexer order", async () => {
    const first = claimCell({ outPointByte: 0x30, nonceByte: 0xaa });
    const duplicate = claimCell({ outPointByte: 0x31, nonceByte: 0xaa });
    const fake = fakeClient({
      claimCells: [first, duplicate],
      issuerCells: activeIssuerMap(identityCell({ outPointByte: 0x32 })),
    });

    const result = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].cell.outPoint.eq(first.outPoint)).toBe(true);
    expect(result.claims[0].duplicateCells).toHaveLength(1);
    expect(
      result.claims[0].duplicateCells[0].outPoint.eq(duplicate.outPoint),
    ).toBe(true);
  });

  test("bounds concurrent issuer lookups", async () => {
    const issuerIds = Array.from({ length: 12 }, (_, index) =>
      repeatedHex(0x80 + index, 20),
    );
    const fake = fakeClient({
      claimCells: issuerIds.map((issuerId, index) =>
        claimCell({ outPointByte: 0xa0 + index, issuerId }),
      ),
      issuerCells: activeIssuerMap(
        ...issuerIds.map((issuerId, index) =>
          identityCell({ outPointByte: 0xc0 + index, issuerId }),
        ),
      ),
      issuerScanDelayMs: 5,
    });

    const result = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims).toHaveLength(issuerIds.length);
    expect(fake.maxConcurrentIssuerScanCount()).toBe(8);
  });

  test("derives the default DID Lock from a did:ckb subject", async () => {
    const identity = issuerType(SUBJECT_ID);
    const expectedLock = ccc.Script.from({
      codeHash: DID_LOCK_INFO.codeHash,
      hashType: DID_LOCK_INFO.hashType,
      args: identity.hash(),
    });
    const cell = claimCell({ outPointByte: 0x40, subjectLock: expectedLock });
    const fake = fakeClient({
      claimCells: [cell],
      issuerCells: activeIssuerMap(identityCell({ outPointByte: 0x41 })),
    });

    const result = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { did: argsToDid(SUBJECT_ID) } },
    });

    expect(result.claims).toHaveLength(1);
    const subjectQuery = fake.queries.find(
      (query) => query.key.scriptType === "lock",
    );
    expect(ccc.Script.from(subjectQuery!.key.script).eq(expectedLock)).toBe(
      true,
    );
  });

  test("reports missing, ambiguous, and unavailable issuer states", async () => {
    const cell = claimCell({ outPointByte: 0x50 });

    const missing = await readClaims({
      client: fakeClient({ claimCells: [cell] }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });
    expect(missing.claims[0].issuerState).toEqual({ status: "missing" });

    const firstState = identityCell({ outPointByte: 0x51 });
    const secondState = identityCell({ outPointByte: 0x52 });
    const ambiguous = await readClaims({
      client: fakeClient({
        claimCells: [cell],
        issuerCells: activeIssuerMap(firstState, secondState),
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });
    expect(ambiguous.claims[0].issuerState).toEqual({
      status: "ambiguous",
      cells: [firstState, secondState],
    });

    const unavailable = await readClaims({
      client: fakeClient({ claimCells: [cell], failIssuerScan: true }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });
    expect(unavailable.claims[0].issuerState).toEqual({
      status: "unavailable",
      reason: "issuer indexer unavailable",
    });

    const mismatchedIssuerCells = new Map<ccc.Hex, ccc.Cell[]>([
      [
        issuerType().hash(),
        [identityCell({ outPointByte: 0x57, issuerId: OTHER_ISSUER_ID })],
      ],
    ]);
    const mismatched = await readClaims({
      client: fakeClient({
        claimCells: [cell],
        issuerCells: mismatchedIssuerCells,
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });
    expect(mismatched.claims[0].issuerState).toEqual({
      status: "unavailable",
      reason: "CKB indexer returned a Cell outside the exact issuer Type query",
    });
  });

  test("proves deactivation from a complete issuer transaction history", async () => {
    const type = issuerType();
    const genesis = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: repeatedHex(0xb0, 32), index: 0 },
        },
      ],
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const genesisHash = genesis.hash();
    const rotation = ccc.Transaction.from({
      inputs: [{ previousOutput: { txHash: genesisHash, index: 0 } }],
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const rotationHash = rotation.hash();
    const deactivation = ccc.Transaction.from({
      inputs: [{ previousOutput: { txHash: rotationHash, index: 0 } }],
      outputs: [
        {
          capacity: 10_000_000_000n,
          lock: CONTROLLER_LOCK,
        },
      ],
      outputsData: ["0x"],
    });
    const deactivationHash = deactivation.hash();
    const history = new Map<ccc.Hex, GroupedTransaction[]>([
      [
        type.hash(),
        [
          {
            txHash: genesisHash,
            blockNumber: 1n,
            txIndex: 0n,
            cells: [{ isInput: false, cellIndex: 0n }],
          },
          {
            txHash: rotationHash,
            blockNumber: 2n,
            txIndex: 0n,
            cells: [
              { isInput: true, cellIndex: 0n },
              { isInput: false, cellIndex: 0n },
            ],
          },
          {
            txHash: deactivationHash,
            blockNumber: 3n,
            txIndex: 0n,
            cells: [{ isInput: true, cellIndex: 0n }],
          },
        ],
      ],
    ]);
    const transactions = new Map<ccc.Hex, ccc.ClientTransactionResponse>([
      [
        genesisHash,
        ccc.ClientTransactionResponse.from({
          transaction: genesis,
          status: "committed",
        }),
      ],
      [
        rotationHash,
        ccc.ClientTransactionResponse.from({
          transaction: rotation,
          status: "committed",
        }),
      ],
      [
        deactivationHash,
        ccc.ClientTransactionResponse.from({
          transaction: deactivation,
          status: "committed",
        }),
      ],
    ]);
    const result = await readClaims({
      client: fakeClient({
        claimCells: [claimCell({ outPointByte: 0x53 })],
        history,
        transactions,
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims[0].issuerState).toEqual({ status: "deactivated" });
  });

  test("fails closed when issuer history transaction contents do not match", async () => {
    const type = issuerType();
    const recordHash = repeatedHex(0xc0, 32);
    const differentTransaction = ccc.Transaction.from({
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const history = new Map<ccc.Hex, GroupedTransaction[]>([
      [
        type.hash(),
        [
          {
            txHash: recordHash,
            blockNumber: 1n,
            txIndex: 0n,
            cells: [{ isInput: false, cellIndex: 0n }],
          },
        ],
      ],
    ]);
    const transactions = new Map<ccc.Hex, ccc.ClientTransactionResponse>([
      [
        recordHash,
        ccc.ClientTransactionResponse.from({
          transaction: differentTransaction,
          status: "committed",
        }),
      ],
    ]);

    const result = await readClaims({
      client: fakeClient({
        claimCells: [claimCell({ outPointByte: 0x54 })],
        history,
        transactions,
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims[0].issuerState).toEqual({
      status: "unavailable",
      reason: `Issuer transaction ${recordHash} has mismatched contents`,
    });
  });

  test("uses committed transaction outputs when reconstructing issuer history", async () => {
    const type = issuerType();
    const creation = ccc.Transaction.from({
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const creationHash = creation.hash();
    const rotation = ccc.Transaction.from({
      inputs: [{ previousOutput: { txHash: creationHash, index: 0 } }],
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const rotationHash = rotation.hash();
    const history = new Map<ccc.Hex, GroupedTransaction[]>([
      [
        type.hash(),
        [
          {
            txHash: creationHash,
            blockNumber: 1n,
            txIndex: 0n,
            cells: [{ isInput: false, cellIndex: 0n }],
          },
          {
            txHash: rotationHash,
            blockNumber: 2n,
            txIndex: 0n,
            cells: [{ isInput: true, cellIndex: 0n }],
          },
        ],
      ],
    ]);
    const transactions = new Map<ccc.Hex, ccc.ClientTransactionResponse>([
      [
        creationHash,
        ccc.ClientTransactionResponse.from({
          transaction: creation,
          status: "committed",
        }),
      ],
      [
        rotationHash,
        ccc.ClientTransactionResponse.from({
          transaction: rotation,
          status: "committed",
        }),
      ],
    ]);

    const result = await readClaims({
      client: fakeClient({
        claimCells: [claimCell({ outPointByte: 0x59 })],
        history,
        transactions,
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims[0].issuerState).toEqual({
      status: "unavailable",
      reason: `Issuer history has mismatched outputs at ${rotationHash}`,
    });
  });

  test("fails closed when issuer history recreates a deactivated state", async () => {
    const type = issuerType();
    const firstCreation = ccc.Transaction.from({
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const firstCreationHash = firstCreation.hash();
    const deactivation = ccc.Transaction.from({
      inputs: [{ previousOutput: { txHash: firstCreationHash, index: 0 } }],
    });
    const deactivationHash = deactivation.hash();
    const secondCreation = ccc.Transaction.from({
      inputs: [
        {
          previousOutput: { txHash: repeatedHex(0xc1, 32), index: 0 },
        },
      ],
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type,
        },
      ],
      outputsData: ["0x"],
    });
    const secondCreationHash = secondCreation.hash();
    const history = new Map<ccc.Hex, GroupedTransaction[]>([
      [
        type.hash(),
        [
          {
            txHash: firstCreationHash,
            blockNumber: 1n,
            txIndex: 0n,
            cells: [{ isInput: false, cellIndex: 0n }],
          },
          {
            txHash: deactivationHash,
            blockNumber: 2n,
            txIndex: 0n,
            cells: [{ isInput: true, cellIndex: 0n }],
          },
          {
            txHash: secondCreationHash,
            blockNumber: 3n,
            txIndex: 0n,
            cells: [{ isInput: false, cellIndex: 0n }],
          },
        ],
      ],
    ]);
    const transactions = new Map<ccc.Hex, ccc.ClientTransactionResponse>([
      [
        firstCreationHash,
        ccc.ClientTransactionResponse.from({
          transaction: firstCreation,
          status: "committed",
        }),
      ],
      [
        deactivationHash,
        ccc.ClientTransactionResponse.from({
          transaction: deactivation,
          status: "committed",
        }),
      ],
      [
        secondCreationHash,
        ccc.ClientTransactionResponse.from({
          transaction: secondCreation,
          status: "committed",
        }),
      ],
    ]);

    const result = await readClaims({
      client: fakeClient({
        claimCells: [claimCell({ outPointByte: 0x56 })],
        history,
        transactions,
      }).client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    expect(result.claims[0].issuerState).toEqual({
      status: "unavailable",
      reason: `Issuer history has an invalid creation at ${secondCreationHash}`,
    });
  });

  test("rejects an incomplete subject scan instead of returning partial results", async () => {
    const fake = fakeClient({ failSubjectScan: true });

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: { subject: { lock: SUBJECT_LOCK } },
      }),
    ).rejects.toThrow("subject indexer unavailable");
  });

  test("rejects a Cell outside the exact subject lock query", async () => {
    const fake = fakeClient({
      claimCells: [
        claimCell({
          outPointByte: 0x58,
          subjectLock: ccc.Script.from({
            codeHash: repeatedHex(0x90, 32),
            hashType: "type",
            args: "0x",
          }),
        }),
      ],
    });

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: { subject: { lock: SUBJECT_LOCK } },
      }),
    ).rejects.toThrow("outside the configured subject lock query");
  });

  test("rejects a stalled subject pagination cursor", async () => {
    const fake = fakeClient({
      claimCells: [claimCell({ outPointByte: 0x55 })],
      stallSubjectCursor: true,
    });

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: { subject: { lock: SUBJECT_LOCK }, pageSize: 1 },
      }),
    ).rejects.toThrow("CKB indexer pagination did not advance");
  });

  test("validates caller configuration before querying", async () => {
    const fake = fakeClient();

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: { subject: { lock: SUBJECT_LOCK }, pageSize: 0 },
      }),
    ).rejects.toThrow("pageSize must be an integer between 1 and 100");

    await expect(
      readClaims({
        client: fake.client,
        scripts: { claimType: CLAIM_TYPE_INFO, didCkb: DID_CKB_INFO },
        filter: { subject: { did: argsToDid(SUBJECT_ID) } },
      }),
    ).rejects.toThrow("scripts.didLock is required");

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: {
          subject: { lock: SUBJECT_LOCK },
          order: "sideways" as "asc",
        },
      }),
    ).rejects.toThrow('order must be either "asc" or "desc"');

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: { subject: { lock: SUBJECT_LOCK }, issuerDid: "" },
      }),
    ).rejects.toThrow("Expected did:ckb");

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: { subject: { lock: SUBJECT_LOCK }, schemaHash: "" },
      }),
    ).rejects.toThrow("schemaHash must be 32 bytes");

    await expect(
      readClaims({
        client: fake.client,
        scripts: SCRIPTS,
        filter: {
          subject: { lock: SUBJECT_LOCK },
          evaluationTime: Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ).rejects.toThrow("evaluationTime numbers must be safe integers");
  });
});

describe("parseClaimPayload", () => {
  test("checks the schema hash before parsing", async () => {
    const fake = fakeClient({
      claimCells: [claimCell({ outPointByte: 0x60 })],
      issuerCells: activeIssuerMap(identityCell({ outPointByte: 0x61 })),
    });
    const { claims } = await readClaims({
      client: fake.client,
      scripts: SCRIPTS,
      filter: { subject: { lock: SUBJECT_LOCK } },
    });

    const payload = parseClaimPayload(claims[0], {
      id: "example.profile.v1",
      hash: SCHEMA_HASH,
      parse: (value) => {
        if (
          typeof value !== "object" ||
          value === null ||
          !("account" in value) ||
          typeof value.account !== "string"
        ) {
          throw new Error("Invalid GitHub payload");
        }
        return { account: value.account };
      },
    });
    expect(payload).toEqual({ account: "alice" });

    expect(() =>
      parseClaimPayload(claims[0], {
        id: "other.v1",
        hash: OTHER_SCHEMA_HASH,
        parse: () => ({ ok: true }),
      }),
    ).toThrow("does not match other.v1");
  });
});

import { ccc } from "@ckb-ccc/core";
import { describe, expect, test } from "vitest";
import { argsToDid } from "../identifier";

import { ClaimData } from "./codec";
import type { ClaimScriptConfigLike, WriteClaimInput } from "./types";
import { buildClaimCell, writeClaim, writeClaims } from "./write";

function repeatedHex(byte: number, length: number): ccc.Hex {
  return `0x${byte.toString(16).padStart(2, "0").repeat(length)}`;
}

const CLAIM_TYPE_INFO = {
  codeHash: repeatedHex(0x11, 32),
  hashType: "type",
  cellDeps: [
    {
      cellDep: {
        outPoint: { txHash: repeatedHex(0xa1, 32), index: 0 },
        depType: "code",
      },
    },
  ],
} satisfies ccc.ScriptInfoLike;

const DID_CKB_INFO = {
  codeHash: repeatedHex(0x22, 32),
  hashType: "type",
  cellDeps: [
    {
      cellDep: {
        outPoint: { txHash: repeatedHex(0xa2, 32), index: 0 },
        depType: "code",
      },
    },
  ],
} satisfies ccc.ScriptInfoLike;

const DID_LOCK_INFO = {
  codeHash: repeatedHex(0x33, 32),
  hashType: "type",
  cellDeps: [
    {
      cellDep: {
        outPoint: { txHash: repeatedHex(0xa3, 32), index: 0 },
        depType: "code",
      },
    },
  ],
} satisfies ccc.ScriptInfoLike;

const DAO_INFO = {
  codeHash: repeatedHex(0xd0, 32),
  hashType: "type",
  cellDeps: [],
} satisfies ccc.ScriptInfoLike;

const SCRIPTS = {
  claimType: CLAIM_TYPE_INFO,
  didCkb: DID_CKB_INFO,
  didLock: DID_LOCK_INFO,
} satisfies ClaimScriptConfigLike;

const ISSUER_ID = repeatedHex(0x44, 20);
const ISSUER_DID = argsToDid(ISSUER_ID);
const SUBJECT_ID = repeatedHex(0x45, 20);
const SUBJECT_DID = argsToDid(SUBJECT_ID);
const OTHER_ISSUER_ID = repeatedHex(0x46, 20);
const SCHEMA_HASH = repeatedHex(0x55, 32);
const CONTROLLER_LOCK = ccc.Script.from({
  codeHash: repeatedHex(0x61, 32),
  hashType: "type",
  args: repeatedHex(0x62, 20),
});
const PAYER_LOCK = ccc.Script.from({
  codeHash: repeatedHex(0x63, 32),
  hashType: "type",
  args: repeatedHex(0x64, 20),
});
const SUBJECT_LOCK = ccc.Script.from({
  codeHash: repeatedHex(0x65, 32),
  hashType: "type",
  args: repeatedHex(0x66, 20),
});

const BASE_INPUT = {
  subject: { lock: SUBJECT_LOCK },
  issuerDid: ISSUER_DID,
  schemaHash: SCHEMA_HASH,
  payload: { account: "alice" },
  issuedAt: 1_700_000_000n,
  nonce: repeatedHex(0x77, 32),
} satisfies WriteClaimInput;

function issuerType(issuerId: ccc.Hex = ISSUER_ID): ccc.Script {
  return ccc.Script.from({
    codeHash: DID_CKB_INFO.codeHash,
    hashType: DID_CKB_INFO.hashType,
    args: issuerId,
  });
}

function subjectType(): ccc.Script {
  return ccc.Script.from({
    codeHash: DID_CKB_INFO.codeHash,
    hashType: DID_CKB_INFO.hashType,
    args: SUBJECT_ID,
  });
}

function didLock(type: ccc.Script = subjectType()): ccc.Script {
  return ccc.Script.from({
    codeHash: DID_LOCK_INFO.codeHash,
    hashType: DID_LOCK_INFO.hashType,
    args: type.hash(),
  });
}

function cell(options: {
  byte: number;
  index?: number;
  capacity?: bigint;
  lock?: ccc.Script;
  type?: ccc.Script;
  data?: ccc.Hex;
}): ccc.Cell {
  return ccc.Cell.from({
    outPoint: {
      txHash: repeatedHex(options.byte, 32),
      index: options.index ?? 0,
    },
    cellOutput: {
      capacity: options.capacity ?? 100_000_000_000n,
      lock: options.lock ?? CONTROLLER_LOCK,
      type: options.type,
    },
    outputData: options.data ?? "0x",
  });
}

function codeCells(): ccc.Cell[] {
  return [
    cell({ byte: 0xa1, lock: SUBJECT_LOCK }),
    cell({ byte: 0xa2, lock: SUBJECT_LOCK }),
    cell({ byte: 0xa3, lock: SUBJECT_LOCK }),
  ];
}

type FakeClientOptions = {
  cells?: ccc.Cell[];
  liveCells?: ccc.Cell[];
  addressPrefix?: string;
  feeRate?: bigint;
  genesisHash?: ccc.Hex;
};

function fakeClient(options: FakeClientOptions = {}) {
  const cells = new Map<string, ccc.Cell>();
  for (const value of [...codeCells(), ...(options.cells ?? [])]) {
    cells.set(`${value.outPoint.txHash}:${value.outPoint.index}`, value);
  }
  const liveCells = options.liveCells ?? [];

  const client = {
    url: "https://example.test",
    addressPrefix: options.addressPrefix ?? "ckt",
    getKnownScript: async (script: ccc.KnownScript) =>
      ccc.ScriptInfo.from(
        script === ccc.KnownScript.DidCkb ? DID_CKB_INFO : DAO_INFO,
      ),
    getCell: async (outPoint: ccc.OutPointLike) => {
      const value = ccc.OutPoint.from(outPoint);
      return cells.get(`${value.txHash}:${value.index}`);
    },
    getCellLiveNoCache: async (outPoint: ccc.OutPointLike) => {
      const value = ccc.OutPoint.from(outPoint);
      return cells.get(`${value.txHash}:${value.index}`);
    },
    getCellDeps: async (
      ...infos: (ccc.CellDepInfoLike | ccc.CellDepInfoLike[])[]
    ) =>
      infos
        .flat()
        .map((info) => ccc.CellDep.from(ccc.CellDepInfo.from(info).cellDep)),
    findCellsPagedNoCache: async (
      key: ccc.ClientIndexerSearchKeyLike,
    ): Promise<ccc.ClientFindCellsResponse> => {
      const type = ccc.Script.from(key.script);
      return {
        cells: liveCells.filter((value) => value.cellOutput.type?.eq(type)),
        lastCursor: "fixture:end",
      };
    },
    getHeaderByNumber: async () =>
      ({
        hash: options.genesisHash ?? repeatedHex(0xf0, 32),
      }) as ccc.ClientBlockHeader,
    getFeeRate: async () => options.feeRate ?? 1_000n,
  } as unknown as ccc.Client;

  return { client, cells };
}

type FakeSigner = ccc.Signer & {
  prepareCount: () => number;
};

function fakeSigner(
  client: ccc.Client,
  locks: readonly ccc.Script[],
  spendable: readonly ccc.Cell[],
  changePrepared?: (tx: ccc.Transaction) => void,
): FakeSigner {
  let prepareCount = 0;
  const addresses = locks.map((script) =>
    ccc.Address.from({ script, prefix: client.addressPrefix }),
  );
  const signer = {
    client,
    getAddressObjs: async () => addresses,
    getRecommendedAddressObj: async () => addresses[0],
    findCells: (
      _filter: unknown,
      _withData?: boolean | null,
    ): AsyncGenerator<ccc.Cell> =>
      (async function* () {
        for (const value of spendable) {
          yield value;
        }
      })(),
    prepareTransaction: async (tx: ccc.TransactionLike) => {
      prepareCount += 1;
      const prepared = ccc.Transaction.from(tx);
      changePrepared?.(prepared);
      return prepared;
    },
    prepareCount: () => prepareCount,
  } as unknown as FakeSigner;
  return signer;
}

function hasCellDep(tx: ccc.Transaction, outPoint: ccc.OutPointLike): boolean {
  return tx.cellDeps.some(({ outPoint: current }) => current.eq(outPoint));
}

describe("buildClaimCell", () => {
  test("encodes canonical Claim data and calculates exact occupied capacity", () => {
    const built = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: BASE_INPUT,
    });

    const decoded = ClaimData.decode(built.outputData);
    expect(decoded.value).toMatchObject({
      issuerId: ISSUER_ID,
      nonce: BASE_INPUT.nonce,
      issuedAt: BASE_INPUT.issuedAt,
      payload: BASE_INPUT.payload,
    });
    expect(built.output.capacity).toBe(
      ccc.CellOutput.from(
        { capacity: 0n, lock: built.output.lock, type: built.output.type },
        built.outputData,
      ).capacity,
    );
    expect(built.claimId).toBe(
      ccc.hashCkb(
        "0x56454c4c554d5f434c41494d5f563100",
        built.output.type!.hash(),
        SUBJECT_LOCK.hash(),
        built.outputData,
      ),
    );
  });

  test("honors extra capacity and rejects capacity below the occupied amount", () => {
    const minimum = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: BASE_INPUT,
    }).output.capacity;
    const extra = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: { ...BASE_INPUT, capacity: minimum + 1n },
    });
    expect(extra.output.capacity).toBe(minimum + 1n);
    expect(() =>
      buildClaimCell({
        claimType: CLAIM_TYPE_INFO,
        didCkb: DID_CKB_INFO,
        subjectLock: SUBJECT_LOCK,
        input: { ...BASE_INPUT, capacity: minimum - 1n },
      }),
    ).toThrow("below the occupied capacity");
  });

  test("validates identifiers, nonce, timestamp ordering, and the data limit", () => {
    expect(() =>
      buildClaimCell({
        claimType: CLAIM_TYPE_INFO,
        didCkb: DID_CKB_INFO,
        subjectLock: SUBJECT_LOCK,
        input: { ...BASE_INPUT, nonce: "0x01" },
      }),
    ).toThrow("nonce must be 32 bytes");
    expect(() =>
      buildClaimCell({
        claimType: CLAIM_TYPE_INFO,
        didCkb: DID_CKB_INFO,
        subjectLock: SUBJECT_LOCK,
        input: { ...BASE_INPUT, issuedAt: 0n },
      }),
    ).toThrow("issuedAt must be greater than zero");
    expect(() =>
      buildClaimCell({
        claimType: CLAIM_TYPE_INFO,
        didCkb: DID_CKB_INFO,
        subjectLock: SUBJECT_LOCK,
        input: { ...BASE_INPUT, expiresAt: BASE_INPUT.issuedAt },
      }),
    ).toThrow("expiresAt must be greater than issuedAt");
    expect(() =>
      buildClaimCell({
        claimType: CLAIM_TYPE_INFO,
        didCkb: DID_CKB_INFO,
        subjectLock: SUBJECT_LOCK,
        input: { ...BASE_INPUT, payload: { value: "x".repeat(17_000) } },
      }),
    ).toThrow("Claim data must not exceed 16384 bytes");
  });

  test("generates a 32-byte nonce when one is omitted", () => {
    const built = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: { ...BASE_INPUT, nonce: undefined },
    });
    expect(ccc.bytesFrom(built.nonce)).toHaveLength(32);
    expect(ClaimData.decode(built.outputData).value.nonce).toBe(built.nonce);
  });
});

describe("writeClaim issuer authorization", () => {
  test("uses a live issuer Cell as a dep and returns a balanced prepared transaction", async () => {
    const identity = cell({ byte: 0x01, type: issuerType() });
    const funding = cell({ byte: 0x02, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
    });

    expect(result.issuerSource).toEqual({ kind: "cell-dep", cellDepIndex: 0 });
    expect(result.controllerInputIndex).toBe(0);
    expect(result.outputIndex).toBe(0);
    expect(result.tx.inputs[0].previousOutput).toEqual(funding.outPoint);
    expect(result.tx.outputs[result.outputIndex].lock).toEqual(SUBJECT_LOCK);
    await expect(
      result.tx.getInputsCapacity(client),
    ).resolves.toBeGreaterThanOrEqual(result.tx.getOutputsCapacity());
    expect(hasCellDep(result.tx, identity.outPoint)).toBe(true);
    expect(
      hasCellDep(result.tx, CLAIM_TYPE_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(true);
    expect(
      hasCellDep(result.tx, DID_CKB_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(false);
    expect(signer.prepareCount()).toBeGreaterThan(0);
  });

  test("uses an issuer input during rotation and adds the DID Type dependency", async () => {
    const identity = cell({
      byte: 0x03,
      capacity: 50_000_000_000n,
      type: issuerType(),
    });
    const funding = cell({ byte: 0x04, capacity: 100_000_000_000n });
    const { client } = fakeClient({ cells: [identity, funding] });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const tx = ccc.Transaction.from({
      inputs: [identity],
      outputs: [identity.cellOutput],
      outputsData: [identity.outputData],
    });

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
      tx,
    });

    expect(result.issuerSource).toEqual({
      kind: "input",
      inputIndex: 0,
      outputIndex: 0,
    });
    expect(result.controllerInputIndex).toBe(0);
    expect(result.outputIndex).toBe(1);
    expect(
      hasCellDep(result.tx, DID_CKB_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(true);
  });

  test("uses a same-transaction issuer output", async () => {
    const funding = cell({ byte: 0x05, capacity: 100_000_000_000n });
    const { client } = fakeClient({ cells: [funding] });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const tx = ccc.Transaction.from({
      outputs: [
        {
          capacity: 20_000_000_000n,
          lock: CONTROLLER_LOCK,
          type: issuerType(),
        },
      ],
      outputsData: ["0x"],
    });

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
      tx,
    });

    expect(result.issuerSource).toEqual({ kind: "output", outputIndex: 0 });
    expect(result.controllerInputIndex).toBe(0);
    expect(result.outputIndex).toBe(1);
    expect(
      hasCellDep(result.tx, DID_CKB_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(true);
  });

  test("uses an issuer Cell already supplied as a direct dep", async () => {
    const identity = cell({ byte: 0x06, type: issuerType() });
    const funding = cell({ byte: 0x07, capacity: 100_000_000_000n });
    const { client } = fakeClient({ cells: [identity, funding] });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const tx = ccc.Transaction.from({
      cellDeps: [{ outPoint: identity.outPoint, depType: "code" }],
    });

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
      tx,
    });

    expect(result.issuerSource).toEqual({ kind: "cell-dep", cellDepIndex: 0 });
    expect(result.controllerInputIndex).toBe(0);
  });

  test("resolves an issuer state through a dep group", async () => {
    const identity = cell({ byte: 0x08, type: issuerType() });
    const depGroup = cell({
      byte: 0x09,
      data: ccc.hexFrom(
        ccc.mol.vector(ccc.OutPoint).encode([identity.outPoint]),
      ),
    });
    const funding = cell({ byte: 0x0a, capacity: 100_000_000_000n });
    const { client } = fakeClient({ cells: [identity, depGroup, funding] });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
      tx: {
        cellDeps: [{ outPoint: depGroup.outPoint, depType: "depGroup" }],
      },
    });

    expect(result.issuerSource).toEqual({ kind: "cell-dep", cellDepIndex: 0 });
  });

  test("returns the final issuer dep index after signer preparation", async () => {
    const identity = cell({ byte: 0x4d, type: issuerType() });
    const funding = cell({ byte: 0x4e, capacity: 100_000_000_000n });
    const prependedDep = cell({ byte: 0x4f, lock: SUBJECT_LOCK });
    const { client } = fakeClient({
      cells: [identity, funding, prependedDep],
      liveCells: [identity],
    });
    const issuerSigner = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const preparingSigner = fakeSigner(client, [PAYER_LOCK], [], (tx) => {
      tx.addCellDepsAtStart({
        outPoint: prependedDep.outPoint,
        depType: "code",
      });
    });

    const result = await writeClaim({
      issuerSigner,
      additionalSigners: [preparingSigner],
      scripts: SCRIPTS,
      input: BASE_INPUT,
    });

    expect(result.issuerSource).toEqual({ kind: "cell-dep", cellDepIndex: 1 });
    expect(result.tx.cellDeps[1].outPoint).toEqual(identity.outPoint);
  });

  test("rejects missing, ambiguous, and malformed issuer state combinations", async () => {
    const funding = cell({ byte: 0x0b, capacity: 100_000_000_000n });
    const missing = fakeClient({ cells: [funding] });
    const missingSigner = fakeSigner(
      missing.client,
      [CONTROLLER_LOCK],
      [funding],
    );
    await expect(
      writeClaim({
        issuerSigner: missingSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
      }),
    ).rejects.toThrow("issuer did:ckb identity has no live state");

    const identityA = cell({ byte: 0x0c, type: issuerType() });
    const identityB = cell({ byte: 0x0d, type: issuerType() });
    const ambiguous = fakeClient({
      cells: [funding, identityA, identityB],
      liveCells: [identityA, identityB],
    });
    const ambiguousSigner = fakeSigner(
      ambiguous.client,
      [CONTROLLER_LOCK],
      [funding],
    );
    await expect(
      writeClaim({
        issuerSigner: ambiguousSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
      }),
    ).rejects.toThrow("issuer did:ckb identity has ambiguous live state");

    const inputState = cell({ byte: 0x0e, type: issuerType() });
    const invalid = fakeClient({ cells: [inputState, funding] });
    const invalidSigner = fakeSigner(
      invalid.client,
      [CONTROLLER_LOCK],
      [funding],
    );
    await expect(
      writeClaim({
        issuerSigner: invalidSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
        tx: { inputs: [inputState] },
      }),
    ).rejects.toThrow("one matching input and one post-transaction output");
  });

  test("requires issuerSigner to control the selected DID controller", async () => {
    const identity = cell({ byte: 0x0f, type: issuerType() });
    const payerFunding = cell({
      byte: 0x10,
      capacity: 100_000_000_000n,
      lock: PAYER_LOCK,
    });
    const { client } = fakeClient({
      cells: [identity, payerFunding],
      liveCells: [identity],
    });
    const wrongSigner = fakeSigner(client, [PAYER_LOCK], [payerFunding]);

    await expect(
      writeClaim({
        issuerSigner: wrongSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
      }),
    ).rejects.toThrow("issuerSigner does not control");
  });

  test("rejects a signer that changes the selected issuer state", async () => {
    const identity = cell({ byte: 0x47, type: issuerType() });
    const funding = cell({ byte: 0x48, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const issuerSigner = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const changingSigner = fakeSigner(client, [PAYER_LOCK], [], (tx) => {
      tx.cellDeps = tx.cellDeps.filter(
        ({ outPoint }) => !outPoint.eq(identity.outPoint),
      );
    });

    await expect(
      writeClaim({
        issuerSigner,
        additionalSigners: [changingSigner],
        scripts: SCRIPTS,
        input: BASE_INPUT,
      }),
    ).rejects.toThrow("A signer changed the selected issuer DID state");
  });
});

describe("writeClaim subjects and input authorization", () => {
  test("anchors a live did:ckb subject and derives its DID Lock", async () => {
    const issuer = cell({ byte: 0x11, type: issuerType() });
    const subject = cell({ byte: 0x12, type: subjectType() });
    const funding = cell({ byte: 0x13, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [issuer, subject, funding],
      liveCells: [issuer, subject],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: { ...BASE_INPUT, subject: { did: SUBJECT_DID } },
    });

    expect(result.tx.outputs[result.outputIndex].lock).toEqual(didLock());
    expect(hasCellDep(result.tx, issuer.outPoint)).toBe(true);
    expect(hasCellDep(result.tx, subject.outPoint)).toBe(true);
    expect(
      hasCellDep(result.tx, DID_LOCK_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(false);
  });

  test("uses a post-transaction subject state and rejects subject deactivation", async () => {
    const issuer = cell({ byte: 0x14, type: issuerType() });
    const subject = cell({
      byte: 0x15,
      capacity: 30_000_000_000n,
      type: subjectType(),
    });
    const funding = cell({ byte: 0x16, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [issuer, subject, funding],
      liveCells: [issuer],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const input = { ...BASE_INPUT, subject: { did: SUBJECT_DID } } as const;

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input,
      tx: {
        inputs: [subject],
        outputs: [subject.cellOutput],
        outputsData: [subject.outputData],
      },
    });
    expect(result.tx.outputs[result.outputIndex].lock).toEqual(didLock());
    expect(
      hasCellDep(result.tx, DID_CKB_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(true);

    await expect(
      writeClaim({
        issuerSigner: signer,
        scripts: SCRIPTS,
        input,
        tx: { inputs: [subject] },
      }),
    ).rejects.toThrow("one matching input and one post-transaction output");
  });

  test("rejects a subject whose controller directly uses DID Lock", async () => {
    const recursiveController = ccc.Script.from({
      codeHash: DID_LOCK_INFO.codeHash,
      hashType: DID_LOCK_INFO.hashType,
      args: repeatedHex(0x99, 32),
    });
    const issuer = cell({ byte: 0x17, type: issuerType() });
    const subject = cell({
      byte: 0x18,
      type: subjectType(),
      lock: recursiveController,
    });
    const funding = cell({ byte: 0x19, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [issuer, subject, funding],
      liveCells: [issuer, subject],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    await expect(
      writeClaim({
        issuerSigner: signer,
        scripts: SCRIPTS,
        input: { ...BASE_INPUT, subject: { did: SUBJECT_DID } },
      }),
    ).rejects.toThrow("controller must not use the configured DID Lock");
  });

  test("prepares an atomic replacement input held under DID Lock", async () => {
    const issuer = cell({ byte: 0x1a, type: issuerType() });
    const oldClaim = cell({ byte: 0x1b, lock: didLock(issuerType()) });
    const funding = cell({ byte: 0x1c, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [issuer, oldClaim, funding],
      liveCells: [issuer],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: { ...BASE_INPUT, subject: { did: ISSUER_DID } },
      tx: { inputs: [oldClaim] },
    });

    expect(result.tx.inputs).toHaveLength(2);
    expect(result.controllerInputIndex).toBe(1);
    expect(
      hasCellDep(result.tx, DID_LOCK_INFO.cellDeps[0].cellDep.outPoint),
    ).toBe(true);
  });

  test("rejects a DID Lock input without identity-state evidence", async () => {
    const issuer = cell({ byte: 0x1d, type: issuerType() });
    const unknownDidLock = ccc.Script.from({
      codeHash: DID_LOCK_INFO.codeHash,
      hashType: DID_LOCK_INFO.hashType,
      args: repeatedHex(0xaa, 32),
    });
    const locked = cell({ byte: 0x1e, lock: unknownDidLock });
    const funding = cell({ byte: 0x1f, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [issuer, locked, funding],
      liveCells: [issuer],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    await expect(
      writeClaim({
        issuerSigner: signer,
        scripts: SCRIPTS,
        input: BASE_INPUT,
        tx: { inputs: [locked] },
      }),
    ).rejects.toThrow("exactly one identity cell-dep state");
  });

  test("rejects a signer that replaces the subject identity anchor", async () => {
    const issuer = cell({ byte: 0x49, type: issuerType() });
    const subject = cell({ byte: 0x4a, type: subjectType() });
    const funding = cell({ byte: 0x4b, capacity: 100_000_000_000n });
    const replacement = cell({ byte: 0x4c, lock: SUBJECT_LOCK });
    const { client } = fakeClient({
      cells: [issuer, subject, funding, replacement],
      liveCells: [issuer, subject],
    });
    const issuerSigner = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const changingSigner = fakeSigner(client, [PAYER_LOCK], [], (tx) => {
      tx.cellDeps = tx.cellDeps.map((cellDep) =>
        cellDep.outPoint.eq(subject.outPoint)
          ? ccc.CellDep.from({
              outPoint: replacement.outPoint,
              depType: "code",
            })
          : cellDep,
      );
    });

    await expect(
      writeClaim({
        issuerSigner,
        additionalSigners: [changingSigner],
        scripts: SCRIPTS,
        input: { ...BASE_INPUT, subject: { did: SUBJECT_DID } },
      }),
    ).rejects.toThrow("A signer changed the selected subject DID state");
  });
});

describe("writeClaim funding and composition", () => {
  test("returns a builder result without signing or broadcasting", async () => {
    const identity = cell({ byte: 0x20, type: issuerType() });
    const funding = cell({ byte: 0x21, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
    });

    expect(result.tx).toBeInstanceOf(ccc.Transaction);
    expect(result.tx.hash()).toMatch(/^0x[0-9a-f]{64}$/);
    expect("sendTransaction" in signer).toBe(false);
  });

  test("builds multiple claim outputs with one funding pass", async () => {
    const identity = cell({ byte: 0x54, type: issuerType() });
    const funding = cell({ byte: 0x55, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    const result = await writeClaims<unknown>({
      issuerSigner: signer,
      scripts: SCRIPTS,
      inputs: [
        BASE_INPUT,
        {
          ...BASE_INPUT,
          schemaHash: repeatedHex(0x56, 32),
          nonce: repeatedHex(0x57, 32),
          payload: { communities: ["nervos"] },
        },
      ],
    });

    expect(result.claims).toHaveLength(2);
    expect(new Set(result.claims.map(({ claimId }) => claimId)).size).toBe(2);
    expect(result.claims.map(({ outputIndex }) => outputIndex)).toEqual([0, 1]);
    expect(result.tx.outputsData.slice(0, 2)).toHaveLength(2);
    expect(result.tx.inputs).toHaveLength(1);
    expect(result.tx.inputs[0].previousOutput).toEqual(funding.outPoint);
  });

  test("rejects mixed subjects or issuers in one claim batch", async () => {
    const client = fakeClient().client;
    const signer = fakeSigner(client, [CONTROLLER_LOCK], []);

    await expect(
      writeClaims({
        issuerSigner: signer,
        scripts: SCRIPTS,
        inputs: [BASE_INPUT, { ...BASE_INPUT, subject: { did: SUBJECT_DID } }],
      }),
    ).rejects.toThrow("same subject and issuer DID");
    await expect(
      writeClaims({
        issuerSigner: signer,
        scripts: SCRIPTS,
        inputs: [
          BASE_INPUT,
          { ...BASE_INPUT, issuerDid: argsToDid(OTHER_ISSUER_ID) },
        ],
      }),
    ).rejects.toThrow("same subject and issuer DID");
  });

  test("keeps a separate issuer authorization input whole when another signer pays", async () => {
    const identity = cell({ byte: 0x22, type: issuerType() });
    const authorization = cell({ byte: 0x23, capacity: 6_100_000_000n });
    const payerFunding = cell({
      byte: 0x24,
      capacity: 100_000_000_000n,
      lock: PAYER_LOCK,
    });
    const { client } = fakeClient({
      cells: [identity, authorization, payerFunding],
      liveCells: [identity],
    });
    const issuerSigner = fakeSigner(client, [CONTROLLER_LOCK], [authorization]);
    const payerSigner = fakeSigner(client, [PAYER_LOCK], [payerFunding]);

    const result = await writeClaim({
      issuerSigner,
      payerSigner,
      scripts: SCRIPTS,
      input: BASE_INPUT,
    });

    expect(result.tx.inputs[0].previousOutput).toEqual(authorization.outPoint);
    expect(result.tx.outputs[0]).toEqual(
      ccc.CellOutput.from({
        capacity: authorization.cellOutput.capacity,
        lock: CONTROLLER_LOCK,
      }),
    );
    expect(result.outputIndex).toBe(1);
    expect(
      result.tx.inputs.some(({ previousOutput }) =>
        previousOutput.eq(payerFunding.outPoint),
      ),
    ).toBe(true);
    expect(issuerSigner.prepareCount()).toBeGreaterThan(0);
    expect(payerSigner.prepareCount()).toBeGreaterThan(0);
  });

  test("reports insufficient payer capacity with an actionable error", async () => {
    const identity = cell({ byte: 0x25, type: issuerType() });
    const funding = cell({ byte: 0x26, capacity: 6_100_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    await expect(
      writeClaim({ issuerSigner: signer, scripts: SCRIPTS, input: BASE_INPUT }),
    ).rejects.toThrow("Payer has insufficient CKB capacity");
  });

  test("rejects signers connected to different network prefixes", async () => {
    const first = fakeClient();
    const second = fakeClient({ addressPrefix: "ckb" });
    const issuerSigner = fakeSigner(first.client, [CONTROLLER_LOCK], []);
    const payerSigner = fakeSigner(second.client, [PAYER_LOCK], []);

    await expect(
      writeClaim({
        issuerSigner,
        payerSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
      }),
    ).rejects.toThrow("same CKB network");
  });

  test("rejects different genesis blocks even when address prefixes match", async () => {
    const first = fakeClient({ genesisHash: repeatedHex(0xf1, 32) });
    const second = fakeClient({ genesisHash: repeatedHex(0xf2, 32) });
    const issuerSigner = fakeSigner(first.client, [CONTROLLER_LOCK], []);
    const payerSigner = fakeSigner(second.client, [PAYER_LOCK], []);

    await expect(
      writeClaim({
        issuerSigner,
        payerSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
      }),
    ).rejects.toThrow("same CKB network");
  });

  test("requires coverage for every pre-existing input lock", async () => {
    const identity = cell({ byte: 0x27, type: issuerType() });
    const funding = cell({ byte: 0x28, capacity: 100_000_000_000n });
    const unrelated = cell({
      byte: 0x29,
      capacity: 10_000_000_000n,
      lock: PAYER_LOCK,
    });
    const { client } = fakeClient({
      cells: [identity, funding, unrelated],
      liveCells: [identity],
    });
    const issuerSigner = fakeSigner(client, [CONTROLLER_LOCK], [funding]);

    await expect(
      writeClaim({
        issuerSigner,
        scripts: SCRIPTS,
        input: BASE_INPUT,
        tx: { inputs: [unrelated] },
      }),
    ).rejects.toThrow("No supplied signer controls transaction input 0");

    const additionalSigner = fakeSigner(client, [PAYER_LOCK], []);
    const result = await writeClaim({
      issuerSigner,
      additionalSigners: [additionalSigner],
      scripts: SCRIPTS,
      input: BASE_INPUT,
      tx: { inputs: [unrelated] },
    });
    expect(additionalSigner.prepareCount()).toBe(1);
    expect(result.tx.inputs[0].previousOutput).toEqual(unrelated.outPoint);
  });

  test("returns the final controller index when signer preparation moves the input", async () => {
    const identity = cell({ byte: 0x50, type: issuerType() });
    const funding = cell({ byte: 0x51, capacity: 100_000_000_000n });
    const prependedInput = cell({
      byte: 0x52,
      capacity: 10_000_000_000n,
      lock: PAYER_LOCK,
    });
    const { client } = fakeClient({
      cells: [identity, funding, prependedInput],
      liveCells: [identity],
    });
    const issuerSigner = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const preparingSigner = fakeSigner(client, [PAYER_LOCK], [], (tx) => {
      tx.inputs.unshift(ccc.CellInput.from(prependedInput));
    });

    const result = await writeClaim({
      issuerSigner,
      additionalSigners: [preparingSigner],
      scripts: SCRIPTS,
      input: BASE_INPUT,
    });

    expect(result.controllerInputIndex).toBe(1);
    expect(result.tx.inputs[1].previousOutput).toEqual(funding.outPoint);
  });
});

describe("writeClaim existing Claim outputs", () => {
  test("preserves distinct claims and rejects a repeated claim ID", async () => {
    const identity = cell({ byte: 0x2a, type: issuerType() });
    const funding = cell({ byte: 0x2b, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const existing = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: { ...BASE_INPUT, nonce: repeatedHex(0x80, 32) },
    });

    const result = await writeClaim({
      issuerSigner: signer,
      scripts: SCRIPTS,
      input: BASE_INPUT,
      tx: { outputs: [existing.output], outputsData: [existing.outputData] },
    });
    expect(result.outputIndex).toBe(1);
    expect(result.tx.outputsData[0]).toBe(existing.outputData);

    await expect(
      writeClaim({
        issuerSigner: signer,
        scripts: SCRIPTS,
        input: BASE_INPUT,
        tx: {
          outputs: [
            buildClaimCell({
              claimType: CLAIM_TYPE_INFO,
              didCkb: DID_CKB_INFO,
              subjectLock: SUBJECT_LOCK,
              input: BASE_INPUT,
            }).output,
          ],
          outputsData: [
            buildClaimCell({
              claimType: CLAIM_TYPE_INFO,
              didCkb: DID_CKB_INFO,
              subjectLock: SUBJECT_LOCK,
              input: BASE_INPUT,
            }).outputData,
          ],
        },
      }),
    ).rejects.toThrow("would duplicate claim ID");
  });

  test("rejects malformed or differently issued outputs in the target group", async () => {
    const identity = cell({ byte: 0x2c, type: issuerType() });
    const funding = cell({ byte: 0x2d, capacity: 100_000_000_000n });
    const { client } = fakeClient({
      cells: [identity, funding],
      liveCells: [identity],
    });
    const signer = fakeSigner(client, [CONTROLLER_LOCK], [funding]);
    const target = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: BASE_INPUT,
    });

    await expect(
      writeClaim({
        issuerSigner: signer,
        scripts: SCRIPTS,
        input: BASE_INPUT,
        tx: {
          outputs: [
            {
              capacity: target.output.capacity,
              lock: SUBJECT_LOCK,
              type: target.output.type,
            },
          ],
          outputsData: ["0x00"],
        },
      }),
    ).rejects.toThrow("Existing Claim output 0 is malformed");

    const otherIssuer = buildClaimCell({
      claimType: CLAIM_TYPE_INFO,
      didCkb: DID_CKB_INFO,
      subjectLock: SUBJECT_LOCK,
      input: {
        ...BASE_INPUT,
        issuerDid: argsToDid(OTHER_ISSUER_ID),
        nonce: repeatedHex(0x81, 32),
      },
    });
    await expect(
      writeClaim({
        issuerSigner: signer,
        scripts: SCRIPTS,
        input: BASE_INPUT,
        tx: {
          outputs: [otherIssuer.output],
          outputsData: [otherIssuer.outputData],
        },
      }),
    ).rejects.toThrow("belongs to a different issuer");
  });
});

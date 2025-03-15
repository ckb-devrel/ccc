/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ccc, mol } from "@ckb-ccc/core";
import JSBI from "jsbi";
import { createCodecMap } from "../src/codec";
import { checkDependencies } from "../src/nearley";
import { CodecMap, MolType } from "../src/type";
import { toMolTypeMap } from "../src/utils";

beforeAll(() => {
  // override valueOf of jsbi to make it comparable under test environment
  JSBI.prototype["valueOf"] = function () {
    return this.toString();
  };
});

test("test simple codec", () => {
  const tokens: MolType[] = [
    { item: "byte", item_count: 1, name: "Uint8", type: "array" },
    { item: "byte", item_count: 64, name: "Uint512", type: "array" },
    { type: "option", name: "NumberOpt", item: "byte" },
    { type: "union", name: "PingPayload", items: ["byte", "Uint8"] },
  ];
  const codecMap = createCodecMap(toMolTypeMap(tokens));
  expect(codecMap["Uint8"].decode("0x01") === 1).toBeTruthy();
  expect(
    codecMap["Uint512"].decode(
      "0x01000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    ) === 1n,
  ).toBeTruthy();
  expect(codecMap["Uint8"].decode("0xff") === 255).toBeTruthy();
});

test("should UnitXX throw error if decimals not supported", () => {
  const tokens: MolType[] = [
    { item: "byte", item_count: 1, name: "Uint88", type: "array" },
  ];

  expect(() => {
    createCodecMap(toMolTypeMap(tokens));
  }).toThrow();
});

test("test codec with refs", () => {
  const tokens: MolType[] = [
    { item: "Bytes", name: "BytesVec", type: "vector" },
  ];
  const refs: CodecMap = { Bytes: mol.Bytes };
  const codecMap = createCodecMap(tokens, refs);
  expect(codecMap["BytesVec"].decode("0x0e00000008000000020000001234")).toEqual(
    ["0x1234"],
  );
});

// https://github.com/nervosnetwork/ckb/blob/5a7efe7a0b720de79ff3761dc6e8424b8d5b22ea/util/types/schemas/blockchain.mol
const ast: MolType[] = [
  { type: "array", name: "Uint32", item: "byte", item_count: 4 },
  { type: "array", name: "Uint64", item: "byte", item_count: 8 },
  { type: "array", name: "Uint128", item: "byte", item_count: 16 },
  { type: "array", name: "Byte32", item: "byte", item_count: 32 },
  { type: "array", name: "Uint256", item: "byte", item_count: 32 },
  { type: "vector", name: "Bytes", item: "byte" },
  { type: "option", name: "BytesOpt", item: "Bytes" },
  { type: "vector", name: "BytesVec", item: "Bytes" },
  { type: "vector", name: "Byte32Vec", item: "Byte32" },
  { type: "option", name: "ScriptOpt", item: "Script" },
  { type: "array", name: "ProposalShortId", item: "byte", item_count: 10 },
  { type: "vector", name: "UncleBlockVec", item: "UncleBlock" },
  { type: "vector", name: "TransactionVec", item: "Transaction" },
  { type: "vector", name: "ProposalShortIdVec", item: "ProposalShortId" },
  { type: "vector", name: "CellDepVec", item: "CellDep" },
  { type: "vector", name: "CellInputVec", item: "CellInput" },
  { type: "vector", name: "CellOutputVec", item: "CellOutput" },
  {
    type: "table",
    name: "Script",
    fields: [
      { name: "codeHash", type: "Byte32" },
      { name: "hashType", type: "byte" },
      { name: "args", type: "Bytes" },
    ],
  },
  {
    type: "struct",
    name: "OutPoint",
    fields: [
      { name: "txHash", type: "Byte32" },
      { name: "index", type: "Uint32" },
    ],
  },
  {
    type: "struct",
    name: "CellInput",
    fields: [
      { name: "since", type: "Uint64" },
      { name: "previousOutput", type: "OutPoint" },
    ],
  },
  {
    type: "table",
    name: "CellOutput",
    fields: [
      { name: "capacity", type: "Uint64" },
      { name: "lock", type: "Script" },
      { name: "type", type: "ScriptOpt" },
    ],
  },
  {
    type: "struct",
    name: "CellDep",
    fields: [
      { name: "outPoint", type: "OutPoint" },
      { name: "depType", type: "byte" },
    ],
  },
  {
    type: "table",
    name: "RawTransaction",
    fields: [
      { name: "version", type: "Uint32" },
      { name: "cellDeps", type: "CellDepVec" },
      { name: "headerDeps", type: "Byte32Vec" },
      { name: "inputs", type: "CellInputVec" },
      { name: "outputs", type: "CellOutputVec" },
      { name: "outputsData", type: "BytesVec" },
    ],
  },
  {
    type: "table",
    name: "Transaction",
    fields: [
      { name: "raw", type: "RawTransaction" },
      { name: "witnesses", type: "BytesVec" },
    ],
  },
  {
    type: "struct",
    name: "RawHeader",
    fields: [
      { name: "version", type: "Uint32" },
      { name: "compactTarget", type: "Uint32" },
      { name: "timestamp", type: "Uint64" },
      { name: "number", type: "Uint64" },
      { name: "epoch", type: "Uint64" },
      { name: "parentHash", type: "Byte32" },
      { name: "transactionsRoot", type: "Byte32" },
      { name: "proposalsHash", type: "Byte32" },
      { name: "extraHash", type: "Byte32" },
      { name: "dao", type: "Byte32" },
    ],
  },
  {
    type: "struct",
    name: "Header",
    fields: [
      { name: "raw", type: "RawHeader" },
      { name: "nonce", type: "Uint128" },
    ],
  },
  {
    type: "table",
    name: "UncleBlock",
    fields: [
      { name: "header", type: "Header" },
      { name: "proposals", type: "ProposalShortIdVec" },
    ],
  },
  {
    type: "table",
    name: "Block",
    fields: [
      { name: "header", type: "Header" },
      { name: "uncles", type: "UncleBlockVec" },
      { name: "transactions", type: "TransactionVec" },
      { name: "proposals", type: "ProposalShortIdVec" },
    ],
  },
  {
    type: "table",
    name: "BlockV1",
    fields: [
      { name: "header", type: "Header" },
      { name: "uncles", type: "UncleBlockVec" },
      { name: "transactions", type: "TransactionVec" },
      { name: "proposals", type: "ProposalShortIdVec" },
      { name: "extension", type: "Bytes" },
    ],
  },
  {
    type: "table",
    name: "CellbaseWitness",
    fields: [
      { name: "lock", type: "Script" },
      { name: "message", type: "Bytes" },
    ],
  },
  {
    type: "table",
    name: "WitnessArgs",
    fields: [
      { name: "lock", type: "BytesOpt" },
      { name: "inputType", type: "BytesOpt" },
      { name: "outputType", type: "BytesOpt" },
    ],
  },
];
checkDependencies(ast);
const codecMap = createCodecMap(toMolTypeMap(ast));
// below test cases come from:
// https://github.com/ckb-js/lumos/blob/e33aaa10d831edd58e904cb2215ea3148c37fba3/packages/base/tests/serialize.test.ts
test("should unpack Script", () => {
  expect(
    codecMap["Script"].decode(
      "0x3d0000001000000030000000310000009bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce80108000000aabbccdd44332211",
    ),
  ).toEqual({
    args: "0xaabbccdd44332211",
    codeHash:
      "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
    hashType: "0x01",
  });
});
test("should unpack OutPoint", () => {
  expect(
    codecMap["OutPoint"].decode(
      "0x4565f957aa65ca5d094ede05cbeaedcee70f5a71200ae2e31b643d2952c929bc03000000",
    ),
  ).toEqual({
    txHash:
      "0x4565f957aa65ca5d094ede05cbeaedcee70f5a71200ae2e31b643d2952c929bc",
    index: 3,
  });
});
test("should unpack CellInput", () => {
  expect(
    codecMap["CellInput"].decode(
      "0x341200a060000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da10000000",
    ),
  ).toEqual({
    since: ccc.numFrom("0x60a0001234"),
    previousOutput: {
      txHash:
        "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da",
      index: 16,
    },
  });
});

test("should unpack CellOutput", () => {
  expect(
    codecMap["CellOutput"].decode(
      "0x8400000010000000180000004f000000100000000000000037000000100000003000000031000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da0002000000123435000000100000003000000031000000a98c57135830e1b900000000f6c4b8870828199a786b26f09f7dec4bc27a73db0100000000",
    ),
  ).toEqual({
    capacity: ccc.numFrom("0x10"),
    lock: {
      codeHash:
        "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da",
      args: "0x1234",
      hashType: "0x00",
    },
    type: {
      codeHash:
        "0xa98c57135830e1b900000000f6c4b8870828199a786b26f09f7dec4bc27a73db",
      args: "0x",
      hashType: "0x01",
    },
  });
});

test("should unpack CellOutput without type", () => {
  expect(
    codecMap["CellOutput"].decode(
      "0x4f00000010000000180000004f000000100000000000000037000000100000003000000031000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da00020000001234",
    ),
  ).toEqual({
    capacity: ccc.numFrom("0x10"),
    lock: {
      codeHash:
        "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da",
      args: "0x1234",
      hashType: "0x00",
    },
    type: undefined,
  });
});

test("should unpack CellDep", () => {
  expect(
    codecMap["CellDep"].decode(
      "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da1100000000",
    ),
  ).toEqual({
    depType: "0x00",
    outPoint: {
      txHash:
        "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73da",
      index: 17,
    },
  });
});
test("should unpack Transaction", () => {
  expect(
    codecMap["Transaction"].decode(
      "0x1f0100000c0000000f010000030100001c00000020000000490000006d0000009d000000f40000000000000001000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7300000000000001000000b39d53656421d1532dd995a0924441ca8f43052bc2b7740a0e814a488a8214d6010000001000000000000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73010200000057000000080000004f00000010000000180000004f000000341200000000000037000000100000003000000031000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7302000200000012340f0000000800000003000000abcdef10000000080000000400000031313131",
    ),
  ).toEqual({
    raw: {
      version: 0,
      cellDeps: [
        {
          depType: "0x00",
          outPoint: {
            txHash:
              "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7300",
            index: 0,
          },
        },
      ],
      headerDeps: [
        "0xb39d53656421d1532dd995a0924441ca8f43052bc2b7740a0e814a488a8214d6",
      ],
      inputs: [
        {
          since: ccc.numFrom("0x10"),
          previousOutput: {
            txHash:
              "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7301",
            index: 2,
          },
        },
      ],
      outputs: [
        {
          capacity: ccc.numFrom("0x1234"),
          lock: {
            codeHash:
              "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7302",
            args: "0x1234",
            hashType: "0x00",
          },
          type: undefined,
        },
      ],
      outputsData: ["0xabcdef"],
    },
    witnesses: ["0x31313131"],
  });
});

test("should unpack Header", () => {
  expect(
    codecMap["Header"].decode(
      "0x0000000094342d1ac363a6ab70010000bcb10f000000000087020012060807003134874027b9b2b17391d2fa545344b10bd8b8c49d9ea47d55a447d01142b21b68a83c880eb942396d22020aa83343906986f66418e9b8a4488f2866ecc4e86a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040b4d9a3ddc9e730736c7342a2f023001240f362253b780000b6ca2f1e7901070001a084150000001a13af4950389b44",
    ),
  ).toEqual({
    nonce: ccc.numFrom("0x449b385049af131a0000001584a00100"),
    raw: {
      compactTarget: 439170196,
      number: ccc.numFrom("0xfb1bc"),
      parentHash:
        "0x3134874027b9b2b17391d2fa545344b10bd8b8c49d9ea47d55a447d01142b21b",
      timestamp: ccc.numFrom("0x170aba663c3"),
      transactionsRoot:
        "0x68a83c880eb942396d22020aa83343906986f66418e9b8a4488f2866ecc4e86a",
      proposalsHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      extraHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      version: 0,
      epoch: ccc.numFrom("0x7080612000287"),
      dao: "0x40b4d9a3ddc9e730736c7342a2f023001240f362253b780000b6ca2f1e790107",
    },
  });
});

test("should unpack UncleBlock", () => {
  expect(
    codecMap["UncleBlock"].decode(
      "0xf40000000c000000dc0000000000000094342d1ac363a6ab70010000bcb10f000000000087020012060807003134874027b9b2b17391d2fa545344b10bd8b8c49d9ea47d55a447d01142b21b68a83c880eb942396d22020aa83343906986f66418e9b8a4488f2866ecc4e86a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040b4d9a3ddc9e730736c7342a2f023001240f362253b780000b6ca2f1e7901070001a084150000001a13af4950389b440200000012345678901234567890abcdeabcdeabcdeabcde",
    ),
  ).toEqual({
    header: {
      nonce: ccc.numFrom("0x449b385049af131a0000001584a00100"),
      raw: {
        compactTarget: 439170196,
        number: ccc.numFrom("0xfb1bc"),
        parentHash:
          "0x3134874027b9b2b17391d2fa545344b10bd8b8c49d9ea47d55a447d01142b21b",
        timestamp: ccc.numFrom("0x170aba663c3"),
        transactionsRoot:
          "0x68a83c880eb942396d22020aa83343906986f66418e9b8a4488f2866ecc4e86a",
        proposalsHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        extraHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        version: 0,
        epoch: ccc.numFrom("0x7080612000287"),
        dao: "0x40b4d9a3ddc9e730736c7342a2f023001240f362253b780000b6ca2f1e790107",
      },
    },
    proposals: ["0x12345678901234567890", "0xabcdeabcdeabcdeabcde"],
  });
});

test("should unpack Block", () => {
  expect(
    codecMap["Block"].decode(
      "0x2502000014000000e4000000e80000000d0200000000000094342d1ac363a6ab70010000bcb10f000000000087020012060807003134874027b9b2b17391d2fa545344b10bd8b8c49d9ea47d55a447d01142b21b68a83c880eb942396d22020aa83343906986f66418e9b8a4488f2866ecc4e86a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040b4d9a3ddc9e730736c7342a2f023001240f362253b780000b6ca2f1e7901070001a084150000001a13af4950389b440400000025010000080000001d0100000c0000000f010000030100001c00000020000000490000006d0000009d000000f40000000000000001000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7300000000000001000000b39d53656421d1532dd995a0924441ca8f43052bc2b7740a0e814a488a8214d6010000001000000000000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a73010200000057000000080000004f00000010000000180000004f000000341200000000000037000000100000003000000031000000a98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7302000200000012340f0000000800000003000000abcdef0e000000080000000200000011110200000012345678901234567890abcdeabcdeabcdeabcde",
    ),
  ).toEqual({
    header: {
      nonce: ccc.numFrom("0x449b385049af131a0000001584a00100"),
      raw: {
        compactTarget: 439170196,
        number: ccc.numFrom("0xfb1bc"),
        parentHash:
          "0x3134874027b9b2b17391d2fa545344b10bd8b8c49d9ea47d55a447d01142b21b",
        timestamp: ccc.numFrom("0x170aba663c3"),
        transactionsRoot:
          "0x68a83c880eb942396d22020aa83343906986f66418e9b8a4488f2866ecc4e86a",
        proposalsHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        extraHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        version: 0,
        epoch: ccc.numFrom("0x7080612000287"),
        dao: "0x40b4d9a3ddc9e730736c7342a2f023001240f362253b780000b6ca2f1e790107",
      },
    },
    proposals: ["0x12345678901234567890", "0xabcdeabcdeabcdeabcde"],
    transactions: [
      {
        raw: {
          version: 0,
          cellDeps: [
            {
              depType: "0x00",
              outPoint: {
                txHash:
                  "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7300",
                index: 0,
              },
            },
          ],
          headerDeps: [
            "0xb39d53656421d1532dd995a0924441ca8f43052bc2b7740a0e814a488a8214d6",
          ],
          inputs: [
            {
              since: ccc.numFrom("0x10"),
              previousOutput: {
                txHash:
                  "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7301",
                index: 2,
              },
            },
          ],
          outputs: [
            {
              capacity: ccc.numFrom("0x1234"),
              lock: {
                codeHash:
                  "0xa98c57135830e1b91345948df6c4b8870828199a786b26f09f7dec4bc27a7302",
                args: "0x1234",
                hashType: "0x00",
              },
              type: undefined,
            },
          ],
          outputsData: ["0xabcdef"],
        },
        witnesses: ["0x1111"],
      },
    ],
    uncles: [],
  });
});

test("should unpack WitnessArgs", () => {
  expect(
    codecMap["WitnessArgs"].decode(
      "0x2200000010000000160000001c000000020000001234020000004678020000002312",
    ),
  ).toEqual({
    lock: "0x1234",
    inputType: "0x4678",
    outputType: "0x2312",
  });
});

test("should unpack empty WitnessArgs", () => {
  expect(
    codecMap["WitnessArgs"].decode("0x10000000100000001000000010000000"),
  ).toEqual({
    lock: undefined,
    inputType: undefined,
    outputType: undefined,
  });
});

test("should unpack only one WitnessArgs", () => {
  expect(
    codecMap["WitnessArgs"].decode(
      "0x16000000100000001600000016000000020000001234",
    ),
  ).toEqual({
    lock: "0x1234",
    inputType: undefined,
    outputType: undefined,
  });
});

test("checkDependencies should work correctly with union", () => {
  checkDependencies([
    { type: "array", name: "Uint8", item: "byte", item_count: 1 },
    { type: "array", name: "Uint16", item: "byte", item_count: 2 },
    { type: "array", name: "Uint32", item: "byte", item_count: 4 },

    // without custom id
    { type: "union", name: "Test1", items: ["Uint8", "Uint16", "Uint32"] },
    // prettier-ignore
    // with custom id
    { type: "union", name: "Test2", items: [["Uint8", 111], ["Uint16", 222], ["Uint32", 333]] },
  ]);

  // test passes if no exception is thrown
});

test("checkDependencies should throw when id is larger than uint32", () => {
  expect(() =>
    checkDependencies([
      { type: "array", name: "Uint8", item: "byte", item_count: 1 },
      { type: "union", name: "Test", items: [["Uint8", 0xff_ff_ff_ff + 1]] },
    ]),
  ).toThrow();
});

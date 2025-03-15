import {
  codegenProject,
  Options,
  codegen as originalCodegen,
  resolveImports,
} from "../src/codegen";

const codegen = (schema: string, options?: Options) => {
  return originalCodegen(schema, options).code;
};

function expectGenerated(schema: string, ...expected: string[]) {
  const generated = codegen(schema);

  return expected.every((item) => generated.includes(item));
}

test("fallback byte related generated", () => {
  expect(
    expectGenerated(
      `array Byte32 [byte; 32];`,
      `export const Byte32 = createFallbackFixedBytesCodec(32);`,
    ),
  ).toBeTruthy();

  expect(
    expectGenerated(
      `vector Bytes <byte>;`,
      `export const Bytes = fallbackBytesCodec;`,
    ),
  ).toBeTruthy();
});

test("array", () => {
  expect(
    expectGenerated(
      `array Uint8 [byte; 1];
array RGB [Uint8; 3];`,
      `export const Uint8 = createFallbackFixedBytesCodec(1);`,
      `export const RGB = array(Uint8, 3);`,
    ),
  ).toBeTruthy();
});

test("vector", () => {
  expect(
    expectGenerated(
      `vector Bytes <byte>;
vector BytesVec <Bytes>;`,
      `export const BytesVec = vector(Bytes);`,
    ),
  ).toBeTruthy();
});

// vector Bytes <byte>;
// option BytesOpt (Bytes);
test("option", () => {
  expect(
    expectGenerated(
      `vector Bytes <byte>;
option BytesOpt (Bytes);`,
      `export const BytesOpt = option(Bytes);`,
    ),
  ).toBeTruthy();
});

test("struct", () => {
  expect(
    expectGenerated(
      `
array Byte32 [byte; 32];
array Uint32 [byte; 4];
struct OutPoint {
  tx_hash:        Byte32,
  index:          Uint32,
}
`,
      `
export const OutPoint = struct({
  tx_hash: Byte32,
  index: Uint32
}, ['tx_hash', 'index'])`,
    ),
  ).toBeTruthy();
});

test("union", () => {
  const result1 = expectGenerated(
    `
array Uint8 [byte; 1];
array Uint16 [byte; 2];
union Number {
  Uint8,
  Uint16,
}
`,
    `export const Number = union({
  Uint8,
  Uint16
}, ['Uint8', 'Uint16'])`,
  );

  expect(result1).toBeTruthy();

  const result2 = expectGenerated(
    `
array Uint8 [byte; 1];
array Uint16 [byte; 2];
union Number {
  Uint8: 8,
  Uint16: 16,
}`,
    `
export const Number = union({
  Uint8,
  Uint16
}, {'Uint8': 8, 'Uint16': 16})`,
  );
  expect(result2).toBeTruthy();
});

test("table", () => {
  const generated = codegen(`
array Byte32 [byte; 32];
vector Bytes <byte>;
array HashType [byte; 1];

table Script {
    code_hash:      Byte32,
    hash_type:      HashType,
    args:           Bytes,
}
`);

  expect(
    generated.includes(`export const Byte32 = createFallbackFixedBytesCodec(32);

export const Bytes = fallbackBytesCodec;

export const HashType = createFallbackFixedBytesCodec(1);

export const Script = table({
  code_hash: Byte32,
  hash_type: HashType,
  args: Bytes
}, ['code_hash', 'hash_type', 'args'])`),
  ).toBeTruthy();
});

test("prepend", () => {
  const generated = codegen(
    `
array Uint8 [byte; 1];
array Uint16 [byte; 2];
`,
    {
      prepend: "import { Uint8 } from './customized'",
    },
  );

  expect(generated.includes(`export const Uint8`)).toBeFalsy();
  expect(generated.includes(`export const Uint16`)).toBeTruthy();
});

test("should throw when unknown type found", () => {
  expect(() => {
    codegen(`
union Something {
  Item1,
  Item2,
}
`);
  }).toThrow();
});

test("should erase if import statement exists", () => {
  const inputCode = `
import a;
  import b;
// import c;

struct X {
  value: byte,
}
`;
  const { code, importSchemas } = resolveImports(inputCode);

  expect(importSchemas).toEqual(["a", "b"]);
  expect(code).toBe(inputCode);
});

test("codegenProject", () => {
  const project = codegenProject([
    {
      path: "a.mol",
      content: `
import b;
import c/c1;

array A [byte;1];
`,
    },
    {
      path: "b.mol",
      content: `
import c/c1;

array B [byte;1];
`,
    },

    {
      path: "c/c1.mol",
      content: `
import ../d;

array C1 [byte;1];
`,
    },

    {
      path: "d.mol",
      content: `
/*
a block comment
*/      

array D [byte; 1]; 
`,
    },
  ]);

  const a = project.find((item) => item.path === "a.mol")!.content;
  expect(a.includes(`import { B } from './b'`)).toBeTruthy();
  expect(a.includes(`import { C1 } from './c/c1'`)).toBeTruthy();

  const b = project.find((item) => item.path === "b.mol")!.content;
  expect(b.includes(`import { C1 } from './c/c1'`)).toBeTruthy();

  const c1 = project.find((item) => item.path === "c/c1.mol")!.content;
  expect(c1.includes(`import { D } from '../d'`)).toBeTruthy();

  const d = project.find((item) => item.path === "d.mol")!.content;
  expect(d).toBeTruthy();
});

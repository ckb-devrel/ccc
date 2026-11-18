import { ccc, mol } from "@ckb-ccc/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { Schema, type SchemaLike } from "./compile.js";

describe("Schema.from", () => {
  it("compiles forward references and matches native CCC codecs", () => {
    const codecs = Schema.from(`
      table Packet { version: byte, payload: Bytes, pair: Pair, }
      struct Pair { first: Byte2, last: byte, }
      array Byte2 [byte; 2];
      vector Bytes <byte>;
    `);
    const native = mol.table({
      version: mol.Byte,
      payload: mol.Bytes,
      pair: mol.struct({ first: mol.array(mol.Byte, 2), last: mol.Byte }),
    });
    const value = {
      version: "0x01",
      payload: "0xcafe",
      pair: { first: "0x1234", last: "0x56" },
    };
    const encoded = codecs.get("Packet").encode(value);
    expect(encoded).toEqual(
      native.encode({
        ...value,
        pair: { ...value.pair, first: ["0x12", "0x34"] },
      }),
    );
    expect(codecs.get("Packet").decode(encoded)).toEqual(value);
    expect(Array.from(codecs.keys())).toEqual([
      "Packet",
      "Pair",
      "Byte2",
      "Bytes",
    ]);
  });

  it("uses declared shape, never special names", () => {
    const codecs = Schema.from(
      "array Uint64 [byte; 2]; array Byte32 [byte; 3];",
    );
    expect(codecs.get("Uint64").byteLength).toBe(2);
    expect(codecs.get("Uint64").decode("0x1234")).toBe("0x1234");
    expect(codecs.get("Byte32").byteLength).toBe(3);
    expect(() => codecs.get("Uint64").encode("0x01")).toThrow("byte length");
    expect(() => {
      codecs.get("Byte32").decode("0x1234");
    }).toThrow("byte length");
  });

  it("selects fixed and dynamic vectors from shape", () => {
    const codecs = Schema.from(
      `array Word [byte; 2]; vector Words <Word>; vector Data <byte>; vector Chunks <Data>;`,
    );
    expect(ccc.hexFrom(codecs.get("Words").encode(["0x1234", "0x5678"]))).toBe(
      "0x0200000012345678",
    );
    expect(codecs.get("Words").decode("0x0200000012345678")).toEqual([
      "0x1234",
      "0x5678",
    ]);
    expect(codecs.get("Chunks").encode(["0x12", "0x3456"])).toEqual(
      mol.vector(mol.Bytes).encode(["0x12", "0x3456"]),
    );
    expect(
      codecs.get("Chunks").decode(codecs.get("Chunks").encode([])),
    ).toEqual([]);
  });

  it("keeps unions dynamic and supports custom IDs and forward references", () => {
    const codecs = Schema.from(
      `union Value { Word: 5, byte, } vector Values <Value>; array Word [byte; 2];`,
    );
    expect(codecs.get("Value").byteLength).toBeUndefined();
    expect(
      ccc.hexFrom(
        codecs.get("Value").encode({ type: "Word", value: "0x1234" }),
      ),
    ).toBe("0x050000001234");
    expect(
      ccc.hexFrom(codecs.get("Value").encode({ type: "byte", value: "0x56" })),
    ).toBe("0x0600000056");
    const value = [{ type: "Word", value: "0x1234" }];
    expect(codecs.get("Values").encode(value)).toEqual(
      mol
        .vector(
          mol.union(
            { Word: mol.array(mol.Byte, 2), byte: mol.Byte },
            { Word: 5, byte: 6 },
          ),
        )
        .encode([{ type: "Word", value: ["0x12", "0x34"] }]),
    );
    expect(() => {
      codecs.get("Value").decode("0x0700000012");
    }).toThrow();
  });

  it("supports options, empty tables and nested arrays", () => {
    const codecs = Schema.from(
      `option Maybe (byte); table Empty {} array Pair [byte; 2]; array Pairs [Pair; 2];`,
    );
    expect(codecs.get("Maybe").encode(undefined)).toEqual(new Uint8Array());
    expect(codecs.get("Maybe").decode("0x01")).toBe("0x01");
    expect(codecs.get("Empty").decode("0x04000000")).toEqual({});
    expect(codecs.get("Pairs").decode("0x01020304")).toEqual([
      "0x0102",
      "0x0304",
    ]);
  });

  it("resolves explicit external references without mutation or fetching imports", () => {
    const references = new Schema(Object.freeze({ Number: ccc.CodecUint32 }));
    const codecs = Schema.from([
      "import numbers; table Count { n: Number, }",
      references,
    ]);
    expect(
      codecs.get("Count").decode(codecs.get("Count").encode({ n: 42 })),
    ).toEqual({
      n: 42,
    });
    expect([...references.keys()]).toEqual(["Number"]);
    expect(Array.from(codecs.keys())).toEqual(["Count", "Number"]);
    expect(() => Schema.from(["array Number [byte; 2];", references])).toThrow(
      "duplicate or reserved",
    );
    expect(() =>
      Schema.from([
        "table T { b: byte, }",
        new Schema({ byte: ccc.CodecUint8 }),
      ]),
    ).toThrow("duplicate or reserved");
  });

  it.each([
    ["table T { n: Missing, }", "unknown type"],
    ["option A (B); option B (A);", "cyclic"],
    ["option A (A);", "cyclic"],
    ["array byte [byte; 1];", "reserved"],
    ["array Byte [byte; 1];", "reserved"],
    ["array A [byte; 1]; array a [byte; 2];", "duplicate"],
    ["union U { byte, byte, }", "duplicate"],
    ["array A [byte; 1]; array A [byte; 2];", "duplicate"],
    ["struct A { x: byte, x: byte, }", "duplicate"],
    ["vector Data <byte>; struct A { x: Data, }", "fixed-size"],
    ["vector Data <byte>; array A [Data; 2];", "byte length"],
    ["union U { byte, } struct A { x: U, }", "fixed-size"],
  ])("rejects invalid schema %s", (source, message) => {
    expect(() => Schema.from(source)).toThrow(new RegExp(message, "i"));
  });

  it("does not confuse names with inherited object properties", () => {
    const codecs = Schema.from(
      "array constructor [byte; 2]; table toString { value: constructor, }",
    );
    const name: string = "toString";
    expect(
      codecs.get(name).decode(codecs.get(name).encode({ value: "0x1234" })),
    ).toEqual({ value: "0x1234" });
  });

  it("rejects malformed binary using core validation", () => {
    const codecs = Schema.from("vector Data <byte>; table T { data: Data, }");
    expect(() => {
      codecs.get("Data").decode("0x0200000001");
    }).toThrow();
    expect(() => {
      codecs.get("T").decode("0x04000000");
    }).toThrow();
  });
});

describe("Schema composition", () => {
  it("compiles separately parsed sources with order-independent forward references", () => {
    const sources = [
      "syntax = 1; import other; table T { b: B, }",
      "syntax = 1; array B [byte; 2];",
    ] as const;
    for (const input of [sources, [...sources].reverse()]) {
      const schema = Schema.from(input);
      expect(
        schema.get("T").decode(schema.get("T").encode({ b: "0x1234" })),
      ).toEqual({ b: "0x1234" });
    }
  });

  it("accepts single schemas, returns all types, and preserves identity", () => {
    const base = Schema.from("array B [byte; 2];");
    const combined = Schema.from([base, "table T { b: B, }", base]);
    expect([...combined.keys()]).toEqual(["B", "T"]);
    expect(combined.get("B")).toBe(base.get("B"));
    expect(Schema.from(base)).toBe(base);
    expect(Schema.from(base).get("B")).toBe(base.get("B"));
    const record = new Schema(Object.freeze({ N: ccc.CodecUint32 }));
    expect(Schema.from([record, record]).get("N")).toBe(ccc.CodecUint32);
    expect(Schema.from(record).get("N")).toBe(ccc.CodecUint32);
    expect([...Schema.from([]).keys()]).toEqual([]);
  });

  it("rejects conflicts without overriding and accepts only identical repeated codec objects", () => {
    const source = "array B [byte; 2];";
    expect(() => Schema.from([source, source])).toThrow("duplicate");
    expect(() => Schema.from([Schema.from(source), source])).toThrow(
      "duplicate",
    );
    expect(() => Schema.from([source, Schema.from(source)])).toThrow(
      "duplicate",
    );
    expect(() =>
      Schema.from([Schema.from(source), Schema.from(source)]),
    ).toThrow("duplicate");
    expect(() =>
      Schema.from([
        new Schema({ X: ccc.CodecUint32 }),
        new Schema({ x: ccc.CodecUint32 }),
      ]),
    ).toThrow("duplicate");
    expect(() => new Schema({ BYTE: ccc.CodecByte })).toThrow("reserved");
  });

  it("reports the source index, does not resolve import paths, and requires exact lookup names", () => {
    expect(() => Schema.from(["table Good {}", "table Bad {"])).toThrow(
      /input\[1\].*at /,
    );
    expect(() =>
      Schema.from("import missing; table T { b: Missing, }"),
    ).toThrow("unknown type");
    const schema = Schema.from("import missing; table T {}");
    expect(() => schema.get("t")).toThrow("unknown type");
    expect(() => schema.get("byte")).toThrow("unknown type");
    expect(() => schema.get("constructor")).toThrow("unknown type");
    // @ts-expect-error Nested arrays intentionally are not supported.
    expect(() => Schema.from([["table T {}"]])).toThrow("flat");
  });

  it("preserves context and supports explicit input/output assertions without constructing instances", () => {
    const contextual = new ccc.Codec<number, string, { prefix: string }>(
      (n) => Uint8Array.of(n),
      (bytes, context) => `${context?.prefix}${ccc.bytesFrom(bytes)[0]}`,
      1,
    );
    const schema = Schema.from([
      new Schema({ N: contextual }),
      "vector Ns <N>; table Box { values: Ns, }",
    ]);
    const box = schema.get<
      { values: number[] },
      { values: string[] },
      { prefix: string }
    >("Box");
    expect(
      box.decode(box.encode({ values: [7, 8] }), { prefix: "n=" }),
    ).toEqual({ values: ["n=7", "n=8"] });
    const codec = schema.get<number, string, { prefix: string }>("N");
    expect(codec.decode(codec.encode(7), { prefix: "n=" })).toBe("n=7");
    // eslint-disable-next-line no-constant-condition
    if (false) {
      // @ts-expect-error Typed encoding rejects the wrong input.
      codec.encode("7");
      // @ts-expect-error Typed decoding rejects the wrong context.
      codec.decode("0x07", { prefix: 2 });

      expectTypeOf(schema.get("N").decode("0x07")).toBeUnknown();
    }
    class Message {
      value = "0x01";
      method() {
        return true;
      }
    }
    const message = Schema.from("table Message { value: byte, }").get<Message>(
      "Message",
    );
    expect(message.decode(message.encode(new Message()))).not.toBeInstanceOf(
      Message,
    );
  });
});

describe("Schema construction", () => {
  it("snapshots records, validates names and rejects invalid codecs", () => {
    const record = { N: ccc.CodecUint32 };
    const schema = new Schema(record);
    record.N = ccc.CodecUint16;
    expect(schema.get("N")).toBe(ccc.CodecUint32);
    expect(
      () => new Schema({ N: ccc.CodecUint32, n: ccc.CodecUint32 }),
    ).toThrow("duplicate");
    for (const name of ["byte", "Byte", "BYTE"]) {
      expect(() => new Schema({ [name]: ccc.CodecByte })).toThrow("reserved");
    }
    for (const name of ["", "1Number", "has space", "_Hidden"]) {
      expect(() => new Schema({ [name]: ccc.CodecUint32 })).toThrow(
        "invalid type name",
      );
    }
    // @ts-expect-error Invalid codec values must also fail at runtime.
    expect(() => new Schema({ N: {} })).toThrow("invalid codec");
    expect([...new Schema({}).keys()]).toEqual([]);
    const inherited = Object.create({ Hidden: ccc.CodecUint32 }) as Record<
      string,
      typeof ccc.CodecUint32
    >;
    inherited.Visible = ccc.CodecUint32;
    expect([...new Schema(inherited).keys()]).toEqual(["Visible"]);
  });
  it("accepts repeated same codecs in records and constructed schemas", () => {
    const a = new Schema({ N: ccc.CodecUint32 });
    const b = new Schema({ N: ccc.CodecUint32 });
    expect([...Schema.from([a, b]).keys()]).toEqual(["N"]);
    expect([...Schema.from([a, b, { N: ccc.CodecUint32 }]).keys()]).toEqual([
      "N",
    ]);
    expect(Schema.from({ N: ccc.CodecUint32 }).get("N")).toBe(ccc.CodecUint32);
  });
});

describe("syntax version composition", () => {
  it.each([0, 2, 7])(
    "compiles version %s with the same codec rules",
    (version) => {
      const schema = Schema.from(`syntax = ${version}; array A [byte; 2];`);
      expect(ccc.hexFrom(schema.get("A").encode("0x1234"))).toBe("0x1234");
      expect(schema.get("A").decode("0x1234")).toBe("0x1234");
    },
  );

  it("normalizes leading zeros and resolves same-version explicit dependencies", () => {
    const base = Schema.from("syntax = 07; array A [byte; 1];");
    const custom = new Schema({ Count: ccc.CodecUint32 });
    const sources = [
      "syntax = 7; import base; table T { a: A, count: Count, }",
      base,
      custom,
    ];
    for (const inputs of [sources, [...sources].reverse()]) {
      const schema = Schema.from(inputs);
      const value = { a: "0x12", count: 3 };
      expect(schema.get("T").decode(schema.get("T").encode(value))).toEqual(
        value,
      );
    }
  });

  it("combines sources with different versions, including implicit defaults", () => {
    for (const sources of [
      ["syntax = 1; table A {}", "syntax = 2; table B {}"],
      ["table A {}", "syntax = 2; table B {}"],
      ["syntax = 0; table A {}", "syntax = 7; table B {}"],
    ]) {
      for (const inputs of [sources, [...sources].reverse()]) {
        expect([...Schema.from(inputs).keys()].sort()).toEqual(["A", "B"]);
      }
    }
  });

  it("combines compiled schemas without retaining version state", () => {
    const base = Schema.from("syntax = 7; table A {}");
    expect(Schema.from(base)).toBe(base);
    const combined = Schema.from([
      base,
      base,
      new Schema({ Count: ccc.CodecUint32 }),
      Schema.from([]),
    ]);
    const nested = Schema.from([combined, "syntax = 0; table B {}"]);
    for (const other of [
      "syntax = 2; table C {}",
      Schema.from("syntax = 2; table C {}"),
    ]) {
      expect([...Schema.from([nested, other]).keys()]).toEqual([
        "A",
        "Count",
        "B",
        "C",
      ]);
    }
  });
});

describe("codec record inputs", () => {
  it("accepts single readonly records and mixed readonly input arrays", () => {
    const record = Object.freeze({ N: ccc.CodecUint32 });
    const base = Schema.from("array A [byte;1];");
    const input: SchemaLike = ["table T { n:N, a:A, }", record, base] as const;
    const schema = Schema.from(input);
    expect(Schema.from(record).get("N")).toBe(ccc.CodecUint32);
    const value = { n: 42, a: "0x12" };
    expect(schema.get("T").decode(schema.get("T").encode(value))).toEqual(
      value,
    );
    expectTypeOf(
      Schema.from(record).get("N").decode("0x00000000"),
    ).toBeUnknown();
  });

  it("snapshots record entries without cloning codecs or retaining the record", () => {
    const record: Record<string, typeof ccc.CodecUint32> = {
      N: ccc.CodecUint32,
    };
    const single = Schema.from(record);
    const mixed = Schema.from([record, "table T { n: N, }"]);
    record.N = ccc.CodecUint16;
    record.Later = ccc.CodecUint32;
    expect(single.get("N")).toBe(ccc.CodecUint32);
    expect(mixed.get("N")).toBe(ccc.CodecUint32);
    expect([...single.keys()]).toEqual(["N"]);
    expect([...mixed.keys()]).toEqual(["N", "T"]);
  });

  it("applies the existing name, codec and collision validation", () => {
    const invalid: Readonly<
      Record<string, typeof ccc.CodecByte | typeof ccc.CodecUint32>
    >[] = [
      { byte: ccc.CodecByte },
      { "1Bad": ccc.CodecByte },
      { N: ccc.CodecUint32, n: ccc.CodecUint32 },
    ];
    for (const record of invalid) {
      expect(() => Schema.from(record)).toThrow();
      expect(() => Schema.from([record])).toThrow();
    }
    // @ts-expect-error Invalid codecs are rejected at runtime too.
    expect(() => Schema.from({ N: {} })).toThrow("invalid codec");
    expect(() =>
      Schema.from([{ N: ccc.CodecUint32 }, { N: ccc.CodecUint16 }]),
    ).toThrow("duplicate");
    expect(() =>
      Schema.from([{ N: ccc.CodecUint32 }, "array N[byte;4];"]),
    ).toThrow("duplicate");
    expect(() =>
      Schema.from(["array N[byte;4];", { N: ccc.CodecUint32 }]),
    ).toThrow("duplicate");
    expect([...Schema.from({}).keys()]).toEqual([]);
    const inherited = Object.create({ Hidden: ccc.CodecUint32 }) as Record<
      string,
      typeof ccc.CodecUint32
    >;
    inherited.Visible = ccc.CodecUint32;
    expect([...Schema.from(inherited).keys()]).toEqual(["Visible"]);
  });
});

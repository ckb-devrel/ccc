import { describe, expect, it } from "vitest";

import { parseSchema, SchemaSyntaxError } from "./parser.js";

describe("parseSchema", () => {
  it.each([0, 1, 2, 7, Number.MAX_SAFE_INTEGER])(
    "preserves syntax version %s",
    (version) => {
      expect(parseSchema(`syntax = ${version}; table T {}`).syntaxVersion).toBe(
        version,
      );
    },
  );

  it("defaults to version 1 and normalizes leading zeros", () => {
    expect(parseSchema("table T {}").syntaxVersion).toBe(1);
    expect(parseSchema("syntax = 0007; table T {}").syntaxVersion).toBe(7);
  });

  it("parses each declaration without changing field names or order", () => {
    expect(
      parseSchema(`
        syntax = 1;
        import ../common/blockchain;
        array Hash [byte; 32];
        vector Hashes <Hash>;
        option MaybeHash (Hash);
        struct Pair { second: Hash, first: Hash, }
        table Record { snake_case: MaybeHash, }
        union Value { Hash, Record, }
      `),
    ).toEqual({
      syntaxVersion: 1,
      imports: ["../common/blockchain"],
      declarations: [
        { kind: "array", name: "Hash", item: "byte", length: 32 },
        { kind: "vector", name: "Hashes", item: "Hash" },
        { kind: "option", name: "MaybeHash", item: "Hash" },
        {
          kind: "struct",
          name: "Pair",
          fields: [
            { name: "second", type: "Hash" },
            { name: "first", type: "Hash" },
          ],
        },
        {
          kind: "table",
          name: "Record",
          fields: [{ name: "snake_case", type: "MaybeHash" }],
        },
        {
          kind: "union",
          name: "Value",
          items: [
            { type: "Hash", id: 0 },
            { type: "Record", id: 1 },
          ],
        },
      ],
    });
  });

  it("supports line and nested block comments, including punctuation", () => {
    expect(
      parseSchema(`/* outer / * /* nested */ more */
        # comment
        array/* separator */A[byte;1]; // ends here
        table Empty {} // trailing comment`),
    ).toEqual({
      syntaxVersion: 1,
      imports: [],
      declarations: [
        { kind: "array", name: "A", item: "byte", length: 1 },
        { kind: "table", name: "Empty", fields: [] },
      ],
    });
  });

  it("matches upstream mixed implicit/explicit union IDs and sorting", () => {
    expect(parseSchema("union X { A: 5, B, C: 3, D, }").declarations).toEqual([
      {
        kind: "union",
        name: "X",
        items: [
          { type: "C", id: 3 },
          { type: "D", id: 4 },
          { type: "A", id: 5 },
          { type: "B", id: 6 },
        ],
      },
    ]);
  });

  it("permits the largest union ID when no implicit successor overflows", () => {
    expect(
      parseSchema("union X { A: 4294967295, B: 0, }").declarations,
    ).toEqual([
      {
        kind: "union",
        name: "X",
        items: [
          { type: "B", id: 0 },
          { type: "A", id: 4294967295 },
        ],
      },
    ]);
  });

  it.each([
    "",
    "// comment only",
    "syntax = -1; table X {}",
    "syntax = 1.5; table X {}",
    "syntax = 9007199254740992; table X {}",
    'syntax = "1"; table X {}',
    "array A [byte; 0];",
    "array A [byte; -1];",
    "array A [byte; 01];",
    "array A [byte; 1.5];",
    "array A [byte; 9007199254740992];",
    "array A [byte; 2]",
    "array _A [byte; 2];",
    "vector A <byte>; trailing",
    "struct A {}",
    "union A {}",
    "table A { a: byte }",
    "union A { byte }",
    "union A { byte: 4294967296, }",
    "union A { byte: 4294967295, B, }",
    "union A { byte: 3, B: 3, }",
    "union A { byte: 3, B, C: 4, }",
    "table A {} syntax = 1;",
    "table A {} import foo;",
    "import ../../; table A {}",
    "import foo.mol; table A {}",
    'import "foo"; table A {}',
    "import foo / bar; table A {}",
    "/* unterminated",
    "table A {} /* outer /* inner */",
  ])("rejects invalid syntax: %s", (source) => {
    expect(() => parseSchema(source)).toThrow(SchemaSyntaxError);
  });

  it("locates errors after CRLF and comments", () => {
    const source = "// intro\r\ntable A {\r\n  value: byte\r\n}";
    try {
      parseSchema(source);
      expect.fail("Expected syntax error");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaSyntaxError);
      expect(error).toMatchObject({
        line: 4,
        column: 1,
        offset: source.indexOf("}"),
      });
    }
  });

  it("locates an unterminated block comment at its opening delimiter", () => {
    expect(() => parseSchema("table X {}\n  /* missing end")).toThrow(
      "Unterminated block comment at 2:3",
    );
  });
});

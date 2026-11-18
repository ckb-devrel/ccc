/** A field of a Molecule struct or table, in wire order. */
export interface Field {
  name: string;
  type: string;
}

/** A union alternative with its resolved wire discriminator. */
export interface UnionItem {
  type: string;
  id: number;
}

export type Declaration =
  | { kind: "array"; name: string; item: string; length: number }
  | { kind: "vector" | "option"; name: string; item: string }
  | { kind: "struct" | "table"; name: string; fields: Field[] }
  | { kind: "union"; name: string; items: UnionItem[] };

/** Parsed declarations; imports are paths, never fetched by the parser. */
export interface Schema {
  syntaxVersion: number;
  imports: string[];
  declarations: Declaration[];
}

/** A syntax error with a zero-based UTF-16 offset and one-based line/column. */
export class SchemaSyntaxError extends SyntaxError {
  readonly line: number;
  readonly column: number;

  constructor(
    message: string,
    source: string,
    readonly offset: number,
  ) {
    const prefix = source.slice(0, offset);
    const line = prefix.split("\n").length;
    const column = offset - prefix.lastIndexOf("\n");
    super(`${message} at ${line}:${column}`);
    this.name = "SchemaSyntaxError";
    this.line = line;
    this.column = column;
  }
}

// Mirrors the upstream grammar without a generated parser or runtime dependency:
// https://github.com/nervosnetwork/molecule/blob/master/tools/codegen/src/grammar.pest
class Parser {
  private offset = 0;

  constructor(private readonly source: string) {}

  private fail(message: string, offset = this.offset): never {
    throw new SchemaSyntaxError(message, this.source, offset);
  }

  private skip(): void {
    while (this.offset < this.source.length) {
      const rest = this.source.slice(this.offset);
      const whitespace = /^(?:[ \t\n]|\r\n)+/.exec(rest);
      if (whitespace) {
        this.offset += whitespace[0].length;
      } else if (rest.startsWith("//") || rest.startsWith("#")) {
        const end = this.source.indexOf("\n", this.offset);
        this.offset = end === -1 ? this.source.length : end;
      } else if (rest.startsWith("/*")) {
        const start = this.offset;
        this.offset += 2;
        let depth = 1;
        while (depth && this.offset < this.source.length) {
          if (this.source.startsWith("/*", this.offset)) {
            depth += 1;
            this.offset += 2;
          } else if (this.source.startsWith("*/", this.offset)) {
            depth -= 1;
            this.offset += 2;
          } else {
            this.offset += 1;
          }
        }
        if (depth) {
          this.fail("Unterminated block comment", start);
        }
      } else {
        return;
      }
    }
  }

  private take(symbol: string): boolean {
    this.skip();
    if (!this.source.startsWith(symbol, this.offset)) {
      return false;
    }
    this.offset += symbol.length;
    return true;
  }

  private expect(symbol: string): void {
    if (!this.take(symbol)) {
      this.fail(`Expected '${symbol}'`);
    }
  }

  private identifier(): string {
    this.skip();
    const match = /^[A-Za-z][A-Za-z0-9_]*/.exec(this.source.slice(this.offset));
    if (!match) {
      this.fail("Expected an identifier");
    }
    this.offset += match[0].length;
    return match[0];
  }

  private integer(min: number, max = Number.MAX_SAFE_INTEGER): number {
    this.skip();
    const start = this.offset;
    const match = /^[0-9]+/.exec(this.source.slice(start));
    if (!match) {
      this.fail("Expected an integer");
    }
    const value = Number(match[0]);
    if (
      !Number.isSafeInteger(value) ||
      value < min ||
      value > max ||
      (match[0].length > 1 && match[0][0] === "0")
    ) {
      this.fail(`Expected an integer between ${min} and ${max}`, start);
    }
    this.offset += match[0].length;
    return value;
  }

  private fields(kind: "struct" | "table"): Field[] {
    const fields: Field[] = [];
    this.expect("{");
    while (!this.take("}")) {
      const name = this.identifier();
      this.expect(":");
      const type = this.identifier();
      this.expect(",");
      fields.push({ name, type });
    }
    if (kind === "struct" && fields.length === 0) {
      this.fail("A struct must have at least one field");
    }
    return fields;
  }

  private union(): UnionItem[] {
    const items: UnionItem[] = [];
    const ids = new Set<number>();
    let nextId = 0;
    this.expect("{");
    while (!this.take("}")) {
      this.skip();
      const start = this.offset;
      const type = this.identifier();
      const id = this.take(":") ? this.integer(0, 0xffffffff) : nextId;
      if (id > 0xffffffff) {
        this.fail("Union ID exceeds uint32", start);
      }
      if (ids.has(id)) {
        this.fail(`Duplicate union ID ${id}`, start);
      }
      ids.add(id);
      this.expect(",");
      items.push({ type, id });
      nextId = id + 1;
    }
    if (items.length === 0) {
      this.fail("A union must have at least one item");
    }
    // The upstream parser increments from the previous ID, then sorts by ID.
    return items.sort((a, b) => a.id - b.id);
  }

  parse(): Schema {
    const schema: Schema = { syntaxVersion: 1, imports: [], declarations: [] };
    this.skip();
    if (/^syntax\b/.test(this.source.slice(this.offset))) {
      this.identifier();
      this.expect("=");
      this.skip();
      const start = this.offset;
      // The syntax version grammar permits leading zeros, unlike sizes/IDs.
      const version = /^[0-9]+/.exec(this.source.slice(start));
      if (!version || !Number.isSafeInteger(Number(version[0]))) {
        this.fail("Expected a non-negative safe integer syntax version", start);
      }
      schema.syntaxVersion = Number(version[0]);
      this.offset += version[0].length;
      this.expect(";");
    }
    this.skip();
    while (/^import\b/.test(this.source.slice(this.offset))) {
      this.identifier();
      const separator = this.offset;
      this.skip();
      if (separator === this.offset) {
        this.fail("Expected whitespace after import");
      }
      const path =
        /^(?:\.\.\/)*(?:[A-Za-z][A-Za-z0-9_]*\/)*[A-Za-z][A-Za-z0-9_]*/.exec(
          this.source.slice(this.offset),
        );
      if (!path) {
        this.fail("Expected an import path");
      }
      schema.imports.push(path[0]);
      this.offset += path[0].length;
      this.expect(";");
      this.skip();
    }
    while (this.offset < this.source.length) {
      const start = this.offset;
      const kind = this.identifier();
      const name = this.identifier();
      switch (kind) {
        case "array": {
          this.expect("[");
          const item = this.identifier();
          this.expect(";");
          const length = this.integer(1);
          this.expect("]");
          this.expect(";");
          schema.declarations.push({ kind, name, item, length });
          break;
        }
        case "vector":
        case "option": {
          this.expect(kind === "vector" ? "<" : "(");
          const item = this.identifier();
          this.expect(kind === "vector" ? ">" : ")");
          this.expect(";");
          schema.declarations.push({ kind, name, item });
          break;
        }
        case "struct":
        case "table":
          schema.declarations.push({ kind, name, fields: this.fields(kind) });
          break;
        case "union":
          schema.declarations.push({ kind, name, items: this.union() });
          break;
        default:
          this.fail(`Unknown declaration '${kind}'`, start);
      }
      this.skip();
    }
    if (!schema.declarations.length) {
      this.fail("Expected a type declaration");
    }
    return schema;
  }
}

/**
 * Parse one Molecule source. Preserves field order and resolves implicit
 * union IDs; reference resolution and codec construction are separate steps.
 * Does not read files, fetch imports, or execute source code.
 */
export function parseSchema(source: string): Schema {
  return new Parser(source).parse();
}

import { ccc, mol } from "@ckb-ccc/core";
import { parseSchema as parseSchemaAst, type Declaration } from "./parser.js";

// A heterogeneous registry must accept codecs with different input/context types.
// The public get() boundary restores unknown unless the caller asserts types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuntimeCodec = ccc.Codec<any, any, any>;
type SchemaInput = string | Schema | Readonly<Record<string, RuntimeCodec>>;
export type SchemaLike = SchemaInput | readonly SchemaInput[];

function reserveTypeName(name: string, names: Set<string>): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Molecule: invalid type name '${name}'`);
  }
  const normalized = name.toLowerCase();
  if (names.has(normalized)) {
    throw new Error(
      `Molecule: duplicate or reserved type name '${name}' (names are case-insensitively unique)`,
    );
  }
  names.add(normalized);
}

/** A named collection of codecs. Its registry cannot be mutated by callers. */
export class Schema {
  readonly #codecs: ReadonlyMap<string, RuntimeCodec>;

  constructor(codecs: Readonly<Record<string, RuntimeCodec>>) {
    if (!codecs || Array.isArray(codecs) || typeof codecs !== "object") {
      throw new Error("Molecule: expected a codec record");
    }
    const names = new Set(["byte"]);
    const entries = Object.entries(codecs);
    for (const [name, codec] of entries) {
      reserveTypeName(name, names);
      if (
        !codec ||
        typeof codec.encode !== "function" ||
        typeof codec.decode !== "function"
      ) {
        throw new Error(`Molecule: invalid codec '${name}'`);
      }
    }
    this.#codecs = new Map(entries);
  }

  /**
   * Get a codec, throwing if the exact name is absent.
   * Generics are caller assertions, not schema inference or runtime validation.
   * Decoding does not construct class instances. Use mapOut for transformations.
   */
  get<Encodable = unknown, Decoded = Encodable, Context = unknown>(
    name: string,
  ): ccc.Codec<Encodable, Decoded, Context> {
    const codec = this.#codecs.get(name);
    if (!codec) {
      throw new Error(`Molecule: unknown type '${name}'`);
    }
    // Caller-supplied generics are the explicit assertion boundary.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return codec;
  }

  /** Normalize a source, codec record, existing Schema, or flat list. */
  static from(value: SchemaLike): Schema {
    return value instanceof Schema ? value : compileSchema(value);
  }

  keys(): IterableIterator<string> {
    return this.#codecs.keys();
  }
}

/**
 * Compile one input or a flat list into a shared type namespace.
 * Sources are parsed separately, then compiled together, independent of order.
 * Imports are not fetched or resolved by file path. Supply dependencies explicitly.
 * Returns all supplied and declared types (not the built-in byte).
 * Conflicting names fail; repeated identical codec objects are accepted.
 */
function compileSchema(input: SchemaLike): Schema {
  const inputs: readonly SchemaInput[] = Array.isArray(input)
    ? input
    : [input as SchemaInput];
  const declarations: Declaration[] = [];
  const codecs = new Map<string, RuntimeCodec>([["byte", ccc.CodecByte]]);
  const names = new Set(["byte"]);
  const order: string[] = [];
  const supplied = new Map<string, RuntimeCodec>();
  const reserveName = (name: string) => {
    reserveTypeName(name, names);
    order.push(name);
  };
  for (const [index, entry] of inputs.entries()) {
    if (
      typeof entry !== "string" &&
      (!entry || typeof entry !== "object" || Array.isArray(entry))
    ) {
      throw new Error(
        `Molecule input[${index}]: expected a source, Schema or codec record (arrays must be flat)`,
      );
    }
    if (typeof entry === "string") {
      let parsed;
      try {
        parsed = parseSchemaAst(entry);
      } catch (cause) {
        throw new Error(
          `Molecule input[${index}]: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
      for (const declaration of parsed.declarations) {
        reserveName(declaration.name);
        declarations.push(declaration);
      }
    } else {
      const schema = entry instanceof Schema ? entry : new Schema(entry);
      const entries = Array.from(
        schema.keys(),
        (name) => [name, schema.get(name)] as const,
      );
      for (const [name, codec] of entries) {
        if (supplied.has(name) && supplied.get(name) === codec) {
          continue;
        }
        reserveName(name);
        supplied.set(name, codec);
        codecs.set(name, codec);
      }
    }
  }
  const definitions = new Map(declarations.map((d) => [d.name, d]));
  const pending = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const ready: string[] = [];
  for (const definition of declarations) {
    const dependencies = new Set(
      "item" in definition
        ? [definition.item]
        : definition.kind === "union"
          ? definition.items.map((item) => item.type)
          : definition.fields.map((field) => field.type),
    );
    let count = 0;
    for (const dependency of dependencies) {
      if (codecs.has(dependency)) {
        continue;
      }
      if (!definitions.has(dependency)) {
        throw new Error(
          `Molecule ${definition.name}: unknown type '${dependency}'`,
        );
      }
      count += 1;
      const children = dependents.get(dependency) ?? [];
      children.push(definition.name);
      dependents.set(dependency, children);
    }
    pending.set(definition.name, count);
    if (count === 0) {
      ready.push(definition.name);
    }
  }

  const getCodec = (name: string): RuntimeCodec => codecs.get(name)!;
  for (let index = 0; index < ready.length; index += 1) {
    const name = ready[index];
    const definition = definitions.get(name)!;
    let codec: RuntimeCodec;
    try {
      switch (definition.kind) {
        case "array":
          codec =
            definition.item === "byte"
              ? ccc.Codec.from({
                  ...ccc.CodecBytes,
                  byteLength: definition.length,
                })
              : mol.array(getCodec(definition.item), definition.length);
          break;
        case "vector":
          codec =
            definition.item === "byte"
              ? mol.Bytes
              : mol.vector(getCodec(definition.item));
          break;
        case "option":
          codec = mol.option(getCodec(definition.item));
          break;
        case "union": {
          const layout = Object.fromEntries(
            definition.items.map((item) => [item.type, getCodec(item.type)]),
          );
          if (Object.keys(layout).length !== definition.items.length) {
            throw new Error("duplicate union type");
          }
          const ids = Object.fromEntries(
            definition.items.map((item) => [item.type, item.id]),
          );
          codec = mol.union(layout, ids);
          break;
        }
        case "struct":
        case "table": {
          const layout = Object.fromEntries(
            definition.fields.map((field) => [
              field.name,
              getCodec(field.type),
            ]),
          );
          if (Object.keys(layout).length !== definition.fields.length) {
            throw new Error("duplicate field name");
          }
          codec =
            definition.kind === "struct"
              ? mol.struct(layout)
              : mol.table(layout);
          break;
        }
      }
    } catch (cause) {
      throw new Error(
        `Molecule ${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }
    codecs.set(name, codec);
    for (const dependent of dependents.get(name) ?? []) {
      const remaining = pending.get(dependent)! - 1;
      pending.set(dependent, remaining);
      if (remaining === 0) {
        ready.push(dependent);
      }
    }
  }
  if (ready.length !== definitions.size) {
    const unresolved = [...pending]
      .filter(([, count]) => count > 0)
      .map(([name]) => name);
    throw new Error(
      `Molecule: cyclic type dependencies: ${unresolved.join(", ")}`,
    );
  }
  return new Schema(
    Object.fromEntries(order.map((name) => [name, getCodec(name)])),
  );
}

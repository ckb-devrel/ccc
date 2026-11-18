<p align="center">
  <a href="https://app.ckbccc.com/">
    <img alt="Logo" src="https://raw.githubusercontent.com/ckb-devrel/ccc/dev/assets/logoAndText.svg" style="height: 8rem; max-width: 90%; padding: 0.5rem 0;" />
  </a>
</p>

<h1 align="center" style="font-size: 48px;">
  CCC's Support for Molecule
</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ckb-ccc/molecule"><img
    alt="NPM Version" src="https://img.shields.io/npm/v/%40ckb-ccc%2Fmolecule"
  /></a>
  <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ckb-devrel/ccc" />
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/ckb-devrel/ccc/dev" />
  <img alt="GitHub branch check runs" src="https://img.shields.io/github/check-runs/ckb-devrel/ccc/dev" />
  <a href="https://live.ckbccc.com/"><img
    alt="Playground" src="https://img.shields.io/website?url=https%3A%2F%2Flive.ckbccc.com%2F&label=Playground"
  /></a>
  <a href="https://app.ckbccc.com/"><img
    alt="App" src="https://img.shields.io/website?url=https%3A%2F%2Fapp.ckbccc.com%2F&label=App"
  /></a>
  <a href="https://docs.ckbccc.com/"><img
    alt="Docs" src="https://img.shields.io/website?url=https%3A%2F%2Fdocs.ckbccc.com%2F&label=Docs"
  /></a>
</p>

<p align="center">
  CCC - CKBers' Codebase is a one-stop solution for your CKB JS/TS ecosystem development.
  <br />
  Empower yourself with CCC to discover the unlimited potential of CKB.
  <br />
  Interoperate with wallets from different chain ecosystems.
  <br />
  Fully enabling CKB's Turing completeness and cryptographic freedom power.
</p>

Turn a Molecule schema into ordinary CCC codecs at runtime. No generated parser,
code generation step, filesystem access, or network requests are required.

## Quick Start

```ts
import { Schema } from "@ckb-ccc/molecule";
import { ccc } from "@ckb-ccc/core";

const schema = Schema.from(`
  vector Bytes <byte>;
  table Message { tag: byte, data: Bytes, }
`);
const Message = schema.get("Message");
const bytes = Message.encode({ tag: "0x01", data: "0x1234" });
console.log(ccc.hexFrom(bytes));
console.log(Message.decode(bytes)); // { tag: "0x01", data: "0x1234" }
```

It is also available as `ccc.molecule.Schema.from` through
`@ckb-ccc/shell`. CCC App's **Molecule** utility lets you paste a schema, choose
a type, and convert between JSON and hex locally, without a wallet.

## Values

| Schema shape                  | JavaScript value                                |
| ----------------------------- | ----------------------------------------------- |
| `byte`, `[byte; N]`, `<byte>` | Hex string (`"0x12"`, `"0x1234"`, …)            |
| Other array/vector            | Array of item values                            |
| Struct/table                  | Object using the exact schema field names       |
| Option                        | Inner value, or `undefined`/`null` for no value |
| Union                         | `{ type: "VariantName", value: … }`             |

Names do not imply a numeric encoding. For example, `array Uint64 [byte; 8];`
is eight bytes of hex, not a bigint. This keeps the schema's actual layout
rather than silently substituting codecs by name. Use explicit external
codecs when a numeric application representation is wanted.

## Combining schemas

Pass one input directly, or a flat readonly array mixing schema strings, previously
parsed `Schema` objects and readonly codec records:

```ts
const base = Schema.from("array Hash [byte; 32];");
const schema = Schema.from([
  "import base; table Entry { hash: Hash, count: Count, }",
  base,
  { Count: ccc.CodecUint32 },
]);
const Entry = schema.get("Entry");
console.log([...schema.keys()]); // Includes Entry, Hash and Count.
```

Use `Schema.from({ Name: codec })` or `new Schema({ Name: codec })` for custom
CCC codecs. Records passed directly or inside an input array go through the same
constructor validation: identifiers, case-insensitive duplicate names, reserved
`byte`, and codec functions. Their own enumerable entries are snapshotted without
modifying the record or cloning codec objects.

Each string is parsed independently before dependencies are compiled together.
Types may refer to definitions in later inputs. All inputs share one type
namespace; the result includes both supplied codecs and newly declared types.
`Schema.from(existingSchema)` returns that same instance. Inputs are not modified. Use array spread to combine input arrays; nested arrays
are not accepted.

`syntax = N;` is accepted as a numeric declaration, not a switch between codec
rules. It defaults to `1`; non-negative safe integers (including `0` and leading
zeros) are accepted, up to `Number.MAX_SAFE_INTEGER`. Compiled schemas do not
retain or compare syntax versions: inputs with different declarations can be
combined. Unlike upstream file imports, this API combines explicitly supplied
sources and codecs without imposing file-level version consistency.

`import` declarations are parsed but never fetched or matched to filenames.
Supply the required types through the other inputs. This is a shared type
context, **not** Molecule's filesystem-based import resolution or per-file scope.

Duplicate names are rejected, except the exact same name and codec object may
be supplied more than once. Repeating a declaration is still an error; no input
silently overrides another. Type names must be unique ignoring case, and `byte`
is reserved. References use the exact declared spelling; field names are not
rewritten. Supplied codecs must accurately report `byteLength` for fixed-size
types. A codec's name alone is not enough.

## TypeScript values

`Schema.get()` throws if the name is unknown and returns an ordinary CCC codec.
Without type arguments its input and output types are `unknown`, not `any`.
When you know the schema's value representation, declare it explicitly:

```ts
type MessageLike = { tag: string; data: string };
type Message = { tag: ccc.Hex; data: ccc.Hex };
const messageSchema = Schema.from(`
  vector Bytes <byte>;
  table Message { tag: byte, data: Bytes, }
`);
const message = messageSchema.get<MessageLike, Message>("Message");
```

The generic parameters follow `ccc.Codec<Encodable, Decoded, Context>`: encoding
input first, decoding output second, and optional decoding context third.
`Decoded` defaults to `Encodable`; the input and context default to `unknown`.
These type arguments are **caller assertions, not schema inference or runtime
validation of TypeScript types**. A class type does not make decoding construct
class instances or methods. Use the codec's existing `mapIn`/`mapOut` helpers when
actual value conversion is needed. `keys()` lists the available type names.

## Validation and scope

Supports Molecule arrays, structs, vectors, tables, options,
and unions, including custom union IDs and forward type references. Missing
types, recursive dependencies, duplicates and invalid fixed layouts fail at
compile time. Binary validation is delegated to CCC's existing codecs; this
package does not maintain a second serializer.

Runtime schema strings cannot provide static TypeScript inference of their
values. For compile-time typed schemas, use `ccc.mol` combinators directly.

This is a fresh implementation of the runtime-schema functionality proposed in
[CCC #212](https://github.com/ckb-devrel/ccc/pull/212), originally contributed by
[Alive24](https://github.com/Alive24). It does not preserve that unmerged PR's
parser internals or implicit type-name conversions.

<h3 align="center">
  Read more about CCC on <a href="https://docs.ckbccc.com">our website</a> or <a href="https://github.com/ckb-devrel/ccc">GitHub Repo</a>.
</h3>

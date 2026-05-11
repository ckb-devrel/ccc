---
name: ccc-code-style
description: This skill should be used whenever generating, editing, or reviewing TypeScript code in the CCC (CKBers' Codebase) monorepo — especially packages/core, packages/fiber, or any SDK package. Activates when the user asks to add features, fix bugs, refactor code, or write new modules in this project.
version: 1.0.0
---

# CCC Code Style — `packages/core` Convention

All new code in this repo MUST conform to the conventions derived from `packages/core`. Apply every rule below before finalising any edit.

---

## 1. Comment Style

### JSDoc (mandatory for every exported symbol)
- Use `/** … */` blocks above every exported function, class, type, and constant.
- Include `@param name - description` (dash separator, no type annotation — TypeScript carries the type).
- Include `@returns description` when the return value is non-obvious.
- Include `@example` blocks for conversion helpers and public utilities.
- Include `@see OtherSymbol - one-line note` when a related function exists.
- Mark all public API symbols with `@public`.

```typescript
/**
 * Converts a hex string to a Uint8Array.
 *
 * @param hex - A valid ccc.Hex string starting with "0x".
 * @returns The decoded bytes.
 * @example
 * const bytes = bytesFromHex("0xdeadbeef");
 * @see hexFrom - Convert bytes back to a hex string
 * @public
 */
export function bytesFromHex(hex: Hex): Bytes { … }
```

### Inline comments
- Use only for non-obvious decisions: V8 optimisations, algorithm tradeoffs, 2's-complement edge cases.
- Never explain what the code does when it is already readable; explain *why*.

### No non-English comments.

---

## 2. Naming Conventions

| Kind | Convention | Examples |
|---|---|---|
| Classes | PascalCase, descriptive suffix | `SignerCkbPrivateKey`, `FiberClient` |
| Abstract / readonly variants | Append `Readonly` | `SignerBtcPublicKeyReadonly` |
| Functions — converters | verb-first `*From` / `*To` | `hexFrom()`, `bytesTo()`, `numFromBytes()` |
| Functions — predicates | `is` prefix | `isHex()`, `isConnected()` |
| Functions — unsafe fast-path | `*Unsafe` suffix | `bytesLenUnsafe()` |
| Types — domain | PascalCase | `Hex`, `Bytes`, `Num` |
| Types — input unions | `*Like` suffix | `HexLike`, `NumLike`, `BytesLike` |
| String enums | PascalCase name, string values | `enum SignerType { EVM = "EVM" }` |
| Union type aliases | PascalCase | `export type HashType = "type" \| "data"` |
| Private/protected fields | trailing underscore | `client_` |
| Files | kebab-case matching export | `signerCkbPrivateKey.ts` |
| Advanced/internal files | `.advanced.ts` suffix | `hash.advanced.ts` |
| Numbers | `bigint` exclusively (`Num = bigint`) | `0n`, `100n` |

---

## 3. Code Structure

### File layout (top → bottom)
1. `import type { … }` — type-only imports first
2. `import { … }` — value imports (relative paths, `.js` extension for ESM)
3. Type aliases and interfaces
4. Constants
5. Exported classes / functions (public API)
6. Internal helpers

### Class layout (top → bottom)
1. `public readonly` properties
2. `protected` / `private` properties (trailing underscore)
3. `constructor`
4. Getters / property accessors
5. Concrete public methods (grouped by feature)
6. Abstract / overridable methods
7. Static factory / utility methods
8. Protected `_*` internal helpers

### Export pattern
- Every package re-exports via `index.ts` barrel: `export * from "./module.js"`
- Unstable / advanced APIs live in a parallel `.advanced.ts` file and are exposed via the `advanced` export entry point (`cccA` namespace).
- Use `export type { … }` for type-only re-exports.

---

## 4. Problem-Breakdown Principles

### Conversion pairs
Every domain type gets explicit `*From()` (parse input → domain type) and `*To()` (domain type → output) functions. Never collapse the two directions into one overloaded function.

### `*Like` input union pattern
Public functions accept a union input type (`HexLike`, `NumLike`) and return the strict domain type. This eliminates overloads and lets callers pass any reasonable format.

```typescript
export type HexLike = Hex | string | Uint8Array | ArrayBuffer | ArrayLike<number>;
export function hexFrom(val: HexLike): Hex { … }
```

### Validated vs. unsafe pairs
When a function is called in hot paths and its input is already validated upstream, provide an `*Unsafe` variant that skips validation. Document the precondition and the performance reason in JSDoc.

### Abstract base class + subclass per chain
Define behaviour contracts with `abstract class`. Extend per-blockchain: `SignerCkbPrivateKey`, `SignerEvmPublicKey`. Use the template-method pattern: abstract leaf methods, concrete orchestration in the base.

### Factory methods
Prefer `static from(input: XLike): X` for synchronous construction and `static async fromString(s: string, client: Client): Promise<X>` for network-dependent construction. Group multiple factories by input kind: `Address.fromScript()`, `Address.fromKnownScript()`.

### Endianness / encoding variants
For multi-format outputs, define named variants: `numLeToBytes()`, `numBeToBytes()`. Let the "default" wrapper call the canonical one.

### Codec abstraction (Molecule)
Serialization concerns live in a `mol.Codec<Input, Output>` wrapper. Domain types do not contain raw encode/decode logic inline; they delegate to a codec object.

### Error messages
Always include the attempted value: `throw Error(\`Invalid hex string: \${v}\`)`. Check preconditions in constructors (fail fast). Never swallow errors silently.

### Async patterns
- Use `async` / `await` throughout; no raw `.then()` chains.
- Parallelise independent async operations with `Promise.all([…])`.
- Internal async helpers are `protected async _methodName()`.

---

## 5. Checklist Before Finishing

- [ ] Every exported symbol has a JSDoc block with `@public`, `@param`, `@returns`.
- [ ] No non-English comments.
- [ ] Input types use `*Like` unions where the caller might reasonably pass multiple formats.
- [ ] Numeric values use `bigint` / `Num`; never `number` for blockchain quantities.
- [ ] Conversion functions follow `*From` / `*To` naming; predicates use `is*`.
- [ ] Private/protected fields use trailing underscore (`client_`).
- [ ] Hot-path variants suffixed `*Unsafe` with precondition documented.
- [ ] Advanced/internal exports separated into `.advanced.ts`.
- [ ] File name matches the primary export in kebab-case.
- [ ] New barrel entries added to the nearest `index.ts`.

import { test } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { bytesFrom } from "../bytes/index.js";
import { Hex } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import { Codec, CodecLike, ContextType } from "./index.js";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

type FooContext = { foo?: boolean };
type BarContext = { bar?: boolean };

const fooCodec = Codec.from({
  byteLength: 1,
  encode: (_: number) => bytesFrom([0]),
  decode(_, _context?: FooContext) {
    return 0;
  },
});
const barCodec: Codec<number, number, BarContext> = Codec.from({
  byteLength: 1,
  encode: (_) => bytesFrom([0]),
  decode: (_) => 0,
});
const legacyCodec: Codec<number, number> = Codec.from({
  byteLength: 1,
  encode: (_) => bytesFrom([0]),
  decode: (_) => 0,
});
const _contextlessCodec = Codec.from({
  encode: (_: number) => bytesFrom([]),
  decode: (_) => 0,
});

type _FromInfersContext = Assert<
  Equal<ContextType<typeof fooCodec>, FooContext>
>;
type _FromDefaultsContextToAny = Assert<
  IsAny<Parameters<typeof _contextlessCodec.decode>[1]>
>;
const _optionalFoo = mol.option(fooCodec);
const checkFoo: ContextType<typeof fooCodec> = { foo: true };
void checkFoo;
type _UnaryPreservesContext = Assert<
  Equal<ContextType<typeof _optionalFoo>, FooContext>
>;
const _combined = mol.struct({ a: fooCodec, b: barCodec });
type _MultiChildIntersectsContexts = Assert<
  Equal<ContextType<typeof _combined>, FooContext & BarContext>
>;
const _combinedWithLegacy = mol.struct({
  specific: fooCodec,
  legacy: legacyCodec,
});
type _LegacyAnyIsNeutralToSiblingContext = Assert<
  Equal<ContextType<typeof _combinedWithLegacy>, FooContext>
>;
const _tableWithLegacyChild = mol.table({ generic: legacyCodec });
type _LegacyAnyIsNeutral = Assert<
  Equal<
    ContextType<typeof _tableWithLegacyChild>,
    { isExtraFieldIgnored?: boolean }
  >
>;

const _nested = mol.byteVec(
  mol.vector(mol.option(mol.union({ x: mol.table({ value: mol.Uint8 }) }))),
);
type _NestedTableContextPropagates = Assert<
  Equal<ContextType<typeof _nested>, { isExtraFieldIgnored?: boolean }>
>;

const oldStyleCodec: CodecLike<string> = {
  encode: (_) => bytesFrom([]),
  decode: (_, _context?: { isExtraFieldIgnored?: boolean }) => "",
};
const oldStyleCodecAssignment: Codec<string, string> =
  Codec.from(oldStyleCodec);
void oldStyleCodecAssignment;

type Value = { value: number };
const tableAsLegacyCodec: mol.Codec<Value, Value> = mol.table({
  value: mol.Uint8,
});
const tableAsLegacyCodecLike: mol.CodecLike<any> = tableAsLegacyCodec;
const legacyCodecRecord: Record<string, mol.CodecLike<any>> = {
  Table: tableAsLegacyCodec,
  Uint32: mol.Uint32,
};
const customLegacyCodec: Codec<string, Hex> = Codec.from({
  encode: (_) => bytesFrom([]),
  decode: (_) => "" as Hex,
});
void tableAsLegacyCodecLike;
void legacyCodecRecord;
void customLegacyCodec;

test("compile-time context assertions", () => {});

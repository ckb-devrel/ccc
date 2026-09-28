import { expect, test } from "vitest";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { bytesFrom } from "../bytes/index.js";
import { Hex } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import {
  Codec,
  CodecLike,
  ContextType,
  Entity,
  codec as entityCodec,
} from "./index.js";

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
const entityTable = mol.table({
  value: mol.Uint8,
});

@entityCodec(entityTable)
class ContextEntity extends Entity.Base<
  Value,
  ContextEntity,
  ContextType<typeof entityTable>
>() {
  constructor(public readonly value: number) {
    super();
  }

  static from(value: Value): ContextEntity {
    return value instanceof ContextEntity
      ? value
      : new ContextEntity(value.value);
  }
}

type _EntityPreservesContext = Assert<
  Equal<
    Parameters<typeof ContextEntity.decode>[1],
    ContextType<typeof entityTable> | undefined
  >
>;

const tableAsLegacyCodec: Codec<Value, Value> = entityTable;
const tableAsLegacyCodecLike: CodecLike<any> = tableAsLegacyCodec;
const legacyCodecRecord: Record<string, CodecLike<any>> = {
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

test("entity decode methods forward context to the codec", () => {
  // A one-field table containing one structurally valid trailing field.
  const raw = bytesFrom("0d0000000c0000000d00000042", "hex");

  expect(() => ContextEntity.decode(raw)).toThrow(
    "table: invalid field count, expected 1, but got 2",
  );
  expect(ContextEntity.decode(raw, { isExtraFieldIgnored: true })).toEqual(
    new ContextEntity(0x42),
  );
  expect(ContextEntity.fromBytes(raw, { isExtraFieldIgnored: true })).toEqual(
    new ContextEntity(0x42),
  );
});

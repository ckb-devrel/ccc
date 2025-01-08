import { Bytes, BytesLike, bytesFrom } from "../bytes/index.js";
import { Client, KnownScript } from "../client/index.js";
import { Hex, HexLike, hexFrom } from "../hex/index.js";
import { mol } from "../molecule/index.js";
import {
  HASH_TYPES,
  HASH_TYPE_TO_NUM,
  NUM_TO_HASH_TYPE,
} from "./script.advanced.js";

export const HashTypeCodec: mol.Codec<HashTypeLike, HashType> = mol.Codec.from({
  byteLength: 1,
  encode: hashTypeToBytes,
  decode: hashTypeFromBytes,
});

/**
 * @public
 */
export type HashTypeLike = string | number | bigint;
/**
 * @public
 */
export type HashType = "type" | "data" | "data1" | "data2";

/**
 * Converts a HashTypeLike value to a HashType.
 * @public
 *
 * @param val - The value to convert, which can be a string, number, or bigint.
 * @returns The corresponding HashType.
 *
 * @throws Will throw an error if the input value is not a valid hash type.
 *
 * @example
 * ```typescript
 * const hashType = hashTypeFrom(1); // Outputs "data"
 * const hashType = hashTypeFrom("type"); // Outputs "type"
 * ```
 */

export function hashTypeFrom(val: HashTypeLike): HashType {
  const hashType = (() => {
    if (typeof val === "number") {
      return NUM_TO_HASH_TYPE[val];
    }

    if (typeof val === "bigint") {
      return NUM_TO_HASH_TYPE[Number(val)];
    }

    if (!HASH_TYPES.includes(val)) {
      return;
    }
    return val as HashType;
  })();
  if (hashType === undefined) {
    throw new Error(`Invalid hash type ${val}`);
  }
  return hashType;
}

/**
 * Converts a HashTypeLike value to its corresponding byte representation.
 * @public
 *
 * @param hashType - The hash type value to convert.
 * @returns A Uint8Array containing the byte representation of the hash type.
 *
 * @example
 * ```typescript
 * const hashTypeBytes = hashTypeToBytes("type"); // Outputs Uint8Array [0]
 * ```
 */

export function hashTypeToBytes(hashType: HashTypeLike): Bytes {
  return bytesFrom([HASH_TYPE_TO_NUM[hashTypeFrom(hashType)]]);
}

/**
 * Converts a byte-like value to a HashType.
 * @public
 *
 * @param bytes - The byte-like value to convert.
 * @returns The corresponding HashType.
 *
 * @throws Will throw an error if the input bytes do not correspond to a valid hash type.
 *
 * @example
 * ```typescript
 * const hashType = hashTypeFromBytes(new Uint8Array([0])); // Outputs "type"
 * ```
 */

export function hashTypeFromBytes(bytes: BytesLike): HashType {
  return NUM_TO_HASH_TYPE[bytesFrom(bytes)[0]];
}

/**
 * @public
 */
export type ScriptLike = {
  codeHash: BytesLike;
  hashType: HashTypeLike;
  args: BytesLike;
};
/**
 * @public
 */
@mol.codec(
  mol.table({
    codeHash: mol.Byte32,
    hashType: HashTypeCodec,
    args: mol.Bytes,
  }),
)
export class Script extends mol.Entity.Base<ScriptLike, Script>() {
  /**
   * Creates an instance of Script.
   *
   * @param codeHash - The code hash of the script.
   * @param hashType - The hash type of the script.
   * @param args - The arguments for the script.
   */
  constructor(
    public codeHash: Hex,
    public hashType: HashType,
    public args: Hex,
  ) {
    super();
  }

  get occupiedSize(): number {
    return 33 + bytesFrom(this.args).length;
  }

  /**
   * Clone a script.
   *
   * @returns A cloned Script instance.
   *
   * @example
   * ```typescript
   * const script1 = script0.clone();
   * ```
   */
  clone(): Script {
    return new Script(this.codeHash, this.hashType, this.args);
  }

  /**
   * Creates a Script instance from a ScriptLike object.
   *
   * @param script - A ScriptLike object or an instance of Script.
   * @returns A Script instance.
   *
   * @example
   * ```typescript
   * const script = Script.from({
   *   codeHash: "0x1234...",
   *   hashType: "type",
   *   args: "0xabcd..."
   * });
   * ```
   */

  static from(script: ScriptLike): Script {
    if (script instanceof Script) {
      return script;
    }

    return new Script(
      hexFrom(script.codeHash),
      hashTypeFrom(script.hashType),
      hexFrom(script.args),
    );
  }

  /**
   * Creates a Script instance from client and known script.
   *
   * @param knownScript - A KnownScript enum.
   * @param args - Args for the script.
   * @param client - A ScriptLike object or an instance of Script.
   * @returns A promise that resolves to the script instance.
   *
   * @example
   * ```typescript
   * const script = await Script.fromKnownScript(
   *   client,
   *   KnownScript.XUdt,
   *   args: "0xabcd..."
   * );
   * ```
   */

  static async fromKnownScript(
    client: Client,
    knownScript: KnownScript,
    args: HexLike,
  ): Promise<Script> {
    const script = await client.getKnownScript(knownScript);
    return new Script(script.codeHash, script.hashType, hexFrom(args));
  }

  /**
   * Converts the Script instance to molecule data format.
   *
   * @returns An object representing the script in molecule data format.
   */
}

export const ScriptOpt = mol.option(Script);
export const ScriptVec = mol.vector(Script);

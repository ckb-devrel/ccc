import { ccc } from "@ckb-ccc/core";

const CoinXUdtExtensionScriptVecHashCodec = ccc.Codec.from<
  ccc.HexLike,
  ccc.Hex
>({
  byteLength: 20,
  encode: ccc.bytesFrom,
  decode: ccc.hexFrom,
  from: ccc.hexFrom,
});

/** Molecule-compatible union codec for the extension part of xUDT args. */
export const CoinXUdtExtensionCodec = ccc.mol.union(
  {
    Empty: ccc.codecPadding(0),
    ScriptVec: ccc.ScriptVec,
    ScriptVecHash: CoinXUdtExtensionScriptVecHashCodec,
  },
  {
    Empty: 0,
    ScriptVec: 1,
    ScriptVecHash: 2,
  },
);

/** Object-like representation of the extension part of xUDT args. */
export type CoinXUdtExtensionLike = ccc.EncodableType<
  typeof CoinXUdtExtensionCodec
>;

/**
 * Extension configuration encoded by the lower 29 bits of xUDT flags.
 *
 * The variants map directly to RFC 52:
 *
 * - `Empty`: no extension data
 * - `ScriptVec`: a molecule-serialized extension `ScriptVec`
 * - `ScriptVecHash`: the 20-byte blake160 hash of a `ScriptVec`
 *
 * @public
 */
@ccc.codec(CoinXUdtExtensionCodec)
export class CoinXUdtExtension extends ccc.Entity.BaseUnion<
  typeof CoinXUdtExtensionCodec,
  CoinXUdtExtensionLike,
  CoinXUdtExtension
>() {
  /** Creates an extension value with no extension scripts. @public */
  static empty(): CoinXUdtExtension {
    return CoinXUdtExtension.from({ type: "Empty", value: undefined });
  }

  /** Creates an extension value containing a molecule `ScriptVec`. @public */
  static fromScriptVec(scripts: ccc.ScriptLike[]): CoinXUdtExtension {
    return CoinXUdtExtension.from({ type: "ScriptVec", value: scripts });
  }

  /** Creates an extension value containing a 20-byte ScriptVec hash. @public */
  static fromScriptVecHash(hash: ccc.HexLike): CoinXUdtExtension {
    return CoinXUdtExtension.from({ type: "ScriptVecHash", value: hash });
  }
}

/** Object-like representation of xUDT type script args. @public */
export type CoinXUdtArgsLike = {
  /** The 32-byte hash of the owner script. */
  ownerScriptHash: ccc.HexLike;

  /** Disable input-lock owner-mode validation. Defaults to `false`. */
  ownerModeInputLockDisabled?: boolean | null;

  /** Enable owner-mode validation through an output type script. */
  ownerModeOutputType?: boolean | null;

  /** Enable owner-mode validation through an input type script. */
  ownerModeInputType?: boolean | null;

  /** Extension mode and its associated data. Defaults to `Empty`. */
  extensionData?: CoinXUdtExtensionLike | null;

  /**
   * Whether to retain the 4-byte flags field when it would otherwise be zero.
   * Defaults to `false`.
   */
  shouldKeepFlag?: boolean | null;
};

const CoinXUdtArgsCodec = ccc.Codec.from({
  encode(value) {
    const args = CoinXUdtArgs.from(value);
    const extension = args.extensionData.toBytes();
    const extensionFlags = Number(ccc.numLeFromBytes(extension.slice(0, 4)));
    const flags =
      extensionFlags |
      (args.ownerModeInputLockDisabled ? 0x20000000 : 0) |
      (args.ownerModeOutputType ? 0x40000000 : 0) |
      (args.ownerModeInputType ? 0x80000000 : 0);

    const ownerScriptHash = ccc.bytesFrom(args.ownerScriptHash);
    if (flags === 0 && !args.shouldKeepFlag) {
      return ownerScriptHash;
    }

    return ccc.bytesConcat(
      ownerScriptHash,
      ccc.numLeToBytes(flags, 4),
      extension.slice(4),
    );
  },
  decode(value) {
    const argsBytes = ccc.bytesFrom(value);
    if (argsBytes.length === 32) {
      return {
        ownerScriptHash: ccc.hexFrom(argsBytes),
        ownerModeInputLockDisabled: false,
        ownerModeOutputType: false,
        ownerModeInputType: false,
        extensionData: CoinXUdtExtension.empty(),
        shouldKeepFlag: false,
      };
    }

    if (argsBytes.length >= 36) {
      const flags = Number(ccc.numLeFromBytes(argsBytes.slice(32, 36)));
      const extension = CoinXUdtExtension.fromBytes(
        ccc.bytesConcat(
          ccc.numLeToBytes(flags & 0x1fffffff, 4),
          argsBytes.slice(36),
        ),
      );

      return {
        ownerScriptHash: ccc.hexFrom(argsBytes.slice(0, 32)),
        ownerModeInputLockDisabled: (flags & 0x20000000) !== 0,
        ownerModeOutputType: (flags & 0x40000000) !== 0,
        ownerModeInputType: (flags & 0x80000000) !== 0,
        extensionData: extension,
        shouldKeepFlag: flags === 0 && argsBytes.length === 36,
      };
    }

    throw new Error(
      `Invalid xUDT args length: expected 32 or at least 36 bytes, got ${argsBytes.length}`,
    );
  },
  from(value: CoinXUdtArgsLike) {
    return CoinXUdtArgs.from(value);
  },
});

/**
 * Encoded xUDT type script arguments.
 *
 * The owner-mode bits are exposed as boolean fields, while the lower extension
 * flags and their associated data are represented by {@link CoinXUdtExtension}.
 *
 * @public
 */
@ccc.codec(CoinXUdtArgsCodec)
export class CoinXUdtArgs extends ccc.Entity.Base<
  CoinXUdtArgsLike,
  CoinXUdtArgs
>() {
  /** The normalized 32-byte owner script hash. @public */
  public ownerScriptHash: ccc.Hex;

  /** Whether input-lock owner-mode validation is disabled. @public */
  public ownerModeInputLockDisabled: boolean;

  /** Whether output-type owner-mode validation is enabled. @public */
  public ownerModeOutputType: boolean;

  /** Whether input-type owner-mode validation is enabled. @public */
  public ownerModeInputType: boolean;

  /** The normalized extension union. @public */
  public extensionData: CoinXUdtExtension;

  /** Whether an otherwise-zero flags field should be retained. @public */
  public shouldKeepFlag: boolean;

  constructor({
    ownerScriptHash,
    ownerModeInputLockDisabled,
    ownerModeOutputType,
    ownerModeInputType,
    extensionData,
    shouldKeepFlag,
  }: ccc.DecodedType<typeof CoinXUdtArgsCodec>) {
    super();

    this.ownerScriptHash = ownerScriptHash;
    this.ownerModeInputLockDisabled = ownerModeInputLockDisabled;
    this.ownerModeOutputType = ownerModeOutputType;
    this.ownerModeInputType = ownerModeInputType;
    this.extensionData = extensionData;
    this.shouldKeepFlag = shouldKeepFlag;
  }

  /**
   * Normalizes an object-like xUDT args value.
   *
   * @throws if `ownerScriptHash` is not exactly 32 bytes.
   * @public
   */
  static from(value: CoinXUdtArgsLike): CoinXUdtArgs {
    if (value instanceof CoinXUdtArgs) {
      return value;
    }

    const ownerScriptHash = ccc.bytesFrom(value.ownerScriptHash);
    if (ownerScriptHash.length !== 32) {
      throw new Error(
        `Invalid owner script hash length: expected 32 bytes, got ${ownerScriptHash.length}`,
      );
    }

    return new CoinXUdtArgs({
      ownerScriptHash: ccc.hexFrom(ownerScriptHash),
      ownerModeInputLockDisabled: value.ownerModeInputLockDisabled ?? false,
      ownerModeOutputType: value.ownerModeOutputType ?? false,
      ownerModeInputType: value.ownerModeInputType ?? false,
      extensionData: CoinXUdtExtension.from(
        value.extensionData ?? { type: "Empty", value: undefined },
      ),
      shouldKeepFlag: value.shouldKeepFlag ?? false,
    });
  }
}

import { bytesConcat, bytesFrom } from "../../bytes/index.js";
import { Script } from "../../ckb/index.js";
import {
  CellDepInfo,
  Client,
  KnownScript,
  ScriptInfo,
  ScriptInfoLike,
} from "../../client/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { numFrom, NumLike } from "../../num/index.js";
import {
  MultisigCkbWitness,
  MultisigCkbWitnessLike,
} from "./multisigCkbWitness.js";
import {
  decodeOmniLockWitnessLock,
  encodeOmniLockWitnessLockToHex,
} from "./omniLockWitnessLock.js";
import { SignerMultisigCkbBase } from "./signerMultisigCkbBase.js";

/**
 * Auth flag byte for CKB multisig inside Omnilock args (IdentityCkbMultisig).
 */
const AUTH_FLAG_CKB_MULTISIG = 0x06;

/**
 * Omnilock flags bitmask for Anyone-Can-Pay mode.
 */
const ACP_MASK = 0x02;

export interface OmniLockMultisigOptions {
  /**
   * Omnilock flags byte. Set bit 1 (0x02) to enable ACP mode.
   * Default: 0x00 (no modes, pure multisig custody).
   */
  omniLockFlags?: NumLike | null;

  /**
   * ACP minimum CKB exponent (10^n shannons). Only used when ACP is enabled.
   * Default: 0 (minimum 1 shannon).
   */
  acpMinCkb?: NumLike | null;

  /**
   * ACP minimum UDT exponent (10^n base units). Only used when ACP is enabled.
   * Default: 0 (minimum 1 base unit).
   */
  acpMinUdt?: NumLike | null;

  /**
   * Override the Omnilock script info. By default, resolved from
   * KnownScript.OmniLock via the client.
   */
  scriptInfo?: ScriptInfoLike | null;
}

/**
 * Build the Omnilock script args.
 *
 * Layout: <0x06> <20B blake160(multisig_script)> <1B omnilock_flags>
 *         [<2B ckb_min|udt_min> if ACP]
 *
 * Must be static (called before super()).
 */
function buildOmniLockArgs(
  multisigInfo: MultisigCkbWitness,
  omniLockFlags: number,
  acpMinCkb: number,
  acpMinUdt: number,
): Hex {
  const multisigBlake160 = multisigInfo.scriptArgs();
  const parts = [
    bytesFrom([AUTH_FLAG_CKB_MULTISIG]),
    multisigBlake160,
    bytesFrom([omniLockFlags]),
  ];
  if (omniLockFlags & ACP_MASK) {
    parts.push(bytesFrom([acpMinCkb, acpMinUdt]));
  }
  return hexFrom(bytesConcat(...parts));
}

/**
 * A read-only signer for Omnilock cells using CKB multisig auth (flag 0x06).
 *
 * Omnilock with auth flag 0x06 uses the same M-of-N secp256k1 multisig
 * verification as the standalone multisig system script. The multisig witness
 * bytes (S|R|M|N|pubkey_hashes|signatures) are placed inside the
 * OmniLockWitnessLock.signature field rather than directly in WitnessArgs.lock.
 *
 * When ACP mode is enabled (omniLockFlags & 0x02), the cell can also be
 * unlocked without a signature (ACP deposit path), following RFC 0026 rules.
 *
 * @public
 */
export class SignerMultisigOmniLockReadonly extends SignerMultisigCkbBase {
  public readonly omniLockFlags: number;
  public readonly acpMinCkb: number;
  public readonly acpMinUdt: number;

  /**
   * Creates an instance of SignerMultisigOmniLockReadonly.
   *
   * @param client - The client instance.
   * @param multisigInfoLike - The multisig information (public keys, threshold, mustMatch).
   * @param options - Omnilock-specific options (flags, ACP minimums, script override).
   */
  constructor(
    client: Client,
    multisigInfoLike: MultisigCkbWitnessLike,
    options?: OmniLockMultisigOptions | null,
  ) {
    const multisigInfo = MultisigCkbWitness.from(multisigInfoLike);
    const omniLockFlags = Number(numFrom(options?.omniLockFlags ?? 0));
    const acpMinCkb =
      omniLockFlags & ACP_MASK ? Number(numFrom(options?.acpMinCkb ?? 0)) : 0;
    const acpMinUdt =
      omniLockFlags & ACP_MASK ? Number(numFrom(options?.acpMinUdt ?? 0)) : 0;

    const args = buildOmniLockArgs(
      multisigInfo,
      omniLockFlags,
      acpMinCkb,
      acpMinUdt,
    );
    const scriptInfos = (async (): Promise<
      { script: Script; cellDeps: CellDepInfo[] }[]
    > => {
      const info = options?.scriptInfo
        ? ScriptInfo.from(options.scriptInfo)
        : await client.getKnownScript(KnownScript.OmniLock);
      return [
        {
          script: Script.from({ ...info, args }),
          cellDeps: info.cellDeps,
        },
      ];
    })();

    super(client, multisigInfo, scriptInfos);
    this.omniLockFlags = omniLockFlags;
    this.acpMinCkb = acpMinCkb;
    this.acpMinUdt = acpMinUdt;
  }

  protected encodeWitnessLock(witness: MultisigCkbWitness): Hex {
    return encodeOmniLockWitnessLockToHex(bytesFrom(witness.toHex()));
  }

  protected decodeWitnessLock(lock: Hex): MultisigCkbWitness | undefined {
    const lockBytes = bytesFrom(lock);
    const signature = decodeOmniLockWitnessLock(lockBytes);
    if (!signature) {
      return undefined;
    }
    return MultisigCkbWitness.decode(signature);
  }
}

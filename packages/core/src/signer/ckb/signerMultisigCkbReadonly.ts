import { Script, Since, SinceLike } from "../../ckb/index.js";
import {
  Client,
  KnownScript,
  ScriptInfo,
  ScriptInfoLike,
} from "../../client/index.js";
import { Hex } from "../../hex/index.js";
import { apply } from "../../utils/index.js";
import {
  MultisigCkbWitness,
  MultisigCkbWitnessLike,
} from "./multisigCkbWitness.js";
import { SignerMultisigCkbBase } from "./signerMultisigCkbBase.js";

/**
 * A class extending Signer that provides access to a CKB multisig script.
 * This class does not support signing operations.
 * @public
 */
export class SignerMultisigCkbReadonly extends SignerMultisigCkbBase {
  public readonly since?: Since;

  /**
   * Creates an instance of SignerMultisigCkbReadonly.
   *
   * @param client - The client instance.
   * @param multisigInfoLike - The multisig information.
   * @param options - The options.
   */
  constructor(
    client: Client,
    multisigInfoLike: MultisigCkbWitnessLike,
    options?: {
      since?: SinceLike | null;
      scriptInfos?: (KnownScript | ScriptInfoLike)[] | null;
    } | null,
  ) {
    const multisigInfo = MultisigCkbWitness.from(multisigInfoLike);
    const since = apply(Since.from, options?.since);

    const args = multisigInfo.scriptArgs(since);
    const scriptInfos = Promise.all(
      (
        options?.scriptInfos ?? [
          KnownScript.Secp256k1MultisigV2,
          KnownScript.Secp256k1MultisigV2Beta,
          KnownScript.Secp256k1Multisig,
        ]
      ).map(async (v) =>
        typeof v === "string" ? client.getKnownScript(v) : ScriptInfo.from(v),
      ),
    ).then((infos) =>
      infos.map((i) => ({
        script: Script.from({ ...i, args }),
        cellDeps: i.cellDeps,
      })),
    );

    super(client, multisigInfo, scriptInfos);
    this.since = since;
  }

  protected encodeWitnessLock(witness: MultisigCkbWitness): Hex {
    return witness.toHex();
  }

  protected decodeWitnessLock(lock: Hex): MultisigCkbWitness | undefined {
    return MultisigCkbWitness.decode(lock);
  }
}

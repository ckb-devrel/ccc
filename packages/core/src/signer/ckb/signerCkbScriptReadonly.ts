import { Address } from "../../address/index.js";
import { Script, ScriptLike } from "../../ckb/index.js";
import { Client } from "../../client/index.js";
import { Signer, SignerSignType, SignerType } from "../signer/index.js";

/**
 * A read-only signer for a CKB script. It can be used to get addresses,
 * but not to sign transactions. This is useful when you want to watch an address
 * without having the private key.
 *
 * @public
 */
export class SignerCkbScriptReadonly extends Signer {
  /**
   * The type of the signer.
   */
  get type(): SignerType {
    return SignerType.CKB;
  }

  /**
   * The sign type of the signer.
   * As this is a read-only signer, the sign type is {@link SignerSignType.Unknown}.
   */
  get signType(): SignerSignType {
    return SignerSignType.Unknown;
  }

  /**
   * The scripts associated with the signer.
   */
  public readonly scripts: Script[];

  /**
   * Creates an instance of SignerCkbScriptReadonly.
   *
   * @param client - The client instance used for communication.
   * @param scripts - The scripts associated with the signer. Can be a single script, an array of scripts, or multiple script arguments.
   */
  constructor(client: Client, ...scripts: (ScriptLike | ScriptLike[])[]) {
    super(client);

    this.scripts = scripts.flat().map(Script.from);
    if (this.scripts.length === 0) {
      throw new Error("SignerCkbScriptReadonly requires at least one script.");
    }
  }

  /**
   * Connects to the client. This implementation does nothing as the class is read-only.
   *
   * @returns A promise that resolves when the connection is complete.
   */
  async connect(): Promise<void> {}

  /**
   * Check if the signer is connected.
   *
   * @returns A promise that resolves the connection status.
   */
  async isConnected(): Promise<boolean> {
    return true;
  }

  /**
   * Gets the internal address for the script.
   *
   * @returns A promise that resolves to a string representing the internal address.
   *
   * @example
   * ```typescript
   * const internalAddress = await signer.getInternalAddress(); // Outputs the internal address
   * ```
   */
  async getInternalAddress(): Promise<string> {
    return this.getRecommendedAddress();
  }

  /**
   * Gets an array of Address objects representing the script address.
   *
   * @returns A promise that resolves to an array of Address objects.
   *
   * @example
   * ```typescript
   * const addressObjs = await signer.getAddressObjs(); // Outputs the array of Address objects
   * ```
   */
  async getAddressObjs(): Promise<Address[]> {
    return this.scripts.map((script) =>
      Address.fromScript(script, this.client),
    );
  }
}

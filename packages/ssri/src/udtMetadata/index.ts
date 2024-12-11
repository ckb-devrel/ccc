import { BytesLike } from "../../../core/src/bytes";
import { UDT } from "../udt/index";

/**
 * Represents metadata for a UDT (User Defined Token).
 * @extends {UDT} In a composition style.
 */
export class UDTMetadata {
  udt: UDT;

  /**
   * Creates an instance of UDTMetadata.
   * @param {UDT} udt - The UDT instance.
   */
  constructor(udt: UDT) {
    this.udt = udt;
  }

  /**
   * Retrieves the name of the UDT.
   * @returns {Promise<string>} The name of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async name(): Promise<string> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves the symbol of the UDT.
   * @returns {Promise<string>} The symbol of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async symbol(): Promise<string> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves the decimals of the UDT.
   * @returns {Promise<bigint>} The decimals of the UDT.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async decimals(): Promise<bigint> {
    // TODO: implement
    throw new Error("TODO");
  }

  /**
   * Retrieves extension data for the UDT using a registry key.
   * @param {string} registryKey - The registry key to retrieve the extension data for.
   * @returns {Promise<BytesLike>} The extension data.
   * @throws {Error} Throws an error if the function is not yet implemented.
   * @tag Cache
   */
  async getExtensionData(registryKey: string): Promise<BytesLike> {
    // TODO: implement
    throw new Error("TODO");
  }
}

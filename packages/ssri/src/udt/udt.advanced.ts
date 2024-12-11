import { Address } from "../../../core/src/address";

/**
 * Retrieves the balance of the specified address.
 * @param {Address} address - The address to retrieve the balance for.
 * @returns {Promise<bigint>} The balance of the specified address.
 * @throws {Error} Throws an error if the function is not yet implemented.
 * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
 */
export async function getBalanceOf(address: Address): Promise<bigint> {
  // TODO: implement
  throw new Error("TODO");
}

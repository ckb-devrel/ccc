import { ccc, mol } from "@ckb-ccc/core";
import { UDT } from "./index.js";

/**
 * Retrieves the balance of the specified address.
 * @param {ccc.Address} address - The address to retrieve the balance for.
 * @param {ccc.Script} script - The script to retrieve the balance for.
 * @returns {Promise<number>} The balance of the specified address.
 * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
 * @tag Legacy - Supports xUDT legacy behavior.
 * @tag Script - This method requires a script to be provided. It should be the target script of the UDT.
 */
export async function getBalanceOf(
  udtContract: UDT,
  address: ccc.Address,
  script: ccc.Script,
): Promise<number> {
  const lock = address.script;

  let balanceTotal = ccc.numFrom(0);
  for await (const cell of udtContract.client.findCellsByLock(
    lock,
    script,
    true,
  )) {
    balanceTotal += ccc.udtBalanceFrom(cell.outputData);
  }

  return Number(balanceTotal) / 10 ** Number(await udtContract.decimals());
}

export const lockArrayCodec = mol.vector(ccc.Script);

export const amountArrayCodec = mol.vector(mol.Uint128);
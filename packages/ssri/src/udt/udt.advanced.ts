import { ccc, Address } from "@ckb-ccc/core";
import { SSRICallParams, ssriUtils } from "../ssri/index.js";
import { UDT } from "./index.js";

/**
 * Retrieves the balance of the specified address.
 * @param {Address} address - The address to retrieve the balance for.
 * @returns {Promise<number>} The balance of the specified address.
 * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
 */
export async function getBalanceOf(
  udtContract: UDT,
  address: Address,
  params?: SSRICallParams,
): Promise<number> {
  ssriUtils.validateSSRIParams(params, { level: "script" });
  const udtTypeScript = new ccc.Script(
    params!.script!.code_hash,
    params!.script!.hash_type,
    params!.script!.args,
  );

  const lock = address.script;
  console.log("Lock", lock);

  let balanceTotal = BigInt(0);
  for await (const cell of udtContract.server.client.findCellsByLock(
    lock,
    udtTypeScript,
    true,
  )) {
    console.log("Found Cell", cell);
    balanceTotal += ccc.udtBalanceFrom(cell.outputData);
  }

  return Number(balanceTotal) / 10 ** Number(await udtContract.decimals());
}

import { ccc, Address } from "@ckb-ccc/core";
import { SSRICallParams, ssriUtils } from "@ckb-ccc/ssri";
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
  if (!params?.script) {
    throw new Error("Script is required");
  }
  const udtTypeScript = new ccc.Script(
    params.script.code_hash,
    params.script.hash_type,
    params.script.args,
  );

  const lock = address.script;
  console.log("Lock", lock);

  let balanceTotal = BigInt(0);
  let client: ccc.Client;
  if (udtContract.fallbackArguments) {
    client = udtContract.fallbackArguments.client;
  } else {
    client = udtContract.server.client;
  }
  for await (const cell of client.findCellsByLock(
    lock,
    udtTypeScript,
    true,
  )) {
    console.log("Found Cell", cell);
    balanceTotal += ccc.udtBalanceFrom(cell.outputData);
  }

  return Number(balanceTotal) / 10 ** Number(await udtContract.decimals());
}

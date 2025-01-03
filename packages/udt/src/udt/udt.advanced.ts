import { ccc } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { UDT } from "./index.js";

/**
 * Retrieves the balance of the specified address.
 * @param {Address} address - The address to retrieve the balance for.
 * @returns {Promise<number>} The balance of the specified address.
 * @tag Elevated - This method is elevated with CCC and not available in raw SSRI call.
 */
export async function getBalanceOf(
  udtContract: UDT,
  address: ccc.Address,
  params?: ssri.CallParams,
): Promise<number> {
  ssri.utils.validateParams(params, { level: "script" });
  if (!params?.script) {
    throw new Error("Script is required");
  }
  const udtTypeScript = new ccc.Script(
    params.script.code_hash,
    params.script.hash_type,
    params.script.args,
  );

  const lock = address.script;

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
    balanceTotal += ccc.udtBalanceFrom(cell.outputData);
  }

  return Number(balanceTotal) / 10 ** Number(await udtContract.decimals());
}

import { readFileAsBytes } from "@/src/app/utils/(tools)/FileUpload/page";
import { ccc } from "@ckb-ccc/connector-react";
import { normalizeTypeIdArgs } from "./helpers";

export type DeployLogger = (msg: string, ...args: unknown[]) => void;

export async function runDeploy(
  signer: ccc.Signer,
  file: File,
  typeIdArgs: string,
  foundCell: ccc.Cell | null,
  isAddressMatch: boolean | null,
  log: DeployLogger,
  error: DeployLogger,
): Promise<string | null> {
  const fileBytes = (await readFileAsBytes(file)) as ccc.Bytes;
  const { script } = await signer.getRecommendedAddressObj();

  let tx: ccc.Transaction;
  let typeIdArgsValue: string;

  if (typeIdArgs.trim() !== "") {
    if (!foundCell) {
      error("Type ID cell not found. Please check the Type ID args.");
      return null;
    }
    if (isAddressMatch === false) {
      error(
        "Cannot update cell: The cell's lock address does not match your wallet address. You cannot unlock this cell.",
      );
      return null;
    }

    const normalized = normalizeTypeIdArgs(typeIdArgs);
    log("Updating existing Type ID cell...");

    tx = ccc.Transaction.from({
      inputs: [{ previousOutput: foundCell.outPoint }],
      outputs: [
        {
          ...foundCell.cellOutput,
          capacity: ccc.Zero,
        },
      ],
      outputsData: [fileBytes],
    });
    typeIdArgsValue = normalized;
  } else {
    log("Building transaction...");
    tx = ccc.Transaction.from({
      outputs: [
        {
          lock: script,
          type: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.TypeId,
            "00".repeat(32),
          ),
        },
      ],
      outputsData: [fileBytes],
    });

    await tx.completeInputsAddOne(signer);

    if (!tx.outputs[0].type) {
      throw new Error("Unexpected disappeared output");
    }
    tx.outputs[0].type.args = ccc.hashTypeId(tx.inputs[0], 0);
    typeIdArgsValue = tx.outputs[0].type.args;
    log("Type ID created:", typeIdArgsValue);
  }

  await tx.completeFeeBy(signer);
  log("Sending transaction...");
  const txHash = await signer.sendTransaction(tx);
  log("Transaction sent:", txHash);
  return txHash;
}

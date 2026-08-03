import { readFileAsBytes } from "@/src/app/utils/(tools)/FileUpload/page";
import { ccc } from "@ckb-ccc/connector-react";
import { ReactNode } from "react";
import { createImmutableLock } from "./helpers";

export type Logger = (...args: ReactNode[]) => void;
export type DeployResult = {
  txHash: string;
  typeId: string;
  dataHash: string;
};

export async function runDeploy(
  signer: ccc.Signer,
  file: File,
  immutable: boolean,
  typeIdArgs: string,
  foundCell: ccc.Cell | null,
  log: Logger,
  error: Logger,
): Promise<DeployResult | null> {
  const fileBytes = (await readFileAsBytes(file)) as ccc.Bytes;

  let tx: ccc.Transaction;
  let typeIdArgsValue: string;

  if (typeIdArgs.trim() !== "") {
    if (!foundCell) {
      error("Type ID cell not found. Please check the Type ID args.");
      return null;
    }
    log("Updating existing Type ID cell...");

    tx = ccc.Transaction.from({
      inputs: [{ previousOutput: foundCell.outPoint }],
      outputs: [
        {
          ...foundCell.cellOutput,
          lock: immutable ? createImmutableLock() : foundCell.cellOutput.lock,
          capacity: ccc.Zero,
        },
      ],
      outputsData: [fileBytes],
    });
    typeIdArgsValue = foundCell.cellOutput.type?.args ?? typeIdArgs;
  } else {
    log("Building transaction...");
    const lock = immutable
      ? createImmutableLock()
      : (await signer.getRecommendedAddressObj()).script;
    tx = ccc.Transaction.from({
      outputs: [
        {
          lock,
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

  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.TypeId);
  await tx.completeFeeBy(signer);
  log("Sending transaction...");
  const txHash = await signer.sendTransaction(tx);
  log("Transaction sent:", txHash);
  return {
    txHash,
    typeId: typeIdArgsValue,
    dataHash: ccc.hashCkb(fileBytes),
  };
}

/** Burn the selected type_id cell: consume it and send capacity back to the lock (no type script). */
export async function runBurn(
  signer: ccc.Signer,
  foundCell: ccc.Cell,
  log: Logger,
): Promise<string | null> {
  const { lock } = foundCell.cellOutput;
  const tx = ccc.Transaction.from({
    inputs: [{ previousOutput: foundCell.outPoint }],
    outputs: [{ lock, capacity: ccc.Zero }],
    outputsData: ["0x"],
  });
  await tx.addCellDepsOfKnownScripts(signer.client, ccc.KnownScript.TypeId);
  await tx.completeFeeChangeToOutput(signer, 0);
  log("Sending burn transaction...");
  const txHash = await signer.sendTransaction(tx);
  log("Transaction sent:", txHash);
  return txHash;
}

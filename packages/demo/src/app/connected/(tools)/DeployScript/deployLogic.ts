import { readFileAsBytes } from "@/src/app/utils/(tools)/FileUpload/page";
import { ccc } from "@ckb-ccc/connector-react";
import { createTypeId, transferTypeId } from "@ckb-ccc/type-id";
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
  foundCell: ccc.Cell | null,
  log: Logger,
): Promise<DeployResult> {
  const fileBytes = (await readFileAsBytes(file)) as ccc.Bytes;

  let tx: ccc.Transaction;
  let typeIdArgsValue: string;

  if (foundCell) {
    const typeId = foundCell.cellOutput.type?.args;
    if (!typeId) {
      throw new Error("Selected cell does not have a Type ID");
    }
    log("Updating existing Type ID cell...");

    ({ tx } = await transferTypeId({
      client: signer.client,
      id: typeId,
      receiver: immutable ? createImmutableLock() : foundCell.cellOutput.lock,
      data: fileBytes,
    }));
    typeIdArgsValue = typeId;
  } else {
    log("Building transaction...");
    const created = await createTypeId({
      signer,
      data: fileBytes,
      receiver: immutable ? createImmutableLock() : undefined,
    });
    tx = created.tx;
    typeIdArgsValue = created.id;
    log("Type ID created:", typeIdArgsValue);
  }

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

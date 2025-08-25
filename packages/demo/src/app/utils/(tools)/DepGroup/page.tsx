"use client";

import { Button } from "@/src/components/Button";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { TextInput } from "@/src/components/Input";
import { Message } from "@/src/components/Message";
import { Textarea } from "@/src/components/Textarea";
import { useApp } from "@/src/context";
import { useGetExplorerLink } from "@/src/utils";
import { ccc } from "@ckb-ccc/connector-react";
import { FileSearch, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const OutPointVec = ccc.mol.vector(ccc.OutPoint);

export default function DepGroup() {
  const { signer, createSender } = useApp();
  const { client, open } = ccc.useCcc();

  const { log, error } = createSender("Manage dep group");

  const { explorerTransaction, explorerAddress } = useGetExplorerLink();

  const [address, setAddress] = useState<string | undefined>();

  const [typeId, setTypeId] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean>(false);
  const [rawData, setRawData] = useState<string>("");
  const [outPoint, setOutPoint] = useState<string>("");
  const [outPoints, setOutPoints] = useState<ccc.OutPoint[]>([]);

  const [advancedEnabled, setAdvancedEnabled] = useState<boolean>(false);

  const validate = useCallback(async () => {
    if (ccc.bytesFrom(typeId).length !== 32) {
      error(`Type ID length should be 32`);
      return {};
    }

    const cell = await client.findSingletonCellByType(
      {
        ...(await ccc.Script.fromKnownScript(
          client,
          ccc.KnownScript.TypeId,
          typeId,
        )),
      },
      true,
    );

    if (!cell) {
      error(`Cell with Type Id ${typeId} not found`);
      return {};
    }

    const outPoints = OutPointVec.decode(cell.outputData);
    setIsValid(true);

    return { cell, outPoints };
  }, [typeId, client, error]);

  const search = useCallback(async () => {
    const { cell, outPoints } = await validate();
    if (cell && outPoints) {
      setOutPoints(outPoints);
      log(`Found cell`, explorerTransaction(cell.outPoint.txHash));
    }
  }, [validate, explorerTransaction]);

  useEffect(() => {
    (async () => {
      setAddress(await signer?.getRecommendedAddress());
    })();
  }, [signer]);

  return (
    <>
      <div className="flex w-full flex-col items-stretch">
        <Message title="Hint" type="info">
          According to{" "}
          <Link
            className="underline"
            href="https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0022-transaction-structure/0022-transaction-structure.md#dep-group"
            target="_blank"
          >
            RFC 22: CKB Transaction Structure
          </Link>
          : Dep Group is a cell which bundles several cells as its members.
          {address ? (
            <>
              <br />
              Find existing dep groups by explorer: {explorerAddress(address)}
            </>
          ) : undefined}
        </Message>
        <div className="flex items-center">
          <TextInput
            className="flex-1"
            label="Type ID (Empty to create a new one)"
            placeholder="0x0000000000000000000000000000000000000000000000000000000000000000"
            state={[
              typeId,
              (val) => {
                setTypeId(val);
                setIsValid(false);
              },
            ]}
          />
          <div
            className="flex cursor-pointer items-center self-stretch bg-white/75"
            onClick={search}
          >
            <Search
              className="mx-4 rounded-full bg-sky-200 p-1 text-sky-500"
              width="36"
              height="36"
            />
          </div>
        </div>
        <div className="bg-white/75 px-3 py-2">
          Outpoints
          <span
            className="ml-2 cursor-pointer text-xs underline"
            onClick={() => setAdvancedEnabled(!advancedEnabled)}
          >
            Parse raw data (advanced)
          </span>
        </div>
        {advancedEnabled ? (
          <div className="flex items-center">
            <Textarea
              className="flex-1"
              label="Outpoints raw data"
              placeholder="0x00..."
              state={[rawData, setRawData]}
            />
            <div
              className="flex cursor-pointer items-center self-stretch bg-white/75"
              onClick={async () => setOutPoints(OutPointVec.decode(rawData))}
            >
              <FileSearch
                className="mx-4 rounded-full bg-neutral-200 p-1 text-neutral-500"
                width="36"
                height="36"
              />
            </div>
          </div>
        ) : undefined}
        <div className="flex items-center">
          <TextInput
            className="flex-1"
            label="Add outpoint"
            placeholder="0x0000000000000000000000000000000000000000000000000000000000000000:0"
            state={[outPoint, setOutPoint]}
          />
          <div
            className="flex cursor-pointer items-center self-stretch bg-white/75"
            onClick={async () => {
              const [txHash, index] = outPoint.split(":");
              const newOutPoint = ccc.OutPoint.from({
                txHash: ccc.hexFrom(txHash),
                index: ccc.numFrom(index),
              });

              setOutPoints([...outPoints, newOutPoint]);
            }}
          >
            <Plus
              className="mx-4 rounded-full bg-green-200 p-1 text-green-500"
              width="36"
              height="36"
            />
          </div>
        </div>
        {outPoints.map((outPoint, i) => {
          return (
            <div className="bg-white/75 py-1" key={i}>
              <div
                className="w-100 flex cursor-pointer flex-col items-center justify-center break-all rounded px-16 py-2 hover:bg-red-200 xl:flex-row xl:justify-between"
                onClick={() =>
                  setOutPoints(outPoints.filter((_, j) => j !== i))
                }
              >
                {i + 1}. {outPoint.txHash}:{outPoint.index}
                <X className="my-2 rounded-full bg-red-200 p-1 text-red-500 xl:my-0" />
              </div>
            </div>
          );
        })}
        <ButtonsPanel>
          <Button
            variant="success"
            onClick={async () => {
              if (typeId !== "" && !isValid) {
                return search();
              }

              if (!signer) {
                return open();
              }

              if (typeId === "") {
                const { script: lock } =
                  await signer.getRecommendedAddressObj();
                const tx = ccc.Transaction.from({
                  outputs: [
                    {
                      lock,
                      type: await ccc.Script.fromKnownScript(
                        client,
                        ccc.KnownScript.TypeId,
                        "00".repeat(32),
                      ),
                    },
                  ],
                  outputsData: [OutPointVec.encode(outPoints)],
                });
                await tx.completeInputsAtLeastOne(signer);
                const typeId = ccc.hashTypeId(tx.inputs[0], 0);

                if (!tx.outputs[0].type) {
                  error("Unexpected disappeared output");
                  return;
                }
                tx.outputs[0].type!.args = typeId;

                await tx.completeFeeBy(signer);

                const txHash = await signer.sendTransaction(tx);
                log(
                  "Type ID created: ",
                  typeId,
                  "tx hash: ",
                  explorerTransaction(txHash),
                );
                setTypeId(typeId);
                setIsValid(true);
                await signer.client.waitTransaction(txHash);
                log("Transaction committed:", explorerTransaction(txHash));
              } else {
                const { cell } = await validate();
                if (!cell) {
                  return;
                }

                const tx = ccc.Transaction.from({
                  inputs: [cell],
                  outputs: [{ ...cell.cellOutput, capacity: ccc.Zero }],
                  outputsData: [OutPointVec.encode(outPoints)],
                });

                await tx.completeFeeBy(signer);
                const txHash = await signer.sendTransaction(tx);
                log(
                  "Type ID updated: ",
                  typeId,
                  "tx hash: ",
                  explorerTransaction(txHash),
                );
                await signer.client.waitTransaction(txHash);
                log("Transaction committed:", explorerTransaction(txHash));
              }
            }}
          >
            {!signer
              ? "Connect"
              : typeId !== ""
                ? isValid
                  ? "Update"
                  : "Search"
                : "Create"}
          </Button>
        </ButtonsPanel>
      </div>
    </>
  );
}

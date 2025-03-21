"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { BigButton } from "@/src/components/BigButton";

function parseEpoch(epoch: ccc.Epoch): ccc.FixedPoint {
  return (
    ccc.fixedPointFrom(epoch[0].toString()) +
    (ccc.fixedPointFrom(epoch[1].toString()) * ccc.fixedPointFrom(1)) /
      ccc.fixedPointFrom(epoch[2].toString())
  );
}

function DaoButton({ dao }: { dao: ccc.Cell }) {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [tip, setTip] = useState<ccc.ClientBlockHeader | undefined>();
  const [infos, setInfos] = useState<
    [ccc.Num, ccc.ClientBlockHeader, ccc.ClientBlockHeader] | undefined
    // Profit, Deposit Header, Withdraw Header / Tip Header
  >();
  const isNew = useMemo(() => dao.outputData === "0x0000000000000000", [dao]);
  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const tipHeader = await signer.client.getTipHeader();
      setTip(tipHeader);

      const { depositHeader, withdrawHeader } = await dao.getNervosDaoInfo(
        signer.client,
      );

      setInfos(
        depositHeader
          ? [
              ccc.calcDaoProfit(
                dao.capacityFree,
                depositHeader,
                withdrawHeader ?? tipHeader,
              ),
              depositHeader,
              withdrawHeader ?? tipHeader,
            ]
          : undefined,
      );
    })();
  }, [dao, signer]);

  return (
    <BigButton
      key={ccc.hexFrom(dao.outPoint.toBytes())}
      size="sm"
      iconName="Vault"
      onClick={() => {
        if (!signer || !infos) {
          return;
        }

        (async () => {
          const [_, depositHeader, withdrawHeader] = infos;

          let tx;
          if (isNew) {
            tx = ccc.Transaction.from({
              headerDeps: [depositHeader.hash],
              inputs: [{ previousOutput: dao.outPoint }],
              outputs: [dao.cellOutput],
              outputsData: [ccc.numLeToBytes(depositHeader.number, 8)],
            });

            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer);
          } else {
            tx = ccc.Transaction.from({
              headerDeps: [withdrawHeader.hash, depositHeader.hash],
              inputs: [
                {
                  previousOutput: dao.outPoint,
                  since: {
                    relative: "absolute",
                    metric: "epoch",
                    value: ccc.epochToHex(
                      ccc.calcDaoClaimEpoch(depositHeader, withdrawHeader),
                    ),
                  },
                },
              ],
              outputs: [
                {
                  lock: (await signer.getRecommendedAddressObj()).script,
                },
              ],
              witnesses: [
                ccc.WitnessArgs.from({
                  inputType: ccc.numLeToBytes(1, 8),
                }).toBytes(),
              ],
            });
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeChangeToOutput(signer, 0);
          }

          // Sign and send the transaction
          const txHash = await signer.sendTransaction(tx);
          log("Transaction sent:", explorerTransaction(txHash));
          await signer.client.waitTransaction(txHash);
          log("Transaction committed:", explorerTransaction(txHash));
        })();
      }}
      className={`align-center ${isNew ? "text-yellow-400" : "text-orange-400"}`}
    >
      <div className="text-md flex flex-col">
        <span>
          {ccc.fixedPointToString(
            (dao.cellOutput.capacity / ccc.fixedPointFrom("0.01")) *
              ccc.fixedPointFrom("0.01"),
          )}
        </span>
        {infos ? (
          <span className="-mt-1 text-sm">
            +
            {ccc.fixedPointToString(
              (infos[0] / ccc.fixedPointFrom("0.0001")) *
                ccc.fixedPointFrom("0.0001"),
            )}
          </span>
        ) : undefined}
      </div>
      <div className="flex flex-col text-sm">
        {infos && tip ? (
          <div className="flex whitespace-nowrap">
            {ccc.fixedPointToString(
              ((parseEpoch(ccc.calcDaoClaimEpoch(infos[1], infos[2])) -
                parseEpoch(tip.epoch)) /
                ccc.fixedPointFrom("0.001")) *
                ccc.fixedPointFrom("0.001"),
            )}{" "}
            epoch
          </div>
        ) : undefined}
        <span>{isNew ? "Redeem" : "Withdraw"}</span>
      </div>
    </BigButton>
  );
}

export default function NervosDao() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [amount, setAmount] = useState<string>("");
  const [feeRate, setFeeRate] = useState<undefined | ccc.Num>();
  const [daos, setDaos] = useState<ccc.Cell[]>([]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const daos = [];
      for await (const cell of signer.findCells(
        {
          script: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.NervosDao,
            "0x",
          ),
          scriptLenRange: [33, 34],
          outputDataLenRange: [8, 9],
        },
        true,
      )) {
        daos.push(cell);
        setDaos(daos);
      }
    })();
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Amount"
        placeholder="Amount to deposit"
        state={[amount, setAmount]}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {daos.map((dao) => (
          <DaoButton key={ccc.hexFrom(dao.outPoint.toBytes())} dao={dao} />
        ))}
      </div>
      <ButtonsPanel>
        <Button
          onClick={async () => {
            if (!signer) {
              return;
            }

            const { script: lock } = await signer.getRecommendedAddressObj();

            const tx = ccc.Transaction.from({
              outputs: [
                {
                  lock,
                  type: await ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.NervosDao,
                    "0x",
                  ),
                },
              ],
              outputsData: ["00".repeat(8)],
            });
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsAll(signer);
            const feeRate = await signer.client.getFeeRate();
            setFeeRate(feeRate);
            await tx.completeFeeChangeToOutput(signer, 0, feeRate);

            const amount = ccc.fixedPointToString(tx.outputs[0].capacity);
            log("You can deposit at most", amount, "CKB");
            setAmount(amount);
          }}
        >
          Max Amount
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            if (!signer) {
              return;
            }

            const { script: lock } = await signer.getRecommendedAddressObj();

            const tx = ccc.Transaction.from({
              outputs: [
                {
                  lock,
                  type: await ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.NervosDao,
                    "0x",
                  ),
                },
              ],
              outputsData: ["00".repeat(8)],
            });
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            if (tx.outputs[0].capacity > ccc.fixedPointFrom(amount)) {
              error(
                "Insufficient capacity at output, min",
                ccc.fixedPointToString(tx.outputs[0].capacity),
                "CKB",
              );
              return;
            }
            tx.outputs[0].capacity = ccc.fixedPointFrom(amount);

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer, feeRate);

            // Sign and send the transaction
            const txHash = await signer.sendTransaction(tx);
            log("Transaction sent:", explorerTransaction(txHash));
            await signer.client.waitTransaction(txHash);
            log("Transaction committed:", explorerTransaction(txHash));
          }}
        >
          Deposit
        </Button>
      </ButtonsPanel>
    </div>
  );
}

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

function getProfit(
  dao: ccc.Cell,
  depositHeader: ccc.ClientBlockHeader,
  withdrawHeader: ccc.ClientBlockHeader,
): ccc.Num {
  const occupiedSize = ccc.fixedPointFrom(
    dao.cellOutput.occupiedSize + ccc.bytesFrom(dao.outputData).length,
  );
  const profitableSize = dao.cellOutput.capacity - occupiedSize;

  return (
    (profitableSize * withdrawHeader.dao.ar) / depositHeader.dao.ar -
    profitableSize
  );
}

function getClaimEpoch(
  depositHeader: ccc.ClientBlockHeader,
  withdrawHeader: ccc.ClientBlockHeader,
): ccc.Epoch {
  const depositEpoch = depositHeader.epoch;
  const withdrawEpoch = withdrawHeader.epoch;
  const intDiff = withdrawEpoch[0] - depositEpoch[0];
  // deposit[1]    withdraw[1]
  // ---------- <= -----------
  // deposit[2]    withdraw[2]
  if (
    intDiff % ccc.numFrom(180) !== ccc.numFrom(0) ||
    depositEpoch[1] * withdrawEpoch[2] <= depositEpoch[2] * withdrawEpoch[1]
  ) {
    return [
      depositEpoch[0] +
        (intDiff / ccc.numFrom(180) + ccc.numFrom(1)) * ccc.numFrom(180),
      depositEpoch[1],
      depositEpoch[2],
    ];
  }

  return [
    depositEpoch[0] + (intDiff / ccc.numFrom(180)) * ccc.numFrom(180),
    depositEpoch[1],
    depositEpoch[2],
  ];
}

function DaoButton({ dao }: { dao: ccc.Cell }) {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [tip, setTip] = useState<ccc.ClientBlockHeader | undefined>();
  const [infos, setInfos] = useState<
    | [
        ccc.Num,
        ccc.ClientTransactionResponse,
        ccc.ClientBlockHeader,
        [undefined | ccc.ClientTransactionResponse, ccc.ClientBlockHeader],
      ]
    | undefined
  >();

  const isNew = useMemo(() => dao.outputData === "0x0000000000000000", [dao]);
  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const tipHeader = await signer.client.getTipHeader();
      setTip(tipHeader);

      const previousTxRes = await signer.client.getTransactionWithHeader(
        dao.outPoint.txHash,
      );
      if (!previousTxRes || !previousTxRes.header) {
        return;
      }
      const { transaction: previousTx, header: previousHeader } = previousTxRes;

      const claimInfo = await (async (): Promise<typeof infos> => {
        if (isNew) {
          return;
        }

        const depositTxHash =
          previousTx.transaction.inputs[Number(dao.outPoint.index)]
            .previousOutput.txHash;
        const depositTxRes =
          await signer.client.getTransactionWithHeader(depositTxHash);
        if (!depositTxRes || !depositTxRes.header) {
          return;
        }
        const { transaction: depositTx, header: depositHeader } = depositTxRes;

        return [
          getProfit(dao, depositHeader, previousHeader),
          depositTx,
          depositHeader,
          [previousTx, previousHeader],
        ];
      })();

      if (claimInfo) {
        setInfos(claimInfo);
      } else {
        setInfos([
          getProfit(dao, previousHeader, tipHeader),
          previousTx,
          previousHeader,
          [undefined, tipHeader],
        ]);
      }
    })();
  }, [dao, signer, isNew]);

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
          const [_, depositTx, depositHeader] = infos;
          if (!depositTx.blockHash || !depositTx.blockNumber) {
            error(
              "Unexpected empty block info for",
              explorerTransaction(dao.outPoint.txHash),
            );
            return;
          }
          const { blockHash, blockNumber } = depositTx;

          let tx;
          if (isNew) {
            tx = ccc.Transaction.from({
              headerDeps: [blockHash],
              inputs: [{ previousOutput: dao.outPoint }],
              outputs: [dao.cellOutput],
              outputsData: [ccc.numLeToBytes(blockNumber, 8)],
            });

            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer);
          } else {
            if (!infos[3]) {
              error("Unexpected no found deposit info");
              return;
            }
            const [withdrawTx, withdrawHeader] = infos[3];
            if (!withdrawTx?.blockHash) {
              error("Unexpected empty redeem tx block info");
              return;
            }
            if (!depositTx.blockHash) {
              error("Unexpected empty deposit tx block info");
              return;
            }

            tx = ccc.Transaction.from({
              headerDeps: [withdrawTx.blockHash, blockHash],
              inputs: [
                {
                  previousOutput: dao.outPoint,
                  since: {
                    relative: "absolute",
                    metric: "epoch",
                    value: ccc.epochToHex(
                      getClaimEpoch(depositHeader, withdrawHeader),
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
              ((parseEpoch(getClaimEpoch(infos[2], infos[3][1])) -
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

export default function Transfer() {
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

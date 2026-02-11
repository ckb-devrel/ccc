import { sha256 } from "js-sha256";

import { ccc } from "@ckb-ccc/core";

import { InitOutput, TxOutput } from "../bitcoin/types/transaction.js";
import { convertToOutput } from "../bitcoin/utils/transaction.js";

import {
  BLANK_TX_ID,
  BTC_TX_PSEUDO_INDEX,
  DEFAULT_CONFIRMATIONS,
  RGBPP_MAX_CELL_NUM,
  TX_ID_PLACEHOLDER,
} from "../bitcoin/constants/index.js";

import {
  BtcTimeLock,
  RgbppUdtToken,
  RgbppUnlock,
  UtxoSeal,
} from "../bitcoin/types/rgbpp/rgbpp.js";
import { RgbppUdtClient } from "../udt/index.js";
import { isSameScriptTemplate, isUsingOneOfScripts } from "../utils/script.js";

export const encodeRgbppUdtToken = (token: RgbppUdtToken): string => {
  const name = ccc.bytesFrom(token.name, "utf8");
  const symbol = ccc.bytesFrom(token.symbol, "utf8");
  return ccc.hexFrom(
    ccc.bytesConcat(
      ccc.numToBytes(token.decimal, 1),
      ccc.numToBytes(name.length, 1),
      name,
      ccc.numToBytes(symbol.length, 1),
      symbol,
    ),
  );
};

/**
 * https://learnmeabitcoin.com/technical/general/byte-order/
 * Whenever you're working with transaction/block hashes internally (e.g. inside raw bitcoin data), you use the natural byte order.
 * Whenever you're displaying or searching for transaction/block hashes, you use the reverse byte order.
 */
export const buildRgbppLockArgs = (utxoSeal: UtxoSeal): ccc.Hex => {
  return ccc.hexFrom(
    ccc.bytesConcat(
      ccc.numLeToBytes(utxoSeal.index, 4),
      ccc.bytesFrom(utxoSeal.txId).reverse(),
    ),
  );
};

export function btcTxIdInReverseByteOrder(btcTxId: string): string {
  return ccc.bytesTo(ccc.bytesFrom(btcTxId).reverse(), "hex");
}

export function pseudoRgbppLockArgs(): ccc.Hex {
  return buildRgbppLockArgs({
    txId: TX_ID_PLACEHOLDER,
    index: BTC_TX_PSEUDO_INDEX,
  });
}

export function pseudoRgbppLockArgsForCommitment(index: number): ccc.Hex {
  return buildRgbppLockArgs({
    txId: BLANK_TX_ID,
    index,
  });
}

export const buildBtcTimeLockArgs = (
  receiverLock: ccc.Script,
  btcTxId: string,
  confirmations = DEFAULT_CONFIRMATIONS,
): ccc.Hex => {
  return ccc.hexFrom(
    BtcTimeLock.encode({
      lockScript: receiverLock,
      after: confirmations,
      btcTxid: ccc.hexFrom(ccc.bytesFrom(btcTxId).reverse()),
    }),
  );
};

export const buildUniqueTypeArgs = (
  firstInput: ccc.CellInput,
  firstOutputIndex: number,
) => {
  const input = ccc.bytesFrom(firstInput.toBytes());
  const s = new ccc.HasherCkb();
  s.update(input);
  s.update(ccc.numLeToBytes(firstOutputIndex, 8));
  return s.digest().slice(0, 42);
};

export const buildRgbppUnlock = (
  btcLikeTxBytes: string,
  btcLikeTxProof: ccc.Hex,
  inputLen: number,
  outputLen: number,
) => {
  return ccc.hexFrom(
    RgbppUnlock.encode({
      version: 0,
      extraData: {
        inputLen,
        outputLen,
      },
      btcTx: ccc.hexFrom(btcLikeTxBytes),
      btcTxProof: ccc.hexFrom(btcLikeTxProof),
    }),
  );
};

// The maximum length of inputs and outputs is 255, and the field type representing the length in the RGB++ protocol is Uint8
// refer to https://github.com/ckb-cell/rgbpp/blob/0c090b039e8d026aad4336395b908af283a70ebf/contracts/rgbpp-lock/src/main.rs#L173-L211
export const calculateCommitment = (ckbPartialTx: ccc.Transaction): string => {
  const hash = sha256.create();
  hash.update(ccc.bytesFrom("RGB++", "utf8"));
  const version = [0, 0];
  hash.update(version);

  const { inputs, outputs, outputsData } = ckbPartialTx;

  if (
    inputs.length > RGBPP_MAX_CELL_NUM ||
    outputs.length > RGBPP_MAX_CELL_NUM
  ) {
    throw new Error(
      "The inputs or outputs length of RGB++ CKB virtual tx cannot be greater than 255",
    );
  }
  hash.update([inputs.length, outputs.length]);

  for (const input of inputs) {
    hash.update(input.previousOutput.toBytes());
  }
  for (let index = 0; index < outputs.length; index++) {
    const outputData = outputsData[index];
    hash.update(outputs[index].toBytes());

    const outputDataLen = ccc.numLeToBytes(ccc.bytesFrom(outputData).length, 4);
    const od = ccc.bytesFrom(outputData);
    hash.update(outputDataLen);
    hash.update(od);
  }
  // double sha256
  return sha256(hash.array());
};

// RGB++ related outputs
export const buildBtcRgbppOutputs = async (
  ckbPartialTx: ccc.Transaction,
  btcChangeAddress: string,
  receiverBtcAddresses: string[],
  btcDustLimit: number,
  rgbppUdtClient: RgbppUdtClient,
): Promise<TxOutput[]> => {
  const rgbppLockScriptTemplate =
    await rgbppUdtClient.rgbppLockScriptTemplate();
  const btcTimeLockScriptTemplate =
    await rgbppUdtClient.btcTimeLockScriptTemplate();

  const outputs: InitOutput[] = [];
  let lastCkbTypedOutputIndex = -1;
  ckbPartialTx.outputs.forEach((output, index) => {
    // If output.type is not null, then the output.lock must be RGB++ Lock or BTC Time Lock
    if (output.type) {
      if (
        !isUsingOneOfScripts(output.lock, [
          rgbppLockScriptTemplate,
          btcTimeLockScriptTemplate,
        ])
      ) {
        throw new Error("Invalid cell lock");
      }
      lastCkbTypedOutputIndex = index;
    }

    // If output.lock is RGB++ Lock, generate a corresponding output in outputs
    if (isSameScriptTemplate(output.lock, rgbppLockScriptTemplate)) {
      outputs.push({
        fixed: true,
        // Out-of-range index indicates this is a RGB++ change output returning to the BTC address
        address: receiverBtcAddresses[index] ?? btcChangeAddress,
        value: btcDustLimit,
        minUtxoSatoshi: btcDustLimit,
      });
    }
  });

  if (lastCkbTypedOutputIndex < 0) {
    throw new Error("Invalid outputs");
  }

  const rgbppPartialTx = ccc.Transaction.from({
    inputs: ckbPartialTx.inputs,
    outputs: ckbPartialTx.outputs.slice(0, lastCkbTypedOutputIndex + 1),
    outputsData: ckbPartialTx.outputsData.slice(0, lastCkbTypedOutputIndex + 1),
  });

  const commitment = calculateCommitment(rgbppPartialTx);

  // place the commitment as the first output
  outputs.unshift({
    data: commitment,
    value: 0,
    fixed: true,
  });

  return outputs.map((output) => convertToOutput(output));
};

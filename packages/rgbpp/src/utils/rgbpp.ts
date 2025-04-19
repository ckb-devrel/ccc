import { sha256 } from "js-sha256";

import { ccc } from "@ckb-ccc/shell";

import { convertToOutput, InitOutput, TxOutput } from "../bitcoin/index.js";

import {
  BLANK_TX_ID,
  BTC_TX_PSEUDO_INDEX,
  DEFAULT_CONFIRMATIONS,
  RGBPP_MAX_CELL_NUM,
  TX_ID_PLACEHOLDER,
} from "../constants/index.js";

import {
  BtcTimeLock,
  RgbppUdtToken,
  RgbppUnlock,
  UtxoSeal,
} from "../types/rgbpp/rgbpp.js";
import { RgbppUdtClient } from "../udt/index.js";
import {
  prependHexPrefix,
  reverseHexByteOrder,
  trimHexPrefix,
  u32ToHex,
  u32ToLe,
  u64ToLe,
  u8ToHex,
  utf8ToHex,
} from "./encoder.js";
import { isSameScriptTemplate, isUsingOneOfScripts } from "./script.js";

export const encodeRgbppUdtToken = (token: RgbppUdtToken): string => {
  const decimal = u8ToHex(token.decimal);
  const name = trimHexPrefix(utf8ToHex(token.name));
  const nameSize = trimHexPrefix(u8ToHex(name.length / 2));
  const symbol = trimHexPrefix(utf8ToHex(token.symbol));
  const symbolSize = trimHexPrefix(u8ToHex(symbol.length / 2));
  return `${decimal}${nameSize}${name}${symbolSize}${symbol}`;
};

/**
 * https://learnmeabitcoin.com/technical/general/byte-order/
 * Whenever you're working with transaction/block hashes internally (e.g. inside raw bitcoin data), you use the natural byte order.
 * Whenever you're displaying or searching for transaction/block hashes, you use the reverse byte order.
 */
export const buildRgbppLockArgs = (utxoSeal: UtxoSeal): ccc.Hex => {
  return prependHexPrefix(
    `${u32ToHex(utxoSeal.index, true)}${btcTxIdInReverseByteOrder(
      utxoSeal.txId,
    )}`,
  );
};

export function btcTxIdInReverseByteOrder(btcTxId: string): string {
  return trimHexPrefix(reverseHexByteOrder(prependHexPrefix(btcTxId)));
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
      btcTxid: reverseHexByteOrder(prependHexPrefix(btcTxId)),
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
  s.update(ccc.bytesFrom(prependHexPrefix(u64ToLe(BigInt(firstOutputIndex)))));
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
      btcTx: prependHexPrefix(btcLikeTxBytes),
      btcTxProof: prependHexPrefix(btcLikeTxProof),
    }),
  );
};

// The maximum length of inputs and outputs is 255, and the field type representing the length in the RGB++ protocol is Uint8
// refer to https://github.com/ckb-cell/rgbpp/blob/0c090b039e8d026aad4336395b908af283a70ebf/contracts/rgbpp-lock/src/main.rs#L173-L211
export const calculateCommitment = (ckbPartialTx: ccc.Transaction): string => {
  const hash = sha256.create();
  hash.update(ccc.bytesFrom(utf8ToHex("RGB++")));
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
    hash.update(ccc.bytesFrom(input.previousOutput.toBytes()));
  }
  for (let index = 0; index < outputs.length; index++) {
    const outputData = outputsData[index];
    hash.update(ccc.bytesFrom(outputs[index].toBytes()));

    const outputDataLen = u32ToLe(trimHexPrefix(outputData).length / 2);
    const odl = ccc.bytesFrom(prependHexPrefix(outputDataLen));
    const od = ccc.bytesFrom(outputData);
    hash.update(odl);
    hash.update(od);
  }
  // double sha256
  return sha256(hash.array());
};

export const isCommitmentMatched = (
  commitment: string,
  ckbPartialTx: ccc.Transaction,
  lastCkbTypedOutputIndex: number,
): boolean => {
  return (
    commitment ===
    calculateCommitment(
      ccc.Transaction.from({
        inputs: ckbPartialTx.inputs,
        outputs: ckbPartialTx.outputs.slice(0, lastCkbTypedOutputIndex + 1),
        outputsData: ckbPartialTx.outputsData.slice(
          0,
          lastCkbTypedOutputIndex + 1,
        ),
      }),
    )
  );
};

// RGB++ related outputs
export const buildBtcRgbppOutputs = (
  ckbPartialTx: ccc.Transaction,
  btcChangeAddress: string,
  receiverBtcAddresses: string[],
  rgbppUdtClient: RgbppUdtClient,
): TxOutput[] => {
  const commitment = calculateCommitment(ckbPartialTx);

  const rgbppLockScriptTemplate = rgbppUdtClient.rgbppLockScriptTemplate();
  const btcTimeLockScriptTemplate = rgbppUdtClient.btcTimeLockScriptTemplate();

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
        value: 546,
        minUtxoSatoshi: 546,
      });
    }
  });

  if (lastCkbTypedOutputIndex < 0) {
    throw new Error("Invalid outputs");
  }

  if (!isCommitmentMatched(commitment, ckbPartialTx, lastCkbTypedOutputIndex)) {
    throw new Error("Commitment mismatch");
  }

  // place the commitment as the first output
  outputs.unshift({
    data: commitment,
    value: 0,
    fixed: true,
  });

  return outputs.map((output) => convertToOutput(output));
};

import { BytesLike, bytesFrom } from "../../bytes/index.js";
import { CellInput, Transaction, TransactionLike } from "../../ckb/index.js";
import {
  JsonRpcCellInput,
  JsonRpcCellOutput,
  JsonRpcTransaction,
  JsonRpcTransformers,
} from "../../client/jsonRpc/advanced.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { SignerSignType, SignerType } from "../signer/index.js";

export type SignerJsonRpcInfo = {
  sessionId: string;
  type: SignerType;
  signType: SignerSignType;
  name?: string;
  icon?: string;
};

export type SignerJsonRpcInfoPayload = {
  session_id: string;
  type: SignerType;
  sign_type: SignerSignType;
  name?: string;
  icon?: string;
};

export type SignerJsonRpcMessageToSign =
  { type: "string"; value: string } | { type: "bytes"; value: Hex };

export type SignerJsonRpcCellInput = JsonRpcCellInput & {
  cell_output?: JsonRpcCellOutput;
  output_data?: Hex;
};

export type SignerJsonRpcTransaction = Omit<JsonRpcTransaction, "inputs"> & {
  inputs: SignerJsonRpcCellInput[];
};

const PROOF_INDEX = 0xffffffffn;
const PROOF_CAPACITY = 0xffffffffffffffffn;

/**
 * Whether input `i` is the placeholder input of a lock proof: the only input of its transaction, an
 * out point at index 0xffffffff with a tx hash that is not all zero, and a cell with capacity
 * u64::MAX, no type and empty data. No transaction has that many outputs, so such a cell never exists
 * on chain and nothing can be looked up for it.
 */
function isPseudoInput(tx: Transaction, i: number) {
  const input = tx.inputs[i];
  return (
    tx.inputs.length === 1 &&
    input.previousOutput.index === PROOF_INDEX &&
    !/^0x0*$/.test(input.previousOutput.txHash) &&
    input.cellOutput?.capacity === PROOF_CAPACITY &&
    input.cellOutput.type == null &&
    input.outputData === "0x"
  );
}

export class SignerJsonRpcTransformers {
  /** Like `JsonRpcTransformers.transactionFrom`, and carries the cell of a lock proof input. */
  static transactionFrom(txLike: TransactionLike): SignerJsonRpcTransaction {
    const tx = Transaction.from(txLike);
    const json = JsonRpcTransformers.transactionFrom(tx);
    return {
      ...json,
      inputs: json.inputs.map((input, i): SignerJsonRpcCellInput => {
        const { cellOutput, outputData } = tx.inputs[i];
        return isPseudoInput(tx, i)
          ? {
              ...input,
              cell_output: JsonRpcTransformers.cellOutputFrom(cellOutput!),
              output_data: outputData,
            }
          : input;
      }),
    };
  }

  /**
   * Reads a carried cell only for a lock proof input, and only when `accept` is true. Any other input
   * is looked up as usual.
   */
  static transactionTo(
    json: SignerJsonRpcTransaction,
    accept = true,
  ): Transaction {
    const tx = JsonRpcTransformers.transactionTo(json);
    if (!accept) {
      return tx;
    }
    tx.inputs.forEach((input, i) => {
      const { cell_output, output_data } = json.inputs[i];
      if (cell_output == null || output_data == null) {
        return;
      }
      const carried = CellInput.from({
        previousOutput: input.previousOutput,
        since: input.since,
        cellOutput: JsonRpcTransformers.cellOutputTo(cell_output),
        outputData: output_data,
      });
      const kept = tx.inputs[i];
      tx.inputs[i] = carried;
      if (!isPseudoInput(tx, i)) {
        tx.inputs[i] = kept;
      }
    });
    return tx;
  }

  static infoFrom(info: SignerJsonRpcInfo): SignerJsonRpcInfoPayload {
    return {
      session_id: info.sessionId,
      type: info.type,
      sign_type: info.signType,
      name: info.name,
      icon: info.icon,
    };
  }

  static infoTo(info: SignerJsonRpcInfoPayload): SignerJsonRpcInfo {
    return {
      sessionId: info.session_id,
      type: info.type,
      signType: info.sign_type,
      name: info.name,
      icon: info.icon,
    };
  }

  static messageFrom(message: string | BytesLike): SignerJsonRpcMessageToSign {
    if (typeof message === "string") {
      return { type: "string", value: message };
    }

    return { type: "bytes", value: hexFrom(message) };
  }

  static messageTo(message: unknown): string | Uint8Array {
    if (!isRecord(message) || typeof message.value !== "string") {
      throw new Error("Invalid signer message");
    }

    if (message.type === "string") {
      return message.value;
    }
    if (message.type === "bytes") {
      return bytesFrom(message.value);
    }

    throw new Error("Invalid signer message type");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

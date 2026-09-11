import type { Transaction } from "../../ckb/index.js";
import { JsonRpcTransformers } from "../../client/jsonRpc/advanced.js";
import { JsonRpcError, type JsonRpcPayload } from "../../jsonRpc/index.js";
import type { Signer } from "../signer/index.js";
import { signerJsonRpcNetworkIdFromAddressPrefix } from "./network.js";
import {
  SignerJsonRpcTransformers,
  type SignerJsonRpcInfo,
  type SignerJsonRpcMessageToSign,
} from "./transformers.js";

export type SignerJsonRpcConfirmation =
  | { method: "connect"; networkId: string }
  | { method: "sign_message"; message: SignerJsonRpcMessageToSign }
  | { method: "sign_transaction"; transaction: Transaction };

export type SignerJsonRpcHandlerConfig = {
  getSigner: () => Signer | undefined;
  getSignerMetadata?: () => Pick<SignerJsonRpcInfo, "name" | "icon">;
  /** Connects the requested network and returns its connected Signer. */
  connect: (networkId: string) => Promise<Signer>;
  confirmRequest: (request: SignerJsonRpcConfirmation) => Promise<boolean>;
};

export type SignerJsonRpcHandler = (payload: JsonRpcPayload) => unknown;

export function buildSignerJsonRpcHandler({
  connect,
  confirmRequest,
  getSigner,
  getSignerMetadata = () => ({}),
}: SignerJsonRpcHandlerConfig): SignerJsonRpcHandler {
  const requireSigner = () => {
    const signer = getSigner();
    if (!signer) {
      throw new JsonRpcError({
        code: -32000,
        message: "No signer is connected",
      });
    }

    return signer;
  };

  const handlers = new Map<string, SignerJsonRpcHandler>([
    [
      "get_info",
      (payload) => {
        requireParams(payload, 0);
        return buildSignerInfo(requireSigner(), getSignerMetadata());
      },
    ],
    [
      "connect",
      async (payload) => {
        const [networkId] = requireParams(payload, 1);
        if (typeof networkId !== "string" || !networkId) {
          throw new JsonRpcError({
            code: -32602,
            message: "Invalid network ID",
          });
        }

        await requireConfirmation(confirmRequest, {
          method: "connect",
          networkId,
        });

        const signer = await connect(networkId);
        const actualNetworkId = signerJsonRpcNetworkIdFromAddressPrefix(
          signer.client.addressPrefix,
        );
        if (actualNetworkId !== networkId) {
          throw new JsonRpcError({
            code: -32002,
            message: `Signer uses ${actualNetworkId}, expected ${networkId}`,
          });
        }

        return null;
      },
    ],
    [
      "get_scripts",
      async (payload) => {
        requireParams(payload, 0);
        return (await requireSigner().getAddressObjs()).map(({ script }) =>
          JsonRpcTransformers.scriptFrom(script),
        );
      },
    ],
    [
      "get_native_address",
      (payload) => {
        requireParams(payload, 0);
        return requireSigner().getInternalAddress();
      },
    ],
    [
      "get_identity",
      (payload) => {
        requireParams(payload, 0);
        return requireSigner().getIdentity();
      },
    ],
    [
      "sign_message",
      async (payload) => {
        const [message] = requireParams(payload, 1);
        const parsedMessage = parseMessageParam(message);
        await requireConfirmation(confirmRequest, {
          method: "sign_message",
          message: SignerJsonRpcTransformers.messageFrom(parsedMessage),
        });
        return requireSigner().signMessageRaw(parsedMessage);
      },
    ],
    [
      "prepare_transaction",
      async (payload) => {
        const [transaction] = requireParams(payload, 1);
        return JsonRpcTransformers.transactionFrom(
          await requireSigner().prepareTransaction(
            parseTransactionParam(transaction),
          ),
        );
      },
    ],
    [
      "sign_transaction",
      async (payload) => {
        const [transaction] = requireParams(payload, 1);
        const parsedTransaction = parseTransactionParam(transaction);
        await requireConfirmation(confirmRequest, {
          method: "sign_transaction",
          transaction: parsedTransaction,
        });
        return JsonRpcTransformers.transactionFrom(
          await requireSigner().signOnlyTransaction(parsedTransaction),
        );
      },
    ],
  ]);

  return (payload: JsonRpcPayload) => {
    const handler = handlers.get(payload.method);
    if (!handler) {
      throw new JsonRpcError({
        code: -32601,
        message: `Unsupported method: ${payload.method}`,
      });
    }

    return handler(payload);
  };
}

async function requireConfirmation(
  confirmRequest: SignerJsonRpcHandlerConfig["confirmRequest"],
  request: SignerJsonRpcConfirmation,
) {
  if (!(await confirmRequest(request))) {
    throw new JsonRpcError({
      code: -32003,
      message: "User rejected request",
    });
  }
}

function parseMessageParam(message: unknown) {
  try {
    return SignerJsonRpcTransformers.messageTo(message);
  } catch (cause) {
    throw new JsonRpcError({
      code: -32602,
      message:
        cause instanceof Error ? cause.message : "Invalid signer message",
    });
  }
}

function parseTransactionParam(transaction: unknown) {
  try {
    return JsonRpcTransformers.transactionTo(
      transaction as Parameters<typeof JsonRpcTransformers.transactionTo>[0],
    );
  } catch (cause) {
    throw new JsonRpcError({
      code: -32602,
      message:
        cause instanceof Error ? cause.message : "Invalid signer transaction",
    });
  }
}

function requireParams(payload: JsonRpcPayload, count: number) {
  if (!Array.isArray(payload.params) || payload.params.length !== count) {
    throw new JsonRpcError({
      code: -32602,
      message: `${payload.method} expects ${count} parameter${count === 1 ? "" : "s"}`,
    });
  }

  return payload.params;
}

function buildSignerInfo(
  signer: Signer,
  metadata: Pick<SignerJsonRpcInfo, "name" | "icon">,
) {
  return SignerJsonRpcTransformers.infoFrom({
    type: signer.type,
    signType: signer.signType,
    name: metadata.name,
    icon: metadata.icon,
  });
}

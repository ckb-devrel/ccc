import { BytesLike, bytesFrom } from "../../bytes/index.js";
import { Hex, hexFrom } from "../../hex/index.js";
import { SignerSignType, SignerType } from "../signer/index.js";

export type SignerJsonRpcInfo = {
  type: SignerType;
  signType: SignerSignType;
  name?: string;
  icon?: string;
};

export type SignerJsonRpcInfoPayload = {
  type: SignerType;
  sign_type: SignerSignType;
  name?: string;
  icon?: string;
};

export type SignerJsonRpcMessageToSign =
  { type: "string"; value: string } | { type: "bytes"; value: Hex };

export class SignerJsonRpcTransformers {
  static infoFrom(info: SignerJsonRpcInfo): SignerJsonRpcInfoPayload {
    return {
      type: info.type,
      sign_type: info.signType,
      name: info.name,
      icon: info.icon,
    };
  }

  static infoTo(info: SignerJsonRpcInfoPayload): SignerJsonRpcInfo {
    return {
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

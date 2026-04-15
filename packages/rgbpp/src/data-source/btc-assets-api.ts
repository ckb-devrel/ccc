import lodash from "lodash";

import { ccc } from "@ckb-ccc/core";

import { isDomain } from "../utils/index.js";
import {
  BtcBalance,
  BtcBalanceParams,
  BtcRecommendedFeeRates,
  BtcSentTransaction,
  BtcTransaction,
  BtcTransactionHex,
  BtcUtxo,
  BtcUtxoParams,
  RgbppDataSource,
} from "./data-source.js";

export interface RgbppApiSpvProof {
  proof: string;
  spv_client: {
    tx_hash: string;
    index: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = Record<string, any>;

export interface BaseApis {
  request<T>(route: string, options?: BaseApiRequestOptions): Promise<T>;
  post<T>(route: string, options?: BaseApiRequestOptions): Promise<T>;
}

export interface BaseApiRequestOptions extends RequestInit {
  params?: Json;
  method?: "GET" | "POST";
  requireToken?: boolean;
  allow404?: boolean;
}

export interface BtcAssetsApiToken {
  token: string;
}

export interface BtcAssetsApiContext {
  request: {
    url: string;
    body?: Json;
    params?: Json;
  };
  response: {
    status: number;
    data?: Json | string;
  };
}

export class BtcAssetsApiBase implements BaseApis {
  public url: string;
  public app?: string;
  public domain?: string;
  public origin?: string;
  private token?: string;
  private isMainnet: boolean;

  constructor(config: BtcAssetApiConfig) {
    this.url = config.url;
    this.app = config.app;
    this.domain = config.domain;
    this.origin = config.origin;
    this.token = config.token;
    this.isMainnet = config.isMainnet ?? true;

    // Validation
    if (this.domain && !isDomain(this.domain, true)) {
      throw BtcAssetsApiError.withComment(
        ErrorCodes.ASSETS_API_INVALID_PARAM,
        `Invalid domain format: "${this.domain}". Please provide a valid domain (e.g., "example.com")`,
      );
    }
  }

  async request<T>(route: string, options?: BaseApiRequestOptions): Promise<T> {
    const {
      requireToken = this.isMainnet,
      allow404 = false,
      method = "GET",
      headers,
      params,
      ...otherOptions
    } = options ?? {};

    if (requireToken && (!this.token || !this.origin)) {
      throw BtcAssetsApiError.withComment(
        ErrorCodes.ASSETS_API_INVALID_PARAM,
        "Missing required parameters: both token and origin are required",
      );
    }

    const pickedParams = lodash.pickBy(params, (val) => val !== undefined);
    const packedParams = params
      ? "?" + new URLSearchParams(pickedParams).toString()
      : "";
    const url = `${this.url}${route}${packedParams}`;

    const authHeaders: Record<string, string> = {};
    if (requireToken) {
      authHeaders.authorization = `Bearer ${this.token}`;
      authHeaders.origin = this.origin!;
    }

    const res = await fetch(url, {
      method,
      headers: {
        ...authHeaders,
        ...(headers || {}),
      },
      ...otherOptions,
    } as RequestInit);

    let text: string | undefined;
    let json: Json | undefined;
    let ok: boolean = false;
    try {
      text = await res.text();
      if (text) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        json = JSON.parse(text);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ok = json?.ok ?? res.ok ?? false;
      } else {
        ok = res.ok;
      }
    } catch {
      // JSON.parse failed on non-empty text
      // We'll handle this decode error below
    }

    let comment: string | undefined;
    const status = res.status;
    const context: BtcAssetsApiContext = {
      request: {
        url,
        params,
        body: tryParseBody(otherOptions.body),
      },
      response: {
        status,
        data: json ?? text,
      },
    };

    if (!json) {
      comment = text ? `(${status}) ${text}` : `${status}`;
    }
    if (json && !ok) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const code =
        json.code ?? json.statusCode ?? json.error?.error?.code ?? res.status;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const message =
        json.message ??
        (typeof json.error === "string"
          ? json.error
          : json.error?.error?.message);
      if (message) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        comment = code ? `(${code}) ${message}` : message;
      } else {
        comment = JSON.stringify(json);
      }
    }

    if (status === 200) {
      if (text && !json) {
        // 200 OK, but we had body text that failed JSON parsing
        throw BtcAssetsApiError.withComment(
          ErrorCodes.ASSETS_API_RESPONSE_DECODE_ERROR,
          "Failed to decode JSON response",
          context,
        );
      }
      if (!text) {
        return "" as unknown as T;
      }
      return (json ?? text) as unknown as T;
    }
    if (status === 401) {
      throw BtcAssetsApiError.withComment(
        ErrorCodes.ASSETS_API_UNAUTHORIZED,
        comment,
        context,
      );
    }
    if (status === 404 && !allow404) {
      throw BtcAssetsApiError.withComment(
        ErrorCodes.ASSETS_API_RESOURCE_NOT_FOUND,
        comment,
        context,
      );
    }
    if (status !== 200 && status !== 404 && !allow404) {
      throw BtcAssetsApiError.withComment(
        ErrorCodes.ASSETS_API_RESPONSE_ERROR,
        comment,
        context,
      );
    }
    if (status === 404 && allow404) {
      return undefined as T;
    }

    return json! as T;
  }

  async post<T>(route: string, options?: BaseApiRequestOptions): Promise<T> {
    return this.request(route, {
      method: "POST",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    } as BaseApiRequestOptions);
  }
}

function tryParseBody(body: unknown): Record<string, unknown> | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof body === "string" ? JSON.parse(body) : undefined;
  } catch {
    return undefined;
  }
}

export enum ErrorCodes {
  UNKNOWN,

  ASSETS_API_RESPONSE_ERROR,
  ASSETS_API_UNAUTHORIZED,
  ASSETS_API_INVALID_PARAM,
  ASSETS_API_RESOURCE_NOT_FOUND,
  ASSETS_API_RESPONSE_DECODE_ERROR,

  OFFLINE_DATA_SOURCE_METHOD_NOT_AVAILABLE,
}

export const ErrorMessages = {
  [ErrorCodes.UNKNOWN]: "Unknown error",

  [ErrorCodes.ASSETS_API_UNAUTHORIZED]:
    "BtcAssetsAPI unauthorized, please check your token/origin",
  [ErrorCodes.ASSETS_API_INVALID_PARAM]:
    "Invalid param(s) was provided to the BtcAssetsAPI",
  [ErrorCodes.ASSETS_API_RESPONSE_ERROR]: "BtcAssetsAPI returned an error",
  [ErrorCodes.ASSETS_API_RESOURCE_NOT_FOUND]:
    "Resource not found on the BtcAssetsAPI",
  [ErrorCodes.ASSETS_API_RESPONSE_DECODE_ERROR]:
    "Failed to decode the response of BtcAssetsAPI",

  [ErrorCodes.OFFLINE_DATA_SOURCE_METHOD_NOT_AVAILABLE]:
    "Method not available for offline data source",
};

export class BtcAssetsApiError extends Error {
  public code = ErrorCodes.UNKNOWN;
  public message: string;
  public context?: BtcAssetsApiContext;

  constructor(payload: {
    code: ErrorCodes;
    message?: string;
    context?: BtcAssetsApiContext;
  }) {
    const message =
      payload.message ??
      ErrorMessages[payload.code] ??
      ErrorMessages[ErrorCodes.UNKNOWN];

    super(message);
    this.message = message;
    this.code = payload.code;
    this.context = payload.context;
    Object.setPrototypeOf(this, BtcAssetsApiError.prototype);
  }

  static withComment(
    code: ErrorCodes,
    comment?: string,
    context?: BtcAssetsApiContext,
  ): BtcAssetsApiError {
    const prefixMessage =
      ErrorMessages[code] ?? ErrorMessages[ErrorCodes.UNKNOWN];
    const message = comment ? `${prefixMessage}: ${comment}` : undefined;
    return new BtcAssetsApiError({ code, message, context });
  }
}

export interface BtcAssetApiConfig {
  url: string;
  app?: string;
  domain?: string;
  origin?: string;
  token?: string;
  isMainnet?: boolean;
}

/**
 * Typed API client for Bitcoin and RGBPP endpoints.
 *
 * Encapsulates all endpoint URLs and response types in one place.
 * Consumers use typed methods instead of raw `request<T>(url)` calls.
 */
export class BtcAssetsApi implements RgbppDataSource {
  private api: BtcAssetsApiBase;

  constructor(config: BtcAssetApiConfig) {
    this.api = new BtcAssetsApiBase(config);
  }

  getTransaction(txId: string) {
    return this.api.request<BtcTransaction>(`/bitcoin/v1/transaction/${txId}`);
  }

  async getTransactionHex(txId: string) {
    const { hex } = await this.api.request<BtcTransactionHex>(
      `/bitcoin/v1/transaction/${txId}/hex`,
    );
    return hex;
  }

  getUtxos(address: string, params?: BtcUtxoParams) {
    return this.api.request<BtcUtxo[]>(
      `/bitcoin/v1/address/${address}/unspent`,
      { params },
    );
  }

  getBalance(address: string, params?: BtcBalanceParams) {
    return this.api.request<BtcBalance>(
      `/bitcoin/v1/address/${address}/balance`,
      { params },
    );
  }

  getRecommendedFee() {
    return this.api.request<BtcRecommendedFeeRates>(
      `/bitcoin/v1/fees/recommended`,
    );
  }

  async sendTransaction(txHex: string): Promise<string> {
    const { txid: txId } = await this.api.post<BtcSentTransaction>(
      "/bitcoin/v1/transaction",
      {
        body: JSON.stringify({ txhex: txHex }),
      },
    );
    return txId;
  }

  async getRgbppSpvProof(btcTxId: string, confirmations: number) {
    const spvProof: RgbppApiSpvProof | null =
      await this.api.request<RgbppApiSpvProof>("/rgbpp/v1/btc-spv/proof", {
        params: {
          btc_txid: btcTxId,
          confirmations,
        },
      });

    return spvProof
      ? {
          proof: spvProof.proof as ccc.Hex,
          spvClientOutpoint: ccc.OutPoint.from({
            txHash: spvProof.spv_client.tx_hash,
            index: spvProof.spv_client.index,
          }),
        }
      : null;
  }

  async getRgbppCellOutputs(btcAddress: string) {
    const res = await this.api.request<{ cellOutput: ccc.CellOutput }[]>(
      `/rgbpp/v1/address/${btcAddress}/assets`,
    );
    return res.map((item: { cellOutput: ccc.CellOutput }) => item.cellOutput);
  }
}

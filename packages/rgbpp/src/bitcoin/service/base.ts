import lodash from "lodash";
import { BtcAssetApiConfig } from "../types/btc-assets-api.js";
import { BtcAssetsApiError, ErrorCodes } from "../types/error.js";
import {
  BaseApiRequestOptions,
  BaseApis,
  BtcAssetsApiContext,
  Json,
} from "../types/index.js";
import { isDomain } from "../utils/index.js";

const { pickBy } = lodash;

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

    const pickedParams = pickBy(params, (val) => val !== undefined);
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
      json = JSON.parse(text);
      ok = json?.ok ?? res.ok ?? false;
    } catch {
      // do nothing
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
      const code =
        json.code ?? json.statusCode ?? json.error?.error?.code ?? res.status;
      const message =
        json.message ??
        (typeof json.error === "string"
          ? json.error
          : json.error?.error?.message);
      if (message) {
        comment = code ? `(${code}) ${message}` : message;
      } else {
        comment = JSON.stringify(json);
      }
    }

    if (status === 200 && !json) {
      throw BtcAssetsApiError.withComment(
        ErrorCodes.ASSETS_API_RESPONSE_DECODE_ERROR,
        comment,
        context,
      );
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
    return typeof body === "string" ? JSON.parse(body) : undefined;
  } catch {
    return undefined;
  }
}

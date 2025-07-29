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

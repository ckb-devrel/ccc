interface ClientConfig {
  endpoint: string;
  timeout?: number;
}

interface AcceptChannelParams {
  temporary_channel_id: string;
  funding_amount: bigint;
  max_tlc_value_in_flight: bigint;
  max_tlc_number_in_flight: bigint;
  tlc_min_value: bigint;
  tlc_fee_proportional_millionths: bigint;
  tlc_expiry_delta: bigint;
}

interface AcceptChannelResponse {
  channel_id: string;
}

export class Client {
  private endpoint: string;
  private timeout: number;
  private id: number;

  constructor(config: ClientConfig) {
    this.endpoint = config.endpoint;
    this.timeout = config.timeout || 5000;
    this.id = 1;
  }

  async call<T>(method: string, params: any[]): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
        id: this.id++,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(
        `[RPC Error ${data.error.code}] ${data.error.message}\nDetails: ${data.error.data}`,
      );
    }

    return data.result;
  }

  async acceptChannel(
    params: AcceptChannelParams,
  ): Promise<AcceptChannelResponse> {
    const response = await this.call<AcceptChannelResponse>("accept_channel", [
      {
        temporary_channel_id: params.temporary_channel_id,
        funding_amount: `0x${params.funding_amount.toString(16)}`,
        max_tlc_value_in_flight: `0x${params.max_tlc_value_in_flight.toString(16)}`,
        max_tlc_number_in_flight: `0x${params.max_tlc_number_in_flight.toString(16)}`,
        tlc_min_value: `0x${params.tlc_min_value.toString(16)}`,
        tlc_fee_proportional_millionths: `0x${params.tlc_fee_proportional_millionths.toString(16)}`,
        tlc_expiry_delta: `0x${params.tlc_expiry_delta.toString(16)}`,
      },
    ]);
    return response;
  }
}

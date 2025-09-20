export interface DobDecodeResponse {
  jsonrpc: string;
  result: string;
  id: number;
}

export interface DobDecodeResult {
  dob_content: {
    dna: string;
    block_number: number;
    cell_id: number;
    id: string;
  };
  render_output: RenderPartialOutput[] | string;
}

export interface RenderPartialOutput {
  name: string;
  traits: {
    String?: string;
    Number?: number;
    Timestamp?: Date;
    SVG?: string;
  }[];
}

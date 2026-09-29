import { ccc } from "@ckb-ccc/ccc";

export function render(tx: ccc.Transaction): Promise<void>;
export const signer: ccc.Signer;
export const client: ccc.Client;

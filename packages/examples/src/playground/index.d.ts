import { ccc } from "@ckb-ccc/ccc";
import * as bitcoinLib from "bitcoinjs-lib";

export function render(tx: ccc.Transaction): Promise<void>;
export const signer: ccc.Signer;
export const client: ccc.Client;
export const bitcoin: typeof bitcoinLib;

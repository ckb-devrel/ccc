import { ccc } from "@ckb-ccc/ccc";
import type { BrowserRgbppBtcWallet, CkbRgbppUnlockSinger, RgbppUdtClient, UtxoSeal } from "@ckb-ccc/rgbpp";

export function render(tx: ccc.Transaction): Promise<void>;
export const signer: ccc.Signer;
export const client: ccc.Client;
export function initRgbppEnv(signer: ccc.SignerBtc): Promise<{
  btcRgbppSigner: BrowserRgbppBtcWallet;
  ckbRgbppUnlockSinger: CkbRgbppUnlockSinger;
  rgbppUdtClient: RgbppUdtClient;
}>;
export function prepareRgbppUdtIssuanceCells(signer: ccc.Signer, utxoSeal: UtxoSeal,
  rgbppUdtClient: RgbppUdtClient,): Promise<ccc.Cell[]>;
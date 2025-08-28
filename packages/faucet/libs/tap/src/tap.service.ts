import { ccc } from "@ckb-ccc/core";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";

@Injectable()
export class TapService {
  private readonly logger = new Logger(TapService.name);

  private readonly rootKey: HDKey;
  private readonly pathPrefix: string;
  private readonly feeRate: number;
  private readonly client = new ccc.ClientPublicTestnet();

  constructor(configService: ConfigService) {
    const mnemonic = configService.get<string>("server_mnemonic");
    if (!mnemonic) {
      throw Error("Missing mnemonic");
    }
    const feeRate = configService.get<number>("fee_rate");
    if (feeRate === undefined) {
      throw Error("Missing fee rate");
    }

    this.rootKey = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
    this.pathPrefix = configService.get<string>("hd_path_prefix") ?? "";
    this.feeRate = feeRate;
  }

  async tapCkb(address: string, amount: string) {
    const key = this.rootKey.derive(`${this.pathPrefix}0`);
    if (!key.privateKey) {
      throw Error("Failed to derive key");
    }

    const signer = new ccc.SignerCkbPrivateKey(this.client, key.privateKey);
    this.logger.log(`Tap CKB: using ${await signer.getRecommendedAddress()}`);

    const tx = ccc.Transaction.from({
      outputs: [
        {
          capacity: ccc.fixedPointFrom(amount),
          lock: (await ccc.Address.fromString(address, this.client)).script,
        },
      ],
    });
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, this.feeRate);

    const hash = await signer.sendTransaction(tx);
    this.logger.log(`Tap CKB: ${address} tapped ${amount} on ${hash}`);
  }
}

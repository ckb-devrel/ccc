import { ccc } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";

/**
 * Represents a User Defined Token (UDT) script compliant with the SSRI protocol.
 *
 * This class provides a comprehensive implementation for interacting with User Defined Tokens,
 * supporting various token operations such as querying metadata, checking balances, and performing transfers.
 * It supports both SSRI-compliant UDTs and legacy sUDT/xUDT standard tokens.
 *
 * @public
 * @category Blockchain
 * @category Token
 */
export class Udt extends ssri.Trait {
  public readonly script: ccc.Script;

  /**
   * Constructs a new UDT (User Defined Token) script instance.
   * By default it is a SSRI-compliant UDT. By providing `xudtType`, it is compatible with the legacy xUDT.
   *
   * @param executor - The SSRI executor instance.
   * @param code - The script code cell of the UDT.
   * @param script - The type script of the UDT.
   * @example
   * ```typescript
   * const udt = new Udt(executor, code, script);
   * ```
   */
  constructor(
    code: ccc.OutPointLike,
    script: ccc.ScriptLike,
    config?: {
      executor?: ssri.Executor | null;
    } | null,
  ) {
    super(code, config?.executor);
    this.script = ccc.Script.from(script);
  }

  /**
   * Retrieves the human-readable name of the User Defined Token.
   *
   * @returns A promise resolving to the token's name.
   */
  async name(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<string | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(this.code, "UDT.name", [], {
        script: this.script,
        ...context,
      });
      if (res) {
        return res.map((res) => ccc.bytesTo(res, "utf8"));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Retrieves the symbol of the UDT.
   * @returns The symbol of the UDT.
   */
  async symbol(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<string | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.symbol",
        [],
        {
          script: this.script,
          ...context,
        },
      );
      if (res) {
        return res.map((res) => ccc.bytesTo(res, "utf8"));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Retrieves the decimals of the UDT.
   * @returns The decimals of the UDT.
   */
  async decimals(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<ccc.Num | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.decimals",
        [],
        {
          script: this.script,
          ...context,
        },
      );
      if (res) {
        return res.map((res) => ccc.numFromBytes(res));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Retrieves the icon of the UDT
   * @returns The icon of the UDT.
   */
  async icon(
    context?: ssri.ContextScript,
  ): Promise<ssri.ExecutorResponse<string | undefined>> {
    if (this.executor) {
      const res = await this.executor.runScriptTry(this.code, "UDT.icon", [], {
        script: this.script,
        ...context,
      });
      if (res) {
        return res.map((res) => ccc.bytesTo(res, "utf8"));
      }
    }

    return ssri.ExecutorResponse.new(undefined);
  }

  /**
   * Transfers UDT to specified addresses.
   * @param tx - Transfer on the basis of an existing transaction to achieve combined actions. If not provided, a new transaction will be created.
   * @param transfers - The array of transfers.
   * @param transfers.to - The receiver of token.
   * @param transfers.amount - The amount of token to the receiver.
   * @returns The transaction result.
   * @tag Mutation - This method represents a mutation of the onchain state and will return a transaction object.
   * @example
   * ```typescript
   * const { script: change } = await signer.getRecommendedAddressObj();
   * const { script: to } = await ccc.Address.fromString(receiver, signer.client);
   *
   * const udt = new Udt(
   *   {
   *     txHash: "0x4e2e832e0b1e7b5994681b621b00c1e65f577ee4b440ef95fa07db9bb3d50269",
   *     index: 0,
   *   },
   *   {
   *     codeHash: "0xcc9dc33ef234e14bc788c43a4848556a5fb16401a04662fc55db9bb201987037",
   *     hashType: "type",
   *     args: "0x71fd1985b2971a9903e4d8ed0d59e6710166985217ca0681437883837b86162f"
   *   },
   * );
   *
   * const { res: tx } = await udtTrait.transfer(
   *   signer,
   *   [{ to, amount: 100 }],
   * );
   *
   * const completedTx = udt.completeUdtBy(tx, signer);
   * await completedTx.completeInputsByCapacity(signer);
   * await completedTx.completeFeeBy(signer);
   * const transferTxHash = await signer.sendTransaction(completedTx);
   * ```
   */
  async transfer(
    signer: ccc.Signer,
    transfers: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
    tx?: ccc.TransactionLike | null,
  ): Promise<ssri.ExecutorResponse<ccc.Transaction>> {
    let resTx;
    if (this.executor) {
      const txReq = ccc.Transaction.from(tx ?? {});
      await txReq.completeInputsAtLeastOne(signer);

      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.transfer",
        [
          txReq.toBytes(),
          ccc.ScriptVec.encode(transfers.map(({ to }) => to)),
          ccc.mol.Uint128Vec.encode(transfers.map(({ amount }) => amount)),
        ],
        {
          script: this.script,
        },
      );
      if (res) {
        resTx = res.map((res) => ccc.Transaction.fromBytes(res));
      }
    }

    if (!resTx) {
      const transfer = ccc.Transaction.from(tx ?? {});
      for (const { to, amount } of transfers) {
        transfer.addOutput(
          {
            lock: to,
            type: this.script,
          },
          ccc.numLeToBytes(amount, 16),
        );
      }
      resTx = ssri.ExecutorResponse.new(transfer);
    }
    resTx.res.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return resTx;
  }

  /**
   * Mints new tokens to specified addresses. See the example in `transfer` as they are similar.
   * @param tx - Optional existing transaction to build upon
   * @param mints - Array of mints
   * @param mints.to - receiver of token
   * @param mints.amount - amount to the receiver
   * @returns The transaction containing the mint operation
   * @tag Mutation - This method represents a mutation of the onchain state
   */
  async mint(
    signer: ccc.Signer,
    mints: {
      to: ccc.ScriptLike;
      amount: ccc.NumLike;
    }[],
    tx?: ccc.TransactionLike | null,
  ): Promise<ssri.ExecutorResponse<ccc.Transaction>> {
    let resTx;
    if (this.executor) {
      const txReq = ccc.Transaction.from(tx ?? {});
      await txReq.completeInputsAtLeastOne(signer);

      const res = await this.executor.runScriptTry(
        this.code,
        "UDT.mint",
        [
          txReq.toBytes(),
          ccc.ScriptVec.encode(mints.map(({ to }) => to)),
          ccc.mol.Uint128Vec.encode(mints.map(({ amount }) => amount)),
        ],
        {
          script: this.script,
        },
      );
      if (res) {
        resTx = res.map((res) => ccc.Transaction.fromBytes(res));
      }
    }

    if (!resTx) {
      const mint = ccc.Transaction.from(tx ?? {});
      for (const { to, amount } of mints) {
        mint.addOutput(
          {
            lock: to,
            type: this.script,
          },
          ccc.numLeToBytes(amount, 16),
        );
      }
      resTx = ssri.ExecutorResponse.new(mint);
    }
    resTx.res.addCellDeps({
      outPoint: this.code,
      depType: "code",
    });
    return resTx;
  }

  async completeChangeToLock(
    txLike: ccc.TransactionLike,
    signer: ccc.Signer,
    change: ccc.ScriptLike,
  ) {
    const tx = ccc.Transaction.from(txLike);

    await tx.completeInputsByUdt(signer, this.script);
    const balanceDiff =
      (await tx.getInputsUdtBalance(signer.client, this.script)) -
      tx.getOutputsUdtBalance(this.script);
    if (balanceDiff > ccc.Zero) {
      tx.addOutput(
        {
          lock: change,
          type: this.script,
        },
        ccc.numLeToBytes(balanceDiff, 16),
      );
    }

    return tx;
  }

  async completeBy(tx: ccc.TransactionLike, from: ccc.Signer) {
    const { script } = await from.getRecommendedAddressObj();

    return this.completeChangeToLock(tx, from, script);
  }
}

import { ccc, mol } from "@ckb-ccc/core";

export class ErrorUdtInsufficientCoin extends Error {
  constructor(
    public readonly amount: ccc.FixedPoint,
    public readonly udtManager: UdtManager,
  ) {
    super(
      `Insufficient coin, need ${ccc.fixedPointToString(amount, udtManager.decimals)} extra ${udtManager.symbol} coin`,
    );
  }
}

export class UdtManager {
  constructor(
    public readonly script: ccc.Script,
    public readonly cellDeps: ccc.CellDep[],
    public readonly dataLenRange: [number, number],
    public readonly name: string,
    public readonly symbol: string,
    public readonly decimals: number,
    public readonly icon: string,
  ) {}

  async *find(
    client: ccc.Client,
    locks: ccc.Script[],
    options?: {
      source?: "local" | "chain";
    },
  ): AsyncGenerator<ccc.Cell> {
    const isOnChain = options?.source === "chain";
    const processedLocks = new Set<ccc.Hex>();
    for (const lock of locks) {
      const lockHash = lock.hash();
      if (processedLocks.has(lockHash)) {
        continue;
      }
      processedLocks.add(lockHash);

      const findCellsArgs = [
        {
          script: lock,
          scriptType: "lock",
          filter: {
            script: this.script,
            outputDataLenRange: this.dataLenRange,
          },
          scriptSearchMode: "exact",
          withData: true,
        },
      ] as const;

      for await (const cell of isOnChain
        ? client.findCellsOnChain(...findCellsArgs)
        : client.findCells(...findCellsArgs)) {
        yield cell;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async infoFrom(
    _client: ccc.Client,
    initialInfo = {
      balance: ccc.Zero,
      capacity: ccc.Zero,
      count: 0,
    },
    ...cells: {
      cellOutput: ccc.CellOutput;
      outputData: ccc.Hex;
      outPoint?: ccc.OutPoint;
    }[]
  ): Promise<Info> {
    let { balance, capacity, count } = initialInfo;

    for (const { cellOutput, outputData } of cells) {
      if (cellOutput.type?.eq(this.script)) {
        let dataLen = (outputData.length - 2) >> 1;

        if (dataLen < this.dataLenRange[0] || dataLen >= this.dataLenRange[1]) {
          throw new Error("Invalid data length");
        }

        balance += ccc.udtBalanceFrom(outputData);
        // Note: Not a NervosDAO cell, type slot is already used by udt
        capacity += cellOutput.capacity;
        count += 1;
      }
    }

    return { balance, capacity, count };
  }

  async addInput(
    client: ccc.Client,
    tx: ccc.Transaction,
    initialInfo = {
      balance: ccc.Zero,
      capacity: ccc.Zero,
      count: 0,
    },
    ...cells: ccc.Cell[]
  ): Promise<Info> {
    let info = initialInfo;
    for (const cell of cells) {
      info = await this.infoFrom(client, info, cell);
      if (info.count > 0) {
        tx.addInput(cell);
      }
    }
    return info;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async addOutput(
    client: ccc.Client,
    tx: ccc.Transaction,
    lock: ccc.Script,
    amount: ccc.FixedPoint,
    extraData: ccc.BytesLike = [],
  ): Promise<number> {
    const outputData = ccc.hexFrom(
      ccc.bytesConcat(mol.Uint128.encode(amount), extraData),
    );
    const cellOutput = ccc.CellOutput.from(
      {
        capacity: amount,
        lock,
        type: this.script,
      },
      outputData,
    );

    const cell = { cellOutput, outputData };
    if ((await this.infoFrom(client, undefined, cell)).balance !== amount) {
      throw new Error("Internal Error: amount mismatch");
    }

    return tx.addOutput(cellOutput, outputData);
  }

  async updateOutput(
    client: ccc.Client,
    tx: ccc.Transaction,
    index: number,
    additionalAmount: ccc.FixedPoint,
  ): Promise<void> {
    let cell = tx.getOutput(index);
    if (!cell) {
      throw Error("Cell not found");
    }

    const info = await this.infoFrom(client, undefined, cell);
    if (!info) {
      throw Error("Change output must be a UDT cell");
    }

    const amount = info.balance + additionalAmount;
    const outputData = ccc.hexFrom(
      ccc.bytesConcat(mol.Uint128.encode(amount), cell.outputData.slice(34)),
    );

    cell = { ...cell, outputData };
    if ((await this.infoFrom(client, undefined, cell)).balance !== amount) {
      throw new Error("Internal Error: amount mismatch");
    }

    tx.outputsData[index] = outputData;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async addCellDeps(tx: ccc.Transaction): Promise<void> {
    tx.addCellDeps(this.cellDeps);
  }

  async getInfo(
    client: ccc.Client,
    locks: ccc.Script[],
    options?: {
      source?: "chain" | "local";
    },
  ): Promise<Info> {
    let info = await this.infoFrom(client);
    for await (const cell of this.find(client, locks, options)) {
      info = await this.infoFrom(client, info, cell);
    }
    return info;
  }

  async getBalance(
    from: ccc.Signer,
    options?: {
      source?: "chain" | "local";
    },
  ): Promise<ccc.FixedPoint> {
    const { client } = from;
    const locks = (await from.getAddressObjs()).map((a) => a.script);
    return (await this.getInfo(client, locks, options)).balance;
  }

  async getInputsInfo(client: ccc.Client, tx: ccc.Transaction): Promise<Info> {
    const cells = await Promise.all(tx.inputs.map((i) => i.getCell(client)));
    return this.infoFrom(client, undefined, ...cells);
  }

  async getInputsBalance(
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<ccc.FixedPoint> {
    const tx = ccc.Transaction.from(txLike);
    return (await this.getInputsInfo(client, tx)).balance;
  }

  async getOutputsInfo(client: ccc.Client, tx: ccc.Transaction): Promise<Info> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cells = tx.outputs.map((_, index) => tx.getOutput(index)!);
    return this.infoFrom(client, undefined, ...cells);
  }

  async getOutputsBalance(
    client: ccc.Client,
    txLike: ccc.TransactionLike,
  ): Promise<ccc.FixedPoint> {
    const tx = ccc.Transaction.from(txLike);
    return (await this.getOutputsInfo(client, tx)).balance;
  }

  async *completeInputsByBalance(
    client: ccc.Client,
    tx: ccc.Transaction,
    locks: ccc.Script[],
    options?: {
      source?: "chain" | "local";
    },
  ): AsyncGenerator<{ addedInput: Info; initialInput: Info; output: Info }> {
    const initialInput = await this.getInputsInfo(client, tx);
    let addedInput = await this.infoFrom(client);
    const output = await this.getOutputsInfo(client, tx);

    const minBalance = output.balance - initialInput.balance;
    const minCapacity = ccc.numMin(
      output.capacity - initialInput.capacity,
      -(await tx.getFee(client)),
    );

    if (
      (initialInput.count === 0 && output.count === 0) ||
      (addedInput.balance >= minBalance && addedInput.capacity >= minCapacity)
    ) {
      yield { addedInput, initialInput, output };
    }

    for await (const cell of this.find(client, locks, options)) {
      addedInput = await this.addInput(client, tx, addedInput, cell);

      if (
        addedInput.balance >= minBalance &&
        addedInput.capacity >= minCapacity
      ) {
        yield { addedInput, initialInput, output };
      }
    }

    if (addedInput.balance >= minBalance && addedInput.capacity < minCapacity) {
      yield { addedInput, initialInput, output };
    }

    throw new ErrorUdtInsufficientCoin(
      output.balance - addedInput.balance,
      this,
    );
  }

  async completeChangeTo(
    client: ccc.Client,
    tx: ccc.Transaction,
    locks: ccc.Script[],
    options: (
      | { lock: ccc.Script; extraData?: ccc.BytesLike }
      | {
          index: number;
        }
    ) & {
      shouldAddInputs?: boolean;
      source?: "chain" | "local";
    },
  ): Promise<{
    addedInputs: number;
    addedOutputs: number;
  }> {
    const needed =
      "lock" in options
        ? await this.getChangeCapacity(client, options.lock, options.extraData)
        : ccc.Zero;

    let addedInput = await this.infoFrom(client);
    let initialInput = addedInput;
    let output = addedInput;
    if (options.shouldAddInputs) {
      for await ({
        addedInput,
        initialInput,
        output,
      } of this.completeInputsByBalance(client, tx, locks, options)) {
        const inputBalance = initialInput.balance + addedInput.balance;
        const inputCapacity = initialInput.capacity + addedInput.capacity;

        if (
          (inputBalance === output.balance &&
            inputCapacity >= output.capacity) ||
          (inputBalance > output.balance &&
            inputCapacity >= output.capacity + needed)
        ) {
          break;
        }
      }
    } else {
      initialInput = await this.getInputsInfo(client, tx);
      output = await this.getOutputsInfo(client, tx);
    }

    if (initialInput.count + addedInput.count === 0 && output.count === 0) {
      return {
        addedInputs: 0,
        addedOutputs: 0,
      };
    }

    const burned = initialInput.balance + addedInput.balance - output.balance;
    if (burned < ccc.Zero) {
      throw new ErrorUdtInsufficientCoin(-burned, this);
    }

    await this.addCellDeps(tx);

    if (burned === ccc.Zero) {
      return {
        addedInputs: addedInput.count,
        addedOutputs: 0,
      };
    }

    if ("lock" in options) {
      await this.addOutput(client, tx, options.lock, burned, options.extraData);
      return {
        addedInputs: addedInput.count,
        addedOutputs: 1,
      };
    }

    await this.updateOutput(client, tx, options.index, burned);
    return {
      addedInputs: addedInput.count,
      addedOutputs: 0,
    };
  }

  protected async getChangeCapacity(
    client: ccc.Client,
    lock: ccc.Script,
    extraData: ccc.BytesLike = [],
  ): Promise<ccc.FixedPoint> {
    const tx = ccc.Transaction.default();
    await this.addOutput(client, tx, lock, ccc.One, extraData);
    return -(await tx.getFee(client));
  }

  async completeBy(
    signer: ccc.Signer,
    tx: ccc.Transaction,
    options?: {
      shouldAddInputs?: boolean;
      source?: "chain" | "local"; // should be added also to Transaction.completeFee!
    },
  ): Promise<{
    addedInputs: number;
    addedOutputs: number;
  }> {
    return this.completeChangeTo(
      signer.client,
      tx,
      (await signer.getAddressObjs()).map((a) => a.script),
      {
        ...options,
        lock: (await signer.getRecommendedAddressObj()).script,
      },
    );
  }
}

export interface Info {
  balance: ccc.FixedPoint;
  capacity: ccc.FixedPoint;
  count: number;
}

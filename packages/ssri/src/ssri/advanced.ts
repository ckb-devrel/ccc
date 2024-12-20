import {
  BytesLike,
  OutPointLike,
  Script,
  ScriptLike,
  TransactionLike,
} from "@ckb-ccc/core";
import { SSRIContract, SSRIServer } from "./index.js";
export const PLACEHOLDER = 1023;

export interface SSRITraitJSON {
  name: string;
  methods: Array<{
    name: string;
    parameters: Array<{
      name: string;
      type: keyof SSRIRustTypeMap;
      isOption?: boolean;
      isVec?: boolean;
    }>;
    returnType: keyof SSRIRustTypeMap;
  }>;
}

interface BaseSSRIRustTypeMap {
  u8: number;
  u16: number;
  u32: number;
  u64: bigint;
  u128: bigint;
  String: string;
  bool: boolean;
  Bytes: BytesLike;
  Script: ScriptLike;
  Transaction: TransactionLike;
}

export interface SSRIRustTypeMap extends BaseSSRIRustTypeMap {
  [key: string]: unknown;
}

interface SSRITypeHandler<T extends keyof SSRIRustTypeMap> {
  serialize(value: SSRIRustToTSType<T>): BytesLike;
  deserialize(bytes: BytesLike): SSRIRustToTSType<T>;
  validate(value: unknown): value is SSRIRustToTSType<T>;
}

type SSRITypeHandlers = {
  [K in keyof SSRIRustTypeMap]: SSRITypeHandler<K>;
};

type SSRIRustToTSType<T extends keyof SSRIRustTypeMap> = SSRIRustTypeMap[T];

export class SSRIContractFromTrait<
  T extends SSRITraitJSON,
> extends SSRIContract {
  private typeHandlers: SSRITypeHandlers;
  [key: string]: unknown;

  constructor(
    server: SSRIServer,
    codeOutPoint: OutPointLike,
    private SSRIJSON: T,
  ) {
    super(server, codeOutPoint);
    this.typeHandlers = baseSSRITypeHandlers as SSRITypeHandlers;
    this.initializeMethods();
  }

  registerTypeHandler<K extends keyof SSRITypeHandlers>(
    type: K,
    handler: SSRITypeHandlers[K],
  ): void {
    this.typeHandlers[type] = handler;
  }

  private initializeMethods(): void {
    const existingProps = new Set<string | symbol>(
      Object.getOwnPropertyNames(SSRIContract.prototype),
    );

    for (const method of this.SSRIJSON.methods) {
      if (existingProps.has(method.name)) {
        console.warn(
          `Method ${method.name} conflicts with existing SSRIContract method`,
        );
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)[method.name] = this.createMethod(method);
    }
  }

  private createMethod(
    method: T["methods"][number],
  ): (...args: unknown[]) => Promise<unknown> {
    return async (...args: unknown[]) => {
      if (args.length !== method.parameters.length) {
        throw new Error(
          `Method ${method.name} expects ${method.parameters.length} arguments, got ${args.length}`,
        );
      }

      const convertedArgs = args.map((arg, index) =>
        this.serializeForSSRI(arg, method.parameters[index].type),
      );

      const path = Buffer.from(method.name);

      try {
        const result = await this.callMethod("", ["0x"]);
        return this.deserializeForSSRI(result, method.returnType);
      } catch (error) {
        throw this.deserializeErrorForSSRI(error);
      }
    };
  }

  private serializeForSSRI<T extends keyof SSRIRustTypeMap>(
    value: unknown,
    paramType: T,
  ): BytesLike {
    const handler = this.typeHandlers[paramType];

    if (!handler.validate(value)) {
      throw new Error(`Invalid value for type ${paramType}`);
    }
    // TODO: Disassemble vectors and options.

    return handler.serialize(value);
  }

  private deserializeForSSRI<T extends keyof SSRIRustTypeMap>(
    result: unknown,
    type: T,
  ): SSRIRustToTSType<T> {
    throw new Error("TODO");
  }

  private deserializeErrorForSSRI(error: unknown): Error {
    throw new Error("TODO");
  }
}

export const baseSSRITypeHandlers = {
  u8: {
    serialize(value: number): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): number {
      throw new Error("TODO");
    },
    validate(value: unknown): value is number {
      throw new Error("TODO");
    },
  },

  u16: {
    serialize(value: number): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): number {
      throw new Error("TODO");
    },
    validate(value: unknown): value is number {
      throw new Error("TODO");
    },
  },

  u32: {
    serialize(value: number): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): number {
      throw new Error("TODO");
    },
    validate(value: unknown): value is number {
      throw new Error("TODO");
    },
  },

  u64: {
    serialize(value: bigint): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): bigint {
      throw new Error("TODO");
    },
    validate(value: unknown): value is bigint {
      throw new Error("TODO");
    },
  },

  u128: {
    serialize(value: bigint): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): bigint {
      throw new Error("TODO");
    },
    validate(value: unknown): value is bigint {
      throw new Error("TODO");
    },
  },

  String: {
    serialize(value: string): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): string {
      throw new Error("TODO");
    },
    validate(value: unknown): value is string {
      throw new Error("TODO");
    },
  },

  bool: {
    serialize(value: boolean): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): boolean {
      throw new Error("TODO");
    },
    validate(value: unknown): value is boolean {
      throw new Error("TODO");
    },
  },

  Bytes: {
    serialize(value: BytesLike): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): BytesLike {
      throw new Error("TODO");
    },
    validate(value: unknown): value is BytesLike {
      throw new Error("TODO");
    },
  },

  Script: {
    serialize(value: Script): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): Script {
      throw new Error("TODO");
    },
    validate(value: unknown): value is Script {
      throw new Error("TODO");
    },
  },

  Transaction: {
    serialize(value: TransactionLike): BytesLike {
      throw new Error("TODO");
    },
    deserialize(bytes: BytesLike): TransactionLike {
      throw new Error("TODO");
    },
    validate(value: unknown): value is TransactionLike {
      throw new Error("TODO");
    },
  },
} as const;

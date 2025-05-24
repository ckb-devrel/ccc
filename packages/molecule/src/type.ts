/* eslint-disable @typescript-eslint/no-explicit-any */
import { mol } from "@ckb-ccc/core";

export const BYTE = "byte";

export type BaseType = {
  name: string;
  item: string;
};

export type Field = {
  name: string;
  type: string;
};

export type Array = {
  type: "array";
  item_count: number;
} & BaseType;

export type Vector = {
  type: "vector";
} & BaseType;

export type Option = {
  type: "option";
} & BaseType;

export type Union = {
  type: "union";
  name: string;
  items: (string | [string, number])[];
};

export type Struct = {
  type: "struct";
  name: string;
  fields: Field[];
};

export type Table = {
  type: "table";
  name: string;
  fields: Field[];
};

// mol type definitions
export type MolTypeDefinition =
  | Array
  | Vector
  | Option
  | Union
  | Struct
  | Table;

export type CodecRecord = Record<string, mol.Codec<any, any>>;

export type ParseOptions = {
  skipValidation?: boolean;
  extraReferences?: CodecRecord; // overriding extra references to be used in the codec definitions
};

import { ScriptAmountType } from "@/src/app/connected/(tools)/SSRI/components/ScriptAmountInput";
import { ccc } from "@ckb-ccc/connector-react";
export type ParamValue =
  | ccc.ScriptLike
  | ccc.CellLike
  | ccc.TransactionLike
  | ccc.HexLike
  | ccc.HexLike[]
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[]
  | ScriptAmountType
  | ScriptAmountType[]
  | undefined;

export type MethodParamType =
  | "contextScript"
  | "contextCell"
  | "contextTransaction"
  | "hex"
  | "hexArray"
  | "string"
  | "stringArray"
  | "uint64"
  | "uint64Array"
  | "uint128"
  | "uint128Array"
  | "boolean"
  | "booleanArray"
  | "script"
  | "scriptArray"
  | "byte32"
  | "byte32Array"
  | "scriptAmountArray"
  | "tx"
  | "signer";

export interface MethodParam {
  name: string;
  type?: MethodParamType;
}

export const PARAM_TYPE_OPTIONS: {
  name: string;
  displayName: string;
  iconName: "Code" | "Hash";
}[] = [
  { name: "contextScript", displayName: "Context Script", iconName: "Code" },
  { name: "contextCell", displayName: "Context Cell", iconName: "Code" },
  {
    name: "contextTransaction",
    displayName: "Context Transaction",
    iconName: "Code",
  },
  { name: "hex", displayName: "Generic Data (HexLike)", iconName: "Code" },
  {
    name: "hexArray",
    displayName: "Generic Data Array (HexLike)",
    iconName: "Code",
  },
  { name: "string", displayName: "String", iconName: "Code" },
  { name: "stringArray", displayName: "String Array", iconName: "Code" },
  { name: "uint64", displayName: "Number (Uint64)", iconName: "Code" },
  {
    name: "uint64Array",
    displayName: "Number Array (Uint64)",
    iconName: "Code",
  },
  {
    name: "uint128",
    displayName: "Number (Uint128)",
    iconName: "Code",
  },
  {
    name: "uint128Array",
    displayName: "Number Array (Uint128)",
    iconName: "Code",
  },
  {
    name: "script",
    displayName: "Script",
    iconName: "Code",
  },
  { name: "scriptArray", displayName: "Script Array", iconName: "Code" },
  { name: "byte32", displayName: "Byte32", iconName: "Code" },
  { name: "byte32Array", displayName: "Byte32 Array", iconName: "Code" },
  { name: "tx", displayName: "Transaction", iconName: "Code" },
];

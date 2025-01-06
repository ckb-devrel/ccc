import { ccc, mol } from "@ckb-ccc/core";

export const lockArrayCodec = mol.vector(ccc.Script);

export const amountArrayCodec = mol.vector(mol.Uint128);

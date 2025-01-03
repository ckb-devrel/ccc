import { ccc, mol } from "@ckb-ccc/core";

export const u832Codec = mol.array(mol.Uint8, 32);
export const u832VecCodec = mol.vector(u832Codec);
export const udtPausableDataCodec = mol.table({
  pause_list: u832VecCodec,
  next_type_script: mol.option(ccc.Script),
});

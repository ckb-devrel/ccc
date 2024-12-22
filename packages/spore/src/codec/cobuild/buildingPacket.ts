import { ccc, mol } from "@ckb-ccc/core";

export const Action = mol.table({
  scriptInfoHash: mol.Byte32,
  scriptHash: mol.Byte32,
  data: mol.Bytes,
});

export const ActionVec = mol.vector(Action);

export const Message = mol.table({
  actions: ActionVec,
});

export const ResolvedInputs = mol.table({
  outputs: ccc.CellOutputVec,
  outputsData: mol.BytesVec,
});

export const ScriptInfo = mol.table({
  name: mol.String,
  url: mol.String,
  scriptHash: mol.Byte32,
  schema: mol.String,
  messageType: mol.String,
});

export const ScriptInfoVec = mol.vector(ScriptInfo);

export const BuildingPacketV1 = mol.table({
  message: Message,
  payload: ccc.Transaction,
  resolvedInputs: ResolvedInputs,
  changeOutput: mol.Uint32Opt,
  scriptInfos: ScriptInfoVec,
  lockActions: ActionVec,
});

export const BuildingPacket = mol.union({
  BuildingPacketV1,
});

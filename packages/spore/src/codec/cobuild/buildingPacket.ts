import { mol } from "@ckb-ccc/core";

export const Action = mol.table({
  scriptInfoHash: mol.Hash,
  scriptHash: mol.Hash,
  data: mol.Bytes,
});

export const ActionVec = mol.vector(Action);

export const Message = mol.table({
  actions: ActionVec,
});

export const ResolvedInputs = mol.table({
  outputs: mol.CellOutputVec,
  outputsData: mol.BytesVec,
});

export const ScriptInfo = mol.table({
  name: mol.String,
  url: mol.String,
  scriptHash: mol.Hash,
  schema: mol.String,
  messageType: mol.String,
});

export const ScriptInfoVec = mol.vector(ScriptInfo);

export const BuildingPacketV1 = mol.table({
  message: Message,
  payload: mol.Transaction,
  resolvedInputs: ResolvedInputs,
  changeOutput: mol.Uint32Opt,
  scriptInfos: ScriptInfoVec,
  lockActions: ActionVec,
});

export const BuildingPacket = mol.union({
  BuildingPacketV1,
});

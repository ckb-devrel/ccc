import { molecule } from "@ckb-ccc/core";

export const Action = molecule.table({
  scriptInfoHash: molecule.Hash,
  scriptHash: molecule.Hash,
  data: molecule.Bytes,
});

export const ActionVec = molecule.vector(Action);

export const Message = molecule.table({
  actions: ActionVec,
});

export const ResolvedInputs = molecule.table({
  outputs: molecule.CellOutputVec,
  outputsData: molecule.BytesVec,
});

export const ScriptInfo = molecule.table({
  name: molecule.String,
  url: molecule.String,
  scriptHash: molecule.Hash,
  schema: molecule.String,
  messageType: molecule.String,
});

export const ScriptInfoVec = molecule.vector(ScriptInfo);

export const BuildingPacketV1 = molecule.table({
  message: Message,
  payload: molecule.Transaction,
  resolvedInputs: ResolvedInputs,
  changeOutput: molecule.Uint32Opt,
  scriptInfos: ScriptInfoVec,
  lockActions: ActionVec,
});

export const BuildingPacket = molecule.union({
  BuildingPacketV1,
});

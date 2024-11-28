import { RawString } from "../base.js";
import { codec } from "@ckb-ccc/core";

const Uint32Opt = codec.option(codec.Uint32LE);

const Hash = codec.Byte32;

export const Action = codec.table(
  {
    scriptInfoHash: Hash,
    scriptHash: Hash,
    data: codec.Bytes,
  },
  ["scriptInfoHash", "scriptHash", "data"],
);

export const ActionVec = codec.vector(Action);

export const Message = codec.table(
  {
    actions: ActionVec,
  },
  ["actions"],
);

export const ResolvedInputs = codec.table(
  {
    outputs: codec.CellOutputVec,
    outputsData: codec.BytesVec,
  },
  ["outputs", "outputsData"],
);

export const ScriptInfo = codec.table(
  {
    name: RawString,
    url: RawString,
    scriptHash: Hash,
    schema: RawString,
    messageType: RawString,
  },
  ["name", "url", "scriptHash", "schema", "messageType"],
);

export const ScriptInfoVec = codec.vector(ScriptInfo);

export const BuildingPacketV1 = codec.table(
  {
    message: Message,
    payload: codec.Transaction,
    resolvedInputs: ResolvedInputs,
    changeOutput: Uint32Opt,
    scriptInfos: ScriptInfoVec,
    lockActions: ActionVec,
  },
  [
    "message",
    "payload",
    "resolvedInputs",
    "changeOutput",
    "scriptInfos",
    "lockActions",
  ],
);

export const BuildingPacket = codec.union(
  {
    BuildingPacketV1,
  },
  ["BuildingPacketV1"],
);

import { bytesFrom, bytesTo, ScriptLike } from "../barrel.js";
import { byteVec, option, table, vector } from "./codec.advanced.js";
import { fixedBytes } from "./codec.js";
import { Uint8 } from "./predefined.js";

export const Bytes = byteVec({ encode: bytesFrom, decode: bytesFrom });
export const BytesOpt = option(Bytes);
export const BytesVec = vector(Bytes);

export const Byte32 = fixedBytes({ byteLength: 32, encode: bytesFrom, decode: bytesFrom });
export const Byte32Opt = option(Byte32);
export const Byte32Vec = vector(Byte32);

export const String = byteVec({
    encode: (value: string) => bytesFrom(value, "utf8"),
    decode: (buffer) => bytesTo(buffer, "utf8"),
});
export const StringVec = vector(String);
export const StringOpt = option(String);

export const Hash = Byte32;
export const HashType = Uint8;
export const Script = table<ScriptLike>({
    codeHash: Hash,
    hashType: HashType,
    args: Bytes,
});
export const ScriptOpt = option(Script);

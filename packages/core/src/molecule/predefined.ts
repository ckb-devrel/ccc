import { uint } from "./codec";

export const Uint8 = uint(1, true);
export const Uint16LE = uint(2, true);
export const Uint16BE = uint(2);
export const Uint16 = Uint16LE;
export const Uint32LE = uint(4, true);
export const Uint32BE = uint(4);
export const Uint32 = Uint32LE;
export const Uint64LE = uint(8, true);
export const Uint64BE = uint(8);
export const Uint64 = Uint64LE;
export const Uint128LE = uint(16, true);
export const Uint128BE = uint(16);
export const Uint128 = Uint128LE;
export const Uint256LE = uint(32, true);
export const Uint256BE = uint(32);
export const Uint256 = Uint256LE;
export const Uint512LE = uint(64, true);
export const Uint512BE = uint(64);
export const Uint512 = Uint512LE;
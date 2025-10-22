/**
 * @public
 */
export enum KnownScript {
  NervosDao = "NervosDao",
  Secp256k1Blake160 = "Secp256k1Blake160",
  Secp256k1Multisig = "Secp256k1Multisig",
  Secp256k1MultisigV2 = "Secp256k1MultisigV2", // Enhanced since handling (https://github.com/nervosnetwork/ckb-system-scripts/pull/99)
  AnyoneCanPay = "AnyoneCanPay",
  TypeId = "TypeId",
  XUdt = "XUdt",
  JoyId = "JoyId",
  COTA = "COTA",
  PWLock = "PWLock",
  OmniLock = "OmniLock",
  NostrLock = "NostrLock",
  UniqueType = "UniqueType",

  // ckb-proxy-locks https://github.com/ckb-devrel/ckb-proxy-locks
  AlwaysSuccess = "AlwaysSuccess",
  InputTypeProxyLock = "InputTypeProxyLock",
  OutputTypeProxyLock = "OutputTypeProxyLock",
  LockProxyLock = "LockProxyLock",
  SingleUseLock = "SingleUseLock",
  TypeBurnLock = "TypeBurnLock",
  EasyToDiscoverType = "EasyToDiscoverType",
  TimeLock = "TimeLock",
}

import {
  GetAccounts,
  GetAddresses,
  GetBalance,
  GetInfo,
  SendTransfer,
  SignMessage,
  SignPsbt,
} from "./btcMethods.advanced.js";
import {
  ChangeNetwork,
  GetNetwork,
  GetWalletType,
  RenouncePermissions,
  RequestPermissions,
} from "./walletMethods.advanced.js";

export interface BtcRequests {
  getInfo: GetInfo;
  getAddresses: GetAddresses;
  getAccounts: GetAccounts;
  getBalance: GetBalance;
  signMessage: SignMessage;
  sendTransfer: SendTransfer;
  signPsbt: SignPsbt;
}

export type BtcRequestMethod = keyof BtcRequests;

export interface WalletRequests {
  wallet_requestPermissions: RequestPermissions;
  wallet_renouncePermissions: RenouncePermissions;
  wallet_getWalletType: GetWalletType;
  wallet_getNetwork: GetNetwork;
  wallet_changeNetwork: ChangeNetwork;
}

export type Requests = BtcRequests & WalletRequests;

export type Return<Method> = Method extends keyof Requests
  ? Requests[Method]["result"]
  : never;
export type Params<Method> = Method extends keyof Requests
  ? Requests[Method]["params"]
  : never;

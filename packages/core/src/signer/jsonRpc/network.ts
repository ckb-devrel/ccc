const CKB_MAINNET_NETWORK_ID = "ckb-mainnet";
const CKB_TESTNET_NETWORK_ID = "ckb-testnet";

// TODO: In the next major version, read the network ID directly from Client
// instead of inferring it from addressPrefix.
export function signerJsonRpcNetworkIdFromAddressPrefix(addressPrefix: string) {
  if (addressPrefix === "ckb") {
    return CKB_MAINNET_NETWORK_ID;
  }
  if (addressPrefix === "ckt") {
    return CKB_TESTNET_NETWORK_ID;
  }

  throw new Error(`Unsupported address prefix: ${addressPrefix}`);
}

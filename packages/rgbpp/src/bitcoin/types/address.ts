// Read more about the available address types:
// - P2WPKH: https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#p2wpkh
// - P2TR: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
export enum AddressType {
  P2PKH = "P2PKH",
  P2WPKH = "P2WPKH",
  P2TR = "P2TR",
  P2SH_P2WPKH = "P2SH_P2WPKH",
  P2WSH = "P2WSH",
  P2SH = "P2SH",
  UNKNOWN = "UNKNOWN",
}

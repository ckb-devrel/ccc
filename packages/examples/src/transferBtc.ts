import { ccc } from "@ckb-ccc/ccc";
import { bitcoin, signer } from "@ckb-ccc/playground";

// Supported wallets: Unisat, JoyID, Xverse
// Check if the current signer is also a Bitcoin signer
if (!(signer instanceof ccc.SignerBtc)) {
  throw new Error("Signer is not a Bitcoin signer");
}

// Only support testnet for safety
if (signer.client.addressPrefix !== "ckt") {
  throw new Error("Only supported on testnet");
}

// Xverse has deprecated Testnet3 support, so we default to Signet. Make sure to switch to Signet in Xverse's network settings.
const isXverse = signer instanceof ccc.Xverse.Signer;
const btcTestnetName = isXverse ? "signet" : "testnet";

const btcAddress = await signer.getBtcAccount();
// Fetch UTXOs from mempool.space API
const utxos = (await fetch(
  `https://mempool.space/${btcTestnetName}/api/address/${btcAddress}/utxo`,
).then((res) => {
  if (!res.ok) {
    throw new Error(`Failed to fetch UTXOs: ${res.status} ${res.statusText}`);
  }
  return res.json();
})) as { value: number; txid: string; vout: number }[];

const DUST_LIMIT = 546;
const FEE_SATS = 200;

// Select a UTXO above the 546 sat dust threshold
const selectedUtxo = utxos.find((utxo) => utxo.value > DUST_LIMIT + FEE_SATS);
if (!selectedUtxo) {
  throw new Error("No UTXO available");
}

// Fetch the full transaction to get the scriptpubkey
const btcTx = (await fetch(
  `https://mempool.space/${btcTestnetName}/api/tx/${selectedUtxo.txid}`,
).then((res) => {
  if (!res.ok) {
    throw new Error(
      `Failed to fetch transaction: ${res.status} ${res.statusText}`,
    );
  }
  return res.json();
})) as {
  vout: {
    value: number;
    scriptpubkey: string;
    scriptpubkey_type: string;
  }[];
};
const vout = btcTx.vout[selectedUtxo.vout];

if (!vout || !vout.scriptpubkey) {
  throw new Error("Invalid vout data");
}

// Build PSBT with the selected UTXO as input
const psbt = new bitcoin.Psbt({
  network: isXverse ? bitcoin.networks.testnet : bitcoin.networks.testnet,
});
const input: {
  hash: string;
  index: number;
  witnessUtxo: {
    script: Uint8Array;
    value: bigint;
  };
  tapInternalKey?: Uint8Array;
} = {
  hash: selectedUtxo.txid,
  index: selectedUtxo.vout,
  witnessUtxo: {
    script: ccc.bytesFrom(vout.scriptpubkey),
    value: BigInt(vout.value),
  },
};

// Handle Taproot (P2TR) specific input fields
if (
  vout.scriptpubkey_type === "v1_p2tr" ||
  vout.scriptpubkey_type === "witness_v1_taproot"
) {
  const publicKey = await signer.getBtcPublicKey();
  input.tapInternalKey = ccc.bytesFrom(ccc.hexFrom(publicKey)).slice(1);
}

psbt.addInput(input);

// Add a single output back to the same address minus a hardcoded 200 sat fee
psbt.addOutput({
  address: btcAddress,
  value: BigInt(vout.value) - BigInt(FEE_SATS),
});

// Sign and broadcast the transaction
const txId = await signer.signAndBroadcastPsbt(psbt.toHex());
console.log(
  `View transaction: https://mempool.space/${btcTestnetName}/tx/${txId.slice(2)}`,
);

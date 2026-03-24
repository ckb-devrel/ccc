import { ccc } from "@ckb-ccc/core";
import { sha256 } from "@noble/hashes/sha2";

const TX_ID_PLACEHOLDER_PRE_IMAGE =
  "sha256 this for easy replacement in spore co-build witness";
export const TX_ID_PLACEHOLDER = ccc.bytesTo(
  sha256(ccc.bytesFrom(TX_ID_PLACEHOLDER_PRE_IMAGE, "utf8")),
  "hex",
);

// https://github.com/utxostack/rgbpp/blob/main/contracts/rgbpp-lock/src/main.rs#L228
export const BLANK_TX_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

export const BTC_TX_PSEUDO_INDEX = 0xffffffff; // 4,294,967,295 (max u32)

export const UNIQUE_TYPE_OUTPUT_INDEX = 1;

export const DEFAULT_CONFIRMATIONS = 6;

/** Default polling interval in milliseconds for waiting transaction confirmation */
export const DEFAULT_CONFIRMATION_POLL_INTERVAL = 30_000;

/** Default polling interval in milliseconds for SPV proof polling */
export const DEFAULT_SPV_POLL_INTERVAL = 30_000;

export const CONFIG_CELL_INDEX = "0x1";

export const RGBPP_MAX_CELL_NUM = 255;

export const RGBPP_UNLOCK_PARAMS_IDENTIFIER = "RGBPP_UNLOCK_PARAMS";

export const DEFAULT_DUST_LIMIT = 546;

export const DEFAULT_FEE_RATE = 1;

import { sha256 } from "js-sha256";

const TX_ID_PLACEHOLDER_PRE_IMAGE =
  "sha256 this for easy replacement in spore co-build witness";
export const TX_ID_PLACEHOLDER = sha256(TX_ID_PLACEHOLDER_PRE_IMAGE);

// https://github.com/utxostack/rgbpp/blob/main/contracts/rgbpp-lock/src/main.rs#L228
export const BLANK_TX_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

export const BTC_TX_PSEUDO_INDEX = 0xffffffff; // 4,294,967,295 (max u32)

export const UNIQUE_TYPE_OUTPUT_INDEX = 1;

export const DEFAULT_CONFIRMATIONS = 6;

export const RGBPP_MAX_CELL_NUM = 255;

export const RGBPP_UNLOCK_PARAMS_IDENTIFIER = "RGBPP_UNLOCK_PARAMS";

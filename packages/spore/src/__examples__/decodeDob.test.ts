import "dotenv/config";
import { decodeDobBySporeId } from "../dob/index.js";

describe("decodeDob [testnet]", () => {
  it("should respose a decoded dob render data from a spore id", async () => {
    // The address that https://github.com/sporeprotocol/dob-decoder-standalone-server running at
    const decoderServerUrl = "http://127.0.0.1:8090";

    // The spore id that you want to decode (must be a valid spore dob)
    const sporeId =
      "0x29e4cfd388b9a01f7a853d476feb8e33af38565a1e751d55c9423bf7aa4b480b";

    // Decode from spore id
    const dob = await decodeDobBySporeId(sporeId, decoderServerUrl);
    console.log(dob);
  }, 60000);
});

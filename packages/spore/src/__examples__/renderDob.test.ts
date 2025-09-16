import { describe, it } from "vitest";
import { renderByTokenKey, svgToBase64 } from "../dob/index.js";

describe("decodeDob [testnet]", () => {
  it("should respose a decoded dob render data from a spore id", async () => {
    // The spore id that you want to decode (must be a valid spore dob)
    const sporeId =
      "dc19e68af1793924845e2a4dbc23598ed919dcfe44d3f9cd90964fe590efb0e4";

    // Decode from spore id
    const dob = await renderByTokenKey(sporeId);
    console.log(dob);
  }, 60000);
});

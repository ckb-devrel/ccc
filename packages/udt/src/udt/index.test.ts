import { ccc, OutPointLike } from "@ckb-ccc/core";
import { ssri } from "@ckb-ccc/ssri";
import { UDT } from "./index.js";


const testClient = new ccc.ClientPublicTestnet({ url: "wss://testnet.ckb.dev/ws" })
const testSSRIServer = new ssri.Server(
  testClient,
  "http://localhost:9090"
)

const testOutPoint: OutPointLike = {
  txHash: "0x3f791acc65a2f04050bdc63c848748799221c98d078b285108089c875239cf66",
  index: 0
}

const testUDTContract = new UDT(
  testSSRIServer,
  testOutPoint
)

describe("UDT Test", () => {
  it("should create UDT contract", async () => {
    console.log("yay!")
    expect(testUDTContract).toBeInstanceOf(UDT)
  })

  it("should get name", async () => {
    const name = await testUDTContract.name()
    expect(name).toEqual("UDT")
  })
})
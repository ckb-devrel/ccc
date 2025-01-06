import { ccc, OutPointLike } from "@ckb-ccc/core";
import { UDT } from "./index.js";


const testSSRIServerURL = "http://localhost:9090"
const testOutPoint: OutPointLike = {
  txHash: "0x3f791acc65a2f04050bdc63c848748799221c98d078b285108089c875239cf66",
  index: 0
}
const testUDTScript: ccc.ScriptLike = {
  codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type",
  args: "0x"
}

const testUDTCellDep: ccc.CellDepLike = {
  outPoint: testOutPoint,
  depType: "code"
}

const testUDTContract = new UDT(
  testUDTScript,
  testUDTCellDep,
  testSSRIServerURL
)

describe("UDT Test", () => {
  it("should create UDT contract", async () => {
    expect(testUDTContract).toBeInstanceOf(UDT)
  })
})
import { Cell, ccc } from "@ckb-ccc/core";
import { ClientCollectableSearchKeyLike } from "@ckb-ccc/core/advancedBarrel";
import { SSRIServer } from "./index.js";
import { SSRIContractFromTrait, SSRITraitJSON } from "./advanced.js";

const testRPCURL = "wss://testnet.ckb.dev/ws";
const exampleTrait: SSRITraitJSON = {
  name: "ExampleTrait",
  methods: [
    {
      name: "enumerate_paused",
      parameters: [],
      returnType: "Vec<[u8; 32]>",
    },
    {
      name: "is_paused",
      parameters: [
        {
          name: "lock_hashes",
          type: "Vec<[u8; 32]>",
        },
      ],
      returnType: "bool",
    },
  ],
};

const exampleClient = new ccc.ClientPublicTestnet({ url: testRPCURL });
const exampleSSRIServer = new SSRIServer(
  exampleClient,
  "http://localhost:9090",
);

const exampleScriptCellSearchKey: ClientCollectableSearchKeyLike = {
  script: {
    // TypeID
    codeHash:
      "0x00000000000000000000000000000000000000000000000000545950455f4944",
    hashType: "type",
    args: "0x2035d31c47fafd6c1ddb50396c5bcd5b76f24539763ef4fca785022855068ca8",
  },
  scriptType: "type",
  scriptSearchMode: "exact",
};

describe("SSRI Advanced Test", () => {
  it("should create SSRI contract", async () => {
    const findCellDepResult = await exampleClient
      .findCells(exampleScriptCellSearchKey)
      .next();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const exampleCell: Cell = findCellDepResult.value;

    const exampleOutpoint = exampleCell.outPoint;
    const exampleSSRIContractFromTrait = new SSRIContractFromTrait(
      exampleSSRIServer,
      exampleOutpoint,
      exampleTrait,
    );

    console.log(exampleSSRIContractFromTrait);
  });
});

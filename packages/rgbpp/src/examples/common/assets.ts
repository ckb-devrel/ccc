import { ccc } from "@ckb-ccc/shell";

import { ScriptInfo } from "../../types/rgbpp/index.js";

export const udtToken = {
  name: "Just UDT",
  symbol: "jUDT",
  decimal: 8,
};

export const clusterData = {
  name: "RGB++ Cluster real",
  description: "Keep it real",
};

export const issuanceAmount = 2100_0000n;

// https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0025-simple-udt/0025-simple-udt.md#notes
export const testnetSudt = ccc.Script.from({
  codeHash:
    "0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4",
  hashType: "type",
  args: "",
});

export const testnetSudtCellDep = ccc.CellDep.from({
  outPoint: {
    txHash:
      "0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769",
    index: 0,
  },
  depType: "code",
});

export const testnetSudtInfo: ScriptInfo = {
  name: "sUDT",
  script: testnetSudt,
  cellDep: testnetSudtCellDep,
};

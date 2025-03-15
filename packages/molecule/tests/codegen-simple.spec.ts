/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/*
The test
using the Molecule schema from [types.mol](https://github.com/nervosnetwork/molecule/blob/4988418dd65c398b5eab2bc22bc125b72ceeb4b9/test/schemas/types.mol) and corresponding vector from [simple.yaml](https://github.com/nervosnetwork/molecule/blob/4988418dd65c398b5eab2bc22bc125b72ceeb4b9/test/vectors/simple.yaml).
This test checks if the generated code works as expected by running `pack(unpack(item)) == expected`.

To run the test from scratch, please make sure the pwd is `/path/to/lumos/packages/molecule/tests/codegen`

```sh
node ../../lib/cli > generated.ts
```
*/

import { hexFrom, mol } from "@ckb-ccc/core";
import { load } from "js-yaml";
import * as fs from "node:fs";
import path from "node:path";
import * as generated from "./codegen/generated";

test("Test with simple.yaml molecule vector", () => {
  const yamlItems = load(
    fs.readFileSync(path.join(__dirname, "codegen/simple.yaml")).toString(),
  ) as any[];

  const cases = yamlItems.map((testCase) => {
    let data: object | string[] | undefined = undefined;
    if (Array.isArray(testCase.data)) {
      data = testCase.data.map((dataItem: string) =>
        dataItem.replace(/[_/]/gi, ""),
      );
    } else if (typeof testCase.data === "object") {
      data = {};
      Object.entries(testCase.data).forEach((testCaseDataEntry) => {
        Object.assign(data as object, {
          [testCaseDataEntry[0]]: (testCaseDataEntry[1] as string).replace(
            /[_/]/gi,
            "",
          ),
        });
      });
    }
    let caseItem: object | string | undefined = undefined;
    if (typeof testCase.item === "string") {
      caseItem = testCase.item.replace(/[_/]/gi, "");
    } else if (typeof testCase.item === "object") {
      caseItem = {};
      Object.entries(testCase.item).forEach((testCaseItemEntry) => {
        Object.assign(caseItem as object, {
          [testCaseItemEntry[0]]: (testCaseItemEntry[1] as string).replace(
            /[_/]/gi,
            "",
          ),
        });
      });
    }
    return {
      name: testCase.name as keyof typeof generated,
      data,
      item: caseItem,
      expected: testCase.expected.replace(/[_/]/gi, ""),
    };
  });

  cases.forEach(({ name, expected }) => {
    const generatedCodec = generated[name] as mol.Codec<any, any>;
    expect(
      hexFrom(generatedCodec.encode(generatedCodec.decode(expected))),
    ).toBe(expected);
  });
});

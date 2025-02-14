import { hexFrom, Transaction } from "@ckb-ccc/core";
import assert from "assert";
import { readFileSync } from "fs";
import {
  DEFAULT_SCRIPT_ALWAYS_FAILURE,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
  parseAllCycles,
  parseRunResult,
  Resource,
  UnitTestClient,
  Verifier,
} from "./index";

describe("example", () => {
  test("alwaysSuccess", () => {
    const resource = Resource.default();
    const tx = Transaction.default();

    // deploy a cell with risc-v binary, return a script.
    const lockScript = resource.deployCell(
      hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
      tx,
      false,
    );
    // update args
    lockScript.args = "0xEEFF";

    // mock a input cell with the created script as lock script
    const inputCell = resource.mockCell(lockScript);

    // add input cell to the transaction
    tx.inputs.push(Resource.createCellInput(inputCell));
    // add output cell to the transaction
    tx.outputs.push(Resource.createCellOutput(lockScript));
    // add output data to the transaction
    tx.outputsData.push(hexFrom("0x"));

    // verify the transaction
    const verifier = Verifier.from(resource, tx);
    verifier.verifySuccess();
    // turn off console.log
    jest.spyOn(console, "log").mockImplementation(() => {});
    expect(() => verifier.verifyFailure()).toThrow(
      "Transaction verification should fail. No verification failure occurred.",
    );
    jest.spyOn(console, "log").mockRestore();
  });

  test("alwaysFailure", () => {
    const resource = Resource.default();
    const tx = Transaction.default();

    const lockScript = resource.deployCell(
      hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_FAILURE)),
      tx,
      false,
    );
    const inputCell = resource.mockCell(lockScript);
    tx.inputs.push(Resource.createCellInput(inputCell));

    const verifier = Verifier.from(resource, tx);
    verifier.verifyFailure();
    verifier.verifyFailure(-1);
    // turn off console.log
    jest.spyOn(console, "log").mockImplementation(() => {});
    expect(() => verifier.verifySuccess()).toThrow(
      "Transaction verification failed. See details above.",
    );
    expect(() => verifier.verifyFailure(2)).toThrow(
      "Transaction verification failed with unexpected error code: expected 2, got -1. See details above.",
    );
    jest.spyOn(console, "log").mockRestore();
  });

  test("parse", () => {
    const resource = Resource.default();
    const tx = Transaction.default();

    const lockScript = resource.deployCell(
      hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_FAILURE)),
      tx,
      true,
    );
    const inputCell = resource.mockCell(lockScript);
    tx.inputs.push(Resource.createCellInput(inputCell));

    const verifier = Verifier.from(resource, tx);
    const result = verifier.verify()[0];
    assert(parseRunResult(result.stdout.toString()) == -1);
    assert(parseAllCycles(result.stdout.toString()) == 543);
  });
  test("signHashInfo", async () => {
    const resource = Resource.default();
    const tx = Transaction.default();
    const client = new UnitTestClient(resource);

    const lockScript = resource.deployCell(
      hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
      tx,
      false,
    );
    const inputCell = resource.mockCell(lockScript);
    tx.inputs.push(Resource.createCellInput(inputCell));
    // the format of witness should follow WitnessArgs
    tx.witnesses.push(
      hexFrom(
        "0x5500000010000000550000005500000041000000725e20eeee617616f881e65773fdb8d0f2d91619a71cfe18121f3fef67f9cfcb0c019c66ebf67ef2f41123443a786c554a5287ff2a3e92725fa14634c4f1550f01",
      ),
    );
    // extra witness, anything is OK
    tx.witnesses.push(hexFrom("0x00112233445566778899aabbccddeeff"));

    await tx.prepareSighashAllWitness(lockScript, 0, client);
    const sigHashAll = await tx.getSignHashInfo(lockScript, client);
    assert(sigHashAll?.message.length == 66);
    const verifier = Verifier.from(resource, tx);
    verifier.verifySuccess();
  });
});

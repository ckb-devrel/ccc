import { ccc } from "@ckb-ccc/core";
import { describe, expect, test } from "vitest";
import { CoBuild } from "./coBuild.js";
import { Action, ScriptInfo } from "./codec/index.js";

describe("CoBuild", () => {
  const script = ccc.Script.from({
    codeHash: "0x" + "22".repeat(32),
    hashType: "type",
    args: "0x3344",
  });

  const scriptInfo = ScriptInfo.from({
    name: "TestScript",
    url: "https://example.com",
    scriptHash: script.hash(),
    schema: "TestSchema",
    messageType: "TestMessageType",
  });

  const coBuild = new CoBuild(script, scriptInfo);

  test("buildAction should prefill script context", () => {
    const payload = "0x556677";
    const action = coBuild.buildAction(payload);

    expect(action.scriptInfoHash).toBe(scriptInfo.hash());
    expect(action.scriptHash).toBe(script.hash());
    expect(action.data).toBe(payload);
  });

  test("buildAction with ccc.Entity", () => {
    const entity = ccc.Script.from({
      codeHash: "0x" + "44".repeat(32),
      hashType: "type",
      args: "0x",
    });
    const action = coBuild.buildAction(entity);

    expect(action.data).toBe(ccc.hexFrom(entity.toBytes()));
  });

  test("appendActions and parseActions with single action", async () => {
    const tx = ccc.Transaction.from({
      version: 0,
      cellDeps: [],
      headerDeps: [],
      inputs: [],
      outputs: [],
      outputsData: [],
      witnesses: [],
    });

    const action = coBuild.buildAction("0xaabb");
    const { tx: txUpdated } = await coBuild.appendActions(tx, action);

    expect(txUpdated.witnesses.length).toBe(1);

    const { actions } = coBuild.parseActions(txUpdated);
    expect(actions.length).toBe(1);
    expect(actions[0].data).toBe("0xaabb");
    expect(actions[0].scriptHash).toBe(script.hash());
    expect(actions[0].scriptInfoHash).toBe(scriptInfo.hash());
  });

  test("appendActions with iterable and async iterable", async () => {
    const action1 = coBuild.buildAction("0x11");
    const action2 = coBuild.buildAction("0x22");

    // Test sync iterable (array)
    const txSyncBase = ccc.Transaction.from({
      version: 0,
      cellDeps: [],
      headerDeps: [],
      inputs: [],
      outputs: [],
      outputsData: [],
      witnesses: [],
    });
    const { tx: txSync } = await coBuild.appendActions(txSyncBase, [
      action1,
      action2,
    ]);
    const { actions: actionsSync } = coBuild.parseActions(txSync);
    expect(actionsSync.length).toBe(2);
    expect(actionsSync[0].data).toBe("0x11");
    expect(actionsSync[1].data).toBe("0x22");

    // Test async iterable
    const txAsyncBase = ccc.Transaction.from({
      version: 0,
      cellDeps: [],
      headerDeps: [],
      inputs: [],
      outputs: [],
      outputsData: [],
      witnesses: [],
    });
    async function* asyncGenerator() {
      yield action1;
      yield action2;
    }
    const { tx: txAsync } = await coBuild.appendActions(
      txAsyncBase,
      asyncGenerator(),
    );
    const { actions: actionsAsync } = coBuild.parseActions(txAsync);
    expect(actionsAsync.length).toBe(2);
    expect(actionsAsync[0].data).toBe("0x11");
    expect(actionsAsync[1].data).toBe("0x22");
  });

  test("findActions query methods", async () => {
    const tx = ccc.Transaction.from({
      version: 0,
      cellDeps: [],
      headerDeps: [],
      inputs: [],
      outputs: [],
      outputsData: [],
      witnesses: [],
    });

    const otherScript = ccc.Script.from({
      codeHash: "0x" + "55".repeat(32),
      hashType: "type",
      args: "0x",
    });

    const actionCurrent = coBuild.buildAction("0x11");
    const actionOther = Action.from({
      scriptInfoHash: "0x" + "66".repeat(32),
      scriptHash: otherScript.hash(),
      data: "0x22",
    });

    const { tx: txUpdated } = await coBuild.appendActions(tx, [
      actionCurrent,
      actionOther,
    ]);

    // findActions matching current script
    const foundActions1 = coBuild.findActions(txUpdated);
    expect(foundActions1.length).toBe(1);
    expect(foundActions1[0].data).toBe("0x11");

    // findActions matching other script
    const foundActions2 = coBuild.findActions(txUpdated, otherScript);
    expect(foundActions2.length).toBe(1);
    expect(foundActions2[0].data).toBe("0x22");

    // findActionsByHash matching other script hash
    const foundActions3 = coBuild.findActionsByHash(
      txUpdated,
      otherScript.hash(),
    );
    expect(foundActions3.length).toBe(1);
    expect(foundActions3[0].data).toBe("0x22");

    // findActionsByScriptInfo matching current script info
    const foundActions4 = coBuild.findActionsByScriptInfo(
      txUpdated,
      scriptInfo,
    );
    expect(foundActions4.length).toBe(1);
    expect(foundActions4[0].data).toBe("0x11");
  });
});

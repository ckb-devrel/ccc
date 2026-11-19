import type { ccc } from "@ckb-ccc/ccc";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WalletReadyNotice,
  WalletRequiredNotice,
} from "../src/app/components/WalletRequiredNotice";
import type { Messages } from "../src/app/context";
import { MissingWalletError } from "../src/app/execute/wallet";
import { captureOutputEntry } from "../src/app/output";
import { Console } from "../src/app/tabs/Console";
import { WalletReadyMessage } from "../src/app/walletRecovery";

const state = vi.hoisted(() => ({
  app: {
    signer: undefined as unknown,
    messages: [] as Messages,
    isExampleWallet: false,
    openSigner: vi.fn(),
    enableExampleWallet: vi.fn(),
  },
  connector: { signerInfo: undefined as unknown, isOpen: false },
}));
vi.mock("../src/app/context", () => ({ useApp: () => state.app }));
vi.mock("@ckb-ccc/connector-react", async () => {
  const { ccc } = await import("@ckb-ccc/ccc");
  return { ccc: { ...ccc, useCcc: () => state.connector } };
});

function render(active = true) {
  return renderToStaticMarkup(createElement(WalletRequiredNotice, { active }));
}
beforeEach(() => {
  state.app.signer = undefined;
  state.app.messages = [];
  state.app.isExampleWallet = false;
  state.connector.signerInfo = undefined;
  state.connector.isOpen = false;
});
describe("wallet failure recovery", () => {
  it("keeps disconnected recovery choices and does not offer execution", () => {
    const html = render();
    expect(html).toContain("Use example wallet");
    expect(html).toContain("Connect real wallet");
    expect(html).not.toContain("Run current code");
  });
  it.each([false, true])(
    "adds explicit recovery with example=%s",
    (example) => {
      state.app.signer = {};
      state.app.isExampleWallet = example;
      const html = renderToStaticMarkup(
        createElement(WalletReadyNotice, {
          active: true,
          example,
          isRunning: false,
          runBlocked: false,
          onRun: vi.fn(),
        }),
      );
      expect(html).toContain("Run current code");
      expect(html).not.toContain("ERROR");
      expect(render()).toBe(
        "<p>This run stopped because no wallet was connected.</p>",
      );
      if (example) expect(html).toContain("cannot sign or send");
    },
  );
  it("never offers a real-wallet run on a previous example-wallet notice", () => {
    const client = { addressPrefix: "ckt" } as ccc.Client;
    const failure = new MissingWalletError();
    state.app.signer = { client };
    const onRun = vi.fn();
    const timeline = () =>
      renderToStaticMarkup(
        createElement(Console, {
          executionStatus: "Run failed",
          hasRun: true,
          walletFailure: failure,
          onRun,
          isRunning: false,
          runBlocked: false,
          autoClear: true,
          onAutoClear: vi.fn(),
        }),
      );
    const ready = (example: boolean) =>
      captureOutputEntry(
        "info",
        "Ready to run",
        [new WalletReadyMessage(failure, example)],
        state.app.messages.length + 1,
        client,
        example,
      );
    state.app.messages.push(
      captureOutputEntry(
        "error",
        "Execution failed",
        [failure],
        0,
        client,
        false,
      ),
    );
    state.app.messages.push(ready(true));
    state.app.isExampleWallet = true;
    expect(timeline()).toContain("Run current code</button>");
    state.app.isExampleWallet = false;
    expect(timeline()).not.toContain("Run current code</button>"); // Real notice is still queued.
    state.app.messages.push(ready(false));
    const html = timeline();
    expect(html).toContain("Read-only example wallet selected.");
    expect(html).toContain("Wallet connected.");
    expect(html.match(/Run current code<\/button>/g)).toHaveLength(1);
    expect(onRun).not.toHaveBeenCalled();
  });
  it("keeps connection history without a stale execution action", () => {
    const html = renderToStaticMarkup(
      createElement(WalletReadyNotice, {
        active: true,
        example: false,
        isRunning: false,
        runBlocked: false,
        onRun: vi.fn(),
      }),
    );
    expect(html).toContain("no longer connected");
    expect(html).not.toContain("Run current code");
  });
  it("keeps older failures historical even after a later wallet connection", () => {
    state.app.signer = {};
    expect(render(false)).toBe(
      "<p>This run stopped because no wallet was connected.</p>",
    );
  });
  it("does not claim opening the picker is a connection", () => {
    state.connector.isOpen = true;
    expect(render()).toContain("Complete the connection");
    expect(render()).not.toContain("Run current code");
  });
  it("disables execution while another run is active", () => {
    state.app.signer = {};
    expect(
      renderToStaticMarkup(
        createElement(WalletReadyNotice, {
          active: true,
          example: false,
          isRunning: true,
          runBlocked: false,
          onRun: vi.fn(),
        }),
      ),
    ).toMatch(/<button[^>]*disabled/);
  });
  it("disables a wallet recovery run while the wallet network differs", () => {
    state.app.signer = {};
    const renderReady = (runBlocked: boolean) =>
      renderToStaticMarkup(
        createElement(WalletReadyNotice, {
          active: true,
          example: false,
          isRunning: false,
          runBlocked,
          onRun: vi.fn(),
        }),
      );
    expect(renderReady(true)).toMatch(/<button[^>]*disabled/);
    expect(renderReady(false)).not.toMatch(/<button[^>]*disabled/);
  });
});

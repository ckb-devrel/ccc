import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WalletReadyNotice,
  WalletRequiredNotice,
} from "../src/app/components/WalletRequiredNotice";

const state = vi.hoisted(() => ({
  app: {
    signer: undefined as unknown,
    isExampleWallet: false,
    openSigner: vi.fn(),
    enableExampleWallet: vi.fn(),
  },
  connector: { signerInfo: undefined as unknown, isOpen: false },
}));
vi.mock("../src/app/context", () => ({ useApp: () => state.app }));
vi.mock("@ckb-ccc/connector-react", () => ({
  ccc: { useCcc: () => state.connector },
}));

function render(active = true) {
  return renderToStaticMarkup(createElement(WalletRequiredNotice, { active }));
}
beforeEach(() => {
  state.app.signer = undefined;
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
  it("keeps connection history without a stale execution action", () => {
    const html = renderToStaticMarkup(
      createElement(WalletReadyNotice, {
        active: true,
        example: false,
        isRunning: false,
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
          onRun: vi.fn(),
        }),
      ),
    ).toMatch(/<button[^>]*disabled/);
  });
});

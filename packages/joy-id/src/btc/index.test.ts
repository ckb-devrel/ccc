import { ccc } from "@ckb-ccc/core";
import { decodeSearch } from "@joyid/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPopup } from "../common/index.js";
import {
  AccountSelector,
  Connection,
  ConnectionsRepo,
} from "../connectionsStorage/index.js";
import { BitcoinSigner } from "./index.js";

vi.mock("../common/index.js", () => ({
  createPopup: vi.fn(),
}));

const ADDRESS = "tb1qcqza4qj68la40xfcjg8kdaks7uvjxqhtkh3apm";
const CLIENT = ccc.ClientPublicTestnet.new({
  transport: {
    request: async () => {
      throw new Error("Unexpected request");
    },
  },
});

class ConnectionsRepoMemory implements ConnectionsRepo {
  constructor(public connection?: Connection) {}

  async get(_selector: AccountSelector): Promise<Connection | undefined> {
    return this.connection;
  }

  async set(
    _selector: AccountSelector,
    connection: Connection | undefined,
  ): Promise<void> {
    this.connection = connection;
  }
}

function createSigner() {
  return new BitcoinSigner(
    CLIENT,
    "JoyID",
    "",
    undefined,
    "p2wpkh",
    undefined,
    new ConnectionsRepoMemory({
      address: ADDRESS,
      publicKey: `0x${"02".repeat(33)}`,
      keyType: "main_key",
    }),
    "btcTestnet",
  );
}

function requestSentTo(popup: string) {
  const data = new URL(popup).searchParams.get("_data_");
  return decodeSearch(data!) as Record<string, unknown>;
}

describe("BitcoinSigner.signPsbt", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "https://dapp.test/" });
    vi.mocked(createPopup).mockReset();
    vi.mocked(createPopup).mockResolvedValue({ tx: "70736274ff" });
  });

  it("should send the default options in JoyID's shape", async () => {
    const signed = await createSigner().signPsbt("0x70736274ff");

    expect(signed).toBe("0x70736274ff");
    const request = requestSentTo(vi.mocked(createPopup).mock.calls[0][0]);
    expect(request).toMatchObject({
      tx: "70736274ff",
      signerAddress: ADDRESS,
      autoFinalized: true,
      options: { autoFinalized: true },
    });
    expect(request.options).not.toHaveProperty("toSignInputs");
  });

  it("should send inputsToSign as toSignInputs", async () => {
    await createSigner().signPsbt("0x70736274ff", {
      autoFinalized: false,
      inputsToSign: [
        { index: 0, address: ADDRESS },
        { index: 1, publicKey: "0xabcd", sighashTypes: [1] },
      ],
    });

    const request = requestSentTo(vi.mocked(createPopup).mock.calls[0][0]);
    expect(request).toMatchObject({
      autoFinalized: false,
      options: {
        autoFinalized: false,
        toSignInputs: [
          { index: 0, address: ADDRESS },
          { index: 1, publicKey: "abcd", sighashTypes: [1] },
        ],
      },
    });
  });
});

describe("BitcoinSigner.signAndBroadcastPsbt", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { href: "https://dapp.test/" });
    vi.mocked(createPopup).mockReset();
    vi.mocked(createPopup).mockResolvedValue({ tx: "ab".repeat(32) });
  });

  it("should force autoFinalized on and request broadcasting", async () => {
    const txid = await createSigner().signAndBroadcastPsbt("0x70736274ff", {
      autoFinalized: false,
      inputsToSign: [{ index: 0, address: ADDRESS }],
    });

    expect(txid).toBe(`0x${"ab".repeat(32)}`);
    expect(
      requestSentTo(vi.mocked(createPopup).mock.calls[0][0]),
    ).toMatchObject({
      isSend: true,
      autoFinalized: true,
      options: {
        autoFinalized: true,
        toSignInputs: [{ index: 0, address: ADDRESS }],
      },
    });
  });
});

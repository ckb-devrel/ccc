import { describe, expect, it } from "vitest";
import { FeeRateSelectedEvent } from "../events/internal.js";
import { I18n } from "../i18n/index.js";
import { FeeRateOptionId, FeeRateScene } from "./fee-rate.js";

type FeeRateSceneInternals = Pick<
  FeeRateScene,
  "feeRate" | "i18n" | "addEventListener"
> & {
  options: { id: FeeRateOptionId; label: string }[];
  selectedOptionId: FeeRateOptionId | undefined;
  selectOption(id: FeeRateOptionId, feeRate: bigint): void;
  recommendedFeeRate?: bigint;
};

function createScene(locale = "en") {
  const scene = new FeeRateScene() as unknown as FeeRateSceneInternals;
  scene.i18n = new I18n(locale);
  return scene;
}

describe("FeeRateScene", () => {
  it("derives the selected option from the fee rate, not the label", () => {
    const scene = createScene("zh-CN");
    scene.recommendedFeeRate = 1234n;

    expect(scene.options.map(({ id }) => id)).toEqual(["economy", "auto"]);
    expect(scene.options.map(({ label }) => label)).toEqual(["经济", "自动"]);

    scene.feeRate = undefined;
    expect(scene.selectedOptionId).toBe("auto");
    scene.feeRate = 1000n;
    expect(scene.selectedOptionId).toBe("economy");
    scene.feeRate = 5000n;
    expect(scene.selectedOptionId).toBeUndefined();
  });

  it("dispatches an undefined fee rate for the auto option in any locale", () => {
    const scene = createScene("zh-CN");
    const received: (bigint | undefined)[] = [];
    scene.addEventListener("fee-rate-selected", (event) => {
      received.push((event as FeeRateSelectedEvent).feeRate);
    });

    scene.selectOption("auto", 1234n);
    scene.selectOption("economy", 1000n);

    expect(received).toEqual([undefined, 1000n]);
  });
});

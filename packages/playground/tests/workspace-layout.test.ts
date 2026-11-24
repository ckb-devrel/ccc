import { describe, expect, it, vi } from "vitest";
import {
  parseWorkspaceLayout,
  readWorkspaceLayout,
  WORKSPACE_LAYOUT_STORAGE_KEY,
  writeWorkspaceLayout,
} from "../src/app/hooks/useWorkspaceLayout";

const defaults = { split: 50, focus: false, view: "split", mobilePane: "code" };

describe("workspace layout preferences", () => {
  it.each([null, undefined, [], "not an object", 7, true])(
    "uses defaults for invalid root data: %s",
    (input) => {
      expect(parseWorkspaceLayout(input)).toEqual(defaults);
    },
  );

  it.each([
    [5, 20],
    [95, 80],
    [37.5, 37.5],
  ])("clamps finite split %s to %s", (input, expected) => {
    expect(parseWorkspaceLayout({ split: input }).split).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity, "70", null])(
    "rejects a non-finite or non-number split: %s",
    (split) => {
      expect(parseWorkspaceLayout({ split }).split).toBe(50);
    },
  );

  it.each(["code", "output", "split", "unknown"])(
    "migrates legacy desktop view %s to split without changing ratio or focus",
    (view) => {
      expect(parseWorkspaceLayout({ view, split: 63, focus: true })).toEqual({
        split: 63,
        focus: true,
        view: "split",
        mobilePane: "code",
      });
    },
  );

  it("keeps mobile selection independent from the retired desktop view", () => {
    expect(
      parseWorkspaceLayout({ view: "code", mobilePane: "output", focus: true }),
    ).toEqual({ split: 50, view: "split", mobilePane: "output", focus: true });
    expect(
      parseWorkspaceLayout({
        view: "output",
        mobilePane: "invalid",
        focus: "true",
      }),
    ).toEqual(defaults);
  });

  it("recovers from malformed JSON and unavailable storage", () => {
    expect(readWorkspaceLayout({ getItem: () => "{broken" })).toEqual(defaults);
    expect(readWorkspaceLayout({ getItem: () => null })).toEqual(defaults);
    expect(
      readWorkspaceLayout({
        getItem: () => {
          throw new Error("storage denied");
        },
      }),
    ).toEqual(defaults);
    expect(() =>
      writeWorkspaceLayout(
        {
          setItem: () => {
            throw new Error("quota exceeded");
          },
        },
        defaults as ReturnType<typeof parseWorkspaceLayout>,
      ),
    ).not.toThrow();
  });

  it("reads and writes only the layout key and never touches source drafts", () => {
    const data = new Map([
      ["playgroundSourceCode", "const importantDraft = true;"],
      [
        WORKSPACE_LAYOUT_STORAGE_KEY,
        JSON.stringify({ split: 62, focus: true, view: "code" }),
      ],
    ]);
    const storage = {
      getItem: vi.fn((key: string) => data.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        data.set(key, value);
      }),
    };
    expect(readWorkspaceLayout(storage)).toEqual({
      split: 62,
      focus: true,
      view: "split",
      mobilePane: "code",
    });
    writeWorkspaceLayout(
      storage,
      parseWorkspaceLayout({
        split: 200,
        source: "overwrite",
        focus: true,
        view: "output",
      }),
    );
    expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(
      WORKSPACE_LAYOUT_STORAGE_KEY,
    );
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(
      WORKSPACE_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        split: 80,
        focus: true,
        view: "split",
        mobilePane: "code",
      }),
    );
    expect(data.get("playgroundSourceCode")).toBe(
      "const importantDraft = true;",
    );
    expect(
      JSON.parse(data.get(WORKSPACE_LAYOUT_STORAGE_KEY)!),
    ).not.toHaveProperty("source");
  });
});

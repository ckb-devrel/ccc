import { ccc } from "@ckb-ccc/core";
import { describe, expect, it } from "vitest";
import { matchesClusterFilter } from "./clusterFilter.js";

const clusterId = `0x${"66".repeat(32)}`;

describe("matchesClusterFilter", () => {
  it("does not filter when clusterId is omitted", () => {
    expect(matchesClusterFilter(undefined, undefined)).toBe(true);
    expect(matchesClusterFilter(clusterId, undefined)).toBe(true);
  });

  it("keeps only public spores when clusterId is an empty string", () => {
    expect(matchesClusterFilter(undefined, "")).toBe(true);
    expect(matchesClusterFilter("", "")).toBe(true);
    expect(matchesClusterFilter(clusterId, "")).toBe(false);
    expect(matchesClusterFilter("0x", "")).toBe(false);
  });

  it("matches a cluster id without treating an empty string as hex", () => {
    expect(matchesClusterFilter(clusterId, clusterId)).toBe(true);
    expect(matchesClusterFilter(clusterId, ccc.bytesFrom(clusterId))).toBe(
      true,
    );
    expect(matchesClusterFilter(undefined, clusterId)).toBe(false);
    expect(matchesClusterFilter(clusterId, `0x${"11".repeat(32)}`)).toBe(false);
  });
});

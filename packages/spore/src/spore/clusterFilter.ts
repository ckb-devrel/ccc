import { ccc } from "@ckb-ccc/core";

/**
 * Whether a spore's cluster id satisfies a search filter.
 *
 * - `undefined` does not filter.
 * - `""` keeps public spores only (no cluster id) and is never passed to `hexFrom`.
 * - any other {@link ccc.HexLike} keeps spores in that cluster.
 */
export function matchesClusterFilter(
  sporeClusterId: ccc.HexLike | undefined,
  clusterId: ccc.HexLike | undefined,
): boolean {
  if (clusterId === undefined) {
    return true;
  }

  if (clusterId === "") {
    return isPublicClusterId(sporeClusterId);
  }

  if (isPublicClusterId(sporeClusterId)) {
    return false;
  }

  return ccc.hexFrom(sporeClusterId) === ccc.hexFrom(clusterId);
}

function isPublicClusterId(
  clusterId: ccc.HexLike | undefined,
): clusterId is undefined | "" {
  return clusterId == null || clusterId === "";
}

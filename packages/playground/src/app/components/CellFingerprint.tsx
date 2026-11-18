import { ccc } from "@ckb-ccc/connector-react";
import { getScriptBagua, getScriptColor } from "../utils";
import { Bagua } from "./Bagua";

const TYPE_SCALE = 0.6;
const LINE_GAP = 1.6;
// Match the shortest distance across diagonal sector edges to the line gap.
const SECTOR_SPACE =
  (LINE_GAP * (1 + Math.SQRT2)) / (2 * Math.SQRT2 * Math.cos(Math.PI / 8));

/** Decorative identity only: lock outside, type inside, with an open center.
 * The outer lock is identical with or without a type; only the inner ring is optional.
 * Capacity belongs to the labeled CellCapacity breakdown, not a second tiny gauge.
 */
export function CellFingerprint({
  lock,
  type,
}: {
  lock?: ccc.Script;
  type?: ccc.Script;
}) {
  return (
    <span className="cell-fingerprint" aria-hidden="true">
      <Bagua
        dim={1}
        thickness={4.6}
        padding={LINE_GAP}
        margin={2}
        space={SECTOR_SPACE}
        gapRatio={0.16}
        value={getScriptBagua(lock)}
        fill="none"
        stroke={getScriptColor(lock)}
      />
      {type && (
        <Bagua
          className="cell-fingerprint-type"
          dim={1}
          thickness={7.6}
          padding={LINE_GAP / TYPE_SCALE}
          margin={2}
          space={SECTOR_SPACE / TYPE_SCALE}
          gapRatio={0.16}
          value={getScriptBagua(type)}
          fill="none"
          stroke={getScriptColor(type)}
        />
      )}
    </span>
  );
}

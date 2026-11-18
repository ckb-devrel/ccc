import { ccc } from "@ckb-ccc/connector-react";
import "./CellCapacity.css";
import { capacityOccupiedPercent } from "./capacityRatio";

export function CellCapacity({
  capacity,
  occupied,
  extra,
  hasOutPoint,
}: {
  capacity?: ccc.Num;
  occupied?: ccc.Num;
  extra?: ccc.Num;
  hasOutPoint: boolean;
}) {
  const free =
    capacity !== undefined && occupied !== undefined
      ? capacity - occupied
      : undefined;
  const proportion = capacityOccupiedPercent(capacity, occupied);
  const amount = (value?: ccc.Num) =>
    value === undefined ? "Unknown" : `${ccc.fixedPointToString(value)} CKB`;
  return (
    <section
      className="cell-capacity-breakdown"
      aria-label="Cell capacity breakdown"
    >
      <div className="cell-capacity-total">
        <span>Capacity</span>
        <strong>{amount(capacity)}</strong>
      </div>
      {proportion !== undefined && (
        <div className="cell-capacity-meter" aria-hidden="true">
          <span style={{ width: `${proportion}%` }} />
        </div>
      )}
      <dl className="cell-capacity-parts">
        <div>
          <dt>
            <span className="capacity-key occupied" aria-hidden="true" />
            Occupied
          </dt>
          <dd>{amount(occupied)}</dd>
        </div>
        <div>
          <dt>
            <span className="capacity-key free" aria-hidden="true" />
            Free
          </dt>
          <dd>{amount(free)}</dd>
        </div>
      </dl>
      {free !== undefined && free < BigInt(0) && (
        <p className="result-warning">
          Capacity is below the occupied minimum by {amount(-free)}.
        </p>
      )}
      {hasOutPoint && (
        <div className="cell-dao-extra">
          <span>DAO extra</span>
          <strong>{amount(extra)}</strong>
        </div>
      )}
    </section>
  );
}

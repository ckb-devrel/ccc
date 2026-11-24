import { ccc } from "@ckb-ccc/connector-react";
import { useEffect, useMemo, useState } from "react";
import { getSnapshotFee } from "./transactionFee";
import { TransactionFlow } from "./TransactionFlow";

export function Transaction({
  tx,
  client,
  isDefaultOpen = true,
}: {
  tx: ccc.Transaction;
  client: ccc.Client;
  isDefaultOpen?: boolean;
}) {
  const [capacity, setCapacity] = useState<{
    tx: ccc.Transaction;
    client: ccc.Client;
    input?: ccc.Num;
    extra?: ccc.Num;
    error?: string;
  }>();
  useEffect(() => {
    let active = true;
    void Promise.all([
      tx.getInputsCapacity(client),
      tx.getInputsCapacityExtra(client),
    ])
      .then(([input, extra]) => {
        if (active) {
          setCapacity({ tx, client, input, extra });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCapacity({ tx, client, error: String(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [tx, client]);
  const current =
    capacity?.tx === tx && capacity.client === client ? capacity : undefined;
  const output = tx.getOutputsCapacity();
  const input = current?.input;
  const { fee, feeRate } = getSnapshotFee(
    tx.inputs.length,
    input,
    output,
    tx.toBytes().length,
  );
  const json = useMemo(
    () =>
      JSON.stringify(
        tx,
        (_, value) =>
          typeof value === "bigint" ? `0x${value.toString(16)}` : value,
        2,
      ),
    [tx],
  );
  const txHash = tx.hash();
  return (
    <details className="tx-card" open={isDefaultOpen || undefined}>
      <summary className="tx-heading">
        <span className="detail-label">Transaction snapshot</span>
        <span className="tx-network">
          {client.addressPrefix === "ckb" ? "Mainnet" : "Testnet"}
        </span>
        <span className="tx-hash">{txHash}</span>
      </summary>
      <div className="tx-summary">
        <div>
          <span>Inputs</span>
          <strong>
            {input === undefined ? "Unknown" : ccc.fixedPointToString(input)}{" "}
            <small>CKB</small>
          </strong>
        </div>
        <div>
          <span>Outputs</span>
          <strong>
            {ccc.fixedPointToString(output)} <small>CKB</small>
          </strong>
        </div>
        <div>
          <span>Snapshot fee</span>
          <strong>
            {fee === undefined ? "Not available" : ccc.fixedPointToString(fee)}{" "}
            {fee !== undefined && <small>CKB</small>}
          </strong>
          <span>Snapshot fee rate</span>
          <strong>
            {feeRate === undefined ? "Not available" : feeRate.toString()}{" "}
            {feeRate !== undefined && <small>shannons/KB</small>}
          </strong>
        </div>
      </div>
      {current?.extra !== undefined && current.extra !== ccc.Zero && (
        <p className="tx-note">
          Inputs include {ccc.fixedPointToString(current.extra)} CKB DAO extra
          capacity.
        </p>
      )}
      {tx.inputs.length > 0 && input !== undefined && output > input ? (
        <p className="result-warning">
          Outputs exceed resolved input capacity by{" "}
          {ccc.fixedPointToString(output - input)} CKB. Inputs are not yet
          sufficient.
        </p>
      ) : null}
      {current?.error && (
        <p className="result-warning">
          Input capacity unavailable: {current.error}
        </p>
      )}
      <TransactionFlow tx={tx} client={client} />
      <details className="tx-raw">
        <summary>
          Raw transaction · {tx.cellDeps.length} cell deps ·{" "}
          {tx.witnesses.length} witnesses
        </summary>
        <pre tabIndex={0}>{json}</pre>
      </details>
    </details>
  );
}

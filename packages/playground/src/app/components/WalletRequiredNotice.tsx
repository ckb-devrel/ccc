import { ccc } from "@ckb-ccc/connector-react";
import { FlaskConical, Link, Play } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context";
import { requestWalletConnection } from "../execute/wallet";
import { Button } from "./Button";

export function WalletRequiredNotice({ active }: { active: boolean }) {
  const { openSigner, signer, isExampleWallet, enableExampleWallet } = useApp();
  const { signerInfo, isOpen } = ccc.useCcc();
  const [requested, setRequested] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  if (!active || signer) {
    return <p>This run stopped because no wallet was connected.</p>;
  }
  return (
    <div className="wallet-required-notice">
      <p>This run stopped because no wallet was connected.</p>
      <p className="muted" role="status">
        {opening || isOpen
          ? "Complete the connection in the wallet dialog. Your code will not resume automatically."
          : requested
            ? "No wallet is connected. You can try again, or keep working with client-only code."
            : "Connect your wallet or use the read-only example address. Then press Run again. Nothing runs automatically."}
      </p>
      {!signer && !signerInfo && (
        <div className="wallet-choice-actions">
          <Button
            className="primary"
            disabled={opening || isOpen}
            onClick={async () => {
              setError("");
              setRequested(true);
              setOpening(true);
              const result = await requestWalletConnection(openSigner);
              if (!result.opened) {
                setError(result.message);
              }
              setOpening(false);
            }}
          >
            <Link size={15} /> Connect real wallet
          </Button>
          {!isExampleWallet && (
            <Button
              disabled={opening || isOpen}
              onClick={() => {
                setError("");
                enableExampleWallet();
              }}
            >
              <FlaskConical size={15} /> Use example wallet
            </Button>
          )}
        </div>
      )}
      {!signer && error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** The new timeline entry carries the action; the stopped run stays historical. */
export function WalletReadyNotice({
  active,
  example,
  onRun,
  isRunning,
  runBlocked,
}: {
  active: boolean;
  example: boolean;
  onRun: () => void;
  isRunning: boolean;
  runBlocked: boolean;
}) {
  const { signer, isExampleWallet } = useApp();
  const { isOpen } = ccc.useCcc();
  return (
    <div className="wallet-required-notice">
      <p>
        {example ? "Read-only example wallet selected." : "Wallet connected."}
      </p>
      {active && signer ? (
        <>
          <p className="muted">
            {isExampleWallet
              ? "The current wallet is read-only and cannot sign or send transactions. Review your code, then run it when ready."
              : "Review your code, then run it when ready. Nothing runs automatically."}
          </p>
          <Button
            className="primary"
            disabled={isRunning || isOpen || runBlocked}
            onClick={onRun}
          >
            <Play size={15} /> Run current code
          </Button>
        </>
      ) : (
        <p className="muted">
          {active
            ? "The wallet is no longer connected. Connect again to run wallet-dependent code."
            : "This connection did not automatically resume the stopped run."}
        </p>
      )}
    </div>
  );
}

import { Play } from "lucide-react";
import { Button } from "./Button";

export function EmptyOutput({
  hasRun,
  isRunning,
  runBlocked,
  onRun,
}: {
  hasRun: boolean;
  isRunning: boolean;
  runBlocked: boolean;
  onRun: () => void;
}) {
  return (
    <div className="output-empty">
      <div className="empty-diagram" aria-hidden="true">
        <span />
        <i />
        <span />
      </div>
      <span className="eyebrow">
        {isRunning
          ? "EXECUTING"
          : hasRun
            ? "EMPTY CONSOLE"
            : "AWAITING EXECUTION"}
      </span>
      <h2>
        {isRunning
          ? "Waiting for output…"
          : hasRun
            ? "No output to display."
            : "Your code, made visible."}
      </h2>
      {!hasRun && !isRunning && (
        <p>
          Transactions become cell flows. Addresses, data and custom React views
          appear right here.
        </p>
      )}
      {!isRunning && (
        <Button className="primary" onClick={onRun} disabled={runBlocked}>
          <Play size={16} />
          {hasRun ? "Run again" : "Run code"}
        </Button>
      )}
      {!hasRun && !isRunning && (
        <small>
          Use Step to pause at each <code>await render(…)</code>.
        </small>
      )}
    </div>
  );
}

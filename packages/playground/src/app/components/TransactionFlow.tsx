import { ccc } from "@ckb-ccc/connector-react";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Cell, CellInfo } from "./Cell";
import { scrollOutputIntoView } from "./scrollOutputIntoView";
import "./TransactionFlow.css";
import {
  clampTransactionSplit,
  TRANSACTION_DIVIDER_SPACE,
  transactionSplitAtPointer,
  transactionSplitBounds,
} from "./transactionFlowLayout";

export function TransactionFlow({
  tx,
  client,
}: {
  tx: ccc.Transaction;
  client: ccc.Client;
}) {
  const [split, setSplit] = useState(50);
  const [selection, setSelection] = useState<{
    tx: ccc.Transaction;
    side: "inputs" | "outputs";
    index: number;
  }>();
  const inspector = useRef<HTMLElement>(null);
  const closeInspectorButton = useRef<HTMLButtonElement>(null);
  const inspectorTrigger = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(0);
  const [side, setSide] = useState<"inputs" | "outputs">(
    tx.inputs.length ? "inputs" : "outputs",
  );
  const flow = useRef<HTMLDivElement>(null);
  const inputTab = useRef<HTMLButtonElement>(null);
  const outputTab = useRef<HTMLButtonElement>(null);
  const id = useId();
  const outputCells = useMemo(
    () =>
      tx.outputs.map((cellOutput, i) => ({
        cellOutput,
        outputData: tx.outputsData[i],
      })),
    [tx],
  );
  const selectedCell =
    selection?.tx === tx
      ? selection.side === "inputs"
        ? tx.inputs[selection.index]
        : outputCells[selection.index]
      : undefined;
  useEffect(() => {
    if (selection) {
      closeInspectorButton.current?.focus({ preventScroll: true });
      scrollOutputIntoView(inspector.current);
    }
  }, [selection]);
  const inspect = (
    kind: "inputs" | "outputs",
    index: number,
    trigger: HTMLButtonElement,
  ) => {
    inspectorTrigger.current = trigger;
    if (
      selection?.tx === tx &&
      selection.side === kind &&
      selection.index === index
    ) {
      setSelection(undefined);
      return;
    }
    setSelection({ tx, side: kind, index });
  };
  const closeInspector = () => {
    setSelection(undefined);
    inspectorTrigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    const element = flow.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setWidth(element.getBoundingClientRect().width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const ratio = clampTransactionSplit(split, width);
  const [min, max] = transactionSplitBounds(width);
  const selectSide = (next: "inputs" | "outputs", focus = false) => {
    if (next !== side) {
      setSelection(undefined);
    }
    setSide(next);
    if (focus) {
      (next === "inputs" ? inputTab : outputTab).current?.focus();
    }
  };
  return (
    <div
      className="transaction-flow"
      ref={flow}
      data-mobile-side={side}
      style={
        {
          "--transaction-input-ratio": `${ratio}fr`,
          "--transaction-divider-space": `${TRANSACTION_DIVIDER_SPACE}px`,
          "--transaction-output-ratio": `${100 - ratio}fr`,
        } as React.CSSProperties
      }
    >
      <div
        className="transaction-flow-tabs"
        role="tablist"
        aria-label="Transaction cells"
      >
        {(["inputs", "outputs"] as const).map((value) => (
          <button
            type="button"
            key={value}
            ref={value === "inputs" ? inputTab : outputTab}
            id={`${id}-${value}-tab`}
            role="tab"
            aria-selected={side === value}
            aria-controls={`${id}-${value}`}
            tabIndex={side === value ? 0 : -1}
            onClick={() => selectSide(value)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                selectSide(
                  event.key === "Home"
                    ? "inputs"
                    : event.key === "End"
                      ? "outputs"
                      : value === "inputs"
                        ? "outputs"
                        : "inputs",
                  true,
                );
              }
            }}
          >
            {value === "inputs" ? "Inputs" : "Outputs"}{" "}
            <span>
              {value === "inputs" ? tx.inputs.length : tx.outputs.length}
            </span>
          </button>
        ))}
      </div>
      <section
        className="transaction-flow-side transaction-inputs"
        role="tabpanel"
        aria-labelledby={`${id}-inputs-tab`}
        id={`${id}-inputs`}
        aria-label={`Transaction inputs: ${tx.inputs.length} cells`}
      >
        <h3>
          Inputs <span>{tx.inputs.length}</span>
        </h3>
        <div
          className="transaction-cell-list"
          tabIndex={0}
          aria-label="Input cells, scroll to inspect"
        >
          {tx.inputs.length ? (
            tx.inputs.map((cell, index) => (
              <Cell
                key={index}
                cell={cell}
                client={client}
                kind="Input"
                inspectorId={`${id}-inspector`}
                selected={
                  selection?.tx === tx &&
                  selection.side === "inputs" &&
                  selection.index === index
                }
                onInspect={(trigger) => inspect("inputs", index, trigger)}
                index={index}
              />
            ))
          ) : (
            <p className="tx-empty">No input cells</p>
          )}
        </div>
      </section>
      <div
        className="transaction-flow-divider"
        role="separator"
        aria-label="Resize transaction input and output columns"
        aria-orientation="vertical"
        aria-valuenow={ratio}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${Math.round(ratio)}% inputs, ${Math.round(100 - ratio)}% outputs`}
        tabIndex={0}
        aria-describedby={`${id}-resize-help`}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
            event.preventDefault();
            setSplit(
              event.key === "Home"
                ? 50
                : clampTransactionSplit(
                    ratio + (event.key === "ArrowLeft" ? -2 : 2),
                    width,
                  ),
            );
          }
        }}
        onDoubleClick={() => setSplit(50)}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
          }
          const bounds = flow.current?.getBoundingClientRect();
          if (bounds) {
            setSplit(
              transactionSplitAtPointer(
                event.clientX - bounds.left,
                bounds.width,
              ),
            );
          }
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <span>
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
      <section
        className="transaction-flow-side transaction-outputs"
        role="tabpanel"
        aria-labelledby={`${id}-outputs-tab`}
        id={`${id}-outputs`}
        aria-label={`Transaction outputs: ${tx.outputs.length} cells`}
      >
        <h3>
          Outputs <span>{tx.outputs.length}</span>
        </h3>
        <div
          className="transaction-cell-list"
          tabIndex={0}
          aria-label="Output cells, scroll to inspect"
        >
          {outputCells.length ? (
            outputCells.map((cell, index) => (
              <Cell
                key={index}
                cell={cell}
                client={client}
                kind="Output"
                inspectorId={`${id}-inspector`}
                selected={
                  selection?.tx === tx &&
                  selection.side === "outputs" &&
                  selection.index === index
                }
                onInspect={(trigger) => inspect("outputs", index, trigger)}
                index={index}
              />
            ))
          ) : (
            <p className="tx-empty">No output cells</p>
          )}
        </div>
      </section>
      <span id={`${id}-resize-help`} className="sr-only">
        Drag to resize transaction columns. Arrow keys adjust; Home or
        double-click resets.
      </span>
      {selectedCell && selection && (
        <section
          className="transaction-inspector"
          id={`${id}-inspector`}
          ref={inspector}
          aria-labelledby={`${id}-inspector-title`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeInspector();
            }
          }}
        >
          <header>
            <h3 id={`${id}-inspector-title`}>
              {selection.side === "inputs" ? "Input" : "Output"}{" "}
              {selection.index} · Cell details
            </h3>
            <button
              type="button"
              ref={closeInspectorButton}
              onClick={closeInspector}
              aria-label="Close cell details"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <CellInfo cell={selectedCell} client={client} />
        </section>
      )}
    </div>
  );
}

import type { ReactNode } from "react";

export type ModuleReadoutTone = "error" | "idle" | "pending" | "success";

export type ModuleReadoutState = {
  content: ReactNode;
  label: ReactNode;
  tone?: ModuleReadoutTone;
};

export type ShowModuleReadout = (readout: ModuleReadoutState) => void;

export function ModuleReadout({
  children,
  label,
  previous,
  revision = 0,
  tone = "idle",
}: {
  children: ReactNode;
  label: ReactNode;
  previous?: ModuleReadoutState;
  revision?: number;
  tone?: ModuleReadoutTone;
}) {
  return (
    <div className={`module-readout is-${tone}`} aria-live="polite">
      <span className="module-readout-rail" aria-hidden="true">
        {previous ? (
          <span
            key={`previous-rail-${revision}`}
            className={`module-readout-rail-segment is-${previous.tone ?? "idle"} is-leaving`}
          />
        ) : null}
        <span
          key={`current-rail-${revision}`}
          className={`module-readout-rail-segment is-${tone} ${previous ? "is-entering" : ""}`}
        />
      </span>
      {previous ? (
        <div
          key={`previous-${revision}`}
          className="module-readout-line is-leaving"
          aria-hidden="true"
          inert
        >
          <span className="module-readout-label">{previous.label}</span>
          {previous.content}
        </div>
      ) : null}
      <div
        key={`current-${revision}`}
        className={`module-readout-line ${previous ? "is-entering" : ""}`}
      >
        <span className="module-readout-label">{label}</span>
        {children}
      </div>
    </div>
  );
}

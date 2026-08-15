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
  tone = "idle",
}: {
  children: ReactNode;
  label: ReactNode;
  tone?: ModuleReadoutTone;
}) {
  return (
    <div className={`module-readout is-${tone}`} aria-live="polite">
      <span className="module-readout-label">{label}</span>
      {children}
    </div>
  );
}

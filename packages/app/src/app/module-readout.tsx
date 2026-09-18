import { type AnimationEvent, type ReactNode, useState } from "react";

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
      <ModuleReadoutPresentation
        key={revision}
        label={label}
        previous={previous}
        tone={tone}
      >
        {children}
      </ModuleReadoutPresentation>
    </div>
  );
}

function ModuleReadoutPresentation({
  children,
  label,
  previous,
  tone,
}: {
  children: ReactNode;
  label: ReactNode;
  previous?: ModuleReadoutState;
  tone: ModuleReadoutTone;
}) {
  const [settled, setSettled] = useState(previous === undefined);
  const transitioning = previous !== undefined && !settled;
  const settle = (event: AnimationEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      event.animationName === "module-readout-slot-in"
    ) {
      setSettled(true);
    }
  };

  return (
    <>
      <span className="module-readout-rail" aria-hidden="true">
        {transitioning ? (
          <span
            className={`module-readout-rail-segment is-${previous.tone ?? "idle"} is-leaving`}
          />
        ) : null}
        <span
          className={`module-readout-rail-segment is-${tone} ${transitioning ? "is-entering" : ""}`}
        />
      </span>
      {transitioning ? (
        <div
          className="module-readout-line is-leaving"
          aria-hidden="true"
          inert
        >
          <span className="module-readout-label">{previous.label}</span>
          {previous.content}
        </div>
      ) : null}
      <div
        className={`module-readout-line ${transitioning ? "is-entering" : ""}`}
        onAnimationEnd={settle}
      >
        <span className="module-readout-label">{label}</span>
        {children}
      </div>
    </>
  );
}

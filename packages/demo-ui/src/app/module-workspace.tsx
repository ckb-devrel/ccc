"use client";

import type { ccc } from "@ckb-ccc/connector-react";
import { Circle, LockKeyhole } from "lucide-react";
import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { DemoLogger } from "./activity-console";
import { ModuleReadout, type ModuleReadoutState } from "./module-readout";
import type { DemoModule } from "./modules";

export const ModuleWorkspace = memo(function ModuleWorkspace({
  active,
  client,
  log,
  module,
  signer,
}: {
  active: boolean;
  client: ccc.Client;
  log: DemoLogger;
  module?: DemoModule;
  signer?: ccc.Signer;
}) {
  const Module = module?.component;
  const slotRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const workspace = workspaceRef.current;
    if (!slot || !workspace) return;

    const syncHeight = () => {
      slot.style.setProperty(
        "--module-workspace-height",
        `${workspace.getBoundingClientRect().height}px`,
      );
    };
    const observer = new ResizeObserver(syncHeight);
    syncHeight();
    observer.observe(workspace);

    return () => observer.disconnect();
  }, [module?.id]);

  return (
    <div
      ref={slotRef}
      className={`module-workspace-slot ${active ? "is-active" : ""}`}
      aria-hidden={!active}
    >
      {module && Module ? (
        <div className="workspace-reveal">
          <MountedModuleWorkspace
            key={module.id}
            client={client}
            log={log}
            module={module}
            signer={signer}
            workspaceRef={workspaceRef}
          />
        </div>
      ) : null}
    </div>
  );
});

function MountedModuleWorkspace({
  client,
  log,
  module,
  signer,
  workspaceRef,
}: {
  client: ccc.Client;
  log: DemoLogger;
  module: DemoModule;
  signer?: ccc.Signer;
  workspaceRef: React.RefObject<HTMLElement | null>;
}) {
  const Module = module.component;
  const ready = module.access === "local" || signer !== undefined;
  const moduleLog = useCallback(
    (message: string, level?: Parameters<DemoLogger>[2]) =>
      log(module.name.toUpperCase(), message, level),
    [log, module.name],
  );
  const [{ previousReadout, readout, revision }, setReadout] = useState<{
    previousReadout?: ModuleReadoutState;
    readout: ModuleReadoutState;
    revision: number;
  }>({
    readout: {
      label: "OUTPUT",
      tone: "idle",
      content: <strong className="is-empty">Awaiting module output</strong>,
    },
    revision: 0,
  });
  const show = useCallback((next: ModuleReadoutState) => {
    setReadout((current) => ({
      previousReadout: current.readout,
      readout: next,
      revision: current.revision + 1,
    }));
  }, []);

  return (
    <section
      ref={workspaceRef}
      className="module-workspace"
      aria-label={`${module.name} workspace`}
    >
      <div className="workspace-backdrop" aria-hidden="true">
        <span className="workspace-grid-orbit">
          <span className="workspace-grid-plane" />
        </span>
      </div>

      <div className="workspace-hardware" aria-hidden="true">
        <span>CORE/{module.id.toUpperCase()}</span>
        <span className="workspace-hardware-line" />
        <Circle size={7} />
      </div>

      <header className="workspace-header">
        {ready ? (
          <span className="workspace-header-glyph-viewport" aria-hidden="true">
            <span className="workspace-header-glyph">啟</span>
          </span>
        ) : null}
        <div>
          <span className="section-index">
            <span className="section-glyph" aria-hidden="true">
              {module.access === "signer" ? "參" : "貳"}
            </span>
            <span className="section-separator" aria-hidden="true">
              ·
            </span>
            <span>ACTIVE MODULE</span>
          </span>
          <h1>{module.name}</h1>
        </div>
        {!ready ? (
          <div className="workspace-state">
            <LockKeyhole size={14} />
            <span>SIGNER REQUIRED</span>
          </div>
        ) : null}
      </header>

      <div className="workspace-core">
        <Module client={client} log={moduleLog} show={show} signer={signer} />
        <ModuleReadout
          label={readout.label}
          previous={previousReadout}
          revision={revision}
          tone={readout.tone}
        >
          {readout.content}
        </ModuleReadout>
      </div>
    </section>
  );
}

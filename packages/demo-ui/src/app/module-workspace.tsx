"use client";

import type { ccc } from "@ckb-ccc/connector-react";
import { Circle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { DemoLogger } from "./activity-console";
import { ModuleReadout, type ModuleReadoutState } from "./module-readout";
import type { DemoModule } from "./modules";

export function ModuleWorkspace({
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

  return (
    <div
      className={`module-workspace-slot ${active ? "is-active" : ""}`}
      aria-hidden={!active}
    >
      {module && Module ? (
        <MountedModuleWorkspace
          key={module.id}
          client={client}
          log={log}
          module={module}
          signer={signer}
        />
      ) : null}
    </div>
  );
}

function MountedModuleWorkspace({
  client,
  log,
  module,
  signer,
}: {
  client: ccc.Client;
  log: DemoLogger;
  module: DemoModule;
  signer?: ccc.Signer;
}) {
  const Module = module.component;
  const ready = module.access === "local" || signer !== undefined;
  const [readout, show] = useState<ModuleReadoutState>({
    label: "OUTPUT",
    tone: "idle",
    content: <strong className="is-empty">Awaiting module output</strong>,
  });

  return (
    <section
      className="module-workspace"
      aria-label={`${module.name} workspace`}
    >
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
        <Module
          client={client}
          log={(message, level) =>
            log(module.name.toUpperCase(), message, level)
          }
          show={show}
          signer={signer}
        />
        <ModuleReadout label={readout.label} tone={readout.tone}>
          {readout.content}
        </ModuleReadout>
      </div>
    </section>
  );
}

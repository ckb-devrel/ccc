"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ArrowUpRight, Circle } from "lucide-react";
import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import type { DemoLogger } from "./activity-console";
import { ModuleReadout, type ModuleReadoutState } from "./module-readout";
import type { DemoModule, SubmitTransaction } from "./modules";
import { showTransaction } from "./modules/module-helpers";

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
  const submitTransaction = useCallback<SubmitTransaction>(
    async (actionName, action, options) => {
      if (!signer) throw new Error("Connect a signer first");
      const tx = await action(ccc.Transaction.from({}));
      await tx.completeFeeBy(signer, options?.feeRate);
      const txHash = await signer.sendTransaction(tx);
      moduleLog(`${actionName} sent: ${txHash}`);
      showTransaction(client, show, txHash, `${actionName} sent`);
      void signer.client
        .waitTransaction(txHash)
        .then(() => moduleLog(`${actionName} committed: ${txHash}`, "success"))
        .catch(() => undefined);
      return txHash;
    },
    [client, moduleLog, show, signer],
  );

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
        <span className="workspace-header-glyph-viewport" aria-hidden="true">
          <span className="workspace-header-glyph">啟</span>
        </span>
        <div className="workspace-title">
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
          <p className="workspace-description">{module.description}</p>
          {module.resources?.length ? (
            <nav
              className="workspace-resources"
              aria-label={`${module.name} resources`}
            >
              {module.resources.map((resource) => (
                <a
                  key={resource.href}
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>{resource.label}</span>
                  <ArrowUpRight size={11} />
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <div className="workspace-core">
        <Module
          client={client}
          log={moduleLog}
          show={show}
          signer={signer}
          submitTransaction={submitTransaction}
        />
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

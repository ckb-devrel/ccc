"use client";

import { ccc } from "@ckb-ccc/connector-react";
import { ArrowUpRight, Circle } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { DemoLogger } from "./activity-console";
import { ModuleReadout, type ModuleReadoutState } from "./module-readout";
import type { DemoModule, SubmitTransaction } from "./modules";
import { showTransaction } from "./modules/module-helpers";
import { useDecorativeAnimationVisibility } from "./use-decorative-animation-visibility";

type WorkspacePhase = "hidden" | "entering" | "active" | "exiting";
type ExitTarget = "hidden" | "unmounted";

type WorkspacePresentation = {
  exitTarget?: ExitTarget;
  module?: DemoModule;
  phase: WorkspacePhase;
  revision: number;
};

type WorkspacePresentationAction =
  | {
      type: "sync";
      module?: DemoModule;
      visible: boolean;
    }
  | {
      type: "complete";
      phase: "entering" | "exiting";
      revision: number;
    };

const WORKSPACE_TRANSITION_FALLBACK_MS = 700;

function updateWorkspacePresentation(
  state: WorkspacePresentation,
  action: WorkspacePresentationAction,
): WorkspacePresentation {
  if (action.type === "complete") {
    if (state.phase !== action.phase || state.revision !== action.revision) {
      return state;
    }

    if (action.phase === "entering") {
      return { ...state, phase: "active" };
    }

    return {
      module: state.exitTarget === "unmounted" ? undefined : state.module,
      phase: "hidden",
      revision: state.revision,
    };
  }

  const sameModule = state.module?.id === action.module?.id;
  if (!action.module) {
    if (!state.module) {
      return state;
    }
    if (state.phase === "hidden") {
      return {
        module: undefined,
        phase: "hidden",
        revision: state.revision + 1,
      };
    }
    if (state.phase === "exiting" && state.exitTarget === "unmounted") {
      return state;
    }

    return {
      ...state,
      exitTarget: "unmounted",
      phase: "exiting",
      revision: state.revision + 1,
    };
  }

  if (!sameModule) {
    return {
      module: action.module,
      phase: action.visible ? "entering" : "hidden",
      revision: state.revision + 1,
    };
  }

  if (action.visible) {
    if (state.phase === "entering" || state.phase === "active") {
      return state;
    }

    return {
      ...state,
      exitTarget: undefined,
      phase: "entering",
      revision: state.revision + 1,
    };
  }

  if (
    state.phase === "hidden" ||
    (state.phase === "exiting" && state.exitTarget === "hidden")
  ) {
    return state;
  }

  return {
    ...state,
    exitTarget: "hidden",
    phase: "exiting",
    revision: state.revision + 1,
  };
}

export const ModuleWorkspace = memo(function ModuleWorkspace({
  client,
  log,
  module,
  setClient,
  signer,
  visible,
  wallet,
}: {
  client: ccc.Client;
  log: DemoLogger;
  module?: DemoModule;
  setClient: (owner: ccc.Owner<ccc.Client>) => unknown;
  signer?: ccc.Signer;
  visible: boolean;
  wallet?: ccc.Wallet;
}) {
  const slotRef = useRef<HTMLDivElement>(null);
  useDecorativeAnimationVisibility(slotRef);
  const [presentation, dispatchPresentation] = useReducer(
    updateWorkspacePresentation,
    {
      phase: "hidden",
      revision: 0,
    },
  );

  useEffect(() => {
    dispatchPresentation({ type: "sync", module, visible });
  }, [module, visible]);

  useEffect(() => {
    if (presentation.phase !== "entering" && presentation.phase !== "exiting") {
      return;
    }

    const phase = presentation.phase;
    const revision = presentation.revision;
    const timer = setTimeout(() => {
      dispatchPresentation({ type: "complete", phase, revision });
    }, WORKSPACE_TRANSITION_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [presentation.phase, presentation.revision]);

  const interactive =
    presentation.phase === "entering" || presentation.phase === "active";
  const presentedModule = presentation.module;
  const Module = presentedModule?.component;

  return (
    <div
      ref={slotRef}
      className="module-workspace-slot"
      data-phase={presentation.phase}
      aria-hidden={!interactive}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        const phase = presentation.phase;
        if (phase !== "entering" && phase !== "exiting") {
          return;
        }
        const expectedAnimation =
          phase === "entering"
            ? "workspace-layout-enter"
            : "workspace-layout-exit";
        if (event.animationName !== expectedAnimation) {
          return;
        }

        dispatchPresentation({
          type: "complete",
          phase,
          revision: presentation.revision,
        });
      }}
    >
      {presentedModule && Module ? (
        <div className="workspace-layout-clip">
          <MountedModuleWorkspace
            key={presentedModule.id}
            client={client}
            log={log}
            module={presentedModule}
            setClient={setClient}
            signer={signer}
            wallet={wallet}
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
  setClient,
  signer,
  wallet,
}: {
  client: ccc.Client;
  log: DemoLogger;
  module: DemoModule;
  setClient: (owner: ccc.Owner<ccc.Client>) => unknown;
  signer?: ccc.Signer;
  wallet?: ccc.Wallet;
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
          <span className="workspace-header-glyph">
            {module.id === "khie" ? "契" : "啟"}
          </span>
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
          setClient={setClient}
          show={show}
          signer={signer}
          submitTransaction={submitTransaction}
          wallet={wallet}
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

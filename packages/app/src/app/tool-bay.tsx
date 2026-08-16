"use client";

import { Activity, Check, ChevronRight, Eject } from "lucide-react";
import { memo, useLayoutEffect, useRef, type CSSProperties } from "react";
import { demoModules, type DemoModule } from "./modules";

export const ToolBay = memo(function ToolBay({
  connected,
  onClear,
  onSelect,
  selectedModule,
}: {
  connected: boolean;
  onClear: () => void;
  onSelect: (module: DemoModule) => void;
  selectedModule?: DemoModule;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const gridViewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const viewport = gridViewportRef.current;
    if (!grid || !viewport) {
      return;
    }

    const syncHeight = () => {
      viewport.style.setProperty(
        "--tool-grid-height",
        `${grid.scrollHeight}px`,
      );
    };
    const observer = new ResizeObserver(syncHeight);
    syncHeight();
    observer.observe(grid);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="tool-bay">
      <div className="bay-rail bay-rail-left" aria-hidden="true" />
      <div className="bay-rail bay-rail-right" aria-hidden="true" />

      <div className="tool-bay-header">
        <div>
          <div className="tool-bay-meta">
            <span className="section-index">
              <span className="section-glyph" aria-hidden="true">
                壹
              </span>
              <span className="section-separator" aria-hidden="true">
                ·
              </span>
              <span>TOOL MATRIX</span>
            </span>
            <div className="bay-status">
              <Activity size={14} />
              <span>{demoModules.length} MODULES READY</span>
            </div>
          </div>
          <h2>
            {selectedModule ? "Operation selected" : "What do you want to do?"}
          </h2>
        </div>
      </div>

      <div className="tool-matrix-stack">
        <div
          ref={gridViewportRef}
          className="tool-grid-viewport"
          aria-hidden={selectedModule !== undefined}
        >
          <div ref={gridRef} className="tool-grid">
            {demoModules.map((module, index) => {
              const { access, group, icon: ModuleIcon, name } = module;
              const selected = selectedModule === module;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={selectedModule !== undefined}
                  className={`tool-module ${selected ? "is-selected" : ""}`}
                  style={{ "--module-index": index } as CSSProperties}
                  onClick={() => onSelect(module)}
                >
                  <span className="module-index">
                    {String(index + 1).padStart(2, "0")}-
                    {access === "local" ? "L" : "S"}
                  </span>
                  <span
                    className={`module-icon ${access === "signer" ? "requires-signer" : "is-local"}`}
                  >
                    <ModuleIcon size={19} />
                  </span>
                  <span className="module-copy">
                    <small>{group}</small>
                    <strong>{name}</strong>
                  </span>
                  <span className="module-state">
                    {selected ? (
                      <Check size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className={`command-dock ${selectedModule ? "is-mounted" : ""}`}
          disabled={!selectedModule}
          aria-label={
            selectedModule ? "Change operation" : "Select an operation"
          }
          onClick={onClear}
        >
          <span
            className={`dock-grip ${selectedModule ? "is-eject" : ""}`}
            aria-hidden="true"
          >
            {selectedModule ? (
              <Eject size={20} />
            ) : (
              <>
                <span />
                <span />
                <span />
              </>
            )}
          </span>
          <span className="dock-selection">
            <small>
              {selectedModule ? "CHANGE OPERATION" : "SELECT A MODULE"}
            </small>
            <strong>{selectedModule?.name ?? "No operation selected"}</strong>
            <span className="dock-checks">
              <span className={selectedModule ? "is-ready" : ""}>
                <Check size={12} /> {selectedModule ? "Mounted" : "Slot empty"}
              </span>
              <span
                className={
                  selectedModule?.access === "local" || connected
                    ? "is-ready"
                    : ""
                }
              >
                <Check size={12} />
                {selectedModule?.access === "local" ? "Local" : "Signer"}
              </span>
            </span>
          </span>
        </button>
      </div>
    </section>
  );
});

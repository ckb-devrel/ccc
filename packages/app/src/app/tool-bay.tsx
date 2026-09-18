"use client";

import { Activity, Check, ChevronRight, Eject } from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { demoModules, type DemoModule } from "./modules";
import { useDecorativeAnimationVisibility } from "./use-decorative-animation-visibility";

const TOOL_GRID_COLLAPSE_FALLBACK_MS = 700;

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
  const toolBayRef = useRef<HTMLElement>(null);
  const [gridCollapseSettled, setGridCollapseSettled] = useState(false);
  useDecorativeAnimationVisibility(toolBayRef);

  useEffect(() => {
    if (!selectedModule) {
      setGridCollapseSettled(false);
      return;
    }

    // Preserve the clipped height transition, then stop painting its hidden cards.
    const timer = setTimeout(
      () => setGridCollapseSettled(true),
      TOOL_GRID_COLLAPSE_FALLBACK_MS,
    );
    return () => clearTimeout(timer);
  }, [selectedModule]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const viewport = gridViewportRef.current;
    if (!grid || !viewport) {
      return;
    }

    let previousHeight: number | undefined;
    const syncHeight = () => {
      const height = grid.scrollHeight;
      if (height === previousHeight) {
        return;
      }

      previousHeight = height;
      viewport.style.setProperty("--tool-grid-height", `${height}px`);
    };
    const observer = new ResizeObserver(syncHeight);
    syncHeight();
    observer.observe(grid);

    return () => observer.disconnect();
  }, []);

  const MountedIcon = selectedModule?.icon;

  return (
    <section ref={toolBayRef} className="tool-bay">
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
          <h2>{selectedModule ? "Module mounted" : "What’s your move?"}</h2>
        </div>
      </div>

      <div className="tool-matrix-stack">
        <div
          ref={gridViewportRef}
          className={`tool-grid-viewport ${selectedModule && gridCollapseSettled ? "is-collapse-settled" : ""}`}
          aria-hidden={selectedModule !== undefined}
          onTransitionEnd={(event) => {
            if (
              selectedModule &&
              event.target === event.currentTarget &&
              event.propertyName === "height"
            ) {
              setGridCollapseSettled(true);
            }
          }}
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
          <span className="dock-grip" aria-hidden="true">
            {MountedIcon ? (
              <MountedIcon size={20} />
            ) : (
              <>
                <span />
                <span />
                <span />
              </>
            )}
          </span>
          <span className="dock-selection">
            <strong>{selectedModule?.name ?? "Select a module"}</strong>
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
          {selectedModule ? (
            <span className="dock-eject" aria-hidden="true">
              <Eject size={20} />
              <small>EJECT</small>
            </span>
          ) : null}
        </button>
      </div>
    </section>
  );
});

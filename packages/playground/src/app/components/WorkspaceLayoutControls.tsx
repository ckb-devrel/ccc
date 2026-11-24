import { PanelBottomClose } from "lucide-react";
import type { WorkspacePane } from "../hooks/useWorkspaceLayout";

export function WorkspaceLayoutControls({
  focused,
  onFocusChange,
}: {
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <div className="layout-controls">
      <button
        type="button"
        className={focused ? "tools-reveal" : "control-button tools-toggle"}
        aria-label={focused ? "Show tools" : "Hide tools"}
        aria-expanded={!focused}
        aria-controls="workspace-tools"
        onClick={() => onFocusChange(!focused)}
        title={
          focused ? undefined : "Hide secondary tools to enlarge the workspace"
        }
      >
        {focused ? (
          <span aria-hidden="true" />
        ) : (
          <>
            <PanelBottomClose size={16} aria-hidden="true" />
            Hide tools
          </>
        )}
      </button>
    </div>
  );
}

export function MobileWorkspaceTabs({
  pane,
  onPaneChange,
}: {
  pane: WorkspacePane;
  onPaneChange: (pane: WorkspacePane) => void;
}) {
  return (
    <div className="mobile-tabs" role="group" aria-label="Workspace view">
      <button
        type="button"
        aria-pressed={pane === "code"}
        onClick={() => onPaneChange("code")}
      >
        01 / Code
      </button>
      <button
        type="button"
        aria-pressed={pane === "output"}
        onClick={() => onPaneChange("output")}
      >
        02 / Output
      </button>
    </div>
  );
}

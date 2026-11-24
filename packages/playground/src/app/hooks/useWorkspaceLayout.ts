import { useEffect, useState } from "react";

export type WorkspacePane = "code" | "output";
export const MIN_EDITOR_SPLIT = 20;
export const MAX_EDITOR_SPLIT = 80;
export const DEFAULT_EDITOR_SPLIT = 50;
export const WORKSPACE_LAYOUT_STORAGE_KEY = "playgroundLayout";

export function clampEditorSplit(value: number): number {
  return Math.max(MIN_EDITOR_SPLIT, Math.min(MAX_EDITOR_SPLIT, value));
}

export type WorkspaceLayoutPreference = {
  split: number;
  focus: boolean;
  view: "split";
  mobilePane: WorkspacePane;
};

/** Treat persisted data as untrusted and keep the result limited to layout fields. */
export function parseWorkspaceLayout(
  input: unknown,
): WorkspaceLayoutPreference {
  const defaults: WorkspaceLayoutPreference = {
    split: DEFAULT_EDITOR_SPLIT,
    focus: false,
    view: "split",
    mobilePane: "code",
  };
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return defaults;
  }
  const value = input as Record<string, unknown>;
  return {
    split:
      typeof value.split === "number" && Number.isFinite(value.split)
        ? clampEditorSplit(value.split)
        : defaults.split,
    focus: value.focus === true,
    // Legacy desktop "code" / "output" preferences no longer hide a pane.
    view: "split",
    mobilePane: value.mobilePane === "output" ? "output" : "code",
  };
}

export function readWorkspaceLayout(
  storage: Pick<Storage, "getItem">,
): WorkspaceLayoutPreference {
  try {
    return parseWorkspaceLayout(
      JSON.parse(storage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY) ?? "null"),
    );
  } catch {
    return parseWorkspaceLayout(null);
  }
}

export function writeWorkspaceLayout(
  storage: Pick<Storage, "setItem">,
  preferences: WorkspaceLayoutPreference,
): void {
  try {
    storage.setItem(
      WORKSPACE_LAYOUT_STORAGE_KEY,
      JSON.stringify(parseWorkspaceLayout(preferences)),
    );
  } catch {
    // Private browsing and quota limits must not prevent use of the workspace.
  }
}

/** Layout preferences never read or modify the user's source-code draft. */
export function useWorkspaceLayout() {
  const [mobilePane, setMobilePane] = useState<WorkspacePane>("code");
  const [split, setSplit] = useState(DEFAULT_EDITOR_SPLIT);
  const [focusWorkspace, setFocusWorkspace] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore browser-only preferences after hydration so server/client markup matches.
  // This one-time synchronization intentionally updates local React state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = readWorkspaceLayout(localStorage);
      setSplit(saved.split);
      setFocusWorkspace(saved.focus);
      setMobilePane(saved.mobilePane);
    } catch {
      // Private browsing or invalid saved preferences must not block editing.
    }
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) {
      return;
    }
    try {
      writeWorkspaceLayout(localStorage, {
        split,
        focus: focusWorkspace,
        view: "split",
        mobilePane,
      });
    } catch {
      // Persistence is optional; the current session remains fully usable.
    }
  }, [split, focusWorkspace, mobilePane, ready]);

  return {
    mobilePane,
    setMobilePane,
    split,
    setSplit,
    focusWorkspace,
    setFocusWorkspace,
  };
}

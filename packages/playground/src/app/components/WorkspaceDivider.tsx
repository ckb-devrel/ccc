import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  clampEditorSplit,
  DEFAULT_EDITOR_SPLIT,
  MAX_EDITOR_SPLIT,
  MIN_EDITOR_SPLIT,
} from "../hooks/useWorkspaceLayout";

export function WorkspaceDivider({
  split,
  onSplitChange,
  panesRef,
}: {
  split: number;
  onSplitChange: Dispatch<SetStateAction<number>>;
  panesRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="pane-divider"
      role="separator"
      aria-label="Resize editor and output"
      aria-orientation="vertical"
      aria-valuenow={Math.round(split)}
      aria-valuetext={`${Math.round(split)}% editor, ${Math.round(100 - split)}% output`}
      aria-valuemin={MIN_EDITOR_SPLIT}
      aria-valuemax={MAX_EDITOR_SPLIT}
      tabIndex={0}
      onKeyDown={(event) => {
        if (["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
          event.preventDefault();
          onSplitChange((value) =>
            event.key === "Home"
              ? DEFAULT_EDITOR_SPLIT
              : clampEditorSplit(value + (event.key === "ArrowLeft" ? -2 : 2)),
          );
        }
      }}
      onPointerDown={(event) =>
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      onDoubleClick={() => onSplitChange(DEFAULT_EDITOR_SPLIT)}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          return;
        }
        const bounds = panesRef.current?.getBoundingClientRect();
        if (bounds && bounds.width > 0) {
          onSplitChange(
            clampEditorSplit(
              ((event.clientX - bounds.left) / bounds.width) * 100,
            ),
          );
        }
      }}
    >
      <span />
    </div>
  );
}

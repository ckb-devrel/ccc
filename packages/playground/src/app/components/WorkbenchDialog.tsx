import { Check, Copy, FolderOpen, LoaderCircle, Radio, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { RepositoryExamples } from "./RepositoryExamples";

export type WorkbenchDialogKind = "load" | "share" | "examples";

interface WorkbenchDialogProps {
  dialog: WorkbenchDialogKind | undefined;
  isLoading: boolean;
  isSharing: boolean;
  notice: string;
  shareUrl: string;
  hasShareAttempt: boolean;
  copied: boolean;
  onDismiss: () => void;
  onClose: () => void;
  onImport: (reference: string, kind: "url" | "example") => void;
  onRestoreDraft: () => void;
  onCopyLink: () => void;
  onPublishOrVerify: () => void;
  onPublishNew: () => void;
}

export function WorkbenchDialog({
  dialog,
  isLoading,
  isSharing,
  notice,
  shareUrl,
  hasShareAttempt,
  copied,
  onDismiss,
  onClose,
  onImport,
  onRestoreDraft,
  onCopyLink,
  onPublishOrVerify,
  onPublishNew,
}: WorkbenchDialogProps) {
  const [loadValue, setLoadValue] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Keep the dialog mounted so the browser handles modal focus and Escape.
  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [dialog]);

  return (
    <dialog
      ref={dialogRef}
      className={
        dialog === "examples"
          ? "workbench-dialog workbench-dialog--examples"
          : "workbench-dialog"
      }
      aria-label={
        dialog === "load"
          ? "Load source"
          : dialog === "share"
            ? "Share source"
            : "Choose example"
      }
      onCancel={(event) => {
        if (isSharing) {
          event.preventDefault();
          return;
        }
        onDismiss();
      }}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <span className="eyebrow">
          {dialog === "load"
            ? "IMPORT SOURCE"
            : dialog === "share"
              ? "PUBLISH SOURCE"
              : "EXAMPLE SCRIPTS"}
        </span>
        <Button
          aria-label="Close dialog"
          disabled={isSharing}
          onClick={onDismiss}
        >
          <X size={18} />
        </Button>
      </div>
      {dialog === "load" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onImport(loadValue.trim(), "url");
          }}
        >
          <h2>Bring your own code.</h2>
          <p>
            Load a raw HTTP(S) URL or a <code>nostr:nevent…</code> reference.
            Code is loaded, never automatically executed.
          </p>
          <label htmlFor="source-url">Source URL</label>
          <input
            id="source-url"
            required
            value={loadValue}
            onChange={(e) => setLoadValue(e.target.value)}
            placeholder="https://…/example.ts"
            autoFocus
          />
          <div className="dialog-actions">
            <Button type="button" disabled={isLoading} onClick={onRestoreDraft}>
              Restore local draft
            </Button>
            <Button className="primary" disabled={isLoading} type="submit">
              {isLoading ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <FolderOpen size={16} />
              )}
              Load source
            </Button>
          </div>
          {notice && <p role="status">{notice}</p>}
        </form>
      )}
      {dialog === "examples" && (
        <div className="example-dialog-content">
          <h2>Start with something small.</h2>
          <p>
            Every example is editable. Build up a transaction, inspect it, then
            make it your own.
          </p>
          <RepositoryExamples
            isLoading={isLoading}
            onLoad={(sourceUrl) => void onImport(sourceUrl, "example")}
          />
          {notice && <p role="status">{notice}</p>}
          <p className="muted">
            Use <code>await render(value)</code> to create a visual checkpoint.
            Step pauses at each checkpoint.
          </p>
        </div>
      )}
      {dialog === "share" && (
        <>
          <h2>A link to your experiment.</h2>
          <p>
            Publish the current code to public Nostr relays. Do not include
            private keys or secrets. Relay storage is not guaranteed to be
            permanent.
          </p>
          {shareUrl ? (
            <>
              <label htmlFor="share-url">Verified share link</label>
              <input id="share-url" readOnly value={shareUrl} />
              <Button className="primary" onClick={onCopyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </>
          ) : (
            <Button
              className="primary"
              disabled={isSharing}
              onClick={onPublishOrVerify}
            >
              {isSharing ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Radio size={16} />
              )}{" "}
              {isSharing
                ? "Verifying share…"
                : hasShareAttempt
                  ? "Retry verification"
                  : "Publish to Nostr"}
            </Button>
          )}
          {hasShareAttempt && !shareUrl && (
            <p className="muted">
              Retry verification checks the previously published snapshot
              without publishing again.
              <Button disabled={isSharing} onClick={onPublishNew}>
                Publish current code as a new share
              </Button>
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
        </>
      )}
    </dialog>
  );
}

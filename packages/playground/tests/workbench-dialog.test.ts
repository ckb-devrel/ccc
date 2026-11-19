import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchDialog } from "../src/app/components/WorkbenchDialog";

function render(props: Partial<ComponentProps<typeof WorkbenchDialog>> = {}) {
  return renderToStaticMarkup(
    createElement(WorkbenchDialog, {
      dialog: undefined,
      isLoading: false,
      isSharing: false,
      notice: "",
      shareUrl: "",
      hasShareAttempt: false,
      copied: false,
      onDismiss: vi.fn(),
      onClose: vi.fn(),
      onImport: vi.fn(),
      onRestoreDraft: vi.fn(),
      onCopyLink: vi.fn(),
      onPublishOrVerify: vi.fn(),
      onPublishNew: vi.fn(),
      ...props,
    }),
  );
}

describe("workbench source dialogs", () => {
  it("keeps the native dialog mounted without an open attribute", () => {
    const html = render();
    expect(html).toMatch(/^<dialog class="workbench-dialog"/);
    expect(html).not.toMatch(/<dialog[^>]*\bopen[\s=>]/);
    expect(html).not.toContain("Bring your own code.");
  });

  it("labels the load form and keeps it cancellable while loading", () => {
    const html = render({
      dialog: "load",
      isLoading: true,
      notice: "Could not load source.",
    });
    expect(html).toContain('aria-label="Load source"');
    expect(html).toContain('<label for="source-url">Source URL</label>');
    expect(html).toMatch(/<input id="source-url"[^>]*required=""/);
    expect(html).toMatch(
      /<button disabled=""[^>]*>Restore local draft<\/button>/,
    );
    expect(html).toMatch(/<button disabled="" type="submit"/);
    expect(html).not.toContain('aria-label="Close dialog" disabled=""');
    expect(html).toContain('<p role="status">Could not load source.</p>');
  });

  it("renders the repository picker in the wider examples dialog", () => {
    const html = render({ dialog: "examples" });
    expect(html).toContain("workbench-dialog workbench-dialog--examples");
    expect(html).toContain('aria-label="Choose example"');
    expect(html).toContain("Start with something small.");
    expect(html).not.toContain('id="source-url"');
  });

  it("distinguishes publish, retry, verification in progress, and copy", () => {
    expect(render({ dialog: "share" })).toContain("Publish to Nostr");
    const retry = render({ dialog: "share", hasShareAttempt: true });
    expect(retry).toContain("Retry verification");
    expect(retry).toContain("Publish current code as a new share");

    const verifying = render({
      dialog: "share",
      hasShareAttempt: true,
      isSharing: true,
    });
    expect(verifying).toContain("Verifying share…");
    expect(verifying).toContain('aria-label="Close dialog" disabled=""');

    const verified = render({
      dialog: "share",
      hasShareAttempt: true,
      shareUrl: "https://example.com/?src=nostr%3Aevent",
      copied: true,
    });
    expect(verified).toContain("Verified share link");
    expect(verified).toMatch(/<input id="share-url"[^>]*readonly=""/i);
    expect(verified).toContain("Copied");
    expect(verified).not.toContain("Retry verification");
  });
});

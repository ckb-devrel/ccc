import { DEFAULT_TRANSFER } from "./examples";

const DRAFT_KEY = "playgroundSourceCode";
const normalizeEditorText = (text: string) =>
  text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
const REPLACE_PROMPT =
  "Replace the editor contents? Download a copy first if you need to keep them.";
const IMPORT_PROMPTS = {
  url: "Load this source into the editor? Your saved local draft will be kept.",
  example:
    "Load this repository example into the editor? Your saved local draft will be kept.",
};

type SourceOrigin =
  | { kind: "unsaved" }
  | { kind: "draft" }
  | { kind: "remote"; reference: string };

export type SourceDocument = {
  text: string;
  origin: SourceOrigin;
  loading: boolean;
  savedDraft?: string;
  notice: string;
};

export const INITIAL_SOURCE_DOCUMENT: SourceDocument = {
  text: DEFAULT_TRANSFER,
  origin: { kind: "unsaved" },
  loading: false,
  notice: "",
};

type SourceEnvironment = {
  storage: () => Pick<Storage, "getItem" | "setItem">;
  location: () => URL;
  pushHistory: (url: URL) => void;
  confirm: (prompt: string) => boolean;
  readRemote: (reference: string) => Promise<string | undefined>;
  isExecuting: () => boolean;
  onOpened: () => void;
};

export function sourceOriginLabel(origin: SourceOrigin): string {
  switch (origin.kind) {
    case "unsaved":
      return "Unsaved source";
    case "draft":
      return "Local draft";
    case "remote":
      return origin.reference;
  }
}

/** One document per workbench. Async imports can only commit while current. */
export function createSourceDocument(
  environment: SourceEnvironment,
  publish: (document: SourceDocument) => void,
) {
  let current = INITIAL_SOURCE_DOCUMENT;
  let generation = 0;
  let hydrated = false;
  let restorePending = false;

  function update(patch: Partial<SourceDocument>) {
    current = { ...current, ...patch };
    publish(current);
  }

  function readDraft() {
    return environment.storage().getItem(DRAFT_KEY) ?? DEFAULT_TRANSFER;
  }

  function open(text: string, origin: SourceOrigin, notice = "") {
    update({ text, origin, notice, loading: false });
    environment.onOpened();
  }

  async function load(reference: string, commitHistory: boolean) {
    const request = ++generation;
    update({ loading: true, notice: "" });
    try {
      const text = await environment.readRemote(reference);
      if (text === undefined) {
        throw new Error("No source was returned");
      }
      if (request !== generation) {
        return;
      }
      if (commitHistory) {
        const url = environment.location();
        url.searchParams.set("src", reference);
        environment.pushHistory(url);
      }
      open(
        text,
        { kind: "remote", reference },
        "Source loaded. Review the code before running it.",
      );
    } catch (error) {
      if (request === generation) {
        update({
          notice: `Could not load source: ${String(error)}`,
          loading: false,
        });
      }
    }
  }

  function restoreHistory(): Promise<void> | undefined {
    if (environment.isExecuting()) {
      restorePending = true;
      return;
    }
    restorePending = false;
    ++generation;
    const reference = environment.location().searchParams.get("src");
    if (reference) {
      // Keep the saved draft visible during initial import, including failure.
      if (!hydrated) {
        hydrated = true;
        try {
          update({ text: readDraft(), origin: { kind: "draft" } });
        } catch {
          update({ origin: { kind: "unsaved" } });
        }
      }
      return load(reference, false);
    }
    hydrated = true;
    try {
      update({
        text: readDraft(),
        origin: { kind: "draft" },
        notice: "",
        loading: false,
      });
    } catch {
      update({
        notice:
          "Local storage is unavailable. Download your code to keep a copy.",
        loading: false,
      });
    }
  }

  return {
    getDocument: () => current,
    executionSource(
      visibleText: string,
      visibleLoading: boolean,
      editorText: string | undefined,
    ) {
      // An import can settle before React commits the new editor value.
      // Monaco can also apply the committed value in a later effect, and it
      // normalizes line endings and stores an initial BOM outside its value.
      if (
        visibleLoading ||
        current.loading ||
        current.text !== visibleText ||
        editorText === undefined ||
        normalizeEditorText(editorText) !== normalizeEditorText(visibleText)
      ) {
        return undefined;
      }
      return visibleText;
    },
    edit(text: string) {
      update({ text });
    },
    setNotice(notice: string) {
      update({ notice });
    },
    importSource(reference: string, kind: keyof typeof IMPORT_PROMPTS) {
      if (!current.loading && environment.confirm(IMPORT_PROMPTS[kind])) {
        return load(reference, true);
      }
    },
    restoreDraft() {
      try {
        const text = readDraft();
        if (current.text !== text && !environment.confirm(REPLACE_PROMPT)) {
          return;
        }
        ++generation;
        const url = environment.location();
        url.searchParams.delete("src");
        environment.pushHistory(url);
        open(text, { kind: "draft" });
      } catch {
        update({ notice: "Could not restore the local draft." });
      }
    },
    restoreHistory,
    flushHistory() {
      if (restorePending) {
        return restoreHistory();
      }
    },
    persistDraft(text: string, origin: SourceOrigin) {
      if (
        origin.kind !== "draft" ||
        current.origin.kind !== "draft" ||
        current.text !== text
      ) {
        return;
      }
      let savedDraft: string | undefined;
      try {
        environment.storage().setItem(DRAFT_KEY, text);
        savedDraft = text;
      } catch {
        savedDraft = undefined;
      }
      if (savedDraft !== current.savedDraft) {
        update({ savedDraft });
      }
    },
    cancelLoad() {
      ++generation;
      update({ loading: false });
    },
    dispose() {
      ++generation;
      restorePending = false;
    },
  };
}

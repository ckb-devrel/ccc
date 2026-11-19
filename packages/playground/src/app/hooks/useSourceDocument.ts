import { useEffect, useState } from "react";
import { DEFAULT_NOSTR_RELAYS, getFromNEvent } from "../nostr";
import {
  createSourceDocument,
  INITIAL_SOURCE_DOCUMENT,
} from "../sourceDocument";

async function readRemote(reference: string) {
  if (reference.startsWith("nostr:")) {
    return getFromNEvent(DEFAULT_NOSTR_RELAYS, reference.slice(6));
  }
  const url = new URL(reference);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Use an HTTP(S) source URL or nostr:nevent…");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`Source returned HTTP ${response.status}`);
  }
  return response.text();
}

export function useSourceDocument(
  isExecuting: () => boolean,
  onOpened: () => void,
) {
  const [current, setDocument] = useState(INITIAL_SOURCE_DOCUMENT);
  const [source] = useState(() =>
    createSourceDocument(
      {
        storage: () => window.localStorage,
        location: () => new URL(window.location.href),
        pushHistory: (url) => window.history.pushState({}, "", url),
        confirm: (prompt) => window.confirm(prompt),
        readRemote,
        isExecuting,
        onOpened,
      },
      setDocument,
    ),
  );

  useEffect(() => {
    const restore = () => void source.restoreHistory();
    restore();
    window.addEventListener("popstate", restore);
    return () => {
      source.dispose();
      window.removeEventListener("popstate", restore);
    };
  }, [source]);

  const { text, origin } = current;
  useEffect(() => {
    source.persistDraft(text, origin);
    // Persistence is keyed by the committed source and origin, not notices or
    // the result of the previous save.
  }, [source, text, origin]);

  return [current, source] as const;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MODULE_ITEM_PAGE_SIZE = 16;

type BufferedItem<T> = { value: T };

export function usePagedModuleItems<Source, Raw, Item = Raw>({
  iterate,
  onError,
  preparePage,
  revision = 0,
  source,
}: {
  iterate: (source: Source) => AsyncGenerator<Raw>;
  onError: (cause: unknown) => void;
  preparePage?: (items: Raw[], source: Source) => Promise<Item[]>;
  revision?: number;
  source?: Source;
}) {
  const callbacks = useRef({ iterate, onError, preparePage });
  const iterator = useRef<AsyncGenerator<Raw> | undefined>(undefined);
  const buffered = useRef<BufferedItem<Raw> | undefined>(undefined);
  const generation = useRef(0);
  const loadingRef = useRef(false);
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    callbacks.current = { iterate, onError, preparePage };
  }, [iterate, onError, preparePage]);

  const readPage = useCallback(
    async (
      activeSource: Source,
      activeIterator: AsyncGenerator<Raw>,
      activeGeneration: number,
      append: boolean,
    ) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const raw: Raw[] = [];
        if (buffered.current) {
          raw.push(buffered.current.value);
          buffered.current = undefined;
        }
        while (raw.length < MODULE_ITEM_PAGE_SIZE + 1) {
          const next = await activeIterator.next();
          if (next.done) break;
          raw.push(next.value);
        }
        if (generation.current !== activeGeneration) return;

        buffered.current =
          raw.length > MODULE_ITEM_PAGE_SIZE
            ? { value: raw[MODULE_ITEM_PAGE_SIZE] as Raw }
            : undefined;
        const page = raw.slice(0, MODULE_ITEM_PAGE_SIZE);
        const prepared = callbacks.current.preparePage
          ? await callbacks.current.preparePage(page, activeSource)
          : (page as unknown as Item[]);
        if (generation.current !== activeGeneration) return;
        setItems((current) => (append ? [...current, ...prepared] : prepared));
        setHasMore(buffered.current !== undefined);
      } catch (cause) {
        if (generation.current === activeGeneration) {
          setHasMore(false);
          callbacks.current.onError(cause);
        }
      } finally {
        if (generation.current === activeGeneration) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const activeGeneration = ++generation.current;
    const previous = iterator.current;
    iterator.current = undefined;
    buffered.current = undefined;
    loadingRef.current = false;
    if (previous) void previous.return(undefined);

    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled || generation.current !== activeGeneration) return;
      setItems([]);
      setHasMore(false);
      setLoading(false);
      if (source === undefined) return;
      const activeIterator = callbacks.current.iterate(source);
      iterator.current = activeIterator;
      await readPage(source, activeIterator, activeGeneration, false);
    })();

    return () => {
      cancelled = true;
      if (iterator.current) void iterator.current.return(undefined);
      iterator.current = undefined;
    };
  }, [readPage, revision, source]);

  const loadMore = () => {
    const activeIterator = iterator.current;
    if (
      source === undefined ||
      !activeIterator ||
      !buffered.current ||
      loadingRef.current
    ) {
      return;
    }
    void readPage(source, activeIterator, generation.current, true);
  };

  return { hasMore, items, loadMore, loading };
}

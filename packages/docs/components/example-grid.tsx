"use client";

import { ExternalLink, Play, Code, Server, Coins, Sprout, Search, Wallet, AppWindow, Wrench } from "lucide-react";
import { useState, useMemo } from "react";
import { getDictionary } from "@/lib/dictionary";

export interface ExampleItem {
  title: string;
  description: string;
  href: string;
  tags: string[];
  source?: string;
}

const TAG_ICONS: Record<string, React.ReactNode> = {
  playground: <Play className="size-3" />,
  transaction: <Coins className="size-3" />,
  wallet: <Wallet className="size-3" />,
  query: <Search className="size-3" />,
  backend: <Server className="size-3" />,
  spore: <Sprout className="size-3" />,
  udt: <Coins className="size-3" />,
  app: <AppWindow className="size-3" />,
  tool: <Wrench className="size-3" />,
};

const TAG_COLORS: Record<string, string> = {
  playground: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  transaction: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  wallet: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  query: "bg-green-500/15 text-green-700 dark:text-green-300",
  backend: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  spore: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  udt: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  app: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  tool: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
};

function TagBadge({ tag, active, onClick }: { tag: string; active: boolean; onClick?: () => void }) {
  const color = TAG_COLORS[tag] ?? "bg-fd-muted text-fd-muted-foreground";
  const icon = TAG_ICONS[tag];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${color} ${active ? "ring-2 ring-fd-primary ring-offset-1" : "opacity-70 hover:opacity-100"}`}
    >
      {icon}
      {tag}
    </button>
  );
}

export function ExampleGrid({ items, lang = "en" }: { items: ExampleItem[]; lang?: string }) {
  const t = getDictionary(lang).examples;
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => item.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeTags.size === 0) return items;
    return items.filter((item) => item.tags.some((t) => activeTags.has(t)));
  }, [items, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Tag filter bar */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTags(new Set())}
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all ${activeTags.size === 0 ? "bg-fd-primary text-fd-primary-foreground" : "bg-fd-muted text-fd-muted-foreground hover:opacity-80"}`}
        >
          {t.all}
        </button>
        {allTags.map((tag) => (
          <TagBadge
            key={tag}
            tag={tag}
            active={activeTags.has(tag)}
            onClick={() => toggleTag(tag)}
          />
        ))}
      </div>

      {/* Example cards grid */}
      <div className="grid gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 flex-col rounded-lg border border-fd-border bg-fd-card p-4 transition-all hover:border-fd-primary/50 hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold leading-tight text-fd-foreground group-hover:text-fd-primary transition-colors">
                {item.title}
              </h4>
              <ExternalLink className="size-3.5 shrink-0 text-fd-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mb-3 flex-1 text-xs leading-relaxed text-fd-muted-foreground">
              {item.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_COLORS[tag] ?? "bg-fd-muted text-fd-muted-foreground"}`}
                >
                  {TAG_ICONS[tag]}
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <p className="py-8 text-center text-sm text-fd-muted-foreground">
          {t.noMatch}
        </p>
      )}
    </div>
  );
}

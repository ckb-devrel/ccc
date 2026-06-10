/**
 * Shape contract for every locale dictionary.
 *
 * This interface is the single source of truth: adding a new field here will
 * cause every locale file (`en.ts`, `zh.ts`, …) to fail type-check until it
 * is updated, which makes translation drift a compile error rather than a
 * runtime miss.
 *
 * To add a new language (e.g. Japanese):
 *   1. Create `lib/dictionary/ja.ts` with `const ja: Dictionary = { ... }`
 *   2. Register it in `lib/dictionary/index.ts` (`dictionaries = { en, zh, ja }`)
 *   3. Add `'ja'` to `lib/i18n.ts` `languages`
 */
export interface Dictionary {
  /**
   * BCP 47 locale tag used for `Intl` APIs (date / number formatting).
   * e.g. `'en-US'`, `'zh-CN'`, `'ja-JP'`.
   */
  dateLocale: string;

  /** Top navigation bar links. */
  nav: {
    docs: string;
    blog: string;
    playground: string;
    api: string;
    demo: string;
  };

  /** Marketing / landing page (`/[lang]`). */
  home: {
    eyebrow: string;
    /** Headline split into two lines for typographic emphasis. */
    title: [string, string];
    subtitle: string;
    ctaDocs: string;
    ctaPlayground: string;
    installHint: string;
    sectionFeatures: string;
    featuresTitle: string;
    features: { title: string; desc: string }[];
    sectionUsers: string;
    usersTitle: string;
    usersMore: string;
    codeCaption: string;
  };

  /** Blog list and blog post pages. */
  blog: {
    eyebrow: string;
    title: string;
    subtitle: string;
    /** Author byline label, e.g. "by" or "作者". */
    by: string;
    empty: string;
    backToBlog: string;
    tableOfContents: string;
  };

  /** Site-wide footer rendered below home / blog pages. */
  footer: {
    /** Column heading for product/internal links. */
    product: string;
    /** Column heading for community/social links. */
    community: string;
    /** Column heading for resource/external links. */
    resources: string;
    /** Short link labels reused across the footer. */
    links: {
      docs: string;
      blog: string;
      playground: string;
      api: string;
      demo: string;
      github: string;
      twitter: string;
      githubOrg: string;
      talk: string;
    };
    /** Copyright line, usually rendered with the current year prepended. */
    copyright: string;
    /** Small caption above the brand block. */
    builtBy: string;
  };

  /** 404 / not-found pages — global, blog-specific, and docs-specific copy. */
  notFound: {
    /** Generic (global) 404 used outside `/[lang]`. */
    global: {
      eyebrow: string;
      title: [string, string];
      subtitle: string;
      ctaHome: string;
      ctaDocs: string;
    };
    /** 404 inside `/[lang]/blog/*`. */
    blog: {
      eyebrow: string;
      title: [string, string];
      subtitle: string;
      ctaBlog: string;
      ctaHome: string;
    };
    /** 404 inside `/[lang]/docs/*`. */
    docs: {
      eyebrow: string;
      title: [string, string];
      subtitle: string;
      ctaDocs: string;
      ctaHome: string;
    };
  };

  /** ExampleGrid component — filter bar and empty-state text. */
  examples: {
    all: string;
    noMatch: string;
  };

  /** Docs pages — section eyebrows shown above each page title. */
  docs: {
    copyMarkdown: string;
    askAi: string;
    askAiItems: {
      scira: string;
      chatgpt: string;
      claude: string;
      cursor: string;
    };
    sections: {
      'getting-started': string;
      concepts: string;
      guides: string;
      wallets: string;
      packages: string;
    };
  };
}

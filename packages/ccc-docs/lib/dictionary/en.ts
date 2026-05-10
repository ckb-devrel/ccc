import type { Dictionary } from './types';

export const en: Dictionary = {
  dateLocale: 'en-US',

  nav: {
    docs: 'Docs',
    blog: 'Blog',
    playground: 'Playground',
    api: 'API Reference',
    demo: 'Demo',
  },

  home: {
    eyebrow: "CKBers' Codebase",
    title: ['One SDK for the', 'entire CKB stack'],
    subtitle:
      'Compose transactions, connect wallets from any chain ecosystem, and interact with on-chain assets — all through a single, declarative TypeScript library.',
    ctaDocs: 'Read the docs',
    ctaPlayground: 'Try the playground',
    installHint: '$ npm i @ckb-ccc/ccc',
    sectionFeatures: 'Capabilities',
    featuresTitle: 'Everything you need to build on CKB.',
    features: [
      {
        title: 'Declarative transactions',
        desc: 'Describe what you want the transaction to produce; CCC auto-fills inputs, fees, and change.',
      },
      {
        title: 'Multi-chain signing',
        desc: 'A single signer interface across EVM, Bitcoin, CKB, Nostr, and Dogecoin ecosystems.',
      },
      {
        title: 'Drop-in wallet UI',
        desc: 'Ship wallet connection in minutes with the React connector, or bring your own UI.',
      },
      {
        title: 'Protocol integrations',
        desc: 'First-class support for xUDT, Spore Protocol (DOBs), SSRI, RGB++, and Nervos DAO.',
      },
      {
        title: 'Node.js ready',
        desc: 'Use the same API in browser, edge, and server runtimes via @ckb-ccc/shell.',
      },
      {
        title: 'Type-safe by default',
        desc: 'Full TypeScript types, tree-shakeable exports, and an online API reference.',
      },
    ],
    sectionUsers: 'Ecosystem',
    usersTitle: 'Trusted by teams shipping on CKB',
    usersMore: '& Your project — open a PR',
    codeCaption: 'transfer.ts — send 100 CKB',
  },

  blog: {
    eyebrow: '// Blog',
    title: 'Blog',
    subtitle: 'Changelogs, protocol deep-dives, and tutorials.',
    by: 'by',
    empty: 'No posts yet.',
    backToBlog: 'Back to Blog',
    tableOfContents: 'Table of Contents',
  },

  footer: {
    product: 'Product',
    community: 'Community',
    resources: 'Resources',
    links: {
      docs: 'Documentation',
      blog: 'Blog',
      playground: 'Playground',
      api: 'API Reference',
      demo: 'Demo',
      github: 'GitHub Repo',
      twitter: 'X / Twitter',
      githubOrg: 'CKB DevRel',
      talk: 'Talk',
    },
    copyright: 'CKB DevRel. All rights reserved.',
    builtBy: 'Crafted by CKB DevRel',
  },

  docs: {
    copyMarkdown: 'Copy Markdown',
    openAs: 'Open',
    sections: {
      'getting-started': 'Get Started',
      concepts: 'Core Concepts',
      guides: 'Guides',
      wallets: 'Wallets',
      packages: 'Packages',
    },
  },
};

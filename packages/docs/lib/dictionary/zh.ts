import type { Dictionary } from './types';

export const zh: Dictionary = {
  dateLocale: 'zh-CN',

  nav: {
    docs: '文档',
    blog: '博客',
    playground: '在线调试',
    api: 'API 参考',
    demo: '示例应用',
  },

  home: {
    eyebrow: 'CKBer 的代码库',
    title: ['一个 SDK，', '覆盖 CKB 全栈。'],
    subtitle:
      '声明式地组装交易、连接来自任意生态的钱包、与链上资产交互——全部通过同一个 TypeScript 库完成。',
    ctaDocs: '阅读文档',
    ctaPlayground: '打开 Playground',
    installHint: '$ npm i @ckb-ccc/ccc',
    sectionFeatures: '核心能力',
    featuresTitle: '在 CKB 上构建应用所需的一切。',
    features: [
      {
        title: '声明式交易',
        desc: '只描述交易想要产生的输出，CCC 自动填充 Inputs、手续费与找零。',
      },
      {
        title: '跨链签名',
        desc: '统一的签名接口，覆盖 EVM、Bitcoin、CKB、Nostr、Dogecoin 等生态。',
      },
      {
        title: '即插即用的钱包 UI',
        desc: '几分钟内接入 React Connector，或自行定制钱包连接界面。',
      },
      {
        title: '协议深度集成',
        desc: '原生支持 xUDT、Spore 协议（DOB）、SSRI、RGB++ 与 Nervos DAO。',
      },
      {
        title: 'Node.js 可用',
        desc: '通过 @ckb-ccc/shell 在浏览器、边缘环境、服务器运行时保持同一套 API。',
      },
      {
        title: '类型安全',
        desc: '完整的 TypeScript 类型、支持摇树优化的导出、以及在线 API 参考。',
      },
    ],
    sectionUsers: '生态项目',
    usersTitle: 'CKB 生态项目的信赖之选',
    usersMore: '& 你的项目 — 提个 PR',
    codeCaption: 'transfer.ts —— 发送 100 CKB',
  },

  blog: {
    eyebrow: '// Blog',
    title: '博客',
    subtitle: '更新日志、协议解读与教程。',
    by: '作者',
    empty: '暂无文章。',
    backToBlog: '返回博客',
    tableOfContents: '目录',
  },

  footer: {
    product: '产品',
    community: '社区',
    resources: '资源',
    links: {
      docs: '使用文档',
      blog: '博客',
      playground: '在线调试',
      api: 'API 参考',
      demo: '示例应用',
      github: 'GitHub 仓库',
      twitter: 'X / Twitter',
      githubOrg: 'CKB DevRel',
      talk: '论坛',
    },
    copyright: 'CKB DevRel. 保留所有权利。',
    builtBy: '由 CKB DevRel 倾力打造',
  },
  
  notFound: {
    global: {
      eyebrow: '// 404 — 页面未找到',
      title: ['这个页面', '不存在。'],
      subtitle:
        '你访问的链接可能被移除、重命名，或者从未存在。从下面挑一个目的地继续探索。',
      ctaHome: '回到首页',
      ctaDocs: '阅读文档',
    },
    blog: {
      eyebrow: '// 404 — 博客文章',
      title: ['文章', '不见了。'],
      subtitle:
        '这篇博客可能已经下架或被移动。可以浏览全部文章，或者返回首页。',
      ctaBlog: '浏览博客',
      ctaHome: '回到首页',
    },
    docs: {
      eyebrow: '// 404 — 文档页面',
      title: ['文档页面', '不见了。'],
      subtitle:
        '这个文档页面可能已重命名或移动。可以打开文档首页，或在左侧目录搜索相关主题。',
      ctaDocs: '文档首页',
      ctaHome: '回到首页',
    },
  },

  examples: {
    all: '全部',
    noMatch: '没有匹配所选标签的示例。',
  },

  docs: {
    copyMarkdown: '复制 Markdown',
    askAi: '问 AI',
    askAiItems: {
      scira: '用 Scira AI 提问',
      chatgpt: '用 ChatGPT 提问',
      claude: '用 Claude 提问',
      cursor: '用 Cursor 提问',
    },
    sections: {
      'getting-started': '快速上手',
      concepts: '核心概念',
      guides: '指南',
      wallets: '钱包',
      packages: '包',
    },
  },
};

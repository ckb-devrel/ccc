import { siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';

export const revalidate = false;

const preamble = `# CCC Documentation (CKBers' Codebase)

> CCC is a monorepo-based TypeScript SDK that abstracts CKB's UTXO-based cell model into developer-friendly APIs. The system enables developers to:
> - Compose transactions using high-level abstractions like \`ccc.Transaction.from\` and automatic input/fee completion
> - Integrate wallets from Ethereum (MetaMask), Bitcoin (UniSat, Xverse), Nostr, and native CKB wallets through a unified \`Signer\` interface
> - Interact with CKB nodes via WebSocket/HTTP JSON-RPC clients
> - Build UIs using React components (\`@ckb-ccc/connector-react\`) or Web Components (\`@ckb-ccc/connector\`)
> - Develop and test using the interactive playground at live.ckbccc.com

Notes for AI agents:

- All links below are absolute URLs. Append \`.md\` to any docs page URL to get its raw Markdown version (e.g. ${siteUrl}/en/docs/getting-started/introduction.md).
- The entire documentation concatenated into a single file: ${siteUrl}/llms-full.txt
- Agent skills index (product-specific operating guidance, split by topic): ${siteUrl}/skill.md
- Chinese versions of every page are available by replacing \`/en/\` with \`/zh/\` in the URL.
- API reference: https://api.ckbccc.com | Playground: https://live.ckbccc.com | Source: https://github.com/ckb-devrel/ccc

## Sections (index pages)

- [Get Started](${siteUrl}/en/docs/getting-started): Install CCC, send your first transaction, and learn what CCC can do for you.
- [Core Concepts](${siteUrl}/en/docs/concepts): The five primitives behind every CCC app — cells, transactions, signers, clients, and addresses.
- [Guides](${siteUrl}/en/docs/guides): Step-by-step recipes for the most common CKB development tasks.
- [CCC Package Guide](${siteUrl}/en/docs/packages): Overview of every NPM package; pick the right one for your runtime and features.
- [Core Packages](${siteUrl}/en/docs/packages/core-packages): Core primitives, aggregated entry points, and wallet connectors.
- [Protocol Support Layer](${siteUrl}/en/docs/packages/protocol-sdks): Protocol-level SDKs — Spore, UDT, SSRI, and Lumos patches.
- [Wallet Integrations](${siteUrl}/en/docs/packages/wallet-integrations): Connect any wallet through one unified \`Signer\` interface.
- [AI Resources](${siteUrl}/en/docs/ai-resources): How this documentation is built for AI agents, and how developers should configure and prompt their own AI tools to use it correctly.

## Common tasks (recommended reading paths)

Start here, then read the linked pages in order for the task at hand:

- New to CCC: [Introduction](${siteUrl}/en/docs/getting-started/introduction) → [Installation](${siteUrl}/en/docs/getting-started/installation) → [Quick Start](${siteUrl}/en/docs/getting-started/quick-start)
- Connect a wallet: [Connect Wallets](${siteUrl}/en/docs/guides/connect-wallets) → [Signer](${siteUrl}/en/docs/concepts/signer) → pick a wallet under "Wallet Integrations" below
- Build & send a transaction: [CKB Cell Model](${siteUrl}/en/docs/concepts/cell-model) → [Transaction](${siteUrl}/en/docs/concepts/transaction) → [Compose Transactions](${siteUrl}/en/docs/guides/compose-transactions)
- Use CCC in a Node.js backend: [Node.js Backend](${siteUrl}/en/docs/guides/node-js-backend) → [@ckb-ccc/shell](${siteUrl}/en/docs/packages/core-packages/shell) → [Client](${siteUrl}/en/docs/concepts/client)
- Sign & verify a message: [Sign Message](${siteUrl}/en/docs/guides/sign-message) → [Signer](${siteUrl}/en/docs/concepts/signer)

The "Wallet Integrations" section lists one page per supported wallet — read only the one(s) your app targets; they all share the same unified \`Signer\` interface.
`;

export function GET() {
  const index = llms(source)
    // English only — Chinese pages are linked via the note in the preamble
    .index('en')
    // Make relative links absolute so agents can fetch them directly
    .replace(/\]\(\//g, `](${siteUrl}/`)
    // Drop the generic top-level heading; the preamble provides one
    .replace(/^# Documentation\s*\n/, '');

  return new Response(`${preamble}\n${index}`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
    },
  });
}

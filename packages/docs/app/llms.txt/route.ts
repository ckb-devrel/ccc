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
- Chinese versions of every page are available by replacing \`/en/\` with \`/zh/\` in the URL.
- API reference: https://api.ckbccc.com | Playground: https://live.ckbccc.com | Source: https://github.com/ckb-devrel/ccc

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
    },
  });
}

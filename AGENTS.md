# CCC repository guide

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution workflow. Keep changes focused and follow the conventions of the package you touch.

## Where to work

- `packages/core` owns the SDK primitives (clients, signers, transactions and Molecule codecs); `packages/ccc` is the umbrella SDK. Check public exports and downstream consumers when changing a shared API.
- `packages/connector` owns wallet connection UI. The app and Playground are in `packages/app` and `packages/playground`; documentation and runnable examples are in `packages/docs` and `packages/examples`.

## Use the CCC Skills

- When using or documenting the CCC SDK, start with [`ckb-ccc-fundamentals`](skills/ckb-ccc-fundamentals/SKILL.md), then use the task-specific skill for [signers](skills/ckb-ccc-signer-setup/SKILL.md), [transactions](skills/ckb-ccc-transactions/SKILL.md), [UDT](skills/ckb-ccc-udt/SKILL.md), [Spore](skills/ckb-ccc-spore/SKILL.md), or the [Playground](skills/ckb-ccc-playground/SKILL.md).
- Use [`ckb-ccc-examples-finder`](skills/ckb-ccc-examples-finder/SKILL.md) to find an existing example before adding one. Prefer the Skill files in this checkout; verify guidance against the current code. If you change a Skill, follow its [maintenance guide](skills/README.md).

## Build and verify

- Install from the repo root with `pnpm install`. Match the Node version in [CI](.github/workflows/check.yaml) and the pnpm version in [`package.json`](package.json).
- Start with tests for the changed behavior and follow the affected package's `test` script. Use `pnpm exec vitest run <path-to-test>` only for tests covered by the root Vitest config. JoyID and Xverse run artifact tests with `node --test` after building.
- For cross-package changes, run the CI checks: `pnpm build:all`, `pnpm lint`, and `pnpm test:ci`.
- For UI changes, check the affected flow in a browser, including narrow layouts. Use mocks or testnet for wallet and transaction checks; do not use real wallet credentials or broadcast mainnet transactions as part of verification. Report what ran and what did not.

## Documentation

- Update the English (`.mdx`) and Simplified Chinese (`.zh.mdx`) versions together when changing the docs site. Keep examples, links, and documented behavior in sync, and check locale-specific links and anchors.

## Pull requests and releases

- Target `dev` and use Conventional Commits. Add a changeset when an affected package needs a release; skip it for docs-only changes that do not require one.
- Use public, absolute HTTPS image URLs in READMEs that may be published to npm or rendered outside GitHub. Do not rely on repository-relative image paths in those files.
- When a PR adds both an image and a URL pointing to it on the target branch, a missing image in the PR preview is expected until merge. Note this in the PR and verify the URL after merge. For assets already on the target branch, verify new or changed URLs before merge.
- In this monorepo, check which README the affected package actually ships. When in doubt, run `npm pack --dry-run --ignore-scripts` from that package directory.

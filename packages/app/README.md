# CCC App

The interactive CCC application and reference implementation for connecting
wallets, inspecting accounts, and running common CKB workflows with CCC.

## AI Disclosure

All UI implementation code in this package was written by AI. Human
contributors designed the frontend code structure and tested the frontend UI,
but did not write the UI implementation.

Human code review was limited to the core logic of each Module. In this package,
**Module core logic** means the standalone functions above the separator comment
in each `src/app/modules/*-module.tsx` file, together with core-only helper files
used by those functions. UI implementation is not included in this definition.

## Development

From the repository root:

```bash
pnpm --dir packages/app dev
```

Then open <http://localhost:3000>.

## Package

- Package name: `@ckb-ccc/app`
- Source: `packages/app`
- The legacy implementation remains available in `packages/demo` while the
  application is being validated.

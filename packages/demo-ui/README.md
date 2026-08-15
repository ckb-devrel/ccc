# CCC Demo UI

This package is the working area for the CCC demo UI redesign. It intentionally
contains the real CCC wallet connector while transaction tools remain visual
placeholders. This lets the connection and transition experience be validated
against real signer state before moving over the remaining business logic.

## Development

From the repository root:

```bash
pnpm --dir packages/demo-ui dev
```

Then open <http://localhost:3000>.

## Current boundary

- Wallet connection, restoration, telemetry, and disconnect use CCC.
- Tool controls remain intentionally unwired.
- `packages/demo` remains the source of truth for existing behavior.
- Business flows will be migrated one at a time after UI review.

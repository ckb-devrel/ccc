---
"@ckb-ccc/connector": minor
"@ckb-ccc/connector-react": minor
---

feat(connector): add localization support

- New `locale` property on `<ccc-connector>` and `ccc.Provider`; English by default, `zh-CN` built in, unknown tags fall back to the closest registered language.
- `useCcc()` now exposes the active `locale`.
- Fee rate options are selected by a stable id instead of their display label.
- Errors raised by the connector itself (camera access, Khie pairing) are translated at render time via `ConnectorError`.
- Dialog back/close and copy buttons gained `aria-label`s.

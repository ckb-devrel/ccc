---
"@ckb-ccc/connector": minor
"@ckb-ccc/connector-react": minor
---

feat(connector): add localization support

- New `locale` property on `<ccc-connector>` and `ccc.Provider`; English by default, `zh-Hans` built in. The value must be an exact built-in tag; anything else falls back to English.
- `ccc.connectorLocales` lists the built-in language tags at runtime.
- Fee rate options are selected by a stable id instead of their display label.
- Errors raised by the connector itself (camera access, Khie pairing) are translated at render time via `ConnectorError`.


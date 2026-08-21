---
"@ckb-ccc/core": minor
---

feat(core)!: replace `Buffer`-based byte encoding with `uint8array-extras`

- Remove the legacy `ascii`, `binary`, `latin1`, `ucs2`, and `utf16le` encodings
- Use consistent strict validation for implicit and explicit hex input
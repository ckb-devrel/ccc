---
"@ckb-ccc/core": patch
---

fix(core): verify JoyID signatures against the given key and message

Reject unsupported JoyID key types during message verification.

Verify binary passkey challenges against their original bytes while preserving text message semantics.

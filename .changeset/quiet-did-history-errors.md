---
"@ckb-ccc/did-ckb": patch
---

Propagate input cell lookup failures in `getDidCkbHistory` instead of misclassifying updates as CREATE or MIGRATE and silently truncating history.

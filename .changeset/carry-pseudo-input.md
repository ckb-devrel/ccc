---
"@ckb-ccc/core": minor
---

feat(core): carry the placeholder input of a lock proof over the signer JSON-RPC. The dApp side always sends the cell of such an input; the wallet side uses it only when it opts in with `acceptPseudoInputs`, and looks the input up otherwise

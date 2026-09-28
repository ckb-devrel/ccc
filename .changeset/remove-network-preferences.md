---
"@ckb-ccc/core": major
"@ckb-ccc/ccc": major
"@ckb-ccc/joy-id": major
"@ckb-ccc/okx": major
"@ckb-ccc/uni-sat": major
"@ckb-ccc/utxo-global": major
"@ckb-ccc/xverse": major
---

Remove the deprecated network preference API. Wallet integrations expose one fixed-network signer per selectable network; applications should select the desired signer directly.

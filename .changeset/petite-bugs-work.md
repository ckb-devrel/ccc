---
"@ckb-ccc/core": patch
---

fix(core): `ccc.mol.codec` decorator

* The runtime will invoke the decorator with 2 arguments, but the decorator expects 1.
* Decorator function return type '...' is not assignable to type '...'
  

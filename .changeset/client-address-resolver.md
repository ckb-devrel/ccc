---
"@ckb-ccc/core": minor
---

Add `AddressResolver` and `ClientConfig.addressResolver`, so `Address.fromString` can resolve representations it cannot parse, such as names, with a single Client. Passing a prefix-keyed record of Clients to `Address.fromString` is now deprecated; callers supporting multiple prefixes should try each Client themselves.

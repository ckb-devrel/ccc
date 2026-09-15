---
"@ckb-ccc/core": patch
---

Document that a cell dep carrying a type id is resolved against the chain before use.

Several outpoints in the known-script tables no longer resolve, which reads as a bug until
you know that `getCellDeps` looks the live cell up by type id and uses that outpoint
instead. This adds that to the tables themselves, where somebody checking the outpoints
will be looking, and to the method's own docstring, including the case that is easy to
miss: when the lookup comes back empty the configured outpoint is used as written, stale or
not, so a node whose indexer has not caught up is the situation to know about.

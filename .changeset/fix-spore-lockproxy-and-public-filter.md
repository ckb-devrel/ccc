---
"@ckb-ccc/spore": patch
"@ckb-ccc/core": patch
---

fix(spore): restore the selected lock-proxy input via an output tagged with that input's outPoint (survives clone/JSON, stays per-transaction), keep one owner restore per cluster, and treat `clusterId: ""` as public spores only

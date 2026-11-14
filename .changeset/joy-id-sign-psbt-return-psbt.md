---
"@ckb-ccc/joy-id": patch
---

`signPsbt` now always returns a PSBT. Previously JoyID returned a raw
transaction when `autoFinalized` was true, and failed on PSBTs with inputs it
couldn't sign.

If you broadcast the result of `signPsbt` directly, extract the transaction
from the PSBT or use `signAndBroadcastPsbt` instead.

Automatic finalization uses the shared supported-script finalizer on all ready
inputs, including previously signed inputs. Unsupported or incomplete inputs
and already finalized inputs are preserved.

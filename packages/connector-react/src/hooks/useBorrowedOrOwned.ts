import { ccc } from "@ckb-ccc/connector";
import { useEffect, useState } from "react";

/**
 * Opens and owns a fallback value after the component commits, while returning
 * a borrowed value whenever one is provided.
 */
export function useBorrowedOrOwned<T>(
  borrowed: T | undefined,
  open: () => ccc.Owner<T>,
): T | undefined {
  const [owned, setOwned] = useState<T>();

  useEffect(() => {
    const owner = open();
    setOwned(owner.value);
    return () => void owner.dispose().catch(() => {});
  }, [open]);

  return borrowed ?? owned;
}

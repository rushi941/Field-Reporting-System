import { useEffect } from "react";
import { lockPageScroll } from "@/lib/scroll-lock";

/** Lock background scroll while `active` is true. Safe for nested modals. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return lockPageScroll();
  }, [active]);
}

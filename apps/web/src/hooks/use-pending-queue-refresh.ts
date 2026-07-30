import { useEffect } from "react";
import {
  PENDING_QUEUE_REFRESH_EVENT,
  PENDING_QUEUE_REFRESH_KEY,
} from "@/lib/activity-seen";

/** Refresh pending queue when the tab is focused or a field submit completes. */
export function usePendingQueueRefresh(refresh: () => void | Promise<void>) {
  useEffect(() => {
    const run = () => void refresh();

    window.addEventListener("focus", run);
    window.addEventListener(PENDING_QUEUE_REFRESH_EVENT, run);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PENDING_QUEUE_REFRESH_KEY) run();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", run);
      window.removeEventListener(PENDING_QUEUE_REFRESH_EVENT, run);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);
}

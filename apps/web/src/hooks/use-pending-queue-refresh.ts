import { useEffect } from "react";
import {
  PENDING_QUEUE_POLL_MS,
  PENDING_QUEUE_REFRESH_EVENT,
  PENDING_QUEUE_REFRESH_KEY,
} from "@/lib/activity-seen";

/** Keep manager pending queue fresh (poll + immediate refresh on field submit). */
export function usePendingQueueRefresh(refresh: () => void | Promise<void>) {
  useEffect(() => {
    const run = () => void refresh();

    run();
    const pollId = window.setInterval(run, PENDING_QUEUE_POLL_MS);
    window.addEventListener("focus", run);
    window.addEventListener(PENDING_QUEUE_REFRESH_EVENT, run);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PENDING_QUEUE_REFRESH_KEY) run();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.clearInterval(pollId);
      window.removeEventListener("focus", run);
      window.removeEventListener(PENDING_QUEUE_REFRESH_EVENT, run);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);
}

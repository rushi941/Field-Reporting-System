import { useEffect, useState } from "react";
import { ACTIVITY_SEEN_EVENT } from "@/lib/activity-seen";

/** Re-render when local seen-state changes (same tab). */
export function useActivitySeenRevision(scope?: string) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    function onSeen(event: Event) {
      const detail = (event as CustomEvent<{ scope?: string }>).detail;
      if (!scope || !detail?.scope || detail.scope === scope) {
        setRevision((r) => r + 1);
      }
    }
    window.addEventListener(ACTIVITY_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(ACTIVITY_SEEN_EVENT, onSeen);
  }, [scope]);

  return revision;
}

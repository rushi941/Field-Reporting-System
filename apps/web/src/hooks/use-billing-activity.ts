import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  isBillingProjectUnread,
  type BillingPendingInput,
} from "@/lib/activity-seen";
import { useActivitySeenRevision } from "@/hooks/use-activity-seen-revision";

type BillingSummary = {
  totalPending: number;
  projectsWithPending: number;
  projects: BillingPendingInput[];
};

export function useBillingActivity(userId: string | undefined) {
  const [projects, setProjects] = useState<BillingPendingInput[]>([]);
  const seenRevision = useActivitySeenRevision("billing_pending");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<BillingSummary>("/api/v1/billing/summary");
      setProjects(data.projects ?? []);
    } catch {
      /* non-blocking */
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const unreadCount = useMemo(
    () => projects.filter((p) => isBillingProjectUnread(userId, p)).length,
    [projects, userId, seenRevision],
  );

  const isUnread = useCallback(
    (project: BillingPendingInput) => isBillingProjectUnread(userId, project),
    [userId, seenRevision],
  );

  return { unreadCount, isUnread, refresh };
}

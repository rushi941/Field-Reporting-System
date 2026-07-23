import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  isPendingApprovalUnread,
  type PendingActivityInput,
} from "@/lib/activity-seen";
import { useActivitySeenRevision } from "@/hooks/use-activity-seen-revision";
import { usePendingQueueRefresh } from "@/hooks/use-pending-queue-refresh";

type PendingSummary = {
  pendingCount: number;
  reports: PendingActivityInput[];
};

export function usePendingApprovalActivity(userId: string | undefined) {
  const [reports, setReports] = useState<PendingActivityInput[]>([]);
  const seenRevision = useActivitySeenRevision("pending_approvals");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<PendingSummary>(
        "/api/v1/approvals/pending",
      );
      setReports(
        data.reports.map((r) => ({
          id: r.id,
          submittedAt: r.submittedAt,
        })),
      );
    } catch {
      /* non-blocking */
    }
  }, [userId]);

  usePendingQueueRefresh(refresh);

  const unreadCount = useMemo(
    () => reports.filter((r) => isPendingApprovalUnread(userId, r)).length,
    [reports, userId, seenRevision],
  );

  const pendingCount = reports.length;

  const isUnread = useCallback(
    (report: PendingActivityInput) =>
      isPendingApprovalUnread(userId, report),
    [userId, seenRevision],
  );

  return {
    pendingCount,
    unreadCount,
    isUnread,
    refresh,
  };
}

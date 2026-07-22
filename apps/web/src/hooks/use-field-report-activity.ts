import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  isFieldReportUnread,
  type ReportActivityInput,
} from "@/lib/activity-seen";
import { useActivitySeenRevision } from "@/hooks/use-activity-seen-revision";

type SummaryResponse = {
  reports: ReportActivityInput[];
};

export function useFieldReportActivity(userId: string | undefined) {
  const [reports, setReports] = useState<ReportActivityInput[]>([]);
  const seenRevision = useActivitySeenRevision("field_reports");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<SummaryResponse>(
        "/api/v1/field/reports/summary",
      );
      setReports(data.reports);
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
    () => reports.filter((r) => isFieldReportUnread(userId, r)).length,
    [reports, userId, seenRevision],
  );

  const isUnread = useCallback(
    (report: ReportActivityInput) => isFieldReportUnread(userId, report),
    [userId, seenRevision],
  );

  return { unreadCount, isUnread, refresh };
}

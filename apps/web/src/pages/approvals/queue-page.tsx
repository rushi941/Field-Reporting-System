import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { InitialListLoad, RefreshBar } from "@/components/page-shell";
import {
  type PendingReportSummary,
} from "@/components/pending-approval-card";
import { PendingTaskCard } from "@/components/pending-task-card";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/auth/auth-context";
import { usePendingApprovalActivity } from "@/hooks/use-pending-approval-activity";
import { usePendingQueueRefresh } from "@/hooks/use-pending-queue-refresh";
import { markPendingApprovalSeen } from "@/lib/activity-seen";
import { groupPendingReportsByTask } from "@/lib/group-pending-tasks";

type PendingResponse = {
  reports: PendingReportSummary[];
  pendingCount: number;
};

export function ApprovalsQueuePage() {
  const { user, can } = useAuth();
  const { isUnread } = usePendingApprovalActivity(user?.id);
  const { data, loading, refreshing, refresh } = useApi<PendingResponse>(
    user?.id ? "/api/v1/approvals/pending" : null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  usePendingQueueRefresh(refresh);

  const reports = data?.reports ?? [];
  const tasks = useMemo(() => groupPendingReportsByTask(reports), [reports]);

  function toggleTask(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleSeen(groupReports: PendingReportSummary[]) {
    for (const report of groupReports) {
      markPendingApprovalSeen(user?.id, {
        id: report.id,
        submittedAt: report.submittedAt,
      });
    }
  }

  function handleActionComplete() {
    setExpandedId(null);
    refresh();
  }

  if (loading && reports.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Pending approval
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a bid item to review submitted quantities.
          </p>
        </div>
        <InitialListLoad label="Loading pending tasks…" rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RefreshBar active={refreshing} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Pending approval
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each bid item appears once. Tap it to see every pending submission,
          then approve or return.
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <ClipboardCheck className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Queue is clear</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No bid items waiting for approval.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.key}>
              <PendingTaskCard
                group={task}
                expanded={expandedId === task.key}
                unread={task.reports.some((s) => isUnread(s.report))}
                canApprove={can("reports.approve")}
                onToggle={() => toggleTask(task.key)}
                onSeen={() => handleSeen(task.reports.map((s) => s.report))}
                onActionComplete={handleActionComplete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

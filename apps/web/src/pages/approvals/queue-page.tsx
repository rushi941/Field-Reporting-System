import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { InitialListLoad, RefreshBar } from "@/components/page-shell";
import {
  PendingApprovalCard,
  type PendingReportSummary,
} from "@/components/pending-approval-card";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/auth/auth-context";
import { usePendingApprovalActivity } from "@/hooks/use-pending-approval-activity";
import { usePendingQueueRefresh } from "@/hooks/use-pending-queue-refresh";
import { markPendingApprovalSeen } from "@/lib/activity-seen";

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

  function toggleReport(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleSeen(report: PendingReportSummary) {
    markPendingApprovalSeen(user?.id, {
      id: report.id,
      submittedAt: report.submittedAt,
    });
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
            Tap a report to review quantities and approve or return.
          </p>
        </div>
        <InitialListLoad label="Loading pending reports…" rows={4} />
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
          Tap a report to expand — tap again to collapse. Approve or return
          without leaving the queue.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-12 text-center">
          <ClipboardCheck className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Queue is clear</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No reports waiting for approval.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {reports.map((r) => (
            <li key={r.id}>
              <PendingApprovalCard
                report={r}
                expanded={expandedId === r.id}
                unread={isUnread(r)}
                canApprove={can("reports.approve")}
                canEditSubmitted={can("reports.edit_submitted")}
                onToggle={() => toggleReport(r.id)}
                onSeen={() => handleSeen(r)}
                onActionComplete={handleActionComplete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

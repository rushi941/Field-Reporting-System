import { Link } from "react-router-dom";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { ConnectionBanner } from "@/components/connection-banner";
import { ActivityDot } from "@/components/activity-dot";
import { OFFLINE_CACHE_KEYS } from "@/lib/offline-cache";
import { useCachedApi } from "@/hooks/use-cached-api";
import { useAuth } from "@/auth/auth-context";
import { usePendingApprovalActivity } from "@/hooks/use-pending-approval-activity";
import { usePendingQueueRefresh } from "@/hooks/use-pending-queue-refresh";

type PendingReport = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  submittedAt: string | null;
  lineCount: number;
  attachmentCount: number;
  ageLabel: string;
  ageHours: number;
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
  };
  submittedBy: { id: string; name: string; email: string };
};

type PendingResponse = {
  reports: PendingReport[];
  pendingCount: number;
};

export function ApprovalsQueuePage() {
  const { user } = useAuth();
  const { isUnread } = usePendingApprovalActivity(user?.id);
  const {
    data,
    loading,
    refreshing,
    fromCache,
    cacheSavedAt,
    error,
    online,
    refresh,
  } = useCachedApi<PendingResponse>(
    OFFLINE_CACHE_KEYS.approvalsPending,
    "/api/v1/approvals/pending",
  );

  usePendingQueueRefresh(refresh);

  const reports = data?.reports ?? [];

  if (loading && reports.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading pending queue…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConnectionBanner
        online={online}
        fromCache={fromCache}
        refreshing={refreshing}
        cacheSavedAt={cacheSavedAt}
        error={error}
        className="bg-background/80"
      />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Pending approval
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review quantities, notes, and attachments.
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
        <ul className="space-y-2">
          {reports.map((r) => {
            const unread = isUnread(r);
            return (
            <li key={r.id}>
              <Link
                to={`/approvals/${r.id}`}
                className="block rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {unread && <ActivityDot inline label="New" />}
                    <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {r.reportNumber}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none text-sky-900">
                    Under review
                  </span>
                </div>
                <p className="mt-2 break-words text-sm font-semibold leading-snug">
                  {r.project.jobNumber} — {r.project.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{r.submittedBy.name}</span>
                  <span aria-hidden>·</span>
                  <span>{r.reportDate}</span>
                  <span aria-hidden>·</span>
                  <span>
                    {r.lineCount} line{r.lineCount === 1 ? "" : "s"}
                  </span>
                  {r.attachmentCount > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span>
                        {r.attachmentCount} file
                        {r.attachmentCount === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span className="tabular-nums" title={`${r.ageHours} hours since submit`}>
                    Age {r.ageLabel}
                  </span>
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { ClipboardList, Loader2 } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { cn } from "@/lib/utils";
import { ConnectionBanner } from "@/components/connection-banner";
import { ActivityDot } from "@/components/activity-dot";
import { OFFLINE_CACHE_KEYS } from "@/lib/offline-cache";
import { useCachedApi } from "@/hooks/use-cached-api";
import { useAuth } from "@/auth/auth-context";
import { isFieldReportUnread } from "@/lib/activity-seen";

type FieldReport = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  returnComment: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
  updatedAt?: string | null;
  approvedBy: { id: string; name: string; email: string } | null;
  returnedBy: { id: string; name: string; email: string } | null;
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
  };
  lineItems: { id: string; finalQuantity: number }[];
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  RETURNED: "bg-amber-100 text-amber-900",
  SUBMITTED: "bg-sky-100 text-sky-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  APPROVED_WITH_NOTES: "bg-emerald-100 text-emerald-900",
};

export function FieldReportsPage() {
  const { user } = useAuth();
  const {
    data,
    loading,
    refreshing,
    fromCache,
    cacheSavedAt,
    error,
    online,
  } = useCachedApi<{ reports: FieldReport[] }>(
    OFFLINE_CACHE_KEYS.fieldReports,
    "/api/v1/field/reports",
  );

  const reports = data?.reports ?? [];

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
      <p className="text-sm text-muted-foreground">
        Open a report for full details. Correct returned reports and resubmit.
      </p>

      {loading && reports.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-sky-800" />
          Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-12 text-center">
          <ClipboardList className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No reports yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Open a project, enter quantities on tasks, then submit.
          </p>
          <Link
            to="/field/projects"
            className="mt-4 inline-block text-sm font-medium text-sky-800 underline"
          >
            Go to projects
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => {
            const label =
              frdStatusLabels[r.status as keyof typeof frdStatusLabels] ??
              r.status.replaceAll("_", " ");
            const unread = isFieldReportUnread(user?.id, r);
            return (
              <li key={r.id}>
                <Link
                  to={`/field/reports/${r.id}`}
                  className="block rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition active:scale-[0.99] hover:border-sky-300 hover:bg-sky-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="relative min-w-0 truncate pr-2 font-mono text-xs text-muted-foreground">
                      {unread && (
                        <ActivityDot className="-left-0.5 top-1/2 -translate-y-1/2" />
                      )}
                      <span className={unread ? "pl-3" : undefined}>
                        {r.reportNumber}
                      </span>
                    </p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide",
                        statusStyles[r.status] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug">
                    {r.project.jobNumber} — {r.project.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.reportDate} · {r.lineItems.length} line
                    {r.lineItems.length === 1 ? "" : "s"}
                  </p>
                  {(r.status === "APPROVED" ||
                    r.status === "APPROVED_WITH_NOTES") &&
                    r.approvedBy && (
                      <p className="mt-1.5 text-xs text-emerald-800">
                        Approved by {r.approvedBy.name}
                      </p>
                    )}
                  {r.status === "RETURNED" && r.returnedBy && (
                    <p className="mt-1.5 text-xs text-amber-900">
                      Returned by {r.returnedBy.name}
                    </p>
                  )}
                  {r.status === "RETURNED" && r.returnComment && (
                    <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-950">
                      {r.returnComment}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

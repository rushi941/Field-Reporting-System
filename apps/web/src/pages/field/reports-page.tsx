import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { ScrollableText } from "@/components/scrollable-text";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityDot } from "@/components/activity-dot";
import { InitialListLoad, RefreshBar } from "@/components/page-shell";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/auth/auth-context";
import { useFieldReportActivity } from "@/hooks/use-field-report-activity";

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
  const { isUnread } = useFieldReportActivity(user?.id);
  const { data, loading, refreshing, refresh } = useApi<{ reports: FieldReport[] }>(
    user?.id ? "/api/v1/field/reports" : null,
  );

  const reports = data?.reports ?? [];
  const [deleteTarget, setDeleteTarget] = useState<FieldReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteDraft() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/v1/field/reports/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Draft report deleted");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <RefreshBar active={refreshing} />
      {loading && reports.length === 0 ? (
        <InitialListLoad label="Loading reports…" rows={4} />
      ) : (
        <>
      <p className="text-sm text-muted-foreground">
        Open a report for full details. Correct returned reports and resubmit.
      </p>

      {reports.length === 0 ? (
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
            const unread = isUnread(r);
            return (
              <li key={r.id}>
                <div className="rounded-xl border border-border bg-card shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40">
                  <Link
                    to={`/field/reports/${r.id}`}
                    className="block px-4 py-3.5 active:scale-[0.99]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {unread && <ActivityDot inline label="New" />}
                        <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                          {r.reportNumber}
                        </p>
                      </div>
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
                      <ScrollableText maxHeight="max-h-20" className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-950">
                        {r.returnComment}
                      </ScrollableText>
                    )}
                  </Link>
                  {r.status === "DRAFT" && (
                    <div className="border-t border-border px-4 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        Delete draft
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete draft report?"
        description={
          deleteTarget ? (
            <>
              Delete <strong>{deleteTarget.reportNumber}</strong>? This cannot
              be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteDraft()}
      />
    </div>
  );
}

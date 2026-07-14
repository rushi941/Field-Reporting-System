import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
  const [data, setData] = useState<PendingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch<PendingResponse>(
          "/api/v1/approvals/pending",
        );
        setData(res);
        if (res.pendingCount > 0) {
          toast.message(
            `${res.pendingCount} report${res.pendingCount === 1 ? "" : "s"} pending approval`,
            { id: "approval-pending" },
          );
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load queue");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading pending queue…
      </div>
    );
  }

  const reports = data?.reports ?? [];

  return (
    <div className="space-y-4">
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
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                to={`/approvals/${r.id}`}
                className="block rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {r.reportNumber}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {r.project.jobNumber} — {r.project.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.submittedBy.name} · {r.reportDate} · {r.lineCount}{" "}
                      line
                      {r.lineCount === 1 ? "" : "s"}
                      {r.attachmentCount
                        ? ` · ${r.attachmentCount} file${r.attachmentCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
                      Under review
                    </span>
                    <span
                      className="text-[11px] font-medium tabular-nums text-muted-foreground"
                      title={`${r.ageHours} hours since submit`}
                    >
                      Age {r.ageLabel}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

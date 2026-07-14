import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type FieldReport = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  returnComment: string | null;
  approvedAt: string | null;
  returnedAt: string | null;
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
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ reports: FieldReport[] }>(
          "/api/v1/field/reports",
        );
        setReports(data.reports);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load reports",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Open a report for full details. Correct returned reports and resubmit.
      </p>

      {loading ? (
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
            return (
              <li key={r.id}>
                <Link
                  to={`/field/reports/${r.id}`}
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
                        {r.reportDate} · {r.lineItems.length} line
                        {r.lineItems.length === 1 ? "" : "s"}
                      </p>
                      {(r.status === "APPROVED" ||
                        r.status === "APPROVED_WITH_NOTES") &&
                        r.approvedBy && (
                          <p className="mt-1 text-xs text-emerald-800">
                            Approved by {r.approvedBy.name}
                          </p>
                        )}
                      {r.status === "RETURNED" && r.returnedBy && (
                        <p className="mt-1 text-xs text-amber-900">
                          Returned by {r.returnedBy.name}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusStyles[r.status] ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                  </div>
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

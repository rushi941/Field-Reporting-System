import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { apiDownload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { ActivityDot } from "@/components/activity-dot";

type RollupProject = {
  id: string;
  jobNumber: string;
  name: string;
  location: string | null;
  division: string;
  clientName: string | null;
  approvedCount: number;
  pendingCount: number;
  returnedCount: number;
  lastReportDate: string | null;
  billingReady: boolean;
  billingReadinessFlag: string;
};

export function BillingRollupPage({ base }: { base: "office" | "system" }) {
  const { can } = useAuth();
  const [projects, setProjects] = useState<RollupProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ projects: RollupProject[] }>(
          "/api/v1/billing/rollup",
        );
        setProjects(data.projects);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load rollup");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function exportCsv(project: RollupProject) {
    if (!can("billing.export")) {
      toast.error("Export not allowed");
      return;
    }
    if (!project.billingReady) {
      toast.error("Wait for pending approvals before export");
      return;
    }
    setExportingId(project.id);
    try {
      await apiDownload(
        `/api/v1/billing/projects/${project.id}/export.csv`,
        `${project.jobNumber}-billing-backup.csv`,
      );
      toast.success("CSV downloaded", { id: "billing-export" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed", {
        id: "billing-export",
      });
    } finally {
      setExportingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading billing rollup…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay-app backup from approved field reports. All active projects are
          listed — billing-ready jobs appear first.
        </p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
        <p className="font-medium">How billing works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed sm:text-sm">
          <li>Field leads submit daily reports → managers approve them.</li>
          <li>
            A job is <strong>Billing ready</strong> when it has at least one
            approved report and zero pending approvals.
          </li>
          <li>
            Open drilldown to review quantities and attachments, then export CSV
            for your pay application backup.
          </li>
        </ol>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No active projects.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Client / location</th>
                  <th className="px-3 py-2 font-medium text-right">Approved</th>
                  <th className="px-3 py-2 font-medium text-right">Pending</th>
                  <th className="px-3 py-2 font-medium">Last report</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/${base}/billing/${p.id}`}
                        className="relative inline-flex items-center font-semibold hover:underline"
                      >
                        {p.pendingCount > 0 && (
                          <ActivityDot className="-left-2 top-1/2 -translate-y-1/2" />
                        )}
                        <span className={p.pendingCount > 0 ? "pl-2" : undefined}>
                          {p.jobNumber}
                        </span>
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {[p.clientName, p.location].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {p.approvedCount}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums font-medium",
                        p.pendingCount > 0 && "text-amber-700",
                      )}
                    >
                      {p.pendingCount}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">
                      {p.lastReportDate ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          p.billingReady
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-950",
                        )}
                      >
                        {p.billingReady ? "Ready" : "Waiting"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/${base}/billing/${p.id}`}>Drilldown</Link>
                        </Button>
                        {can("billing.export") && (
                          <Button
                            size="sm"
                            disabled={!p.billingReady || exportingId === p.id}
                            onClick={() => void exportCsv(p)}
                          >
                            {exportingId === p.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            CSV
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {projects.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/${base}/billing/${p.id}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {p.jobNumber} — {p.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[p.clientName, p.location].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span>
                        Approved:{" "}
                        <strong className="text-foreground">
                          {p.approvedCount}
                        </strong>
                      </span>
                      <span>
                        Pending:{" "}
                        <strong
                          className={
                            p.pendingCount > 0
                              ? "text-amber-700"
                              : "text-foreground"
                          }
                        >
                          {p.pendingCount}
                        </strong>
                      </span>
                      <span>
                        Last report:{" "}
                        <strong className="text-foreground">
                          {p.lastReportDate ?? "—"}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        p.billingReady
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-950",
                      )}
                    >
                      {p.billingReady ? "Billing ready" : "Waiting"}
                    </span>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/${base}/billing/${p.id}`}>Drilldown</Link>
                      </Button>
                      {can("billing.export") && (
                        <Button
                          size="sm"
                          disabled={!p.billingReady || exportingId === p.id}
                          onClick={() => void exportCsv(p)}
                        >
                          {exportingId === p.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          CSV
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

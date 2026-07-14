import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { apiDownload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";

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
          Project rollup of approved quantities. Export when billing ready.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No active projects.
        </p>
      ) : (
        <ul className="space-y-2">
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
      )}
    </div>
  );
}

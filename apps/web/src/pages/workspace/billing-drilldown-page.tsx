import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Paperclip } from "lucide-react";
import { apiDownload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/auth-context";
import { markBillingProjectSeen } from "@/lib/activity-seen";
import { cn } from "@/lib/utils";

type Drilldown = {
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
    clientName: string | null;
    pendingCount: number;
    billingReady: boolean;
  };
  quantitiesByBidItem: {
    code: string;
    name: string;
    unit: string;
    quantity: number;
  }[];
  reports: {
    id: string;
    reportNumber: string;
    reportDate: string;
    status: string;
    approvalNotes: string | null;
    submittedBy: { name: string };
    approvedBy: { name: string } | null;
    lineItems: {
      id: string;
      code: string;
      name: string;
      unit: string;
      finalQuantity: number;
    }[];
    attachments: {
      id: string;
      fileName: string;
      category: string;
      storageUrl: string;
    }[];
  }[];
};

export function BillingDrilldownPage({
  base,
}: {
  base: "office" | "system";
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const { can, user } = useAuth();
  const [data, setData] = useState<Drilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await apiFetch<Drilldown>(
          `/api/v1/billing/projects/${projectId}`,
        );
        setData(res);
        markBillingProjectSeen(user?.id, {
          id: res.project.id,
          pendingCount: res.project.pendingCount,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, user?.id]);

  async function exportCsv() {
    if (!data) return;
    if (!data.project.billingReady) {
      toast.error("Wait for pending approvals before export");
      return;
    }
    setExporting(true);
    try {
      await apiDownload(
        `/api/v1/billing/projects/${data.project.id}/export.csv`,
        `${data.project.jobNumber}-billing-backup.csv`,
      );
      toast.success("CSV downloaded", { id: "billing-export" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed", {
        id: "billing-export",
      });
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading approved quantities…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-2">
        <Link
          to={`/${base}/billing`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Billing
        </Link>
        <p className="text-sm text-muted-foreground">Project not found.</p>
      </div>
    );
  }

  const { project } = data;

  return (
    <div className="space-y-5">
      <Link
        to={`/${base}/billing`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Billing
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {project.jobNumber} — {project.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {[project.clientName, project.location].filter(Boolean).join(" · ") ||
              "—"}
          </p>
          <p className="mt-2 text-xs">
            Pending approvals:{" "}
            <strong
              className={
                project.pendingCount > 0 ? "text-amber-700" : undefined
              }
            >
              {project.pendingCount}
            </strong>
            {" · "}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                project.billingReady
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-amber-100 text-amber-950",
              )}
            >
              {project.billingReady ? "Billing ready" : "Waiting"}
            </span>
          </p>
        </div>
        {can("billing.export") && (
          <Button
            disabled={!project.billingReady || exporting}
            onClick={() => void exportCsv()}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Export CSV
          </Button>
        )}
      </div>

      {!project.billingReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Wait for pending approvals before export.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Approved quantities by bid item</h2>
        {data.quantitiesByBidItem.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved reports yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {data.quantitiesByBidItem.map((row) => (
                  <tr key={row.code} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2">{row.unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {row.quantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Approved reports &amp; attachments
        </h2>
        <ul className="space-y-3">
          {data.reports.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-border bg-card px-3 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {r.reportNumber}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {r.reportDate} · {r.submittedBy.name}
                  </span>
                </p>
                <span className="text-[10px] font-semibold uppercase text-emerald-800">
                  {r.status.replaceAll("_", " ")}
                </span>
              </div>
              {r.approvalNotes && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes: {r.approvalNotes}
                </p>
              )}
              <ul className="mt-2 space-y-1 text-xs">
                {r.lineItems.map((li) => (
                  <li key={li.id} className="flex justify-between gap-2">
                    <span>
                      {li.code} — {li.name}
                    </span>
                    <span className="tabular-nums font-medium">
                      {li.finalQuantity.toLocaleString()} {li.unit}
                    </span>
                  </li>
                ))}
              </ul>
              {r.attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.storageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-sky-800 underline"
                      >
                        <Paperclip className="size-3" />
                        {a.fileName} ({a.category})
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

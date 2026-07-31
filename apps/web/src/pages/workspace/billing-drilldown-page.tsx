import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Paperclip } from "lucide-react";
import { apiDownload, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/auth-context";
import { markBillingProjectSeen } from "@/lib/activity-seen";
import { cn } from "@/lib/utils";
import { TablePagination } from "@/components/table-pagination";
import { AdminTableSearch } from "@/components/admin-table-search";
import { SortableTh } from "@/components/sortable-table-head";
import { ADMIN_PAGE_SIZE } from "@/lib/admin-table";
import { useAdminTable } from "@/hooks/use-admin-table";
import { billingExportPath, formatCurrency } from "@/lib/billing-export";

type Drilldown = {
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
    division: string;
    clientName: string | null;
    generalContractor: string | null;
    contractAmount: number | null;
    startDate: string | null;
    endDate: string | null;
    pendingCount: number;
    billingReady: boolean;
    approvedReportCount: number;
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
    crewSize: number | null;
    notes: string | null;
    approvalNotes: string | null;
    approvedAt: string | null;
    submittedBy: { name: string; email: string };
    approvedBy: { name: string; email: string } | null;
    lineItems: {
      id: string;
      code: string;
      name: string;
      unit: string;
      finalQuantity: number;
      locationDescription: string | null;
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

  type QuantityRow = Drilldown["quantitiesByBidItem"][number];

  const quantitySortAccessors = useMemo(
    () => ({
      code: (r: QuantityRow) => r.code,
      name: (r: QuantityRow) => r.name,
      unit: (r: QuantityRow) => r.unit,
      quantity: (r: QuantityRow) => r.quantity,
    }),
    [],
  );

  const {
    searchInput,
    setSearchInput,
    sortKey,
    sortDir,
    toggleSort,
    paginated: paginatedQuantities,
    setPage: setQuantitiesPage,
    total: quantitiesTotal,
  } = useAdminTable({
    rows: data?.quantitiesByBidItem ?? [],
    getSearchText: (r) => `${r.code} ${r.name} ${r.unit}`,
    sortAccessors: quantitySortAccessors,
    defaultSort: { key: "code", direction: "asc" },
  });

  useEffect(() => {
    setQuantitiesPage(1);
  }, [projectId, setQuantitiesPage]);

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

  async function exportBilling() {
    if (!data) return;
    if (!data.project.billingReady) {
      toast.error("Wait for pending approvals before export");
      return;
    }
    setExporting(true);
    try {
      await apiDownload(
        billingExportPath(data.project.id),
        `${data.project.jobNumber}-billing-backup.csv`,
      );
      toast.success("Billing backup downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
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
            Approved reports:{" "}
            <strong>{project.approvedReportCount}</strong>
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
            onClick={() => void exportBilling()}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Download billing CSV
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Job information
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {project.clientName && (
            <div>
              <dt className="text-muted-foreground">Client</dt>
              <dd className="font-medium">{project.clientName}</dd>
            </div>
          )}
          {project.generalContractor && (
            <div>
              <dt className="text-muted-foreground">General contractor</dt>
              <dd className="font-medium">{project.generalContractor}</dd>
            </div>
          )}
          {project.location && (
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium">{project.location}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Division</dt>
            <dd className="font-medium">{project.division}</dd>
          </div>
          {project.contractAmount != null && (
            <div>
              <dt className="text-muted-foreground">Contract amount</dt>
              <dd className="font-medium">
                {formatCurrency(project.contractAmount)}
              </dd>
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div>
              <dt className="text-muted-foreground">Project dates</dt>
              <dd className="font-medium">
                {[project.startDate, project.endDate].filter(Boolean).join(" → ")}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {!project.billingReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-sm text-amber-950">
          Wait for pending approvals before export.
        </p>
      )}

      {can("billing.export") && project.billingReady && (
        <p className="text-xs text-muted-foreground">
          One CSV includes job info, quantity summary, daily reports log, line
          detail, and attachment links for your pay application backup.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Approved quantities by bid item</h2>
        {data.quantitiesByBidItem.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved reports yet.
          </p>
        ) : (
          <>
            <AdminTableSearch
              className="max-w-sm"
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search bid items…"
            />
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-left text-sm">
                  <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <SortableTh label="Code" sortKey="code" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Item" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Unit" sortKey="unit" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Quantity" sortKey="quantity" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {quantitiesTotal === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No bid items match your search.
                        </td>
                      </tr>
                    )}
                    {paginatedQuantities.items.map((row) => (
                      <tr key={row.code} className="border-b last:border-0">
                        <td className="px-2 py-1 font-mono text-xs">{row.code}</td>
                        <td className="px-2 py-1">{row.name}</td>
                        <td className="px-2 py-1">{row.unit}</td>
                        <td className="px-2 py-1 text-right tabular-nums font-medium">
                          {row.quantity.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={paginatedQuantities.page}
                pageSize={ADMIN_PAGE_SIZE}
                total={paginatedQuantities.total}
                onPageChange={setQuantitiesPage}
              />
            </div>
          </>
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
                    {r.crewSize != null && ` · Crew ${r.crewSize}`}
                  </span>
                </p>
                <span className="text-[10px] font-semibold uppercase text-emerald-800">
                  {r.status.replaceAll("_", " ")}
                </span>
              </div>
              {r.approvedBy && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved by {r.approvedBy.name}
                  {r.approvedAt && ` · ${r.approvedAt.slice(0, 10)}`}
                </p>
              )}
              {r.notes && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Field notes: {r.notes}
                </p>
              )}
              {r.approvalNotes && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Approval notes: {r.approvalNotes}
                </p>
              )}
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

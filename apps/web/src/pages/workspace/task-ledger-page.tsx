import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formTypeLabel, frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskProgressBar } from "@/components/task-progress-bar";

type LedgerRow = {
  id: string;
  reportId: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  submittedBy: string;
  beginSta: string | null;
  endSta: string | null;
  locationDescription: string | null;
  lineTypeCode: string | null;
  side: string | null;
  conversionFactor: number | null;
  todayQuantity: number;
  toDateQuantity: number;
  unit: string;
};

type LedgerGroup = {
  reportId: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  submittedBy: string;
  groupTotal: number;
  rows: Omit<
    LedgerRow,
    "reportId" | "reportNumber" | "reportDate" | "status" | "submittedBy"
  >[];
};

type LedgerResponse = {
  project: { id: string; jobNumber: string; name: string };
  task: {
    id: string;
    taskMaster: { code: string; name: string; unit: string; formType: string };
  };
  unit: string;
  flat: LedgerRow[];
  grouped?: LedgerGroup[];
};

const statusStyles: Record<string, string> = {
  SUBMITTED: "bg-sky-100 text-sky-900",
  RETURNED: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  APPROVED_WITH_NOTES: "bg-emerald-100 text-emerald-900",
};

function formatLocation(row: LedgerRow): string {
  if (row.beginSta && row.endSta) {
    const side = row.side ? ` (${row.side})` : "";
    return `${row.beginSta} → ${row.endSta}${side}`;
  }
  return row.locationDescription ?? "—";
}

export function TaskLedgerPage({ base }: { base: "office" | "system" }) {
  const { projectId, taskId } = useParams();
  const [search, setSearch] = useSearchParams();
  const statusFilter = search.get("status") ?? "all";
  const view = search.get("view") === "grouped" ? "grouped" : "flat";

  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const reportsBase = base === "system" ? "/system/reports" : "/office/reports";

  useEffect(() => {
    if (!projectId || !taskId) return;
    void (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ status: statusFilter, view });
        const res = await apiFetch<LedgerResponse>(
          `/api/v1/workspace-reports/projects/${projectId}/tasks/${taskId}/ledger?${q}`,
        );
        setData(res);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load ledger");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, taskId, statusFilter, view]);

  const grouped = useMemo(() => data?.grouped ?? [], [data?.grouped]);

  function setFilter(key: "status" | "view", value: string) {
    const next = new URLSearchParams(search);
    next.set(key, value);
    setSearch(next, { replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" /> Loading ledger…
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Ledger not available.</p>;
  }

  const tm = data.task.taskMaster;
  const isSta = tm.formType.startsWith("STA");

  return (
    <div className="space-y-4">
      <Link
        to={`${reportsBase}/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to project
      </Link>

      <div>
        <p className="text-xs font-medium text-muted-foreground">
          {data.project.jobNumber} · {data.project.name}
        </p>
        <h1 className="text-xl font-bold">
          #{tm.code} — {tm.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Form E026 ledger · {formTypeLabel(tm.formType)} · {data.unit}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "approved", "pending"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setFilter("status", s)}
          >
            {s === "all" ? "All" : s === "approved" ? "Approved" : "Pending"}
          </Button>
        ))}
        <span className="mx-1 w-px self-stretch bg-border" />
        <Button
          size="sm"
          variant={view === "flat" ? "default" : "outline"}
          onClick={() => setFilter("view", "flat")}
        >
          Flat (E026)
        </Button>
        <Button
          size="sm"
          variant={view === "grouped" ? "default" : "outline"}
          onClick={() => setFilter("view", "grouped")}
        >
          By report
        </Button>
      </div>

      {view === "flat" ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Location</th>
                {isSta && <th className="px-3 py-2">Line type</th>}
                {isSta && <th className="px-3 py-2">CF</th>}
                <th className="px-3 py-2 text-right">Today</th>
                <th className="px-3 py-2 text-right">To date</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.flat.length === 0 ? (
                <tr>
                  <td
                    colSpan={isSta ? 7 : 5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No entries for this filter.
                  </td>
                </tr>
              ) : (
                data.flat.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2">{row.reportDate}</td>
                    <td className="px-3 py-2">{formatLocation(row)}</td>
                    {isSta && (
                      <td className="px-3 py-2">{row.lineTypeCode ?? "—"}</td>
                    )}
                    {isSta && (
                      <td className="px-3 py-2">
                        {row.conversionFactor != null ? row.conversionFactor : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-medium">
                      {row.todayQuantity.toLocaleString()} {row.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-800">
                      {row.toDateQuantity.toLocaleString()} {row.unit}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          statusStyles[row.status] ?? "bg-muted",
                        )}
                      >
                        {frdStatusLabels[row.status as keyof typeof frdStatusLabels] ??
                          row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No report groups for this filter.</p>
          ) : (
            grouped.map((g) => (
              <div key={g.reportId} className="rounded-lg border">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                  <div>
                    <p className="font-semibold">{g.reportNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.reportDate} · {g.submittedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {g.groupTotal.toLocaleString()} {data.unit}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusStyles[g.status] ?? "bg-muted",
                      )}
                    >
                      {frdStatusLabels[g.status as keyof typeof frdStatusLabels] ??
                        g.status}
                    </span>
                  </div>
                </div>
                <ul className="divide-y px-3 py-1 text-sm">
                  {g.rows.map((row) => (
                    <li key={row.id} className="flex justify-between gap-2 py-2">
                      <span>{formatLocation(row as LedgerRow)}</span>
                      <span className="shrink-0 font-medium">
                        {row.todayQuantity.toLocaleString()} {row.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

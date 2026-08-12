import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { ReportHistoryCard } from "@/components/report-history-card";
import { ScrollableText } from "@/components/scrollable-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReportDetail = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  crewSize: number | null;
  notes: string | null;
  returnComment: string | null;
  approvalNotes: string | null;
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
  };
  submittedBy: { name: string; email: string };
  approvedBy: { name: string; email: string } | null;
  lineItems: {
    id: string;
    entryType: string;
    beginSta: string | null;
    endSta: string | null;
    locationDescription: string | null;
    symbolItemType: string | null;
    finalQuantity: number;
    taskMaster: { code: string; name: string; unit: string };
  }[];
  attachments: {
    id: string;
    fileName: string;
    category: string;
    storageUrl: string;
    fileType: string;
  }[];
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800",
  SUBMITTED: "bg-sky-100 text-sky-900",
  RETURNED: "bg-red-100 text-red-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  APPROVED_WITH_NOTES: "bg-emerald-100 text-emerald-800",
};

export function WorkspaceReportViewPage({
  base,
}: {
  base: "office" | "system";
}) {
  const { projectId, reportId } = useParams();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ report: ReportDetail }>(
          `/api/v1/workspace-reports/reports/${reportId}`,
        );
        setReport(data.report);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    })();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-sky-800" />
        Loading report…
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link to={`/${base}/reports/${projectId ?? ""}`}>
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const statusLabel =
    frdStatusLabels[report.status as keyof typeof frdStatusLabels] ??
    report.status.replaceAll("_", " ");
  const backProjectId = projectId ?? report.project.id;

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <Button asChild variant="outline" size="sm">
        <Link to={`/${base}/reports/${backProjectId}`}>
          <ArrowLeft className="size-4" /> Project reports
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{report.reportNumber}</h1>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase",
              statusStyles[report.status] ?? "bg-muted",
            )}
          >
            {statusLabel}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            View only
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {report.project.jobNumber} — {report.project.name}
        </p>
      </div>

      <ReportHistoryCard
        report={{
          id: report.id,
          reportNumber: report.reportNumber,
          reportDate: report.reportDate,
          status: report.status,
          lineCount: report.lineItems.length,
          returnComment: report.returnComment,
          submittedBy: report.submittedBy,
          approvedBy: report.approvedBy,
        }}
      />

      {report.approvalNotes && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
            Approval notes
          </p>
          <ScrollableText maxHeight="max-h-24" className="mt-1 text-emerald-950">
            {report.approvalNotes}
          </ScrollableText>
        </div>
      )}

      {report.notes && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Field notes
          </p>
          <ScrollableText maxHeight="max-h-24" className="mt-1">
            {report.notes}
          </ScrollableText>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Quantities submitted</h2>
        <ul className="space-y-2">
          {report.lineItems.map((li) => (
            <li
              key={li.id}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">
                    {li.taskMaster.code}
                  </p>
                  <p className="font-medium leading-snug">{li.taskMaster.name}</p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {li.beginSta && li.endSta
                      ? `${li.beginSta} → ${li.endSta}`
                      : null}
                    {li.locationDescription ? li.locationDescription : null}
                    {li.symbolItemType ? ` · ${li.symbolItemType}` : null}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums font-semibold">
                  {li.finalQuantity.toLocaleString()} {li.taskMaster.unit}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {report.attachments.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Attachments</h2>
          <ul className="space-y-1.5">
            {report.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.storageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate font-medium">{a.fileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {a.category}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

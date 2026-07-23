import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { frdStatusLabels } from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/auth/auth-context";
import { markFieldReportSeen, notifyPendingQueueRefresh } from "@/lib/activity-seen";
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
  submittedAt: string | null;
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
  lineItems: {
    id: string;
    projectTaskId: string;
    entryType: string;
    beginSta: string | null;
    endSta: string | null;
    finalQuantity: number;
    locationDescription: string | null;
    symbolItemType: string | null;
    projectTask: {
      taskMaster: {
        code: string;
        name: string;
        unit: string;
      };
    };
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
  DRAFT: "bg-slate-100 text-slate-700",
  RETURNED: "bg-amber-100 text-amber-900",
  SUBMITTED: "bg-sky-100 text-sky-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  APPROVED_WITH_NOTES: "bg-emerald-100 text-emerald-900",
};

export function FieldReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ report: ReportDetail }>(
          `/api/v1/field/reports/${reportId}`,
        );
        setReport(data.report);
        markFieldReportSeen(user?.id, data.report);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [reportId, user?.id]);

  const editable =
    report?.status === "DRAFT" || report?.status === "RETURNED";

  async function submitReport() {
    if (!report || !editable) return;
    if (!report.lineItems.length) {
      toast.error("Add quantities before submit", { id: "field-report" });
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiFetch<{ report: ReportDetail }>(
        `/api/v1/field/reports/${report.id}/submit`,
        { method: "POST" },
      );
      setReport(data.report);
      notifyPendingQueueRefresh();
      toast.success(`Submitted ${data.report.reportNumber}`, {
        id: "field-report",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed", {
        id: "field-report",
      });
    } finally {
      setSubmitting(false);
    }
  }

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
      <div className="space-y-2">
        <Link
          to="/field/reports"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Reports
        </Link>
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const statusLabel =
    frdStatusLabels[report.status as keyof typeof frdStatusLabels] ??
    report.status.replaceAll("_", " ");

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/field/reports"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Reports
      </Link>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
            {report.reportNumber}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide",
              statusStyles[report.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
        </div>
        <h1 className="text-base font-semibold leading-snug sm:text-lg">
          {report.project.jobNumber} — {report.project.name}
        </h1>
        <p className="text-xs text-muted-foreground">
          {report.reportDate}
          {report.crewSize != null ? ` · Crew ${report.crewSize}` : ""}
          {report.project.location ? ` · ${report.project.location}` : ""}
        </p>
      </div>

      {report.status === "RETURNED" && report.returnComment && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">
            Returned for correction
            {report.returnedBy ? ` by ${report.returnedBy.name}` : ""}
          </p>
          <p className="mt-1 text-xs">{report.returnComment}</p>
        </div>
      )}

      {(report.status === "APPROVED" ||
        report.status === "APPROVED_WITH_NOTES") &&
        report.approvedBy && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            <p className="font-medium">
              Approved by {report.approvedBy.name}
            </p>
            {report.approvedAt && (
              <p className="mt-0.5 text-xs text-emerald-800/80">
                {new Date(report.approvedAt).toLocaleString()}
              </p>
            )}
            {report.approvalNotes && (
              <p className="mt-1 text-xs">{report.approvalNotes}</p>
            )}
          </div>
        )}

      {report.approvalNotes &&
        report.status !== "APPROVED" &&
        report.status !== "APPROVED_WITH_NOTES" && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Approval notes
          </p>
          <p className="mt-1">{report.approvalNotes}</p>
        </div>
      )}

      {report.notes && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Field notes
          </p>
          <p className="mt-1">{report.notes}</p>
        </div>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Line items
        </p>
        {report.lineItems.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No quantities yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.lineItems.map((li) => {
              const tm = li.projectTask.taskMaster;
              return (
                <li
                  key={li.id}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">
                        {tm.code}
                      </p>
                      <p className="font-medium">{tm.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {li.entryType.replaceAll("_", " ")}
                        {li.beginSta && li.endSta
                          ? ` · ${li.beginSta} → ${li.endSta}`
                          : ""}
                        {li.locationDescription
                          ? ` · ${li.locationDescription}`
                          : ""}
                        {li.symbolItemType ? ` · ${li.symbolItemType}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular-nums font-semibold">
                        {li.finalQuantity.toLocaleString()} {tm.unit}
                      </p>
                      {editable && (
                        <button
                          type="button"
                          className="mt-1 text-[11px] font-medium text-sky-800 underline"
                          onClick={() =>
                            navigate(
                              `/field/projects/${report.project.id}/tasks/${li.projectTaskId}?reportId=${report.id}`,
                            )
                          }
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {report.attachments.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attachments
          </p>
          <ul className="space-y-1.5">
            {report.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.storageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-muted/40"
                >
                  <Paperclip className="size-3.5 text-muted-foreground" />
                  <span className="truncate font-medium">{a.fileName}</span>
                  <span className="text-muted-foreground">{a.category}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editable && (
        <div className="sticky bottom-0 z-10 -mx-1 space-y-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => navigate(`/field/projects/${report.project.id}`)}
          >
            {report.lineItems.length
              ? "Continue editing tasks"
              : "Enter quantities"}
          </Button>
          <Button
            type="button"
            className="h-11 w-full bg-sky-800 text-white hover:bg-sky-900"
            disabled={submitting || report.lineItems.length === 0}
            onClick={() => void submitReport()}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : report.status === "RETURNED" ? (
              "Resubmit for approval"
            ) : (
              "Submit for approval"
            )}
          </Button>
        </div>
      )}

      {!editable && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
          This report is locked ({statusLabel.toLowerCase()}).
        </p>
      )}
    </div>
  );
}

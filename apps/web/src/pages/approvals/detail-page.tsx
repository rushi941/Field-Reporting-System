import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import {
  approveReportSchema,
  approveWithNotesSchema,
  returnReportSchema,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ApprovalDetail = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  notes: string | null;
  crewSize: number | null;
  ageLabel?: string;
  ageHours?: number;
  project: {
    jobNumber: string;
    name: string;
    location: string | null;
  };
  submittedBy: { name: string; email: string };
  lineItems: {
    id: string;
    finalQuantity: number;
    entryType: string;
    beginSta: string | null;
    endSta: string | null;
    locationDescription: string | null;
    symbolItemType: string | null;
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

export function ApprovalsDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [mode, setMode] = useState<"idle" | "notes" | "return">("idle");
  const [notes, setNotes] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    if (!reportId) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ report: ApprovalDetail }>(
          `/api/v1/approvals/${reportId}`,
        );
        setReport(data.report);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [reportId]);

  async function approve() {
    if (!report) return;
    setActing(true);
    try {
      const body = approveReportSchema.parse({});
      await apiFetch(`/api/v1/approvals/${report.id}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Report approved", { id: "approval-action" });
      navigate("/approvals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
    }
  }

  async function approveWithNotes() {
    if (!report) return;
    const parsed = approveWithNotesSchema.safeParse({ notes });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Notes required";
      setFieldError(msg);
      toast.error(msg, { id: "approval-action" });
      return;
    }
    setFieldError(undefined);
    setActing(true);
    try {
      await apiFetch(`/api/v1/approvals/${report.id}/approve-with-notes`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Approved with notes", { id: "approval-action" });
      navigate("/approvals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
    }
  }

  async function returnReport() {
    if (!report) return;
    const parsed = returnReportSchema.safeParse({ comment: returnComment });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Comment required";
      setFieldError(msg);
      toast.error(msg, { id: "approval-action" });
      return;
    }
    setFieldError(undefined);
    setActing(true);
    try {
      await apiFetch(`/api/v1/approvals/${report.id}/return`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Returned for correction", { id: "approval-action" });
      navigate("/approvals");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Return failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
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
          to="/approvals"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Queue
        </Link>
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const pending = report.status === "SUBMITTED";

  return (
    <div className="space-y-4 pb-8">
      <Link
        to="/approvals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {report.reportNumber}
          </p>
          <h1 className="mt-1 break-words text-lg font-semibold">
            {report.project.jobNumber} — {report.project.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {report.submittedBy.name} · {report.reportDate}
            {report.crewSize != null ? ` · Crew ${report.crewSize}` : ""}
            {report.project.location ? ` · ${report.project.location}` : ""}
          </p>
        </div>
        {pending && report.ageLabel && (
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-900">
            Age {report.ageLabel}
          </span>
        )}
      </div>

      {report.notes && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            Field notes
          </p>
          <p className="mt-1">{report.notes}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bid items / quantities
        </p>
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
                  <p className="break-words font-medium">{li.taskMaster.name}</p>
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
                <p className="shrink-0 tabular-nums font-semibold">
                  {li.finalQuantity.toLocaleString()} {li.taskMaster.unit}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {report.attachments.length > 0 && (
        <div className="space-y-2">
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
        </div>
      )}

      {pending && (
        <div className="space-y-3 border-t border-border pt-4">
          {mode === "idle" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                variant="outline"
                className="h-11 border-amber-300 text-amber-950 hover:bg-amber-50"
                disabled={acting}
                onClick={() => {
                  setMode("return");
                  setFieldError(undefined);
                }}
              >
                Return
              </Button>
              <Button
                variant="outline"
                className="h-11"
                disabled={acting}
                onClick={() => {
                  setMode("notes");
                  setFieldError(undefined);
                }}
              >
                Approve with notes
              </Button>
              <Button
                className="h-11 bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={acting}
                onClick={() => void approve()}
              >
                {acting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          )}

          {mode === "notes" && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="approval-notes">Approval notes</Label>
              <textarea
                id="approval-notes"
                className={cn(
                  "min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  fieldError && "border-destructive",
                )}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setFieldError(undefined);
                }}
                placeholder="Required notes for this approval…"
              />
              {fieldError && (
                <p className="text-[11px] text-destructive" role="alert">
                  {fieldError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={acting}
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </Button>
                <Button
                  disabled={acting}
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                  onClick={() => void approveWithNotes()}
                >
                  {acting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Confirm approve with notes"
                  )}
                </Button>
              </div>
            </div>
          )}

          {mode === "return" && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <Label htmlFor="return-comment">Return comment (required)</Label>
              <textarea
                id="return-comment"
                className={cn(
                  "min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  fieldError && "border-destructive",
                )}
                value={returnComment}
                onChange={(e) => {
                  setReturnComment(e.target.value);
                  setFieldError(undefined);
                }}
                placeholder="What needs to be corrected…"
              />
              {fieldError && (
                <p className="text-[11px] text-destructive" role="alert">
                  {fieldError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={acting}
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </Button>
                <Button
                  disabled={acting}
                  className="bg-amber-700 text-white hover:bg-amber-800"
                  onClick={() => void returnReport()}
                >
                  {acting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Send back to field lead"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!pending && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
          This report is {report.status.replaceAll("_", " ").toLowerCase()} and
          no longer pending.
        </p>
      )}
    </div>
  );
}

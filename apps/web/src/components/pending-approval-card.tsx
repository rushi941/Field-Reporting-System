import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CornerDownLeft,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  approveReportSchema,
  approveWithNotesSchema,
  returnReportSchema,
  TEXT_NOTE_MAX_LENGTH,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { ActivityDot } from "@/components/activity-dot";
import { CharLimitHint } from "@/components/char-limit-hint";
import { ScrollableText } from "@/components/scrollable-text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { noteTextareaClassName } from "@/lib/text-field-styles";

export type PendingReportSummary = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  submittedAt: string | null;
  lineCount: number;
  attachmentCount: number;
  ageLabel: string;
  ageHours: number;
  division?: string;
  project: {
    id: string;
    jobNumber: string;
    name: string;
    location: string | null;
    division?: string;
  };
  submittedBy: { id: string; name: string; email: string };
};

type ApprovalDetail = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  notes: string | null;
  crewSize: number | null;
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

const divisionBadge: Record<string, string> = {
  PAVEMENT_MARKING: "bg-sky-100 text-sky-900",
  TRAFFIC_CONTROL: "bg-amber-100 text-amber-900",
  PERMANENT_SIGNS: "bg-violet-100 text-violet-900",
  MISCELLANEOUS: "bg-muted text-muted-foreground",
};

const divisionShort: Record<string, string> = {
  PAVEMENT_MARKING: "PM",
  TRAFFIC_CONTROL: "TC",
  PERMANENT_SIGNS: "PS",
  MISCELLANEOUS: "Misc",
};

function shortPersonName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return full;
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

function formatQueueDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

function projectTitle(report: PendingReportSummary): string {
  const p = report.project;
  if (p.location) return `${p.name} — ${p.location}`;
  return `${p.jobNumber} — ${p.name}`;
}

type PendingApprovalCardProps = {
  report: PendingReportSummary;
  expanded: boolean;
  unread: boolean;
  canApprove: boolean;
  canEditSubmitted: boolean;
  onToggle: () => void;
  onSeen: () => void;
  onActionComplete: () => void;
};

export function PendingApprovalCard({
  report,
  expanded,
  unread,
  canApprove,
  canEditSubmitted,
  onToggle,
  onSeen,
  onActionComplete,
}: PendingApprovalCardProps) {
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [acting, setActing] = useState(false);
  const [mode, setMode] = useState<"idle" | "return" | "notes" | "edit">("idle");
  const [returnComment, setReturnComment] = useState("");
  const [notes, setNotes] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCrewSize, setEditCrewSize] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const division =
    report.division ?? report.project.division ?? "PAVEMENT_MARKING";
  const divLabel = divisionShort[division] ?? division.slice(0, 2);
  const stale = report.ageHours >= 24;

  useEffect(() => {
    if (!expanded) {
      setMode("idle");
      setFieldError(undefined);
      setConfirmDelete(false);
    }
  }, [expanded]);

  async function loadDetailIfNeeded() {
    if (detail || loadingDetail) return detail;
    setLoadingDetail(true);
    try {
      const data = await apiFetch<{ report: ApprovalDetail }>(
        `/api/v1/approvals/${report.id}`,
      );
      setDetail(data.report);
      onSeen();
      return data.report;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
      return null;
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleToggle() {
    if (!expanded) {
      await loadDetailIfNeeded();
    } else {
      setMode("idle");
      setFieldError(undefined);
    }
    onToggle();
  }

  async function approve() {
    setActing(true);
    try {
      const body = approveReportSchema.parse({});
      await apiFetch(`/api/v1/approvals/${report.id}/approve`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Report approved", { id: "approval-action" });
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
    }
  }

  async function approveWithNotes() {
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
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
    }
  }

  async function returnReport() {
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
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Return failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
    }
  }

  async function saveEdit() {
    if (!detail) return;
    setActing(true);
    try {
      const body: Record<string, unknown> = {};
      if (editNotes.trim() !== (detail.notes ?? "")) {
        body.notes = editNotes.trim() || null;
      }
      const crewNum = editCrewSize ? parseInt(editCrewSize, 10) : null;
      if (crewNum !== detail.crewSize) body.crewSize = crewNum;

      const data = await apiFetch<{ report: ApprovalDetail }>(
        `/api/v1/approvals/${report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setDetail(data.report);
      toast.success("Report updated", { id: "approval-action" });
      setMode("idle");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed", {
        id: "approval-action",
      });
    } finally {
      setActing(false);
    }
  }

  async function deleteReport() {
    setActing(true);
    try {
      await apiFetch(`/api/v1/approvals/${report.id}`, { method: "DELETE" });
      toast.success("Report deleted", { id: "approval-action" });
      onActionComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed", {
        id: "approval-action",
      });
      setActing(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-sm transition",
        expanded && "border-sky-300 ring-1 ring-sky-200",
      )}
    >
      <button
        type="button"
        className={cn(
          "w-full px-4 py-3.5 text-left transition",
          expanded ? "bg-sky-50/80" : "hover:bg-muted/30",
        )}
        onClick={() => void handleToggle()}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {unread && !expanded && <ActivityDot inline label="New" />}
            <p className="text-sm font-bold text-sky-900">
              {report.reportNumber}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stale && !expanded && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-700">
                <AlertTriangle className="size-3.5" />
                {report.ageLabel} ago
              </span>
            )}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                divisionBadge[division] ?? divisionBadge.MISCELLANEOUS,
              )}
            >
              {divLabel}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
        </div>

        <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
          {projectTitle(report)}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          <span className="text-foreground/80">Lead:</span>{" "}
          {shortPersonName(report.submittedBy.name)}
          <span> · </span>
          {formatQueueDate(report.reportDate)}
          <span> · </span>
          {report.lineCount} bid item{report.lineCount === 1 ? "" : "s"}
          {report.attachmentCount > 0 && (
            <>
              <span> · </span>
              {report.attachmentCount} file
              {report.attachmentCount === 1 ? "" : "s"}
            </>
          )}
        </p>
      </button>

      {expanded && (
        <div className="border-t border-sky-100 bg-card px-4 pb-4 pt-3">
          {loadingDetail && !detail ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading quantities…
            </div>
          ) : detail ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Review submitted quantities before approving.
              </p>

              {detail.notes && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Field notes
                  </p>
                  <ScrollableText className="mt-1 text-sm">{detail.notes}</ScrollableText>
                </div>
              )}

              <ul className="space-y-1.5">
                {detail.lineItems.map((li) => (
                  <li
                    key={li.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {li.taskMaster.code}
                      </p>
                      <p className="font-medium leading-snug">
                        {li.taskMaster.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {li.beginSta && li.endSta
                          ? `${li.beginSta} → ${li.endSta}`
                          : null}
                        {li.locationDescription
                          ? li.locationDescription
                          : null}
                        {li.symbolItemType ? ` · ${li.symbolItemType}` : null}
                      </p>
                    </div>
                    <p className="shrink-0 tabular-nums font-semibold">
                      {li.finalQuantity.toLocaleString()} {li.taskMaster.unit}
                    </p>
                  </li>
                ))}
              </ul>

              {detail.attachments.length > 0 && (
                <ul className="space-y-1">
                  {detail.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.storageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-muted/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Paperclip className="size-3.5 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {a.fileName}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {canEditSubmitted && mode === "idle" && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={acting}
                    onClick={() => {
                      setEditNotes(detail.notes ?? "");
                      setEditCrewSize(
                        detail.crewSize != null ? String(detail.crewSize) : "",
                      );
                      setMode("edit");
                    }}
                  >
                    <Pencil className="mr-1.5 size-3.5" />
                    Edit
                  </Button>
                  {!confirmDelete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={acting}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="mr-1.5 size-3.5" />
                      Delete
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-red-700">
                        Delete this report?
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={acting}
                        className="bg-red-700 text-white hover:bg-red-800"
                        onClick={() => void deleteReport()}
                      >
                        {acting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Yes, delete"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={acting}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {canEditSubmitted && mode === "edit" && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-semibold">Edit report</p>
                  <div className="space-y-1">
                    <Label htmlFor={`edit-notes-${report.id}`}>Field notes</Label>
                    <textarea
                      id={`edit-notes-${report.id}`}
                      className={noteTextareaClassName}
                      value={editNotes}
                      maxLength={TEXT_NOTE_MAX_LENGTH}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Optional notes…"
                    />
                    <CharLimitHint value={editNotes} max={TEXT_NOTE_MAX_LENGTH} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`edit-crew-${report.id}`}>Crew size</Label>
                    <input
                      id={`edit-crew-${report.id}`}
                      type="number"
                      min={1}
                      max={999}
                      className="w-32 rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={editCrewSize}
                      onChange={(e) => setEditCrewSize(e.target.value)}
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={acting}
                      onClick={() => setMode("idle")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={acting}
                      className="bg-sky-700 text-white hover:bg-sky-800"
                      onClick={() => void saveEdit()}
                    >
                      {acting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {canApprove && (
                <div className="space-y-2 pt-1">
                  {mode === "idle" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                          disabled={acting}
                          onClick={() => {
                            setMode("return");
                            setFieldError(undefined);
                          }}
                        >
                          <CornerDownLeft className="size-4" />
                          Return
                        </Button>
                        <Button
                          type="button"
                          className="h-12 bg-emerald-700 text-white hover:bg-emerald-800"
                          disabled={acting}
                          onClick={() => void approve()}
                        >
                          {acting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="size-4" />
                              Approve
                            </>
                          )}
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        disabled={acting}
                        onClick={() => {
                          setMode("notes");
                          setFieldError(undefined);
                        }}
                      >
                        Approve with notes
                      </button>
                    </>
                  )}

                  {mode === "return" && (
                    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <Label htmlFor={`return-${report.id}`}>
                        Return comment (required)
                      </Label>
                      <textarea
                        id={`return-${report.id}`}
                        className={cn(
                          noteTextareaClassName,
                          fieldError && "border-destructive",
                        )}
                        value={returnComment}
                        maxLength={TEXT_NOTE_MAX_LENGTH}
                        onChange={(e) => {
                          setReturnComment(e.target.value);
                          setFieldError(undefined);
                        }}
                        placeholder="What needs to be corrected…"
                      />
                      <CharLimitHint value={returnComment} max={TEXT_NOTE_MAX_LENGTH} />
                      {fieldError && (
                        <p className="text-[11px] text-destructive" role="alert">
                          {fieldError}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acting}
                          onClick={() => setMode("idle")}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="bg-amber-700 text-white hover:bg-amber-800"
                          disabled={acting}
                          onClick={() => void returnReport()}
                        >
                          {acting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Send back"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {mode === "notes" && (
                    <div className="space-y-2 rounded-lg border p-3">
                      <Label htmlFor={`notes-${report.id}`}>
                        Approval notes
                      </Label>
                      <textarea
                        id={`notes-${report.id}`}
                        className={cn(
                          noteTextareaClassName,
                          fieldError && "border-destructive",
                        )}
                        value={notes}
                        maxLength={TEXT_NOTE_MAX_LENGTH}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          setFieldError(undefined);
                        }}
                        placeholder="Required notes for this approval…"
                      />
                      <CharLimitHint value={notes} max={TEXT_NOTE_MAX_LENGTH} />
                      {fieldError && (
                        <p className="text-[11px] text-destructive" role="alert">
                          {fieldError}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={acting}
                          onClick={() => setMode("idle")}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="bg-emerald-700 text-white hover:bg-emerald-800"
                          disabled={acting}
                          onClick={() => void approveWithNotes()}
                        >
                          {acting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              Could not load report details.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

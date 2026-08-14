import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CornerDownLeft,
  Loader2,
} from "lucide-react";
import {
  approveReportSchema,
  approveWithNotesSchema,
  resolveLineTypeLabel,
  returnReportSchema,
  TEXT_NOTE_MAX_LENGTH,
} from "@frs/shared";
import { apiFetch } from "@/lib/api";
import { ActivityDot } from "@/components/activity-dot";
import { CharLimitHint } from "@/components/char-limit-hint";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { noteTextareaClassName } from "@/lib/text-field-styles";
import type { PendingTaskGroup } from "@/lib/group-pending-tasks";

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

function formatEntryDetail(li: {
  beginSta: string | null;
  endSta: string | null;
  locationDescription: string | null;
  symbolItemType: string | null;
  lineTypeCode?: string | null;
  lineTypeLabel?: string | null;
}): { title: string; work: string | null } {
  const lineType =
    li.lineTypeLabel?.trim() || resolveLineTypeLabel(li.lineTypeCode);
  const sta =
    li.beginSta && li.endSta ? `${li.beginSta} → ${li.endSta}` : null;
  const extra = [li.locationDescription, li.symbolItemType]
    .filter(Boolean)
    .join(" · ");

  if (lineType) {
    return {
      title: lineType,
      work: [sta, extra].filter(Boolean).join(" · ") || null,
    };
  }
  if (sta) {
    return { title: sta, work: extra || null };
  }
  if (extra) {
    return { title: extra, work: null };
  }
  return { title: "Entry", work: null };
}

type PendingTaskCardProps = {
  group: PendingTaskGroup;
  expanded: boolean;
  unread: boolean;
  canApprove: boolean;
  onToggle: () => void;
  onSeen: () => void;
  onActionComplete: () => void;
};

export function PendingTaskCard({
  group,
  expanded,
  unread,
  canApprove,
  onToggle,
  onSeen,
  onActionComplete,
}: PendingTaskCardProps) {
  const [actingId, setActingId] = useState<string | null>(null);
  const [modeByReport, setModeByReport] = useState<
    Record<string, "idle" | "return" | "notes">
  >({});
  const [returnComment, setReturnComment] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();

  const divLabel = divisionShort[group.division] ?? group.division.slice(0, 2);
  const stale = group.ageHours >= 24;
  const reportLabel =
    group.reportCount === 1
      ? "1 report"
      : `${group.reportCount} reports`;
  const leads = [
    ...new Set(
      group.reports.map((s) => shortPersonName(s.report.submittedBy.name)),
    ),
  ].join(", ");

  useEffect(() => {
    if (!expanded) {
      setModeByReport({});
      setFieldError(undefined);
      setReturnComment("");
      setNotes("");
    }
  }, [expanded]);

  function setMode(reportId: string, mode: "idle" | "return" | "notes") {
    setModeByReport((prev) => ({ ...prev, [reportId]: mode }));
    setFieldError(undefined);
  }

  async function approve(reportId: string) {
    setActingId(reportId);
    try {
      const body = approveReportSchema.parse({});
      await apiFetch(`/api/v1/approvals/${reportId}/approve`, {
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
      setActingId(null);
    }
  }

  async function approveWithNotes(reportId: string) {
    const parsed = approveWithNotesSchema.safeParse({ notes });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Notes required";
      setFieldError(msg);
      toast.error(msg, { id: "approval-action" });
      return;
    }
    setFieldError(undefined);
    setActingId(reportId);
    try {
      await apiFetch(`/api/v1/approvals/${reportId}/approve-with-notes`, {
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
      setActingId(null);
    }
  }

  async function returnReport(reportId: string) {
    const parsed = returnReportSchema.safeParse({ comment: returnComment });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Comment required";
      setFieldError(msg);
      toast.error(msg, { id: "approval-action" });
      return;
    }
    setFieldError(undefined);
    setActingId(reportId);
    try {
      await apiFetch(`/api/v1/approvals/${reportId}/return`, {
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
      setActingId(null);
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
        onClick={() => {
          if (!expanded) onSeen();
          onToggle();
        }}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {unread && !expanded && <ActivityDot inline label="New" />}
            <p className="font-mono text-sm font-bold text-sky-900">
              {group.code}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stale && !expanded && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-700">
                <AlertTriangle className="size-3.5" />
                {group.ageLabel} ago
              </span>
            )}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                divisionBadge[group.division] ?? divisionBadge.MISCELLANEOUS,
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
          {group.name}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          <span className="tabular-nums font-semibold text-foreground">
            {group.totalQty.toLocaleString()} {group.unit}
          </span>
          <span> · </span>
          {reportLabel}
          {group.entryCount > group.reportCount ? (
            <>
              <span> · </span>
              {group.entryCount} entries
            </>
          ) : null}
          <span> · </span>
          Lead: {leads}
        </p>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-sky-100 bg-card px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">
            All pending submissions for this bid item. Approve or return each
            daily report below.
          </p>

          {group.reports.map((slice) => {
            const reportId = slice.report.id;
            const mode = modeByReport[reportId] ?? "idle";
            const acting = actingId === reportId;
            return (
              <div
                key={reportId}
                className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
              >
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {slice.report.reportNumber}
                  </span>
                  <span> · </span>
                  {shortPersonName(slice.report.submittedBy.name)}
                  <span> · </span>
                  {formatQueueDate(slice.report.reportDate)}
                </p>

                <ul className="space-y-2">
                  {slice.entries.map((li) => {
                    const detail = formatEntryDetail(li);
                    return (
                      <li
                        key={li.id}
                        className="flex items-start justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium leading-snug text-foreground">
                            {detail.title}
                          </p>
                          {detail.work ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {detail.work}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 tabular-nums font-semibold">
                          {li.finalQuantity.toLocaleString()} {group.unit}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {canApprove && (
                  <div className="space-y-2 pt-1">
                    {mode === "idle" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                            disabled={Boolean(actingId)}
                            onClick={() => setMode(reportId, "return")}
                          >
                            <CornerDownLeft className="size-4" />
                            Return
                          </Button>
                          <Button
                            type="button"
                            className="h-10 bg-emerald-700 text-white hover:bg-emerald-800"
                            disabled={Boolean(actingId)}
                            onClick={() => void approve(reportId)}
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
                          disabled={Boolean(actingId)}
                          onClick={() => setMode(reportId, "notes")}
                        >
                          Approve with notes
                        </button>
                      </>
                    )}

                    {mode === "return" && (
                      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <Label htmlFor={`return-${reportId}`}>
                          Return comment (required)
                        </Label>
                        <textarea
                          id={`return-${reportId}`}
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
                        <CharLimitHint
                          value={returnComment}
                          max={TEXT_NOTE_MAX_LENGTH}
                        />
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
                            onClick={() => setMode(reportId, "idle")}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="bg-amber-700 text-white hover:bg-amber-800"
                            disabled={acting}
                            onClick={() => void returnReport(reportId)}
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
                        <Label htmlFor={`notes-${reportId}`}>
                          Approval notes
                        </Label>
                        <textarea
                          id={`notes-${reportId}`}
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
                            onClick={() => setMode(reportId, "idle")}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="bg-emerald-700 text-white hover:bg-emerald-800"
                            disabled={acting}
                            onClick={() => void approveWithNotes(reportId)}
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
            );
          })}
        </div>
      )}
    </div>
  );
}

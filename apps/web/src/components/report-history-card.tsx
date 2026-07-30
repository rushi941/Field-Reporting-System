import { Link } from "react-router-dom";
import { Check, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportHistoryCardData = {
  id: string;
  reportNumber: string;
  reportDate: string;
  status: string;
  lineCount: number;
  returnComment: string | null;
  submittedBy: { name: string };
  approvedBy: { name: string } | null;
  project?: {
    jobNumber: string;
    name: string;
  };
};

function shortPersonName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return full;
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]![0]}. ${parts[parts.length - 1]}`;
}

function formatHistoryDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

function isApprovedStatus(status: string): boolean {
  return status === "APPROVED" || status === "APPROVED_WITH_NOTES";
}

type ReportHistoryCardProps = {
  report: ReportHistoryCardData;
  showProject?: boolean;
  linkTo?: string;
};

export function ReportHistoryCard({
  report,
  showProject = false,
  linkTo,
}: ReportHistoryCardProps) {
  const approved = isApprovedStatus(report.status);
  const returned = report.status === "RETURNED";
  const pending = report.status === "SUBMITTED";

  const body = (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition",
        linkTo && "hover:border-sky-300 hover:bg-sky-50/30",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 break-all text-sm font-bold text-sky-900">
          {report.reportNumber}
        </p>
        <div className="flex shrink-0 flex-col items-end gap-1">
        {approved && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            <Check className="size-3.5" strokeWidth={2.5} />
            Approved
          </span>
        )}
        {returned && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-800">
            <CornerDownLeft className="size-3.5" strokeWidth={2.5} />
            Returned
          </span>
        )}
        {pending && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-900">
            Under review
          </span>
        )}
        {!approved && !returned && !pending && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {report.status.replaceAll("_", " ")}
          </span>
        )}
        </div>
      </div>

      {showProject && report.project && (
        <p className="mt-1 break-words text-xs font-medium leading-snug text-foreground">
          {report.project.jobNumber} — {report.project.name}
        </p>
      )}

      <p className="mt-1.5 break-words text-sm text-foreground">
        <span className="text-muted-foreground">Lead:</span>{" "}
        {shortPersonName(report.submittedBy.name)}
        <span className="text-muted-foreground"> · </span>
        {formatHistoryDate(report.reportDate)}
        <span className="text-muted-foreground"> · </span>
        {report.lineCount} item{report.lineCount === 1 ? "" : "s"}
      </p>

      {approved && report.approvedBy && (
        <p className="mt-1 text-xs text-muted-foreground">
          Reviewed by {shortPersonName(report.approvedBy.name)}
        </p>
      )}

      {returned && report.returnComment && (
        <p className="mt-2.5 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-900">
          {report.returnComment}
        </p>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="block min-w-0 max-w-full">
        {body}
      </Link>
    );
  }

  return body;
}

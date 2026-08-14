import { cn } from "@/lib/utils";
import {
  computeProgressShares,
  formatProgressPercent,
  progressBarWidthPct,
} from "@/lib/task-progress-display";

type TaskProgressBarProps = {
  code: string;
  name: string;
  formLabel: string;
  unit: string;
  estimated: number;
  approved: number;
  pending: number;
  className?: string;
};

export function TaskProgressBar({
  code,
  name,
  formLabel,
  unit,
  estimated,
  approved,
  pending,
  className,
}: TaskProgressBarProps) {
  const { approvedPct, pendingPct, totalPct } = computeProgressShares(
    estimated,
    approved,
    pending,
  );
  const reported = approved + pending;
  const pctLabel = formatProgressPercent(totalPct);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-sky-800">#{code}</span>
        <span className="shrink-0 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {formLabel}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug">{name}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Est:{" "}
          <strong className="text-foreground">
            {estimated.toLocaleString()} {unit}
          </strong>
        </span>
        <span>
          Appr:{" "}
          <strong className="text-emerald-700">
            {approved.toLocaleString()}
          </strong>
        </span>
        <span>
          Pend:{" "}
          <strong className="text-amber-700">{pending.toLocaleString()}</strong>
        </span>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(totalPct * 10) / 10}
        aria-label={`${pctLabel} reported`}
      >
        {approvedPct > 0 && (
          <div
            className="h-full bg-emerald-600 transition-[width] duration-300 ease-out"
            style={{
              width: `${progressBarWidthPct(approvedPct, approved > 0)}%`,
            }}
          />
        )}
        {pendingPct > 0 && (
          <div
            className="h-full bg-amber-500 transition-[width] duration-300 ease-out"
            style={{
              width: `${progressBarWidthPct(pendingPct, pending > 0)}%`,
            }}
          />
        )}
      </div>
      {reported > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {approvedPct > 0 && pendingPct > 0
            ? `${formatProgressPercent(approvedPct)} approved · ${formatProgressPercent(pendingPct)} under review`
            : approvedPct > 0
              ? `${formatProgressPercent(approvedPct)} approved`
              : pendingPct > 0
                ? `${formatProgressPercent(pendingPct)} under review`
                : `${pctLabel} reported`}
        </p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

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
  const pct =
    estimated > 0 ? Math.min(100, Math.round((approved / estimated) * 100)) : 0;

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
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-sky-600 transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {estimated > 0 && approved > 0 && (
        <p className="text-[11px] text-muted-foreground">{pct}% approved</p>
      )}
    </div>
  );
}

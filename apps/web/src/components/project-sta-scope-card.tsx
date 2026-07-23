import { projectStaScope } from "@frs/shared";
import { cn } from "@/lib/utils";

type Props = {
  beginSta: string;
  endSta: string;
  className?: string;
  compact?: boolean;
  title?: string;
};

/** Shows project corridor start → end STA and total physical LF for field crews */
export function ProjectStaScopeCard({
  beginSta,
  endSta,
  className,
  compact = false,
  title,
}: Props) {
  let scope: { beginSta: string; endSta: string; totalLf: number };
  try {
    scope = projectStaScope(beginSta, endSta);
  } catch {
    return null;
  }

  if (compact) {
    return (
      <p
        className={cn(
          "font-mono text-[11px] text-sky-900",
          className,
        )}
      >
        Work: {scope.beginSta} → {scope.endSta} · {scope.totalLf.toLocaleString()}{" "}
        LF total
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sky-950",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
        {title ?? "Work limits"}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] font-medium uppercase text-sky-700">
            Start STA
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold">
            {scope.beginSta}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-sky-700">
            End STA
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold">
            {scope.endSta}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase text-sky-700">
            Total work
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold">
            {scope.totalLf.toLocaleString()} LF
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-sky-800">
        Enter stations between start and end only. End STA cannot go past{" "}
        <span className="font-mono font-semibold">{scope.endSta}</span>.
      </p>
    </div>
  );
}

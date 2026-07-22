import { cn } from "@/lib/utils";

/** Small red notification dot for nav icons and list rows. */
export function ActivityDot({
  className,
  label,
}: {
  className?: string;
  /** Screen reader label */
  label?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute size-2.5 rounded-full bg-red-500 ring-2 ring-card",
        className,
      )}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}

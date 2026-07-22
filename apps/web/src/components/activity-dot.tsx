import { cn } from "@/lib/utils";

/** Small red notification dot for nav icons and list rows. */
export function ActivityDot({
  className,
  label,
  inline = false,
}: {
  className?: string;
  /** Screen reader label */
  label?: string;
  /** Use in flex rows instead of absolutely positioned overlays */
  inline?: boolean;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none size-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-card",
        inline ? "relative" : "absolute",
        className,
      )}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  );
}

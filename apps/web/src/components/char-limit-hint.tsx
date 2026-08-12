import { cn } from "@/lib/utils";

export function CharLimitHint({
  value,
  max,
  className,
}: {
  value: string;
  max: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-right text-[11px] text-muted-foreground",
        value.length >= max && "text-destructive",
        className,
      )}
    >
      {value.length}/{max}
    </p>
  );
}

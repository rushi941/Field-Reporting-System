import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ScrollableTextProps = {
  children: ReactNode;
  className?: string;
  /** Tailwind max-height class, e.g. max-h-24 */
  maxHeight?: string;
};

export function ScrollableText({
  children,
  className,
  maxHeight = "max-h-24",
}: ScrollableTextProps) {
  return (
    <div
      className={cn(
        "overflow-y-auto overflow-x-hidden break-words whitespace-pre-wrap",
        maxHeight,
        className,
      )}
    >
      {children}
    </div>
  );
}

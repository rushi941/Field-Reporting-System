import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  disabled?: boolean;
  placeholder?: string;
};

export function DivisionMultiSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Select divisions",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(div: string) {
    if (value.includes(div)) {
      const next = value.filter((d) => d !== div);
      if (next.length > 0) onChange(next);
      return;
    }
    onChange([...value, div]);
  }

  const summary =
    value.length === 0
      ? placeholder
      : options
          .filter((o) => value.includes(o.value))
          .map((o) => o.label)
          .join(", ");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "truncate",
            value.length === 0 && "text-muted-foreground",
          )}
        >
          {summary}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute z-[2100] mt-1 w-full rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(opt.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-asphalt bg-asphalt text-white"
                      : "border-input bg-card",
                  )}
                >
                  {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

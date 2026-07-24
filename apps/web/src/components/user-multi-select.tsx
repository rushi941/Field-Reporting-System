import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type UserOption = { id: string; name: string; hint?: string };

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  options: UserOption[];
  disabled?: boolean;
  placeholder?: string;
  minSelected?: number;
};

export function UserMultiSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Select users",
  minSelected = 0,
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

  function toggle(id: string) {
    if (value.includes(id)) {
      const next = value.filter((v) => v !== id);
      if (next.length >= minSelected) onChange(next);
      return;
    }
    onChange([...value, id]);
  }

  const summary =
    value.length === 0
      ? placeholder
      : options
          .filter((o) => value.includes(o.id))
          .map((o) => o.name)
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
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "line-clamp-2",
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
          className="absolute z-[2100] mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
        >
          {options.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              No users available
            </p>
          ) : (
            options.map((opt) => {
              const checked = value.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(opt.id)}
                  className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-asphalt bg-asphalt text-white"
                        : "border-input bg-card",
                    )}
                  >
                    {checked ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{opt.name}</span>
                    {opt.hint ? (
                      <span className="block text-xs text-muted-foreground">
                        {opt.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type UserOption = { id: string; name: string; hint?: string };

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  options: UserOption[];
  disabled?: boolean;
  placeholder?: string;
  minSelected?: number;
};

function matchesQuery(opt: UserOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    opt.name.toLowerCase().includes(q) ||
    (opt.hint?.toLowerCase().includes(q) ?? false)
  );
}

export function UserMultiSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Select users",
  minSelected = 0,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(
    () => options.filter((opt) => matchesQuery(opt, query)),
    [options, query],
  );

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
        <div className="absolute z-[2100] mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
          </div>
          <div
            role="listbox"
            aria-multiselectable
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-sm text-muted-foreground">
                No matches
              </p>
            ) : (
              filtered.map((opt) => {
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
                      {checked ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : null}
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
        </div>
      )}
    </div>
  );
}

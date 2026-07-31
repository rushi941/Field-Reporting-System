import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { UserOption } from "@/components/user-multi-select";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: UserOption[];
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
};

function matchesQuery(opt: UserOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    opt.name.toLowerCase().includes(q) ||
    (opt.hint?.toLowerCase().includes(q) ?? false)
  );
}

export function UserSingleSelect({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Select user",
  required,
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

  const selected = options.find((o) => o.id === value);

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
          required && !value && "border-amber-300",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.name ?? placeholder}
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
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-2 text-sm text-muted-foreground">
                No matches
              </li>
            ) : (
              filtered.map((opt) => {
                const active = opt.id === value;
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(opt.id);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm hover:bg-muted",
                        active && "bg-muted/70",
                      )}
                    >
                      <span className="font-medium">{opt.name}</span>
                      {opt.hint ? (
                        <span className="text-xs text-muted-foreground">
                          {opt.hint}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

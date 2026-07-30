import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectPickerOption = {
  id: string;
  jobNumber: string;
  name: string;
  reportCount?: number;
};

type MobileProjectPickerProps = {
  label: string;
  value: string;
  allValue?: string;
  allLabel?: string;
  options: ProjectPickerOption[];
  onChange: (value: string) => void;
};

function optionMeta(
  option: ProjectPickerOption | null,
  allLabel: string,
  isAll: boolean,
) {
  if (isAll) {
    return { primary: allLabel, secondary: null as string | null };
  }
  if (!option) {
    return { primary: allLabel, secondary: null };
  }
  const count =
    option.reportCount != null
      ? `${option.reportCount} report${option.reportCount === 1 ? "" : "s"}`
      : null;
  return {
    primary: option.jobNumber,
    secondary: [option.name, count].filter(Boolean).join(" · "),
  };
}

export function MobileProjectPicker({
  label,
  value,
  allValue = "",
  allLabel = "All projects",
  options,
  onChange,
}: MobileProjectPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const isAll = value === allValue;
  const selected =
    isAll ? null : (options.find((o) => o.id === value) ?? null);
  const trigger = optionMeta(selected, allLabel, isAll);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <label htmlFor={listId} className="text-xs font-medium">
        {label}
      </label>
      <button
        id={listId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1.5 flex h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-md border border-input bg-card px-3 text-left text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate font-medium">{trigger.primary}</span>
          {trigger.secondary && (
            <span className="block truncate text-xs text-muted-foreground">
              {trigger.secondary}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute z-50 mt-1 max-h-[min(16rem,50vh)] w-full min-w-0 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          <li role="option" aria-selected={isAll}>
            <button
              type="button"
              className={cn(
                "flex w-full min-w-0 items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/60",
                isAll && "bg-sky-50 text-sky-950",
              )}
              onClick={() => pick(allValue)}
            >
              <span className="min-w-0 flex-1 break-words font-medium">
                {allLabel}
              </span>
              {isAll && (
                <Check className="mt-0.5 size-4 shrink-0 text-sky-800" />
              )}
            </button>
          </li>
          {options.map((p) => {
            const active = p.id === value;
            const meta = optionMeta(p, allLabel, false);
            return (
              <li key={p.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/60",
                    active && "bg-sky-50 text-sky-950",
                  )}
                  onClick={() => pick(p.id)}
                >
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block break-words text-sm font-medium">
                      {meta.primary}
                    </span>
                    {meta.secondary && (
                      <span className="mt-0.5 block break-words text-xs leading-snug text-muted-foreground">
                        {meta.secondary}
                      </span>
                    )}
                  </span>
                  {active && (
                    <Check className="mt-0.5 size-4 shrink-0 text-sky-800" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

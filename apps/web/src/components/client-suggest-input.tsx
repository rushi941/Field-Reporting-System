import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type ClientSuggestOption = {
  id: string;
  name: string;
  foundationNumber?: number | null;
};

type ClientSuggestInputProps = {
  value: string;
  onChange: (value: string) => void;
  options: ClientSuggestOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function ClientSuggestInput({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: ClientSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [options, value]);

  useEffect(() => {
    setHighlight(0);
  }, [value, matches.length]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        className={className}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && matches[highlight]) {
            e.preventDefault();
            pick(matches[highlight].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-border bg-card py-1 text-sm shadow-lg"
          role="listbox"
        >
          {matches.map((opt, i) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={cn(
                  "flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-muted/60",
                  i === highlight && "bg-muted/60",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt.name)}
              >
                <span className="flex-1">{opt.name}</span>
                {opt.foundationNumber != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    #{opt.foundationNumber}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

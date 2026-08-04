import { Suspense, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

export function AppBootScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background">
      <BrandLogo variant="mark" imgClassName="h-10 w-10" />
      <Loader2 className="size-5 animate-spin text-sky-800" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

/** Centered spinner for first data fetch on a page. */
export function DataPageLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-3 py-12",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-sky-800" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Full-page first load: spinner + list skeleton. */
export function InitialListLoad({
  label = "Loading…",
  rows = 4,
}: {
  label?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <DataPageLoader label={label} className="min-h-[8rem] py-6" />
      <ListPageSkeleton rows={rows} />
    </div>
  );
}

function DelayedFallback() {
  return (
    <div className="flex min-h-[8rem] flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-sky-800" />
      Loading page…
    </div>
  );
}

export function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DelayedFallback />}>{children}</Suspense>;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  );
}

export function ListPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden>
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-11 rounded-lg bg-muted" />
      <div className="space-y-2.5 pt-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-[4.5rem] rounded-xl bg-muted/80" />
        ))}
      </div>
    </div>
  );
}

export function RefreshBar({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "h-0.5 overflow-hidden rounded-full bg-sky-100 transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    >
      <div className="refresh-bar h-full w-1/3 rounded-full bg-sky-600" />
    </div>
  );
}
